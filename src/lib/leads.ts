import { supabase } from './supabase';

// Trial-link lead tracking: which shared challenge a visitor opened, whether they
// finished it, and (later) which account they became. Stored via Supabase RPCs
// (see supabase/migrations/0002_leads.sql); silently a no-op when Supabase isn't configured.

const VISITOR_KEY = 'nabbit_visitor_id';

// Read once at load — the `?dare=` URL is rewritten to a clean hash shortly after.
const entryParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const entryReferrer = typeof document !== 'undefined' ? document.referrer : '';

/** Anonymous, stable id for a user's share links: first 10 hex chars of sha256(user id). */
export async function getSharerRef(userId: string): Promise<string | null> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(userId));
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 10);
  } catch {
    return null;
  }
}

function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return 'anon_' + Math.random().toString(36).slice(2, 12);
  }
}

const logged = new Set<string>();

export function trackTrialView(challengeId: string) {
  if (!supabase || logged.has(challengeId)) return;
  logged.add(challengeId);
  supabase
    .rpc('log_lead', {
      p_visitor_id: getVisitorId(),
      p_challenge_id: challengeId,
      p_utm_source: entryParams?.get('utm_source') || null,
      p_utm_medium: entryParams?.get('utm_medium') || null,
      p_utm_campaign: entryParams?.get('utm_campaign') || null,
      p_referrer: entryReferrer || null,
      p_ref: entryParams?.get('ref') || null,
    })
    .then(({ error }) => {
      if (error) console.warn('[Nabbit] lead log notice:', error.message);
    });
}

export function trackTrialCompleted(challengeId: string, correct: boolean) {
  if (!supabase) return;
  supabase
    .rpc('complete_lead', {
      p_visitor_id: getVisitorId(),
      p_challenge_id: challengeId,
      p_correct: correct,
    })
    .then(({ error }) => {
      if (error) console.warn('[Nabbit] lead complete notice:', error.message);
    });
}

export function claimLeads() {
  if (!supabase) return;
  supabase.rpc('claim_leads', { p_visitor_id: getVisitorId() }).then(({ error }) => {
    if (error) console.warn('[Nabbit] lead claim notice:', error.message);
  });
}
