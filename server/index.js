import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import {
  DEFAULT_MODEL,
  SUPPORTED_MODELS,
  generateKanjiReadingQuiz,
  resolveModel,
} from './kanjiReadingQuiz.js';
import { loadLocalEnv } from './loadEnv.js';
import { checkRateLimit } from './rateLimit.js';

loadLocalEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'),
);

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8787);
const ALLOWED_ORIGIN = process.env.APP_ORIGIN || 'http://127.0.0.1:5173';
const MAX_BODY_SIZE = 1_000_000;

const app = new Hono();

app.use('*', async (c, next) => {
  const requestId = randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-Id', requestId);

  const start = Date.now();
  console.log(`[${requestId}] --> ${c.req.method} ${c.req.path}`);

  await next();

  const elapsed = Date.now() - start;
  console.log(
    `[${requestId}] <-- ${c.req.method} ${c.req.path} ${c.res.status} ${elapsed}ms`,
  );
});

app.use(
  '*',
  cors({
    origin: ALLOWED_ORIGIN,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    exposeHeaders: ['X-Request-Id'],
    maxAge: 600,
  }),
);

function getClientIp(c) {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) {
      return first;
    }
  }
  const realIp = c.req.header('x-real-ip');
  if (realIp) {
    const trimmed = realIp.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return 'unknown';
}

app.post('/api/generate-reading-quiz', async (c, next) => {
  const requestId = c.get('requestId');
  const ip = getClientIp(c);
  const result = await checkRateLimit(ip);

  c.header('X-RateLimit-Limit', String(result.limit));
  c.header('X-RateLimit-Remaining', String(result.remaining));

  if (!result.success) {
    const retryAfter = result.retryAfter ?? 0;
    console.log(`[${requestId}] rate limited ip=${ip} retryAfter=${retryAfter}s`);
    c.header('Retry-After', String(retryAfter));
    return c.json(
      {
        code: 'rate_limited',
        error: `Too many requests. Try again in ${retryAfter}s.`,
        retryAfter,
      },
      429,
    );
  }

  await next();
});

// Centralized error handler.
app.onError((error, c) => {
  const requestId = c.get('requestId') || '-';
  console.error(`[${requestId}] [api]`, error);

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

app.get('/api/health', (c) => {
  const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const body = {
    ok: true,
    hasApiKey,
    model: resolveModel(process.env.ANTHROPIC_MODEL) || DEFAULT_MODEL,
  };
  if (hasApiKey) {
    body.supportedModels = SUPPORTED_MODELS;
  }
  return c.json(body);
});

app.get('/api/version', (c) => {
  return c.json({
    name: 'jlpt-kanji-api',
    version: packageJson.version,
    model: resolveModel(process.env.ANTHROPIC_MODEL) || DEFAULT_MODEL,
  });
});

app.post('/api/generate-reading-quiz', async (c) => {
  const requestId = c.get('requestId');

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

  if (body.model !== undefined && !SUPPORTED_MODELS.includes(body.model)) {
    return c.json(
      {
        code: 'unsupported_model',
        error: 'Unsupported model.',
        supportedModels: SUPPORTED_MODELS,
      },
      400,
    );
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
      model: body.model,
    });
    return c.json({ quiz }, 200);
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('rate_limit') || message.includes('429')) {
      return c.json({ code: 'rate_limited', error: 'Anthropic API rate limit hit.' }, 429);
    }
    console.error(`[${requestId}] quiz generation failed`, error);
    return c.json(
      { code: 'quiz_generation_failed', error: 'Failed to generate a valid quiz from the selected vocabulary.' },
      500,
    );
  }
});

serve({ fetch: app.fetch, hostname: HOST, port: PORT }, (info) => {
  console.log(`Anthropic quiz API (Hono) running at http://${info.address}:${info.port}`);
});
