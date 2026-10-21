import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { CURATED_CHALLENGES, CURATED_VIDEOS } from './src/content/data.ts';

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

async function startServer() {
  const app = express();

  // Liveness check for hosting platforms.
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, timestamp: Date.now(), service: 'nabbit' });
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

  app.listen(PORT, () => {
    console.log(`[Nabbit] Server running on port ${PORT} (${isProduction ? 'production' : 'development'})`);
  });
}

startServer();
