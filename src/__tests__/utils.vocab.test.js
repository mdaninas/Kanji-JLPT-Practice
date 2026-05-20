import { describe, expect, it } from 'vitest';
import { vocabSortForLevels } from '../utils.js';

const makeVocab = (overrides) => ({
  id: 'x',
  level: 5,
  word: 'あ',
  reading: 'あ',
  translation: '',
  ...overrides,
});

const sortWith = (levels, items) => [...items].sort(vocabSortForLevels(levels));

describe('vocabSortForLevels', () => {
  it('places vocab in the active level set before others', () => {
    const items = [
      makeVocab({ level: 4, word: 'い' }),
      makeVocab({ level: 3, word: 'う' }),
      makeVocab({ level: 5, word: 'え' }),
    ];
    const result = sortWith([3], items);
    expect(result[0].level).toBe(3);
    expect(result.slice(1).map((item) => item.level).sort()).toEqual([4, 5]);
  });

  it('orders inactive vocab by absolute distance to the nearest active level', () => {
    const items = [
      makeVocab({ level: 1, word: 'a' }),
      makeVocab({ level: 4, word: 'b' }),
      makeVocab({ level: 2, word: 'c' }),
    ];
    const result = sortWith([3], items);
    expect(result.map((item) => item.level)).toEqual([4, 2, 1]);
  });

  it('when two inactive vocab tie on distance, the higher level value wins', () => {
    const items = [
      makeVocab({ level: 2, word: 'a' }),
      makeVocab({ level: 4, word: 'b' }),
    ];
    const [first, second] = sortWith([3], items);
    expect(first.level).toBe(4);
    expect(second.level).toBe(2);
  });

  it('treats every level as active when the input list is empty', () => {
    const items = [
      makeVocab({ level: 1, word: 'a' }),
      makeVocab({ level: 5, word: 'b' }),
    ];
    const result = sortWith([], items);
    expect(result[0].level).toBe(5);
    expect(result[1].level).toBe(1);
  });

  it('breaks ties on equal level by word length (shorter first)', () => {
    const items = [
      makeVocab({ level: 5, word: 'ありがとう' }),
      makeVocab({ level: 5, word: 'あ' }),
      makeVocab({ level: 5, word: 'あい' }),
    ];
    const result = sortWith([5], items);
    expect(result.map((item) => item.word)).toEqual(['あ', 'あい', 'ありがとう']);
  });

  it('breaks ties on equal level and length by locale comparison', () => {
    const items = [
      makeVocab({ level: 5, word: 'う' }),
      makeVocab({ level: 5, word: 'あ' }),
      makeVocab({ level: 5, word: 'い' }),
    ];
    const result = sortWith([5], items);
    expect(result.map((item) => item.word)).toEqual(['あ', 'い', 'う']);
  });

  it('is stable enough to keep originally-passed items intact (no mutation)', () => {
    const items = [
      makeVocab({ level: 2, word: 'a' }),
      makeVocab({ level: 5, word: 'b' }),
    ];
    const snapshot = items.map((item) => item.word);
    sortWith([5], items);
    expect(items.map((item) => item.word)).toEqual(snapshot);
  });
});
