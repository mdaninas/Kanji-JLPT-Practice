// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  getDisplayStreak,
  normalizeStats,
  todayKey,
  useStudyStats,
} from '../../hooks/useStudyStats.js';

describe('useStudyStats', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('replaceStats with byLevel null does not throw and normalizes to an object', () => {
    const { result } = renderHook(() => useStudyStats());

    expect(() => {
      act(() => {
        result.current.replaceStats({ byLevel: null, totalCorrect: 5, totalAnswered: 8 });
      });
    }).not.toThrow();

    expect(result.current.stats.byLevel).toEqual({});
    expect(result.current.stats.totalCorrect).toBe(5);
    expect(result.current.stats.totalAnswered).toBe(8);
  });

  it('reset clears stats and localStorage', () => {
    const { result } = renderHook(() => useStudyStats());

    act(() => {
      result.current.recordSession([{ id: 'q1', answer: 'a', jlpt: 'N5' }], { q1: 'a' });
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.stats.totalAnswered).toBe(0);
    expect(result.current.stats.totalCorrect).toBe(0);
    expect(result.current.stats.sessions).toEqual([]);
  });

  it('increments streak on consecutive study days', () => {
    const { result } = renderHook(() => useStudyStats());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    act(() => {
      result.current.replaceStats({
        lastStudyDate: todayKey(yesterday),
        streak: 2,
        totalCorrect: 0,
        totalAnswered: 0,
        byLevel: {},
        longestStreak: 2,
        sessions: [],
      });
    });

    act(() => {
      result.current.recordSession([{ id: 'q1', answer: 'a', jlpt: 'N5' }], { q1: 'a' });
    });

    expect(result.current.stats.streak).toBe(3);
    expect(result.current.stats.longestStreak).toBe(3);
  });

  it('syncs stats when another tab updates localStorage', () => {
    const { result } = renderHook(() => useStudyStats());

    const payload = JSON.stringify({
      schemaVersion: 1,
      data: { totalCorrect: 9, totalAnswered: 10, byLevel: {}, sessions: [] },
    });

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'kanjiApp:stats',
        newValue: payload,
      }));
    });

    expect(result.current.stats.totalCorrect).toBe(9);
    expect(result.current.stats.totalAnswered).toBe(10);
  });

  it('recordSession aggregates totals and per-level counts', () => {
    const { result } = renderHook(() => useStudyStats());

    const questions = [
      { id: 'q1', answer: 'a', jlpt: 'N5' },
      { id: 'q2', answer: 'b', jlpt: 'N5' },
      { id: 'q3', answer: 'c', jlpt: 'N4' },
    ];
    const answers = { q1: 'a', q2: 'wrong', q3: 'c' };

    act(() => {
      result.current.recordSession(questions, answers);
    });

    expect(result.current.stats.totalAnswered).toBe(3);
    expect(result.current.stats.totalCorrect).toBe(2);
    expect(result.current.stats.byLevel['5']).toEqual({ correct: 1, answered: 2 });
    expect(result.current.stats.byLevel['4']).toEqual({ correct: 1, answered: 1 });
    expect(result.current.stats.lastStudyDate).toBe(todayKey());
  });
});

describe('normalizeStats', () => {
  it('returns defaults for invalid input', () => {
    expect(normalizeStats(null).byLevel).toEqual({});
    expect(normalizeStats(undefined).totalAnswered).toBe(0);
  });

  it('coerces numeric fields and filters bad session rows', () => {
    const stats = normalizeStats({
      totalCorrect: '4',
      totalAnswered: '7',
      byLevel: { 5: { correct: '2', answered: '3' } },
      sessions: [{ date: '2026-01-01', correct: '1', answered: '2' }, null, 'bad'],
    });

    expect(stats.totalCorrect).toBe(4);
    expect(stats.totalAnswered).toBe(7);
    expect(stats.byLevel['5']).toEqual({ correct: 2, answered: 3 });
    expect(stats.sessions).toEqual([{ date: '2026-01-01', correct: 1, answered: 2 }]);
  });
});

describe('getDisplayStreak', () => {
  it('returns zero when there is no last study date', () => {
    expect(getDisplayStreak({ lastStudyDate: '', streak: 5 })).toBe(0);
  });

  it('returns the stored streak when the last study date is today', () => {
    expect(getDisplayStreak({ lastStudyDate: todayKey(), streak: 4 })).toBe(4);
  });
});
