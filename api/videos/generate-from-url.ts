import { generateFromUrl } from '../_lib/generate-from-url.js';

// Vercel serverless entry for POST /api/videos/generate-from-url. Needs the
// GEMINI_API_KEY (and optionally GEMINI_MODEL) environment variables set in the
// Vercel project settings.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { status, json } = await generateFromUrl(req.body);
  return res.status(status).json(json);
}
