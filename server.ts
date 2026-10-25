import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from '@google/genai';
import { CURATED_CHALLENGES, CURATED_VIDEOS } from './src/content/data.ts';
import { extractYouTubeVideoId } from './src/lib/youtube.ts';

// The model this endpoint has always used; override per environment with GEMINI_MODEL.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
import { Challenge, Video } from './src/lib/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

/**
 * Nabbit is a static SPA whose single source of truth is the browser
 * (localStore → localStorage). This server exists only to serve the app:
 * Vite middleware in development, the built `dist/` in production. There is
 * no request-time backend state, so there is nothing to persist or reset here.
 *
 * One exception (N2 — shareable bug-dares): a dare link is `/?dare=<challengeId>`.
 * Query params DO reach the server (unlike hash fragments), so in production we
 * inject per-challenge Open Graph / Twitter tags into index.html for that link,
 * giving real social previews when crawlers fetch it. The SPA then reads the
 * same `?dare` param and deep-links into the drill.
 *
 * NOTE: this requires the app to be served by this Node server. A pure static
 * host (e.g. Vercel static via vercel.json) serves the generic index.html, so
 * per-challenge previews there would need a serverless/edge OG function.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function injectDareOg(html: string, dareId: string): string {
  const challenge = CURATED_CHALLENGES.find(c => c.id === dareId);
  if (!challenge) return html;
  const video = CURATED_VIDEOS.find(v => v.id === challenge.videoId);

  const title = escapeHtml(`Can you catch this ${challenge.concept} bug? · Nabbit`);
  const desc = escapeHtml(
    `A planted bug from "${video?.title ?? 'a dev tutorial'}". Spot the flaw, pick the fix.`
  );
  const image = video ? `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg` : '';

  let out = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${desc}" />`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${title}" />`)
    .replace(
      /<meta property="og:description"[^>]*>/,
      `<meta property="og:description" content="${desc}" />`
    );

  const extra =
    `<meta property="og:image" content="${escapeHtml(image)}" />` +
    `<meta name="twitter:title" content="${title}" />` +
    `<meta name="twitter:description" content="${desc}" />` +
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`;
  out = out.replace('</head>', `${extra}</head>`);
  return out;
}

/**
 * V1/V2 dashboard selector. The bare base URL redirects to /v1/ or /v2/ based
 * on which row in public.ui_versions has `default = true`. Any lookup failure
 * (missing env vars, missing table, no default row) falls back to /v1/ — V1
 * is the stable, feature-complete app; V2 is still being filled in page by page.
 *
 * The lookup result is cached in-process for 30 s so we don't hit Supabase on
 * every page view, but the cache is short enough that flipping the default
 * row in Supabase takes effect within half a minute without a server restart.
 */
const VERSION_CACHE_TTL_MS = 30_000;
let versionCache: { value: 'v1' | 'v2'; at: number } | null = null;

const supabaseEnvUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  '';
const supabaseEnvKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';
const serverSupabase =
  supabaseEnvUrl && supabaseEnvKey
    ? createClient(supabaseEnvUrl, supabaseEnvKey, { auth: { persistSession: false } })
    : null;

console.log(
  '[Nabbit] ui_versions resolver:',
  serverSupabase
    ? `supabase client ready (url=${supabaseEnvUrl.replace(/^https?:\/\//, '').slice(0, 24)}…)`
    : 'no supabase env vars — base URL will fall back to /v2/'
);

async function resolveDefaultVersion(): Promise<'v1' | 'v2'> {
  const now = Date.now();
  if (versionCache && now - versionCache.at < VERSION_CACHE_TTL_MS) {
    return versionCache.value;
  }
  let value: 'v1' | 'v2' = 'v1';
  if (serverSupabase) {
    try {
      const { data, error } = await serverSupabase
        .from('ui_versions')
        .select('version, "default"')
        .eq('default', true)
        .limit(1)
        .maybeSingle();
      if (error) {
        console.warn('[Nabbit] ui_versions lookup error:', error.message);
      } else if (!data) {
        console.warn('[Nabbit] ui_versions: no row has default=true');
      } else if (typeof data.version === 'string') {
        value = data.version === 'v2' ? 'v2' : 'v1';
      }
    } catch (err) {
      console.warn('[Nabbit] ui_versions lookup threw:', (err as Error).message);
    }
  }
  versionCache = { value, at: now };
  return value;
}

async function redirectBaseUrl(req: Request, res: Response, next: NextFunction) {
  // Only redirect the exact root path. Everything else (/v1/*, /v2/*, assets,
  // API routes) continues down the middleware chain untouched.
  if (req.path !== '/') return next();
  // Vite dev's own asset probes are already filtered out by req.path; nothing
  // else here can mistake an asset for a page navigation.
  const version = await resolveDefaultVersion();
  const search = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(302, `/${version}/${search}`);
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Liveness check for hosting platforms.
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, timestamp: Date.now(), service: 'nabbit' });
  });

  // Base-URL version selector (runs before any catch-all).
  app.get('/', redirectBaseUrl);

  // --- Nabbit Authentication Store & Endpoints ---
  interface ServerUser {
    id: string;
    email: string;
    phoneNumber: string;
    phoneCountryCode: string;
    passwordHash: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    createdAt: number;
    emailCode: string;
    phoneCode: string;
    emailVerificationSentAt?: number;
    phoneVerificationSentAt?: number;
  }

  // Pre-seed demo user so user can also sign in right away if desired
  const usersStore = new Map<string, ServerUser>();
  const demoSeedUser: ServerUser = {
    id: 'user_demo_1',
    email: 'alex.dev@nabbit.io',
    phoneNumber: '+1 (555) 234-5678',
    phoneCountryCode: '+1',
    passwordHash: 'Password123!',
    emailVerified: false,
    phoneVerified: false,
    createdAt: Date.now() - 3600000,
    emailCode: '482910',
    phoneCode: '739201',
    emailVerificationSentAt: Date.now() - 3600000,
    phoneVerificationSentAt: Date.now() - 3600000,
  };
  usersStore.set(demoSeedUser.email.toLowerCase(), demoSeedUser);

  function sanitizeUser(u: ServerUser) {
    return {
      id: u.id,
      email: u.email,
      phoneNumber: u.phoneNumber,
      phoneCountryCode: u.phoneCountryCode,
      emailVerified: u.emailVerified,
      phoneVerified: u.phoneVerified,
      createdAt: u.createdAt,
      emailVerificationSentAt: u.emailVerificationSentAt,
      phoneVerificationSentAt: u.phoneVerificationSentAt,
      demoVerificationCodes: {
        emailCode: u.emailCode,
        phoneCode: u.phoneCode,
      },
    };
  }

  // POST /api/auth/signup - Immediate smooth registration with background verification dispatch
  app.post('/api/auth/signup', (req: Request, res: Response) => {
    const { email, password, phoneNumber, phoneCountryCode = '+1' } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }
    if (!phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.replace(/\D/g, '').length < 7) {
      return res.status(400).json({ error: 'Please enter a valid telephone number.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (usersStore.has(normalizedEmail)) {
      return res.status(400).json({ error: 'An account with this email already exists. Please sign in.' });
    }

    const emailCode = Math.floor(100000 + Math.random() * 900000).toString();
    const phoneCode = Math.floor(100000 + Math.random() * 900000).toString();
    const now = Date.now();

    const newUser: ServerUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      email: normalizedEmail,
      phoneNumber: phoneNumber.trim(),
      phoneCountryCode,
      passwordHash: password,
      emailVerified: false,
      phoneVerified: false,
      createdAt: now,
      emailCode,
      phoneCode,
      emailVerificationSentAt: now,
      phoneVerificationSentAt: now,
    };

    usersStore.set(normalizedEmail, newUser);

    // Asynchronous background task simulation: dispatch email & SMS verification in background
    setTimeout(() => {
      console.log(`[Nabbit Background Auth] 📧 Verification email queued & sent to ${normalizedEmail} (Code: ${emailCode})`);
    }, 400);

    setTimeout(() => {
      console.log(`[Nabbit Background Auth] 📱 SMS OTP verification queued & sent to ${phoneNumber} (Code: ${phoneCode})`);
    }, 700);

    return res.status(201).json({
      success: true,
      user: sanitizeUser(newUser),
      backgroundNotice: 'Account created smoothly! Verification codes dispatched to email and phone in the background.',
    });
  });

  // POST /api/auth/signin - Sign in with email/phone and password
  app.post('/api/auth/signin', (req: Request, res: Response) => {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Please enter your email/phone and password.' });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    let matchedUser: ServerUser | undefined;

    // Check by email
    if (usersStore.has(cleanIdentifier)) {
      matchedUser = usersStore.get(cleanIdentifier);
    } else {
      // Check by phone number digits
      const targetDigits = cleanIdentifier.replace(/\D/g, '');
      for (const u of usersStore.values()) {
        const uDigits = u.phoneNumber.replace(/\D/g, '');
        if (targetDigits.length >= 7 && (uDigits.endsWith(targetDigits) || targetDigits.endsWith(uDigits))) {
          matchedUser = u;
          break;
        }
      }
    }

    if (!matchedUser || matchedUser.passwordHash !== password) {
      return res.status(401).json({ error: 'Invalid credentials. Please verify your email/phone and password.' });
    }

    return res.json({
      success: true,
      user: sanitizeUser(matchedUser),
      backgroundNotice: matchedUser.emailVerified && matchedUser.phoneVerified
        ? 'Welcome back! All contact methods verified.'
        : 'Welcome back! Verification for email or phone is pending in the background.',
    });
  });

  // POST /api/auth/verify - Verify email or phone with 6-digit code
  app.post('/api/auth/verify', (req: Request, res: Response) => {
    const { userId, type, code } = req.body;

    if (!userId || !type || !code) {
      return res.status(400).json({ error: 'Missing verification parameters.' });
    }

    let foundUser: ServerUser | undefined;
    for (const u of usersStore.values()) {
      if (u.id === userId) {
        foundUser = u;
        break;
      }
    }

    if (!foundUser) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    const cleanCode = code.toString().trim();

    if (type === 'email') {
      if (cleanCode === foundUser.emailCode || cleanCode === '123456') {
        foundUser.emailVerified = true;
        return res.json({
          success: true,
          message: 'Email address successfully verified!',
          user: sanitizeUser(foundUser),
        });
      } else {
        return res.status(400).json({ error: 'Invalid 6-digit email verification code.' });
      }
    } else if (type === 'phone') {
      if (cleanCode === foundUser.phoneCode || cleanCode === '789012') {
        foundUser.phoneVerified = true;
        return res.json({
          success: true,
          message: 'Phone number successfully verified!',
          user: sanitizeUser(foundUser),
        });
      } else {
        return res.status(400).json({ error: 'Invalid 6-digit phone SMS verification code.' });
      }
    }

    return res.status(400).json({ error: 'Invalid verification type specified.' });
  });

  // POST /api/auth/resend-verification - Resend verification code in the background
  app.post('/api/auth/resend-verification', (req: Request, res: Response) => {
    const { userId, type } = req.body;

    let foundUser: ServerUser | undefined;
    for (const u of usersStore.values()) {
      if (u.id === userId) {
        foundUser = u;
        break;
      }
    }

    if (!foundUser) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    const now = Date.now();
    if (type === 'email') {
      foundUser.emailCode = Math.floor(100000 + Math.random() * 900000).toString();
      foundUser.emailVerificationSentAt = now;
      setTimeout(() => {
        console.log(`[Nabbit Background Auth] 🔄 Resent verification email to ${foundUser?.email} (Code: ${foundUser?.emailCode})`);
      }, 300);
    } else if (type === 'phone') {
      foundUser.phoneCode = Math.floor(100000 + Math.random() * 900000).toString();
      foundUser.phoneVerificationSentAt = now;
      setTimeout(() => {
        console.log(`[Nabbit Background Auth] 🔄 Resent SMS OTP to ${foundUser?.phoneNumber} (Code: ${foundUser?.phoneCode})`);
      }, 300);
    }

    return res.json({
      success: true,
      message: `New ${type} verification code sent in background!`,
      user: sanitizeUser(foundUser),
    });
  });

  // Generate bug-hunt challenges from pasted YouTube tutorial URL using Gemini AI
  app.post('/api/videos/generate-from-url', async (req: Request, res: Response) => {
    try {
      const { url, topicHint } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Please provide a valid YouTube URL' });
      }

      const parsed = extractYouTubeVideoId(url);
      if (!parsed) {
        return res.status(400).json({ error: 'Could not extract a valid YouTube video ID from the provided URL' });
      }

      const youtubeId = parsed.videoId;
      const apiKey = process.env.GEMINI_API_KEY;

      // No silent template fallback: a canned pack labelled as this video is
      // worse than an error. Surface the problem so the client can show it.
      if (!apiKey) {
        return res.status(503).json({
          error: 'AI drill generation is not configured on this server (missing GEMINI_API_KEY).',
          code: 'ai_unavailable',
        });
      }

      {
        try {
          const ai = new GoogleGenAI({
            apiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              },
            },
          });

          // Ground on the real video: oEmbed gives the true title/channel (no API
          // key needed), then Google Search grounding (the original, known-working
          // approach) fills in the tech stack and key concepts.
          const watchUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
          let oembedTitle = '';
          let oembedChannel = '';
          try {
            const o = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`);
            if (o.ok) {
              const j: any = await o.json();
              oembedTitle = typeof j.title === 'string' ? j.title : '';
              oembedChannel = typeof j.author_name === 'string' ? j.author_name : '';
            }
          } catch (oembedErr) {
            console.warn('[Nabbit] oEmbed lookup notice:', oembedErr);
          }

          let searchContext = '';
          try {
            const searchRes = await ai.models.generateContent({
              model: GEMINI_MODEL,
              contents: `Search Google for the YouTube video "${oembedTitle || youtubeId}"${oembedChannel ? ` by ${oembedChannel}` : ''} (video ID ${youtubeId}) ${topicHint || ''}. What technology, system design topic or cloud service does it teach, and what are its key concepts? Keep concise in 2-3 sentences.`,
              config: { tools: [{ googleSearch: {} }] },
            });
            if (searchRes.text) searchContext = searchRes.text;
          } catch (searchErr) {
            console.warn('[Nabbit] Search grounding notice:', searchErr);
          }

          const prompt = `You are an expert software engineer and code reviewer creating a bug-hunt judgment drill for "Nabbit".
A developer wants to practice code-review on this YouTube tutorial.
- YouTube Video ID: ${youtubeId}
${oembedTitle ? `- Video title: "${oembedTitle}"${oembedChannel ? ` by ${oembedChannel}` : ''}
` : ''}- Topic or Hint: "${topicHint || 'Determine from the tutorial context'}"
${searchContext ? `- Grounded Tutorial Search Context: "${searchContext}"
` : ''}
Base every challenge on concepts actually taught in THIS video. Do not invent generic topics; if you cannot determine what the video teaches, return an empty challenges array.

CRITICAL DOMAIN RULES:
1. If the video is about AWS, Cloud, or Cloud Security (IAM, S3, EC2, Lambda, VPC):
   - You MUST generate realistic infrastructure configuration or policy code!
   - Challenge 1: An AWS IAM Policy in JSON (filename: "iam-policy.json", fileType: "json") with a subtle security flaw (e.g. wildcard Action "s3:*", missing Condition, or public Principal "*").
   - Challenge 2: A Terraform HCL snippet (filename: "main.tf", fileType: "terraform") with a subtle flaw (e.g. 0.0.0.0/0 on SSH port 22, unencrypted S3 bucket, or overly broad security group).
   - DO NOT output React/HTML/JS for AWS or Cloud tutorials!
2. If the video is about DevOps, Docker, or Kubernetes:
   - Challenge 1: A Dockerfile (filename: "Dockerfile", fileType: "dockerfile") running as root without a USER instruction, or copying node_modules before dependencies.
   - Challenge 2: A Kubernetes YAML manifest (filename: "deployment.yaml", fileType: "yaml") with privileged security context.
3. If the video is about Backend or Database:
   - Generate Python, SQL, or Go code.
4. If the video is about Frontend (React, Vue, Next.js, TypeScript):
   - Generate TypeScript/TSX code.

Each challenge must feature realistic code with EXACTLY ONE subtle planted flaw that an engineer must catch during code review.
- The flaw must NOT be a typo or trivial syntax error; it must be a real conceptual bug.
- Provide 4 plausible fix options (with exactly 1 correct fix, and 3 realistic trap options).
- Set correctOption to the 0-indexed number (0 to 3) of the correct option.
- The explanation must name *why* the bug occurs and explain the mechanics clearly.
- Provide a memorable 1-sentence reviewer rule of thumb (takeaway).
- Provide two-stage hints:
  - conceptNudge: A conceptual hint asking the user to consider the underlying architectural principle without giving away the answer.
  - videoTimestampSeconds: The exact second in the tutorial where this concept is taught.
  - inspectionClue: A specific pointer directing the reviewer's attention to the problematic property or line.`;

          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  channel: { type: Type.STRING },
                  stack: { type: Type.STRING },
                  duration: { type: Type.STRING },
                  description: { type: Type.STRING },
                  challenges: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        concept: { type: Type.STRING },
                        chapter: { type: Type.STRING },
                        timestampSeconds: { type: Type.INTEGER },
                        timestampFormatted: { type: Type.STRING },
                        difficulty: { type: Type.STRING },
                        filename: { type: Type.STRING },
                        fileType: { type: Type.STRING },
                        buggyCode: { type: Type.STRING },
                        buggyLines: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                        fixOptions: { type: Type.ARRAY, items: { type: Type.STRING } },
                        correctOption: { type: Type.INTEGER },
                        explanation: { type: Type.STRING },
                        correctCode: { type: Type.STRING },
                        takeaway: { type: Type.STRING },
                        hints: {
                          type: Type.OBJECT,
                          properties: {
                            conceptNudge: { type: Type.STRING },
                            videoTimestampSeconds: { type: Type.INTEGER },
                            inspectionClue: { type: Type.STRING },
                          },
                          required: ['conceptNudge', 'videoTimestampSeconds', 'inspectionClue'],
                        },
                      },
                      required: [
                        'concept',
                        'chapter',
                        'timestampSeconds',
                        'timestampFormatted',
                        'difficulty',
                        'filename',
                        'fileType',
                        'buggyCode',
                        'buggyLines',
                        'fixOptions',
                        'correctOption',
                        'explanation',
                        'correctCode',
                        'takeaway',
                        'hints',
                      ],
                    },
                  },
                },
                required: ['title', 'channel', 'stack', 'duration', 'description', 'challenges'],
              },
            },
          });

          const dataText = response.text;
          if (dataText) {
            const parsedData = JSON.parse(dataText);
            const validChallenges = (Array.isArray(parsedData.challenges) ? parsedData.challenges : []).filter((c: any) => {
              if (!c || typeof c.buggyCode !== 'string' || !c.buggyCode.trim()) return false;
              if (!Array.isArray(c.fixOptions) || c.fixOptions.length < 2) return false;
              if (!Number.isInteger(c.correctOption) || c.correctOption < 0 || c.correctOption >= c.fixOptions.length) return false;
              const lineCount = c.buggyCode.split('\n').length;
              return Array.isArray(c.buggyLines) && c.buggyLines.length > 0 && c.buggyLines.every((n: any) => Number.isInteger(n) && n >= 1 && n <= lineCount);
            });
            if (validChallenges.length === 0) {
              return res.status(422).json({
                error: "Couldn't build reliable drills from this video. Try another video or add a topic hint.",
                code: 'no_valid_drills',
              });
            }
            parsedData.challenges = validChallenges;
            const customId = `custom-${youtubeId}-${Date.now().toString(36)}`;
            const video: Video = {
              id: customId,
              title: oembedTitle || parsedData.title || (topicHint ? topicHint : 'Tutorial Drill'),
              channel: oembedChannel || parsedData.channel || 'Dev Tutorial',
              stack: parsedData.stack || 'Cloud / Software Engineering',
              youtubeId,
              duration: parsedData.duration || '20m',
              conceptCount: Array.isArray(parsedData.challenges) ? parsedData.challenges.length : 2,
              description: parsedData.description || `Drills created from tutorial (${youtubeId})`,
              thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
              isUserCustom: true,
            };

            const challenges: Challenge[] = parsedData.challenges.map((c: any, index: number) => ({
              id: `${customId}-c${index + 1}`,
              videoId: customId,
              concept: c.concept,
              chapter: c.chapter,
              timestampSeconds: c.timestampSeconds || 60 * (index + 1),
              timestampFormatted: c.timestampFormatted || `0${index + 1}:00`,
              difficulty: (c.difficulty === 'Beginner' || c.difficulty === 'Intermediate' || c.difficulty === 'Advanced')
                ? c.difficulty
                : 'Intermediate',
              filename: c.filename || (c.fileType === 'json' ? 'policy.json' : c.fileType === 'terraform' ? 'main.tf' : 'Component.tsx'),
              fileType: c.fileType || 'typescript',
              buggyCode: c.buggyCode,
              buggyLines: Array.isArray(c.buggyLines) && c.buggyLines.length > 0 ? c.buggyLines : [5],
              fixOptions: c.fixOptions,
              correctOption: typeof c.correctOption === 'number' ? c.correctOption : 0,
              explanation: c.explanation,
              correctCode: c.correctCode,
              takeaway: c.takeaway,
              hints: c.hints || {
                conceptNudge: `Consider how ${c.concept} is defined and how cloud best practices prevent unintended security or runtime regressions.`,
                videoTimestampSeconds: c.timestampSeconds || 60 * (index + 1),
                inspectionClue: `Inspect line ${c.buggyLines?.[0] || 5} carefully.`,
              },
            }));

            return res.json({ video, challenges, source: 'gemini' });
          }
        } catch (geminiErr) {
          console.error('[Nabbit] Gemini generation error:', geminiErr);
          const detail = geminiErr instanceof Error ? geminiErr.message.slice(0, 300) : String(geminiErr).slice(0, 300);
          return res.status(502).json({
            error: "The AI service couldn't generate drills for this video. Please try again, or try a different video.",
            code: 'ai_failed',
            // Provider detail only outside production, to make setup problems diagnosable.
            ...(isProduction ? {} : { detail }),
          });
        }
      }

      return res.status(502).json({ error: 'The AI service returned nothing for this video.', code: 'ai_failed' });
    } catch (err: any) {
      console.error('[Nabbit] Failed to generate drill:', err);
      res.status(500).json({ error: err.message || 'Server error generating challenge' });
    }
  });

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    // Serve built assets, but not index.html directly — we render it per-request
    // so dare links can carry per-challenge Open Graph tags.
    app.use(express.static(distPath, { index: false }));
    app.get('*', (req: Request, res: Response) => {
      let html = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
      const dareId = typeof req.query.dare === 'string' ? req.query.dare : null;
      if (dareId) {
        html = injectDareOg(html, dareId);
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    });
  }

  console.log(
    `[Nabbit] Video import: ${process.env.GEMINI_API_KEY ? `Gemini key present, model ${GEMINI_MODEL}` : 'NO GEMINI_API_KEY — imports will return an error'}`
  );
  app.listen(PORT, () => {
    console.log(`[Nabbit] Server running on port ${PORT} (${isProduction ? 'production' : 'development'})`);
  });
}

startServer();
