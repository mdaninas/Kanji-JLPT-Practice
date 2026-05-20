import { useCallback, useEffect, useState } from 'react';

const STATS_KEY = 'studyStats';

const defaultStats = {
  totalCorrect: 0,
  totalAnswered: 0,
  byLevel: {},        // { 5: { correct, answered }, ... }
  lastStudyDate: '',  // YYYY-MM-DD
  streak: 0,          // current daily streak
  longestStreak: 0,
  sessions: [],       // [{ date, correct, answered }] up to 30
};

function loadStats() {
  try {
    return { ...defaultStats, ...JSON.parse(localStorage.getItem(STATS_KEY) || '{}') };
  } catch {
    return defaultStats;
  }
}

function saveStats(stats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    /* quota */
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function diffDays(a, b) {
  if (!a || !b) return Infinity;
  const ma = Date.parse(a);
  const mb = Date.parse(b);
  return Math.round((mb - ma) / 86_400_000);
}

export function useStudyStats() {
  const [stats, setStats] = useState(loadStats);

  useEffect(() => {
    saveStats(stats);
  }, [stats]);

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
    setStats(defaultStats);
    try {
      localStorage.removeItem(STATS_KEY);
      localStorage.removeItem('kanjiProgress');
      localStorage.removeItem('quizCache');
    } catch {
      /* ignore */
    }
  }, []);

  return { stats, recordSession, reset };
}
