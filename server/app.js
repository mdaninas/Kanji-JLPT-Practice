import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
} from '@anthropic-ai/sdk';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import {
  DEFAULT_MODEL,
  SUPPORTED_MODELS,
  generateKanjiReadingQuiz,
  resolveModel,
} from './kanjiReadingQuiz.js';
import { loadLocalEnv } from './loadEnv.js';
import { buildServerDeck } from './vocabLookup.js';
import { checkRateLimit, isProductionWithoutUpstash } from './rateLimit.js';

loadLocalEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageVersion = (() => {
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'),
    );
    return packageJson.version || process.env.npm_package_version || '0.0.0';
  } catch {
    return process.env.npm_package_version || '0.0.0';
  }
})();

const MAX_BODY_SIZE = 1_000_000;

export const app = new Hono();

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

function getClientIp(c) {
  const vercelForwarded = c.req.header('x-vercel-forwarded-for');
  if (vercelForwarded) {
    const first = vercelForwarded.split(',')[0].trim();
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
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) {
      return first;
    }
  }
  return 'unknown';
}

async function verifyTurnstileToken(token) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });
    const payload = await response.json();
    return Boolean(payload.success);
  } catch {
    return false;
  }
}

function getAnthropicErrorType(error) {
  return error?.error?.error?.type || error?.error?.type || error?.type || '';
}

function getAnthropicErrorResponse(error) {
  const errorType = getAnthropicErrorType(error);

  if (error?.status === 529 || errorType === 'overloaded_error') {
    return {
      body: {
        code: 'anthropic_overloaded',
        error: 'Anthropic API is temporarily overloaded. Try again shortly.',
      },
      status: 503,
    };
  }

  if (error instanceof AuthenticationError) {
    return {
      body: { code: 'anthropic_auth_error', error: 'Anthropic API key was rejected.' },
      status: 502,
    };
  }

  if (error instanceof PermissionDeniedError) {
    return {
      body: {
        code: 'anthropic_permission_error',
        error: 'Anthropic API key does not have access to this model.',
      },
      status: 502,
    };
  }

  if (error instanceof NotFoundError) {
    return {
      body: { code: 'anthropic_model_error', error: 'Anthropic model is unavailable.' },
      status: 502,
    };
  }

  if (error instanceof RateLimitError) {
    return {
      body: { code: 'rate_limited', error: 'Anthropic API rate limit hit.' },
      status: 429,
    };
  }

  if (error instanceof APIConnectionError || error instanceof APIConnectionTimeoutError) {
    return {
      body: { code: 'quiz_generation_failed', error: 'Failed to connect to Anthropic API.' },
      status: 503,
    };
  }

  if (error instanceof APIError) {
    if (error.status === 401 || errorType === 'authentication_error') {
      return {
        body: { code: 'anthropic_auth_error', error: 'Anthropic API key was rejected.' },
        status: 502,
      };
    }
    if (error.status === 403 || errorType === 'permission_error') {
      return {
        body: {
          code: 'anthropic_permission_error',
          error: 'Anthropic API key does not have access to this model.',
        },
        status: 502,
      };
    }
    if (error.status === 404 || errorType === 'not_found_error') {
      return {
        body: { code: 'anthropic_model_error', error: 'Anthropic model is unavailable.' },
        status: 502,
      };
    }
    if (error.status === 429 || errorType === 'rate_limit_error') {
      return {
        body: { code: 'rate_limited', error: 'Anthropic API rate limit hit.' },
        status: 429,
      };
    }
  }

  return null;
}

app.use(
  '/api/generate-reading-quiz',
  bodyLimit({
    maxSize: 32 * 1024,
    onError: (c) => c.json({ code: 'body_too_large', error: 'Request body is too large.' }, 413),
  }),
);

app.post('/api/generate-reading-quiz', async (c, next) => {
  if (isProductionWithoutUpstash()) {
    return c.json(
      {
        code: 'rate_limit_unconfigured',
        error: 'Production requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.',
      },
      503,
    );
  }

  const requestId = c.get('requestId');
  const ip = getClientIp(c);
  let result;
  try {
    result = await checkRateLimit(ip);
  } catch (error) {
    console.error(`[${requestId}] rate limit backend error`, error);
    return c.json(
      { code: 'rate_limit_unavailable', error: 'Rate limit service unavailable.' },
      503,
    );
  }

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

app.onError((error, c) => {
  const requestId = c.get('requestId') || '-';
  console.error(`[${requestId}] [api]`, error);

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
  return c.json({
    ok: true,
    supportedModels: SUPPORTED_MODELS,
    model: resolveModel(process.env.ANTHROPIC_MODEL) || DEFAULT_MODEL,
  });
});

app.get('/api/version', (c) => {
  return c.json({
    name: 'jlpt-kanji-api',
    version: packageVersion,
    model: resolveModel(process.env.ANTHROPIC_MODEL) || DEFAULT_MODEL,
  });
});

app.post('/api/generate-reading-quiz', async (c) => {
  const requestId = c.get('requestId');

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

  const explanationLanguage = body.explanationLanguage || 'id';
  let deck = body.deck;
  if (Array.isArray(body.selections) && body.selections.length > 0) {
    deck = buildServerDeck(body.selections, explanationLanguage);
  }
  if (!Array.isArray(deck) || deck.length === 0) {
    return c.json({ error: 'deck must be a non-empty array.' }, 400);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return c.json(
      { code: 'missing_api_key', error: 'ANTHROPIC_API_KEY is not configured.' },
      500,
    );
  }

  const turnstileOk = await verifyTurnstileToken(body.turnstileToken);
  if (!turnstileOk) {
    return c.json(
      { code: 'bot_verification_failed', error: 'Bot verification failed.' },
      403,
    );
  }

  try {
    const quiz = await generateKanjiReadingQuiz({
      deck,
      questionCount: Number(body.questionCount || 10),
      explanationLanguage,
      model: body.model,
    });
    return c.json({ quiz }, 200);
  } catch (error) {
    const anthropicError = getAnthropicErrorResponse(error);
    if (anthropicError) {
      return c.json(anthropicError.body, anthropicError.status);
    }
    console.error(`[${requestId}] quiz generation failed`, error);
    return c.json(
      { code: 'quiz_generation_failed', error: 'Failed to generate a valid quiz from the selected vocabulary.' },
      500,
    );
  }
});
