import { useCallback, useEffect, useState } from 'react';
import { SRS_INTERVALS_DAYS } from '../constants.js';

const STORAGE_KEY = 'kanjiProgress';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage quota exceeded – silently skip
  }
}

function nextReviewTime(level) {
  const days = SRS_INTERVALS_DAYS[Math.min(level, SRS_INTERVALS_DAYS.length - 1)];
  return Date.now() + days * 86_400_000;
}

export function useProgress() {
  const [progress, setProgress] = useState(load);

  useEffect(() => {
    save(progress);
  }, [progress]);

  const recordResult = useCallback((character, correct) => {
    setProgress((prev) => {
      const entry = prev[character] || { level: 0, correct: 0, incorrect: 0 };
      const newLevel = correct
        ? Math.min(entry.level + 1, SRS_INTERVALS_DAYS.length - 1)
        : 0;

      return {
        ...prev,
        [character]: {
          level: newLevel,
          correct: entry.correct + (correct ? 1 : 0),
          incorrect: entry.incorrect + (correct ? 0 : 1),
          lastSeen: Date.now(),
          nextReview: nextReviewTime(newLevel),
        },
      };
    });
  }, []);

  const recordQuizResults = useCallback((questions, answers) => {
    setProgress((prev) => {
      const updates = { ...prev };

      questions.forEach((question) => {
        const character = question.target_kanji || question.kanji;
        if (!character) return;

        const selectedAnswer = answers[question.id];
        const correct = selectedAnswer === question.answer;
        const entry = updates[character] || { level: 0, correct: 0, incorrect: 0 };
        const newLevel = correct
          ? Math.min(entry.level + 1, SRS_INTERVALS_DAYS.length - 1)
          : 0;

        updates[character] = {
          level: newLevel,
          correct: entry.correct + (correct ? 1 : 0),
          incorrect: entry.incorrect + (correct ? 0 : 1),
          lastSeen: Date.now(),
          nextReview: nextReviewTime(newLevel),
        };
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

        if (entry.level >= SRS_INTERVALS_DAYS.length - 1) {
          mastered += 1;
        } else if (entry.incorrect > entry.correct) {
          weak += 1;
        }

        if (entry.nextReview && entry.nextReview <= now) {
          due += 1;
        }
      });

      return { mastered, weak, due };
    },
    [progress],
  );

  const getKanjiStatus = useCallback(
    (character) => {
      const entry = progress[character];
      if (!entry) return 'new';
      if (entry.level >= SRS_INTERVALS_DAYS.length - 1) return 'mastered';
      if (entry.level === 0 && entry.incorrect > 0) return 'weak';
      if (entry.nextReview && entry.nextReview <= Date.now()) return 'due';
      return 'learning';
    },
    [progress],
  );

  return { progress, recordResult, recordQuizResults, getProgressStats, getKanjiStatus };
}
