import { GoogleGenAI, Type } from '@google/genai';
import { extractYouTubeVideoId } from '../../src/lib/youtube.js';
import type { Challenge, Video } from '../../src/lib/types.js';

/*
 * Video -> drills generation, shared by the Express server (server.ts) and the
 * Vercel serverless function (api/videos/generate-from-url.ts). Returns a plain
 * { status, json } so each host can send it its own way. There is deliberately
 * no canned-template fallback: failures are errors.
 */

// The model this endpoint has always used; override per environment with GEMINI_MODEL.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
// Optional second model for when the primary is overloaded. No hardcoded default: older
// models (e.g. gemini-2.5-flash) return 404 for new API keys, so when unset the code
// discovers a usable model from the key's own model list instead.
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || '';
const isProduction = process.env.NODE_ENV === 'production';

// Vercel kills the function at maxDuration (60s in vercel.json); stop retrying before that.
const RETRY_DEADLINE_MS = 42_000;

function isTransient(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /"code":\s*(429|500|503|504)|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded/i.test(msg);
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Other text models this API key can use, newest flash/pro first. Used only
 * when the primary model stays overloaded and no GEMINI_FALLBACK_MODEL is set.
 */
async function discoverFallbackModels(ai: GoogleGenAI, exclude: string): Promise<string[]> {
  try {
    const names: string[] = [];
    const pager = await ai.models.list({ config: { pageSize: 100 } });
    for await (const m of pager) {
      const name = (m.name || '').replace(/^models\//, '');
      const actions = m.supportedActions || [];
      if (!name.startsWith('gemini-') || name === exclude) continue;
      if (actions.length && !actions.includes('generateContent')) continue;
      if (/embedding|image|tts|live|audio|vision|aqa|learnlm|robotics|computer-use|thinking-exp|preview-\d{2}-\d{2}/i.test(name)) continue;
      names.push(name);
    }
    const rank = (n: string) => (/flash/.test(n) ? 0 : /pro/.test(n) ? 1 : 2);
    names.sort((x, y) => rank(x) - rank(y) || y.localeCompare(x, undefined, { numeric: true }));
    console.log('[Nabbit] Fallback model candidates:', names.slice(0, 6).join(', ') || '(none)');
    return names.slice(0, 3);
  } catch (err) {
    console.warn('[Nabbit] Could not list Gemini models:', err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Run a Gemini call through overloads: the primary model twice (backoff 1.5s, 3s),
 * then a configured/discovered fallback model, one try each (models that 404 for
 * this key are skipped). Non-transient errors on the primary (bad key, invalid
 * request) are thrown immediately. If every candidate fails, the error that
 * started the retries is reported.
 */
async function withModelFallback<T>(
  ai: GoogleGenAI,
  startedAt: number,
  call: (model: string) => Promise<T>,
): Promise<T> {
  const overBudget = () => Date.now() - startedAt > RETRY_DEADLINE_MS;
  let firstTransient: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await call(GEMINI_MODEL);
    } catch (err) {
      if (!isTransient(err)) throw err;
      firstTransient ??= err;
      console.warn(`[Nabbit] Gemini ${GEMINI_MODEL} overloaded (attempt ${attempt + 1}/2)`);
      if (overBudget()) throw firstTransient;
      if (attempt === 0) await sleep(1500);
    }
  }

  const candidates = GEMINI_FALLBACK_MODEL && GEMINI_FALLBACK_MODEL !== GEMINI_MODEL
    ? [GEMINI_FALLBACK_MODEL]
    : await discoverFallbackModels(ai, GEMINI_MODEL);
  for (const model of candidates) {
    if (overBudget()) break;
    try {
      console.warn(`[Nabbit] Trying fallback model ${model}`);
      return await call(model);
    } catch (err) {
      console.warn(`[Nabbit] Fallback ${model} failed:`, err instanceof Error ? err.message.slice(0, 160) : err);
    }
  }
  throw firstTransient;
}

export interface GenerateResult {
  status: number;
  json: Record<string, unknown>;
}

export function geminiStatusLine(): string {
  return process.env.GEMINI_API_KEY
    ? `Gemini key present, model ${GEMINI_MODEL}`
    : 'NO GEMINI_API_KEY — imports will return an error';
}

export async function generateFromUrl(body: unknown): Promise<GenerateResult> {
  const reply = (status: number, json: Record<string, unknown>): GenerateResult => ({ status, json });
  const startedAt = Date.now();
  try {
    const { url, topicHint } = (body ?? {}) as { url?: unknown; topicHint?: string };
    if (!url || typeof url !== 'string') {
      return reply(400, { error: 'Please provide a valid YouTube URL' });
    }

    const parsed = extractYouTubeVideoId(url);
    if (!parsed) {
      return reply(400, { error: 'Could not extract a valid YouTube video ID from the provided URL' });
    }

    const youtubeId = parsed.videoId;
    const apiKey = process.env.GEMINI_API_KEY;

    // No silent template fallback: a canned pack labelled as this video is
    // worse than an error. Surface the problem so the client can show it.
    if (!apiKey) {
      console.error('[Nabbit] Video import unavailable: GEMINI_API_KEY is not set on this server.');
      return reply(503, {
        error: 'Server issue. Video import is unavailable right now, please try again later.',
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

        const response = await withModelFallback(ai, startedAt, model => ai.models.generateContent({
          model,
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
        }));

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
            return reply(422, {
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

          return reply(200, { video, challenges, source: 'gemini' });
        }
      } catch (geminiErr) {
        console.error('[Nabbit] Gemini generation error:', geminiErr);
        const detail = geminiErr instanceof Error ? geminiErr.message.slice(0, 300) : String(geminiErr).slice(0, 300);
        return reply(502, {
          error: "Couldn't generate drills for this video. Please try again, or try a different video.",
          code: 'ai_failed',
          // Provider detail only outside production, to make setup problems diagnosable.
          ...(isProduction ? {} : { detail }),
        });
      }
    }

    return reply(502, { error: "Couldn't generate drills for this video. Please try again.", code: 'ai_failed' });
  } catch (err: any) {
    console.error('[Nabbit] Failed to generate drill:', err);
    return reply(500, { error: 'Server issue. Please try again later.' });
  }
}
