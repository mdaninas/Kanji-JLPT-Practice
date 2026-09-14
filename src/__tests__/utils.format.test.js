import { describe, expect, it } from 'vitest';
import {
  classifyQuizError,
  formatQuizExplanation,
  formatReadings,
  formatText,
  resolveQuizErrorKey,
} from '../utils.js';

describe('formatText', () => {
  it('substitutes named placeholders with params', () => {
    expect(formatText('en', 'available', { count: 12, level: 'N5' })).toBe('12 cards ready in N5.');
  });

  it('falls back to English when the language is missing', () => {
    expect(formatText('xx', 'reset')).toBe('Clear');
  });

  it('falls back to English when the language is unsupported', () => {
    expect(formatText('xx', 'appInstall')).toBe('Install app');
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

describe('formatQuizExplanation', () => {
  it('returns short_explanation when present', () => {
    expect(formatQuizExplanation('en', {
      short_explanation: 'Custom note from the model.',
      target_vocab: '日本',
      answer_reading: 'にほん',
    })).toBe('Custom note from the model.');
  });

  it('falls back to the template when short_explanation is empty', () => {
    expect(formatQuizExplanation('en', {
      short_explanation: '   ',
      target_vocab: '日本',
      answer_reading: 'にほん',
    })).toBe('"日本" is read as "にほん".');
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
  it('returns quizErrorNoServer when data is missing and no HTTP status', () => {
    expect(classifyQuizError(new Error('boom'), null)).toBe('quizErrorNoServer');
    expect(classifyQuizError(new Error('boom'), undefined)).toBe('quizErrorNoServer');
  });

  it('returns quizError when the server responded but the body was not JSON', () => {
    expect(classifyQuizError(new Error('invalid json'), null, 502)).toBe('quizError');
  });

  it('returns quizErrorTimeout for AbortError without response data', () => {
    expect(classifyQuizError({ name: 'AbortError' }, null)).toBe('quizErrorTimeout');
  });

  it('returns quizErrorNoApiKey when the server reports a missing_api_key code', () => {
    expect(classifyQuizError(null, { code: 'missing_api_key' })).toBe('quizErrorNoApiKey');
  });

  it('returns quizErrorOverloaded when the server reports anthropic_overloaded', () => {
    expect(classifyQuizError(null, { code: 'anthropic_overloaded' }, 503)).toBe('quizErrorOverloaded');
  });

  it('returns anthropic-specific keys for auth, permission, and model errors', () => {
    expect(classifyQuizError(null, { code: 'anthropic_auth_error' })).toBe('quizErrorAnthropicAuth');
    expect(classifyQuizError(null, { code: 'anthropic_permission_error' })).toBe('quizErrorAnthropicPermission');
    expect(classifyQuizError(null, { code: 'anthropic_model_error' })).toBe('quizErrorAnthropicModel');
  });

  it('returns quizError for body_too_large responses', () => {
    expect(classifyQuizError(null, { code: 'body_too_large' })).toBe('quizError');
  });

  it('returns quizErrorRateLimit when the server returns HTTP 429', () => {
    expect(classifyQuizError(null, { code: 'rate_limited', retryAfter: 60 }, 429)).toBe('quizErrorRateLimit');
  });

  it('returns quizErrorRateLimit when the server body uses rate_limited code', () => {
    expect(classifyQuizError(null, { code: 'rate_limited', retryAfter: 42 })).toBe('quizErrorRateLimit');
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

describe('resolveQuizErrorKey', () => {
  it('returns dev-only keys unchanged while running tests', () => {
    expect(resolveQuizErrorKey('quizErrorNoServer')).toBe('quizErrorNoServer');
    expect(resolveQuizErrorKey('quizErrorOverloaded')).toBe('quizErrorOverloaded');
  });
});
