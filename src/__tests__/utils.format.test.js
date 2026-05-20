import { describe, expect, it } from 'vitest';
import { classifyQuizError, formatReadings, formatText } from '../utils.js';

describe('formatText', () => {
  it('substitutes named placeholders with params', () => {
    expect(formatText('en', 'available', { count: 12, level: 'N5' })).toBe('12 cards ready in N5.');
  });

  it('falls back to English when the language is missing', () => {
    expect(formatText('xx', 'reset')).toBe('Clear');
  });

  it('falls back to the English template when the key is not in the active language', () => {
    expect(formatText('ja', 'appInstall')).toBe('Install app');
  });

  it('returns the raw key when neither active nor English have it', () => {
    expect(formatText('en', 'thisKeyDoesNotExistAnywhere')).toBe('thisKeyDoesNotExistAnywhere');
  });

  it('replaces missing params with an empty string', () => {
    expect(formatText('en', 'available', { count: 3 })).toBe('3 cards ready in .');
  });

  it('uses an empty params object by default', () => {
    expect(formatText('en', 'available')).toBe(' cards ready in .');
  });

  it('supports Indonesian as the active language', () => {
    expect(formatText('id', 'reset')).toBe('Kosongkan');
  });
});

describe('formatReadings', () => {
  it('returns a dash when there are no readings', () => {
    expect(formatReadings([], 3)).toBe('-');
  });

  it('filters out falsy entries before deciding emptiness', () => {
    expect(formatReadings(['', null, undefined], 3)).toBe('-');
  });

  it('joins readings with a comma and a space', () => {
    expect(formatReadings(['ニチ', 'ジツ'], 3)).toBe('ニチ, ジツ');
  });

  it('appends a +N suffix when there are more readings than maxReadings', () => {
    expect(formatReadings(['ニチ', 'ジツ', 'ヒ'], 2)).toBe('ニチ, ジツ +1');
  });

  it('does not append a suffix when maxReadings exactly equals length', () => {
    expect(formatReadings(['ニチ', 'ジツ'], 2)).toBe('ニチ, ジツ');
  });

  it('ignores falsy entries when counting visible readings', () => {
    expect(formatReadings(['ひ', '', 'にち'], 5)).toBe('ひ, にち');
  });
});

describe('classifyQuizError', () => {
  it('returns quizErrorNoServer when data is missing', () => {
    expect(classifyQuizError(new Error('boom'), null)).toBe('quizErrorNoServer');
    expect(classifyQuizError(new Error('boom'), undefined)).toBe('quizErrorNoServer');
  });

  it('returns quizErrorNoApiKey when the server reports a missing_api_key code', () => {
    expect(classifyQuizError(null, { code: 'missing_api_key' })).toBe('quizErrorNoApiKey');
  });

  it('returns quizErrorRateLimit when the server returns status 429', () => {
    expect(classifyQuizError(null, { status: 429 })).toBe('quizErrorRateLimit');
  });

  it('returns quizErrorRateLimit when the error message mentions 429', () => {
    expect(classifyQuizError(new Error('Request failed: 429 rate limit'), {})).toBe('quizErrorRateLimit');
  });

  it('falls back to the generic quizError otherwise', () => {
    expect(classifyQuizError(new Error('boom'), {})).toBe('quizError');
    expect(classifyQuizError(null, { code: 'something_else', status: 500 })).toBe('quizError');
  });

  it('handles a null error without crashing', () => {
    expect(classifyQuizError(null, {})).toBe('quizError');
  });
});
