import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

/**
 * Nabbit is a static SPA whose single source of truth is the browser
 * (localStore → localStorage). This server exists only to serve the app:
 * Vite middleware in development, the built `dist/` in production. There is
 * no request-time backend state, so there is nothing to persist or reset here.
 */
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
    app.use(express.static(distPath));
    // SPA fallback: every non-asset route returns index.html.
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[Nabbit] Server running on port ${PORT} (${isProduction ? 'production' : 'development'})`);
  });
}

startServer();
