/**
 * Phase 8 v3 — prod-incident skin opt-out.
 * Flag stored client-side; applies whenever the user is signed in or anon.
 */

const KEY = 'nabbit_incident_optout_v1';

export function getIncidentOptOut(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setIncidentOptOut(off: boolean): void {
  try {
    if (off) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // storage unavailable — toggle lives for the session only
  }
}

/** Should this drill render in incident mode? */
export function shouldShowIncident(
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced',
  userRating: number | undefined,
  optedOut: boolean,
): boolean {
  if (optedOut) return false;
  if (difficulty === 'Advanced') return true;
  if (typeof userRating === 'number' && userRating >= 1500) return true;
  return false;
}
