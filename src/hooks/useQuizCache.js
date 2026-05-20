import { useCallback, useMemo } from 'react';

const CACHE_KEY = 'quizCache';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_ENTRIES = 30;

function djb2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function stableStringify(value) {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

export function hashDeck(deck, language) {
  return djb2(stableStringify({ deck, language }));
}

function loadCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveCache(cache) {
  try {
    const entries = Object.entries(cache);
    if (entries.length > MAX_ENTRIES) {
      const sorted = entries.sort((a, b) => (b[1].savedAt || 0) - (a[1].savedAt || 0));
      const trimmed = Object.fromEntries(sorted.slice(0, MAX_ENTRIES));
      localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
      return;
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* quota exceeded */
  }
}

export function useQuizCache() {
  const get = useCallback((deck, language) => {
    const key = hashDeck(deck, language);
    const cache = loadCache();
    const entry = cache[key];
    if (!entry) return null;
    if (Date.now() - (entry.savedAt || 0) > TTL_MS) {
      delete cache[key];
      saveCache(cache);
      return null;
    }
    return entry.quiz;
  }, []);

  const set = useCallback((deck, language, quiz) => {
    const key = hashDeck(deck, language);
    const cache = loadCache();
    cache[key] = { quiz, savedAt: Date.now() };
    saveCache(cache);
  }, []);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const size = useCallback(() => Object.keys(loadCache()).length, []);

  return useMemo(() => ({ get, set, clear, size }), [get, set, clear, size]);
}
