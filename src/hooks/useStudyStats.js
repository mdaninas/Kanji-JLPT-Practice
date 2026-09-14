import { useCallback, useEffect, useState } from 'react';
import { LEGACY_KEYS, migrateStorageKey, STORAGE_KEYS } from '../storageKeys.js';

const STATS_KEY = STORAGE_KEYS.stats;
const CURRENT_SCHEMA_VERSION = 1;

const defaultStats = {
  totalCorrect: 0,
  totalAnswered: 0,
  byLevel: {},
  lastStudyDate: '',
  streak: 0,
  longestStreak: 0,
  sessions: [],
};

export function todayKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function diffDays(a, b) {
  if (!a || !b) return Infinity;
  const ma = Date.parse(a);
  const mb = Date.parse(b);
  return Math.round((mb - ma) / 86_400_000);
}

function normalizeLevelStats(value) {
  if (!value || typeof value !== 'object') return {};
  const normalized = {};
  Object.entries(value).forEach(([level, entry]) => {
    if (!entry || typeof entry !== 'object') return;
    normalized[level] = {
      correct: Number(entry.correct) || 0,
      answered: Number(entry.answered) || 0,
    };
  });
  return normalized;
}

function normalizeSessions(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((session) => session && typeof session === 'object')
    .map((session) => ({
      date: typeof session.date === 'string' ? session.date : '',
      correct: Number(session.correct) || 0,
      answered: Number(session.answered) || 0,
    }))
    .slice(0, 30);
}

export function normalizeStats(raw) {
  if (!raw || typeof raw !== 'object') return { ...defaultStats };
  return {
    totalCorrect: Number(raw.totalCorrect) || 0,
    totalAnswered: Number(raw.totalAnswered) || 0,
    byLevel: normalizeLevelStats(raw.byLevel),
    lastStudyDate: typeof raw.lastStudyDate === 'string' ? raw.lastStudyDate : '',
    streak: Number(raw.streak) || 0,
    longestStreak: Number(raw.longestStreak) || 0,
    sessions: normalizeSessions(raw.sessions),
  };
}

export function getDisplayStreak(stats) {
  if (!stats?.lastStudyDate) return 0;
  return diffDays(stats.lastStudyDate, todayKey()) <= 1 ? stats.streak : 0;
}

function parseStats(raw) {
  if (!raw || typeof raw !== 'object') return { ...defaultStats };
  if (raw.schemaVersion === CURRENT_SCHEMA_VERSION) {
    return normalizeStats(raw.data);
  }
  return normalizeStats(raw);
}

function loadStats() {
  try {
    migrateStorageKey(STATS_KEY, LEGACY_KEYS.stats);
    const raw = JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
    return parseStats(raw);
  } catch {
    return { ...defaultStats };
  }
}

function saveStats(stats) {
  try {
    localStorage.setItem(
      STATS_KEY,
      JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, data: stats }),
    );
  } catch {
    /* quota */
  }
}

export function useStudyStats() {
  const [stats, setStats] = useState(loadStats);

  useEffect(() => {
    saveStats(stats);
  }, [stats]);

  useEffect(() => {
    function onStorage(event) {
      if (event.key !== STATS_KEY) return;
      if (event.newValue === null) {
        setStats({ ...defaultStats });
        return;
      }
      try {
        setStats(parseStats(JSON.parse(event.newValue)));
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const recordSession = useCallback((questions, answers) => {
    const today = todayKey();
    let correct = 0;
    const levelDelta = {};

    questions.forEach((q) => {
      const isCorrect = answers[q.id] === q.answer;
      if (isCorrect) correct += 1;
      const lvl = q.jlpt ? Number(String(q.jlpt).replace(/[^0-9]/g, '')) : null;
      if (lvl) {
        levelDelta[lvl] = levelDelta[lvl] || { correct: 0, answered: 0 };
        levelDelta[lvl].answered += 1;
        if (isCorrect) levelDelta[lvl].correct += 1;
      }
    });

    setStats((prev) => {
      const byLevel = { ...prev.byLevel };
      Object.entries(levelDelta).forEach(([lvl, d]) => {
        const cur = byLevel[lvl] || { correct: 0, answered: 0 };
        byLevel[lvl] = {
          correct: cur.correct + d.correct,
          answered: cur.answered + d.answered,
        };
      });

      const dayGap = diffDays(prev.lastStudyDate, today);
      let streak = prev.streak;
      if (prev.lastStudyDate === today) {
        // same day, no streak change
      } else if (dayGap === 1) {
        streak = prev.streak + 1;
      } else {
        streak = 1;
      }

      const sessions = [
        { date: today, correct, answered: questions.length },
        ...prev.sessions,
      ].slice(0, 30);

      return {
        ...prev,
        totalCorrect: prev.totalCorrect + correct,
        totalAnswered: prev.totalAnswered + questions.length,
        byLevel,
        lastStudyDate: today,
        streak,
        longestStreak: Math.max(prev.longestStreak, streak),
        sessions,
      };
    });
  }, []);

  const reset = useCallback(() => {
    setStats({ ...defaultStats });
    try {
      localStorage.removeItem(STATS_KEY);
      localStorage.removeItem(LEGACY_KEYS.stats);
    } catch {
      /* ignore */
    }
  }, []);

  const replaceStats = useCallback((next) => {
    setStats(normalizeStats(next));
  }, []);

  return { stats, recordSession, reset, replaceStats, getDisplayStreak };
}
