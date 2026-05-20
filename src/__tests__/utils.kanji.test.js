import { describe, expect, it } from 'vitest';
import {
  KANJI_SORT_MODES,
  getUniqueKanjiCharacters,
  normalizeKanji,
  sortKanjiList,
} from '../utils.js';

describe('normalizeKanji', () => {
  const rawKanji = {
    日: {
      kanji: '日',
      freq_mainichi_shinbun: 2,
      grade: 1,
      heisig_en: 'sun',
      kun_readings: ['ひ'],
      meanings: ['day', 'sun'],
      on_readings: ['ニチ'],
      stroke_count: 4,
    },
    本: {
      kanji: '本',
      freq_mainichi_shinbun: 1,
      grade: 1,
      heisig_en: 'book',
      kun_readings: ['もと'],
      meanings: ['book', 'origin'],
      on_readings: ['ホン'],
      stroke_count: 5,
    },
  };

  it('shapes raw entries into the canonical kanji form', () => {
    const [first] = normalizeKanji(rawKanji, 5);
    expect(first).toMatchObject({
      character: '本',
      freq: 1,
      grade: 1,
      heisig: 'book',
      jlpt: 5,
      kunReadings: ['もと'],
      meanings: ['book', 'origin'],
      onReadings: ['ホン'],
      strokeCount: 5,
    });
  });

  it('sorts the result ascending by freq', () => {
    const result = normalizeKanji(rawKanji, 5);
    expect(result.map((item) => item.character)).toEqual(['本', '日']);
  });

  it('falls back to MAX_SAFE_INTEGER when freq is missing', () => {
    const result = normalizeKanji(
      {
        a: { kanji: '見', freq_mainichi_shinbun: 10 },
        b: { kanji: '聞' },
      },
      5,
    );
    expect(result[0].character).toBe('見');
    expect(result[1].freq).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('falls back to the entry key when detail.kanji is missing', () => {
    const result = normalizeKanji({ 木: { freq_mainichi_shinbun: 3 } }, 5);
    expect(result[0].character).toBe('木');
  });

  it('defaults missing arrays to empty', () => {
    const result = normalizeKanji({ 火: { kanji: '火', freq_mainichi_shinbun: 9 } }, 5);
    expect(result[0].kunReadings).toEqual([]);
    expect(result[0].onReadings).toEqual([]);
    expect(result[0].meanings).toEqual([]);
    expect(result[0].heisig).toBe('');
  });
});

describe('sortKanjiList', () => {
  const items = [
    { character: '日', freq: 2, grade: 2 },
    { character: '本', freq: 1, grade: 1 },
    { character: '火', freq: 9, grade: null },
    { character: '木', freq: 9, grade: 1 },
  ];

  it('returns input unchanged for the default mode', () => {
    const result = sortKanjiList(items, KANJI_SORT_MODES.default);
    expect(result).toBe(items);
  });

  it('sorts ascending by freq for freq mode (and does not mutate input)', () => {
    const result = sortKanjiList(items, KANJI_SORT_MODES.freq);
    expect(result).not.toBe(items);
    // 本 (freq 1) and 日 (freq 2) are unambiguous; 火 and 木 tie at freq 9 and
    // fall back to locale comparison, so we assert the freq order and let
    // locale decide the tie-break (compared dynamically below).
    expect(result.slice(0, 2).map((kanji) => kanji.character)).toEqual(['本', '日']);
    const tail = result.slice(2).map((kanji) => kanji.character);
    const expectedTail = ['火', '木'].sort((a, b) => a.localeCompare(b, 'ja'));
    expect(tail).toEqual(expectedTail);
  });

  it('sorts grade mode by grade then freq, with null grade sinking to the bottom', () => {
    const result = sortKanjiList(items, KANJI_SORT_MODES.grade);
    expect(result.map((kanji) => kanji.character)).toEqual(['本', '木', '日', '火']);
  });

  it('uses locale comparison to break ties when freq is equal', () => {
    const tied = [
      { character: '日', freq: 5 },
      { character: '一', freq: 5 },
    ];
    const result = sortKanjiList(tied, KANJI_SORT_MODES.freq);
    expect(result.map((kanji) => kanji.character)).toEqual(
      [...tied].sort((a, b) => a.character.localeCompare(b.character, 'ja')).map((k) => k.character),
    );
  });
});

describe('getUniqueKanjiCharacters', () => {
  it('returns only kanji characters, in order of first appearance', () => {
    expect(getUniqueKanjiCharacters('日本語')).toEqual(['日', '本', '語']);
  });

  it('strips kana and ASCII', () => {
    expect(getUniqueKanjiCharacters('食べる123')).toEqual(['食']);
  });

  it('deduplicates repeated kanji', () => {
    expect(getUniqueKanjiCharacters('日々日本')).toEqual(['日', '本']);
  });

  it('returns an empty array when the word has no kanji', () => {
    expect(getUniqueKanjiCharacters('ひらがな')).toEqual([]);
  });
});
