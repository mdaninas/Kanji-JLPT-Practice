import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { generateKanjiReadingQuiz } from './kanjiReadingQuiz.js';
import { loadLocalEnv } from './loadEnv.js';

loadLocalEnv();

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8787);
const ALLOWED_ORIGIN = process.env.APP_ORIGIN || 'http://127.0.0.1:5173';
const MAX_BODY_SIZE = 1_000_000;

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: ALLOWED_ORIGIN,
    allowMethods: ['POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    maxAge: 600,
  }),
);

// Centralized error handler.
app.onError((error, c) => {
  console.error('[api]', error);

  if (error.code === 'BODY_TOO_LARGE') {
    return c.json({ error: 'Request body is too large.' }, 413);
  }
  if (error.name === 'SyntaxError') {
    return c.json({ error: 'Request body must be valid JSON.' }, 400);
  }
  return c.json(
    { code: 'quiz_generation_failed', error: 'Failed to generate a valid quiz from the selected vocabulary.' },
    500,
  );
});

app.notFound((c) => c.json({ error: 'Not found.' }, 404));

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  }),
);

app.post('/api/generate-reading-quiz', async (c) => {
  // Manual content-length guard since Hono doesn't enforce a default body cap.
  const contentLength = Number(c.req.header('content-length') || 0);
  if (contentLength > MAX_BODY_SIZE) {
    return c.json({ error: 'Request body is too large.' }, 413);
  }

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Request body must be valid JSON.' }, 400);
  }

  if (!Array.isArray(body.deck) || body.deck.length === 0) {
    return c.json({ error: 'deck must be a non-empty array.' }, 400);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return c.json(
      { code: 'missing_api_key', error: 'ANTHROPIC_API_KEY is not configured.' },
      500,
    );
  }

  try {
    const quiz = await generateKanjiReadingQuiz({
      deck: body.deck,
      questionCount: Number(body.questionCount || 10),
      explanationLanguage: body.explanationLanguage,
    });
    return c.json({ quiz }, 200);
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('rate_limit') || message.includes('429')) {
      return c.json({ code: 'rate_limited', error: 'Anthropic API rate limit hit.' }, 429);
    }
    console.error(error);
    return c.json(
      { code: 'quiz_generation_failed', error: 'Failed to generate a valid quiz from the selected vocabulary.' },
      500,
    );
  }
});

serve({ fetch: app.fetch, hostname: HOST, port: PORT }, (info) => {
  console.log(`Anthropic quiz API (Hono) running at http://${info.address}:${info.port}`);
});
