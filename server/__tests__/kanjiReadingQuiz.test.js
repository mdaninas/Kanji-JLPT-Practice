import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../app.js';
import { buildKanjiReadingPrompt, resolveModel } from '../kanjiReadingQuiz.js';
import { sanitizeDeckWithServerData } from '../vocabLookup.js';

describe('resolveModel', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('defaults to Sonnet 5.5 for unknown models', () => {
    vi.stubEnv('ALLOWED_MODELS', undefined);
    vi.stubEnv('ANTHROPIC_MODEL', undefined);
    expect(resolveModel('unknown-model')).toBe('claude-sonnet-5-5');
  });

  it('upgrades each legacy model ID to the same family', () => {
    vi.stubEnv('ALLOWED_MODELS', undefined);
    vi.stubEnv('ANTHROPIC_MODEL', 'claude-opus-4-7');
    expect(resolveModel()).toBe('claude-opus-5-5');
    expect(resolveModel('claude-sonnet-4-6')).toBe('claude-sonnet-5-5');
    expect(resolveModel('claude-haiku-4-5-20251001')).toBe('claude-haiku-5-5');
  });

  it('preserves allowed model families when an allowlist uses older IDs', () => {
    vi.stubEnv('ALLOWED_MODELS', 'claude-sonnet-4-6,claude-haiku-4-5-20251001');
    vi.stubEnv('ANTHROPIC_MODEL', 'claude-haiku-4-5-20251001');
    expect(resolveModel('claude-sonnet-5-5')).toBe('claude-sonnet-5-5');
    expect(resolveModel('claude-haiku-5-5')).toBe('claude-haiku-5-5');
    expect(resolveModel('claude-opus-5-5')).toBe('claude-haiku-5-5');
  });
});

describe('sanitizeDeckWithServerData', () => {
  it('overrides client readings with server dataset values', () => {
    const deck = [{
      kanji: '日',
      vocab: [{ word: '日本', reading: 'wrong-reading', translation: 'ignored' }],
    }];
    const sanitized = sanitizeDeckWithServerData(deck, 'en');
    expect(sanitized[0].vocab[0].reading).not.toBe('wrong-reading');
    expect(sanitized[0].vocab[0].translation).toBeTruthy();
  });

  it('uses Simplified Chinese meanings and explanations in a Chinese quiz', () => {
    const deck = sanitizeDeckWithServerData([{
      kanji: '手',
      vocab: [{ word: '手紙', reading: 'てがみ', translation: 'letter' }],
    }], 'zh-Hans');

    expect(deck[0].vocab[0]).toMatchObject({ word: '手紙', reading: 'てがみ', translation: expect.stringMatching(/信/u) });
    expect(buildKanjiReadingPrompt({ deck, explanationLanguage: 'zh-Hans' })).toContain('Simplified Chinese');
  });
});

describe('GET /api/health', () => {
  it('returns ok, supportedModels, and model without hasApiKey', async () => {
    const response = await app.request('/api/health');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.supportedModels)).toBe(true);
    expect(body.supportedModels).toEqual(['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5']);
    expect(typeof body.model).toBe('string');
    expect(body).not.toHaveProperty('hasApiKey');
  });
});

describe('POST /api/generate-reading-quiz route', () => {
  it('returns 400 when deck is empty', async () => {
    const response = await app.request('/api/generate-reading-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deck: [] }),
    });
    expect(response.status).toBe(400);
  });

  it('returns 413 for oversized payload', async () => {
    const bigDeck = [{
      kanji: '日',
      vocab: [{ word: '日本', reading: 'にほん', translation: 'x'.repeat(40_000) }],
    }];
    const response = await app.request('/api/generate-reading-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deck: bigDeck }),
    });
    expect(response.status).toBe(413);
  });
});
