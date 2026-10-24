import { useEffect, useState } from 'react';

/*
 * V2 theme state, persisted to localStorage so a user's choice sticks across
 * navigation between V2 pages (dashboard, auth, challenge, …) without an
 * app-wide context. Every V2 page uses this; the theme value drives the
 * `data-theme` attribute on the page's `.v2-root` element.
 */

const STORAGE_KEY = 'nabbit_v2_theme';
type Theme = 'light' | 'dark';

function readTheme(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function writeTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // storage unavailable — the choice just doesn't persist
  }
}

export function useV2Theme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    writeTheme(theme);
  }, [theme]);

  const toggle = () => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  return [theme, toggle];
}
