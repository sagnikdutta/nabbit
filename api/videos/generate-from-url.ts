import { generateFromUrl } from '../_lib/generate-from-url.js';

// Vercel serverless entry for POST /api/videos/generate-from-url. Needs the
// GEMINI_API_KEY (and optionally GEMINI_MODEL) environment variables set in the
// Vercel project settings. For cache writes, SUPABASE_SERVICE_ROLE_KEY must
// also be set (post-migration 0013 locks the upsert RPC to service_role).
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // Behind Vercel's edge, x-forwarded-for is a comma-separated chain where
  // the first entry is the real client. Fall back to the socket address for
  // dev / direct calls.
  const xff = (req.headers?.['x-forwarded-for'] as string | undefined) || '';
  const clientIp = (xff.split(',')[0] || req.socket?.remoteAddress || '').trim();
  const { status, json } = await generateFromUrl(req.body, { clientIp });
  return res.status(status).json(json);
}
