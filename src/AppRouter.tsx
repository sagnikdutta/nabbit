import { lazy, Suspense, useEffect, useState } from 'react';
import App from './App';
import { supabase } from './lib/supabase';

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

type Choice =
  | { kind: 'v1' }
  | { kind: 'v2-dashboard' }
  | { kind: 'v2-auth' }
  | { kind: 'resolving' };

function pickFromPath(pathname: string): Choice {
  if (pathname === '/v2' || pathname === '/v2/') return { kind: 'v2-dashboard' };
  if (pathname === '/v2/auth' || pathname === '/v2/auth/') return { kind: 'v2-auth' };
  if (pathname === '/v1' || pathname.startsWith('/v1/')) return { kind: 'v1' };
  if (pathname.startsWith('/v2/')) return { kind: 'v1' };
  return { kind: 'resolving' };
}

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

  if (choice.kind === 'v2-dashboard') {
    return (
      <Suspense fallback={<div style={{ padding: 24, fontFamily: 'system-ui' }}>Loading V2…</div>}>
        <V2Dashboard />
      </Suspense>
    );
  }

  if (choice.kind === 'v2-auth') {
    return (
      <Suspense fallback={<div style={{ padding: 24, fontFamily: 'system-ui' }}>Loading V2 auth…</div>}>
        <V2Auth initialMode={new URLSearchParams(window.location.search).get('mode') === 'signup' ? 'signup' : 'signin'} />
      </Suspense>
    );
  }

  if (choice.kind === 'v1') {
    return <App />;
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', color: '#667293' }}>
      Picking dashboard version…
    </div>
  );
}
