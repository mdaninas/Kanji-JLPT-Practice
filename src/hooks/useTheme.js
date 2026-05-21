import { useEffect, useState } from 'react';

const STORAGE_KEY = 'kanjiApp:theme';
const VALID_THEMES = new Set(['light', 'dark']);
const hasWindow = typeof window !== 'undefined';

function readStoredTheme() {
  if (!hasWindow) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    return VALID_THEMES.has(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getSystemTheme() {
  if (!hasWindow || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState(() => readStoredTheme() || getSystemTheme());

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
    if (!hasWindow) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
    } catch {
      // storage quota exceeded or disabled — silently skip
    }
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  return { theme, toggleTheme };
}
