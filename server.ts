import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { CURATED_VIDEOS, CURATED_CHALLENGES } from './src/content/data.ts';
import { calculateRecallSchedule, computeStats, getInitialSeedRecall, getSimulatedNow } from './src/lib/recall.ts';
import { Attempt, RecallItem } from './src/lib/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

// Server In-Memory Store
let attempts: Attempt[] = [];
let recallItems: RecallItem[] = [];
let simulatedOffsetDays = 0;

// Initialize seed data
const initial = getInitialSeedRecall();
attempts = [...initial.attempts];
recallItems = [...initial.items];

async function startServer() {
  const app = express();
  app.use(express.json());

  // --- API Routes ---

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, timestamp: Date.now(), service: 'nabbit-engine' });
  });

  app.get('/api/videos', (_req: Request, res: Response) => {
    res.json({ videos: CURATED_VIDEOS });
  });

  app.get('/api/videos/:id/challenges', (req: Request, res: Response) => {
    const videoId = req.params.id;
    const challenges = CURATED_CHALLENGES.filter(c => c.videoId === videoId);
    res.json({ challenges });
  });

  app.get('/api/challenges/:id', (req: Request, res: Response) => {
    const challenge = CURATED_CHALLENGES.find(c => c.id === req.params.id);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    res.json({ challenge });
  });

  app.post('/api/attempts', (req: Request, res: Response) => {
    const { challengeId, chosen, offsetDays } = req.body;
    if (typeof challengeId !== 'string' || typeof chosen !== 'number') {
      return res.status(400).json({ error: 'Invalid challengeId or chosen index' });
    }

    if (typeof offsetDays === 'number') {
      simulatedOffsetDays = offsetDays;
    }

    const challenge = CURATED_CHALLENGES.find(c => c.id === challengeId);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const correct = chosen === challenge.correctOption;
    const attempt: Attempt = {
      challengeId,
      chosen,
      correct,
      at: getSimulatedNow(simulatedOffsetDays),
    };

    attempts.push(attempt);

    const existingIndex = recallItems.findIndex(i => i.challengeId === challengeId);
    const existing = existingIndex >= 0 ? recallItems[existingIndex] : undefined;

    const updatedRecall = calculateRecallSchedule(
      existing,
      challenge.id,
      challenge.concept,
      challenge.videoId,
      attempt,
      simulatedOffsetDays
    );

    if (existingIndex >= 0) {
      recallItems[existingIndex] = updatedRecall;
    } else {
      recallItems.push(updatedRecall);
    }

    const stats = computeStats(recallItems, attempts, simulatedOffsetDays);

    res.json({
      attempt,
      correct,
      explanation: challenge.explanation,
      recallItem: updatedRecall,
      stats,
    });
  });

  app.get('/api/recall/due', (req: Request, res: Response) => {
    const offset = parseInt(req.query.offsetDays as string, 10);
    if (!isNaN(offset)) {
      simulatedOffsetDays = offset;
    }

    const now = getSimulatedNow(simulatedOffsetDays);
    const dueItems = recallItems
      .filter(item => item.nextReviewAt <= now)
      .map(item => ({
        ...item,
        challenge: CURATED_CHALLENGES.find(c => c.id === item.challengeId),
      }))
      .filter(item => Boolean(item.challenge));

    const allItems = recallItems.map(item => ({
      ...item,
      challenge: CURATED_CHALLENGES.find(c => c.id === item.challengeId),
    }));

    const stats = computeStats(recallItems, attempts, simulatedOffsetDays);

    res.json({ dueItems, allItems, stats });
  });

  app.post('/api/reset', (_req: Request, res: Response) => {
    const seed = getInitialSeedRecall();
    attempts = [...seed.attempts];
    recallItems = [...seed.items];
    simulatedOffsetDays = 0;
    res.json({ ok: true, stats: computeStats(recallItems, attempts, 0) });
  });

  // --- Vite Dev Middleware or Static Production ---

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[Nabbit Engine] Server running on port ${PORT}`);
  });
}

startServer();
