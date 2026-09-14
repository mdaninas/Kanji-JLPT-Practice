import { describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { resolveModel } from '../kanjiReadingQuiz.js';
import { sanitizeDeckWithServerData } from '../vocabLookup.js';

describe('resolveModel', () => {
  it('falls back to default for unknown models', () => {
    expect(resolveModel('unknown-model')).toBe('claude-sonnet-4-6');
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
});

describe('GET /api/health', () => {
  it('returns ok, supportedModels, and model without hasApiKey', async () => {
    const response = await app.request('/api/health');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.supportedModels)).toBe(true);
    expect(body.supportedModels.length).toBeGreaterThan(0);
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
