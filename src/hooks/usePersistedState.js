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

export function usePersistedState(key, defaultValue) {
  const [value, setValue] = useState(() => readFromStorage(key, defaultValue));

  useEffect(() => {
    if (!hasWindow) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage quota exceeded or disabled – silently skip
    }
  }, [key, value]);

  return [value, setValue];
}
