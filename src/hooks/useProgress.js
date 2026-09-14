import { useCallback, useEffect, useState } from 'react';
import { SRS_INTERVALS_DAYS } from '../constants.js';
import { LEGACY_KEYS, migrateStorageKey, STORAGE_KEYS } from '../storageKeys.js';

const STORAGE_KEY = STORAGE_KEYS.progress;
const CURRENT_SCHEMA_VERSION = 1;

function parseProgress(raw) {
  if (!raw || typeof raw !== 'object') return {};
  if (raw.schemaVersion === CURRENT_SCHEMA_VERSION) {
    return raw.data && typeof raw.data === 'object' ? raw.data : {};
  }
  return raw;
}

function load() {
  try {
    migrateStorageKey(STORAGE_KEY, LEGACY_KEYS.progress);
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parseProgress(raw);
  } catch {
    return {};
  }
}

function save(data) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, data }),
    );
  } catch {
    /* quota */
  }
}

function nextReviewTime(level) {
  const days = SRS_INTERVALS_DAYS[Math.min(level, SRS_INTERVALS_DAYS.length - 1)];
  return Date.now() + days * 86_400_000;
}

function defaultEntry() {
  return { level: 0, correct: 0, incorrect: 0 };
}

function isDue(entry, now = Date.now()) {
  if (!entry) return false;
  return !entry.nextReview || entry.nextReview <= now;
}

function isMastered(entry) {
  return entry?.level >= SRS_INTERVALS_DAYS.length - 1;
}

function isWeak(entry) {
  if (!entry || isMastered(entry)) return false;
  return entry.incorrect > entry.correct;
}

function applySessionResult(entry, sessionCorrect, sessionTotal, now = Date.now()) {
  const base = entry || defaultEntry();
  const due = isDue(base, now);
  let level = base.level;

  if (sessionTotal > 0 && due) {
    if (sessionCorrect === sessionTotal) {
      level = Math.min(level + 1, SRS_INTERVALS_DAYS.length - 1);
    } else if (sessionCorrect < sessionTotal) {
      level = 0;
    }
  }

  return {
    level,
    correct: base.correct + sessionCorrect,
    incorrect: base.incorrect + (sessionTotal - sessionCorrect),
    lastSeen: now,
    nextReview: nextReviewTime(level),
  };
}

export function useProgress() {
  const [progress, setProgress] = useState(load);

  useEffect(() => {
    save(progress);
  }, [progress]);

  useEffect(() => {
    function onStorage(event) {
      if (event.key !== STORAGE_KEY) return;
      if (event.newValue === null) {
        setProgress({});
        return;
      }
      try {
        setProgress(parseProgress(JSON.parse(event.newValue)));
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const recordResult = useCallback((character, correct) => {
    setProgress((prev) => ({
      ...prev,
      [character]: applySessionResult(prev[character], correct ? 1 : 0, 1),
    }));
  }, []);

  const recordQuizResults = useCallback((questions, answers) => {
    setProgress((prev) => {
      const updates = { ...prev };
      const byKanji = new Map();

      questions.forEach((question) => {
        const character = question.target_kanji || question.kanji;
        if (!character) return;
        const isCorrect = answers[question.id] === question.answer;
        const bucket = byKanji.get(character) || { correct: 0, total: 0 };
        bucket.total += 1;
        if (isCorrect) bucket.correct += 1;
        byKanji.set(character, bucket);
      });

      byKanji.forEach((session, character) => {
        updates[character] = applySessionResult(
          updates[character],
          session.correct,
          session.total,
        );
      });

      return updates;
    });
  }, []);

  const getProgressStats = useCallback(
    (characters) => {
      const now = Date.now();
      let mastered = 0;
      let weak = 0;
      let due = 0;

      characters.forEach((character) => {
        const entry = progress[character];
        if (!entry) return;
        if (isMastered(entry)) mastered += 1;
        if (isWeak(entry)) weak += 1;
        if (isDue(entry, now)) due += 1;
      });

      return { mastered, weak, due };
    },
    [progress],
  );

  const getKanjiStatus = useCallback(
    (character) => {
      const entry = progress[character];
      if (!entry) return 'new';
      if (isMastered(entry)) return 'mastered';
      if (isWeak(entry)) return 'weak';
      if (isDue(entry)) return 'due';
      return 'learning';
    },
    [progress],
  );

  const getDueKanji = useCallback(
    (characters) => {
      const now = Date.now();
      return characters.filter((character) => isDue(progress[character], now));
    },
    [progress],
  );

  const replaceProgress = useCallback((next) => {
    setProgress(next && typeof next === 'object' ? next : {});
  }, []);

  return {
    progress,
    recordResult,
    recordQuizResults,
    getProgressStats,
    getKanjiStatus,
    getDueKanji,
    replaceProgress,
  };
}
