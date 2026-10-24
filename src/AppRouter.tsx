import { lazy, Suspense, useEffect, useState } from 'react';
import App from './App';
import { supabase } from './lib/supabase';

/*
 * Path-based router that picks between V1 (the current app, hash-routed under
 * `/v1/…`) and V2 (the new dashboard mockup, served at exactly `/v2` or `/v2/`).
 *
 * Routing table:
 *   /v2  or /v2/                → V2 dashboard
 *   /v2/<anything else>         → V1 (fallback, per product decision)
 *   /v1  or /v1/<anything>      → V1
 *   /  (and anything unmatched) → whichever version is marked default in
 *                                 public.ui_versions; falls back to V1 on
 *                                 lookup failure (V1 is the stable product;
 *                                 V2 is still being built out page by page).
 *                                 The server does this redirect in server.ts;
 *                                 this client-side path exists as a safety net
 *                                 for static hosts (Vercel).
 *
 * V2 is lazy-loaded so its CSS + 240 KB of base64 thumbnails never ship to V1
 * users. V1 remains the default route and loads with no indirection.
 */

const V2Dashboard = lazy(() => import('./v2/Dashboard'));

type Choice = { kind: 'v1' } | { kind: 'v2' } | { kind: 'resolving' };

function pickFromPath(pathname: string): Choice {
  if (pathname === '/v2' || pathname === '/v2/') return { kind: 'v2' };
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

  if (choice.kind === 'v2') {
    return (
      <Suspense fallback={<div style={{ padding: 24, fontFamily: 'system-ui' }}>Loading V2…</div>}>
        <V2Dashboard />
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
