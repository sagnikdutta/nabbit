import { lazy, Suspense, useEffect, useState } from 'react';
import App from './App';
import { supabase } from './lib/supabase';
import { api } from './lib/api';

/*
 * Path-based router that picks between V1 (the current app, hash-routed under
 * `/v1/…`) and V2 (the new, in-progress UI).
 *
 * Routing table:
 *   /v2  or /v2/                → V2 dashboard
 *   /v2/auth                    → V2 auth (sign-in / sign-up)
 *   /v2/<anything else>         → V1 (fallback while that V2 page isn't built)
 *   /v1  or /v1/<anything>      → V1
 *   /  (and anything unmatched) → whichever version is marked default in
 *                                 public.ui_versions; falls back to V1 on
 *                                 lookup failure. The server does this
 *                                 redirect in server.ts; the client-side path
 *                                 is the safety net for static hosts (Vercel).
 *
 * Each V2 page is lazy-loaded so its CSS + any heavy assets never ship to V1
 * users or to other V2 pages. V1 remains the default route and loads with
 * no indirection.
 */

const V2Dashboard = lazy(() => import('./v2/Dashboard'));
const V2Auth = lazy(() => import('./v2/pages/Auth'));
const V2Challenge = lazy(() => import('./v2/pages/Challenge'));
const V2Recall = lazy(() => import('./v2/pages/Recall'));
const V2Leaderboard = lazy(() => import('./v2/pages/Leaderboard'));
const V2Community = lazy(() => import('./v2/pages/Community'));
const V2Import = lazy(() => import('./v2/pages/Import'));
const V2Library = lazy(() => import('./v2/pages/Library'));
const V2Progress = lazy(() => import('./v2/pages/Progress'));
const V2ComingSoon = lazy(() => import('./v2/pages/ComingSoon'));

type Choice =
  | { kind: 'v2-import' }
  | { kind: 'v2-library' }
  | { kind: 'v2-progress' }
  | { kind: 'v2-soon'; page: 'Achievements' | 'Settings' }
  | { kind: 'v1' }
  | { kind: 'v2-dashboard' }
  | { kind: 'v2-auth' }
  | { kind: 'v2-challenge' }
  | { kind: 'v2-recall' }
  | { kind: 'v2-leaderboard' }
  | { kind: 'v2-community' }
  | { kind: 'resolving' };

function pickFromPath(pathname: string): Choice {
  if (pathname === '/v2' || pathname === '/v2/') return { kind: 'v2-dashboard' };
  if (pathname === '/v2/auth' || pathname === '/v2/auth/') return { kind: 'v2-auth' };
  if (pathname === '/v2/recall' || pathname === '/v2/recall/') return { kind: 'v2-recall' };
  if (pathname === '/v2/leaderboard' || pathname === '/v2/leaderboard/') return { kind: 'v2-leaderboard' };
  if (pathname === '/v2/community' || pathname === '/v2/community/') return { kind: 'v2-community' };
  const p = pathname.replace(/\/$/, '');
  if (p === '/v2/import') return { kind: 'v2-import' };
  if (p === '/v2/library') return { kind: 'v2-library' };
  if (p === '/v2/progress') return { kind: 'v2-progress' };
  if (p === '/v2/achievements') return { kind: 'v2-soon', page: 'Achievements' };
  if (p === '/v2/settings') return { kind: 'v2-soon', page: 'Settings' };
  if (/^\/v2\/challenge\/[^/]+\/?$/.test(pathname)) return { kind: 'v2-challenge' };
  if (pathname === '/v1' || pathname.startsWith('/v1/')) return { kind: 'v1' };
  if (pathname.startsWith('/v2/')) return { kind: 'v1' };
  return { kind: 'resolving' };
}

/*
 * V2 pages that require a signed-in user. Signed-out visitors are sent to
 * /v2/auth (with ?next= so they land back where they were). Deliberately open:
 *   - /v2/auth       — the sign-in page itself
 *   - /v2/challenge  — shared drill links + the anonymous trial drill
 */
const PROTECTED_KINDS = new Set<Choice['kind']>([
  'v2-dashboard',
  'v2-recall',
  'v2-leaderboard',
  'v2-community',
  'v2-import',
  'v2-library',
  'v2-progress',
  'v2-soon',
]);

async function fetchDefaultVersion(): Promise<'v1' | 'v2'> {
  if (!supabase) return 'v1';
  try {
    const { data, error } = await supabase
      .from('ui_versions')
      .select('version, "default"')
      .eq('default', true)
      .limit(1)
      .maybeSingle();
    if (error || !data) return 'v1';
    return data.version === 'v2' ? 'v2' : 'v1';
  } catch {
    return 'v1';
  }
}

export default function AppRouter() {
  const [choice, setChoice] = useState<Choice>(() => pickFromPath(window.location.pathname));

  useEffect(() => {
    if (choice.kind !== 'resolving') return;
    let alive = true;
    (async () => {
      const version = await fetchDefaultVersion();
      if (!alive) return;
      const search = window.location.search;
      const hash = window.location.hash;
      const target = `/${version}/${search}${hash}`;
      window.location.replace(target);
    })();
    return () => { alive = false; };
  }, [choice.kind]);

  const blocked = PROTECTED_KINDS.has(choice.kind) && !api.getCurrentUser();

  useEffect(() => {
    if (!blocked) return;
    const next = window.location.pathname + window.location.search;
    window.location.replace(`/v2/auth?next=${encodeURIComponent(next)}`);
  }, [blocked]);

  // Loading / in-flight states deliberately render NOTHING instead of raw
  // "Loading V2…" / "Picking dashboard version…" text. Those placeholders
  // show for a fraction of a second during redirects and React.lazy chunk
  // fetches, but when they do show they look like a broken debug build.
  // A blank page for ~100ms is strictly nicer than system-ui text in the
  // top-left corner.

  if (blocked) {
    return null;
  }

  if (choice.kind === 'v2-dashboard') {
    return (
      <Suspense fallback={null}>
        <V2Dashboard />
      </Suspense>
    );
  }

  if (choice.kind === 'v2-auth') {
    return (
      <Suspense fallback={null}>
        <V2Auth initialMode={new URLSearchParams(window.location.search).get('mode') === 'signup' ? 'signup' : 'signin'} />
      </Suspense>
    );
  }

  if (choice.kind === 'v2-challenge') {
    return (
      <Suspense fallback={null}>
        <V2Challenge />
      </Suspense>
    );
  }

  if (choice.kind === 'v2-recall') {
    return (
      <Suspense fallback={null}>
        <V2Recall />
      </Suspense>
    );
  }

  if (choice.kind === 'v2-leaderboard') {
    return (
      <Suspense fallback={null}>
        <V2Leaderboard />
      </Suspense>
    );
  }

  if (choice.kind === 'v2-community') {
    return (
      <Suspense fallback={null}>
        <V2Community />
      </Suspense>
    );
  }

  if (choice.kind === 'v2-import' || choice.kind === 'v2-library' || choice.kind === 'v2-progress' || choice.kind === 'v2-soon') {
    return (
      <Suspense fallback={null}>
        {choice.kind === 'v2-import' && <V2Import />}
        {choice.kind === 'v2-library' && <V2Library />}
        {choice.kind === 'v2-progress' && <V2Progress />}
        {choice.kind === 'v2-soon' && <V2ComingSoon page={choice.page} />}
      </Suspense>
    );
  }

  if (choice.kind === 'v1') {
    return <App />;
  }

  // Resolving default version from Supabase — render nothing; the useEffect
  // above does the window.location.replace once the lookup lands.
  return null;
}
