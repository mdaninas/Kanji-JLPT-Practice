// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useProgress } from '../../hooks/useProgress.js';
import { STORAGE_KEYS } from '../../storageKeys.js';

function makeQuestion(id, kanji, answer = 'a') {
  return {
    id,
    target_kanji: kanji,
    answer,
  };
}

describe('useProgress', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('aggregates multiple quiz questions per kanji into one session level change', () => {
    const { result } = renderHook(() => useProgress());

    const questions = [
      makeQuestion('q1', '日', 'a'),
      makeQuestion('q2', '日', 'b'),
      makeQuestion('q3', '日', 'c'),
    ];
    const answers = { q1: 'a', q2: 'b', q3: 'c' };

    act(() => {
      result.current.recordQuizResults(questions, answers);
    });

    expect(result.current.progress['日'].level).toBe(1);
    expect(result.current.progress['日'].correct).toBe(3);
    expect(result.current.progress['日'].incorrect).toBe(0);
  });

  it('does not jump multiple levels when several questions for one kanji are all correct', () => {
    const { result } = renderHook(() => useProgress());

    act(() => {
      result.current.replaceProgress({
        日: { level: 2, correct: 5, incorrect: 1, nextReview: 0 },
      });
    });

    const questions = [
      makeQuestion('q1', '日', 'a'),
      makeQuestion('q2', '日', 'b'),
      makeQuestion('q3', '日', 'c'),
      makeQuestion('q4', '日', 'd'),
    ];
    const answers = { q1: 'a', q2: 'b', q3: 'c', q4: 'd' };

    act(() => {
      result.current.recordQuizResults(questions, answers);
    });

    expect(result.current.progress['日'].level).toBe(3);
  });

  it('resets level when any question for a due kanji is wrong', () => {
    const { result } = renderHook(() => useProgress());

    act(() => {
      result.current.replaceProgress({
        日: { level: 3, correct: 10, incorrect: 2, nextReview: 0 },
      });
    });

    const questions = [
      makeQuestion('q1', '日', 'a'),
      makeQuestion('q2', '日', 'b'),
    ];
    const answers = { q1: 'a', q2: 'wrong' };

    act(() => {
      result.current.recordQuizResults(questions, answers);
    });

    expect(result.current.progress['日'].level).toBe(0);
  });

  it('does not level up when the kanji is not yet due', () => {
    const { result } = renderHook(() => useProgress());
    const future = Date.now() + 86_400_000;

    act(() => {
      result.current.replaceProgress({
        日: { level: 2, correct: 4, incorrect: 0, nextReview: future },
      });
    });

    act(() => {
      result.current.recordQuizResults(
        [makeQuestion('q1', '日', 'a')],
        { q1: 'a' },
      );
    });

    expect(result.current.progress['日'].level).toBe(2);
    expect(result.current.progress['日'].correct).toBe(5);
  });

  it('syncs progress when another tab updates localStorage', () => {
    const { result } = renderHook(() => useProgress());

    const payload = JSON.stringify({
      schemaVersion: 1,
      data: { 木: { level: 1, correct: 2, incorrect: 0 } },
    });

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: STORAGE_KEYS.progress,
        newValue: payload,
      }));
    });

    expect(result.current.progress['木']).toEqual({ level: 1, correct: 2, incorrect: 0 });
  });

  it('clears progress when storage is removed in another tab', () => {
    const { result } = renderHook(() => useProgress());

    act(() => {
      result.current.replaceProgress({ 日: { level: 1, correct: 1, incorrect: 0 } });
    });

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: STORAGE_KEYS.progress,
        newValue: null,
      }));
    });

    expect(result.current.progress).toEqual({});
  });

  it('recordResult tracks single-answer sessions', () => {
    const { result } = renderHook(() => useProgress());

    act(() => {
      result.current.recordResult('水', true);
      result.current.recordResult('水', false);
    });

    expect(result.current.progress['水'].correct).toBe(1);
    expect(result.current.progress['水'].incorrect).toBe(1);
  });

  it('reports kanji status for new, mastered, weak, due, and learning entries', () => {
    const { result } = renderHook(() => useProgress());
    const future = Date.now() + 86_400_000;

    act(() => {
      result.current.replaceProgress({
        日: { level: 5, correct: 20, incorrect: 0, nextReview: future },
        月: { level: 2, correct: 2, incorrect: 5, nextReview: 0 },
        火: { level: 1, correct: 3, incorrect: 1, nextReview: 0 },
        水: { level: 2, correct: 4, incorrect: 1, nextReview: future },
      });
    });

    expect(result.current.getKanjiStatus('新')).toBe('new');
    expect(result.current.getKanjiStatus('日')).toBe('mastered');
    expect(result.current.getKanjiStatus('月')).toBe('weak');
    expect(result.current.getKanjiStatus('火')).toBe('due');
    expect(result.current.getKanjiStatus('水')).toBe('learning');
  });

  it('summarizes mastered, weak, and due counts', () => {
    const { result } = renderHook(() => useProgress());
    const future = Date.now() + 86_400_000;

    act(() => {
      result.current.replaceProgress({
        日: { level: 5, correct: 20, incorrect: 0, nextReview: future },
        月: { level: 2, correct: 2, incorrect: 5, nextReview: future },
        火: { level: 1, correct: 3, incorrect: 1, nextReview: 0 },
      });
    });

    expect(result.current.getProgressStats(['日', '月', '火', '水'])).toEqual({
      mastered: 1,
      weak: 1,
      due: 1,
    });
  });

  it('returns due kanji characters only', () => {
    const { result } = renderHook(() => useProgress());
    const future = Date.now() + 86_400_000;

    act(() => {
      result.current.replaceProgress({
        日: { level: 1, correct: 1, incorrect: 0, nextReview: 0 },
        月: { level: 1, correct: 1, incorrect: 0, nextReview: future },
      });
    });

    expect(result.current.getDueKanji(['日', '月'])).toEqual(['日']);
  });

  it('skips questions without a target kanji when aggregating quiz results', () => {
    const { result } = renderHook(() => useProgress());

    act(() => {
      result.current.recordQuizResults(
        [{ id: 'q1', answer: 'a' }],
        { q1: 'a' },
      );
    });

    expect(result.current.progress).toEqual({});
  });
});
