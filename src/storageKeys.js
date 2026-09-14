const hasWindow = typeof window !== 'undefined';

export const LEGACY_KEYS = {
  progress: 'kanjiProgress',
  stats: 'studyStats',
  quizCache: 'quizCache',
  kanjiBreakdownCache: 'kanjiBreakdownCache',
};

export const STORAGE_KEYS = {
  progress: 'kanjiApp:progress',
  stats: 'kanjiApp:stats',
  quizCache: 'kanjiApp:quizCache',
  theme: 'kanjiApp:theme',
  language: 'kanjiApp:language',
  selectedLevels: 'kanjiApp:selectedLevels',
  selectedKanji: 'kanjiApp:selectedKanji',
  onlyWithVocab: 'kanjiApp:onlyWithVocab',
  preferredVocabLevels: 'kanjiApp:preferredVocabLevels',
  quizModel: 'kanjiApp:quizModel',
  sortMode: 'kanjiApp:sortMode',
  kanjiBreakdownCache: 'kanjiApp:kanjiBreakdownCache',
};

/** @type {string[]} */
export const ALL_APP_STORAGE_KEYS = [
  ...Object.values(STORAGE_KEYS),
  ...Object.values(LEGACY_KEYS),
];

/**
 * If `newKey` is missing, copy value from `legacyKey` and optionally remove the legacy entry.
 * @returns {string | null} raw string stored under the new key, or null
 */
export function migrateStorageKey(newKey, legacyKey, { removeLegacy = true } = {}) {
  if (!hasWindow) return null;
  try {
    const existing = window.localStorage.getItem(newKey);
    if (existing !== null) return existing;

    const legacy = window.localStorage.getItem(legacyKey);
    if (legacy === null) return null;

    window.localStorage.setItem(newKey, legacy);
    if (removeLegacy) window.localStorage.removeItem(legacyKey);
    return legacy;
  } catch {
    return null;
  }
}

export function clearKanjiAppStorage() {
  if (!hasWindow) return;
  ALL_APP_STORAGE_KEYS.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  });
}
