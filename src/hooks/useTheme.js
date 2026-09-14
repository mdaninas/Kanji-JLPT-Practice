import { useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../storageKeys.js';

const STORAGE_KEY = STORAGE_KEYS.theme;
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
      const serialized = JSON.stringify(theme);
      if (window.localStorage.getItem(STORAGE_KEY) !== serialized) {
        window.localStorage.setItem(STORAGE_KEY, serialized);
      }
    } catch {
      // storage quota exceeded or disabled — silently skip
    }
  }, [theme]);

  useEffect(() => {
    if (!hasWindow) return;

    function onStorage(event) {
      if (event.key !== STORAGE_KEY) return;
      if (event.newValue === null) {
        setTheme(getSystemTheme());
        return;
      }
      try {
        const parsed = JSON.parse(event.newValue);
        if (VALID_THEMES.has(parsed)) setTheme(parsed);
      } catch {
        /* ignore */
      }
    }

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  return { theme, toggleTheme };
}
