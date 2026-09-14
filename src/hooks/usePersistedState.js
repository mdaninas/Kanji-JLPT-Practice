import { useEffect, useState } from 'react';

const hasWindow = typeof window !== 'undefined';

function readFromStorage(key, defaultValue) {
  if (!hasWindow) return defaultValue;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

export function usePersistedState(key, defaultValue, validate) {
  const [value, setValue] = useState(() => {
    const stored = readFromStorage(key, defaultValue);
    return typeof validate === 'function' ? validate(stored) : stored;
  });

  useEffect(() => {
    if (!hasWindow) return;
    try {
      const serialized = JSON.stringify(value);
      if (window.localStorage.getItem(key) !== serialized) {
        window.localStorage.setItem(key, serialized);
      }
    } catch {
      /* quota */
    }
  }, [key, value]);

  useEffect(() => {
    if (!hasWindow) return;

    function onStorage(event) {
      if (event.key !== key) return;
      if (event.newValue === null) {
        setValue(defaultValue);
        return;
      }
      try {
        const parsed = JSON.parse(event.newValue);
        setValue(typeof validate === 'function' ? validate(parsed) : parsed);
      } catch {
        /* ignore corrupt payload */
      }
    }

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key, defaultValue, validate]);

  return [value, setValue];
}
