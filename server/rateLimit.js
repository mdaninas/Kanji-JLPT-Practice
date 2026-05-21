// Rate limiter for the quiz endpoint.
//
// Two backends are supported and chosen lazily on the first call to
// `checkRateLimit`:
//   - Upstash Redis sliding window (UPSTASH_REDIS_REST_URL +
//     UPSTASH_REDIS_REST_TOKEN must both be set). Safe for stateless
//     serverless deployments where each invocation may hit a fresh
//     instance.
//   - In-memory sliding window fallback for local development and unit
//     tests. Auto-cleans expired entries via a periodic sweep, so the
//     Map cannot grow without bound.
//
// `createRateLimiter` is the pure in-memory implementation and is exported
// so unit tests can drive it with an injected clock.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const MAX_REQUESTS = 10;
export const WINDOW_SECONDS = 60;

const WINDOW_MS = WINDOW_SECONDS * 1000;

export function createRateLimiter({
  limit = MAX_REQUESTS,
  windowMs = WINDOW_MS,
  now = () => Date.now(),
  sweepIntervalMs = windowMs,
} = {}) {
  const hits = new Map();
  let sweepTimer = null;

  function pruneIp(ip, cutoff) {
    const timestamps = hits.get(ip);
    if (!timestamps) {
      return [];
    }
    let firstFresh = 0;
    while (firstFresh < timestamps.length && timestamps[firstFresh] <= cutoff) {
      firstFresh += 1;
    }
    const fresh = firstFresh === 0 ? timestamps : timestamps.slice(firstFresh);
    if (fresh.length === 0) {
      hits.delete(ip);
    } else if (fresh !== timestamps) {
      hits.set(ip, fresh);
    }
    return fresh;
  }

  function check(ip) {
    const t = now();
    const cutoff = t - windowMs;
    const fresh = pruneIp(ip, cutoff);

    if (fresh.length >= limit) {
      const oldest = fresh[0];
      const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - t) / 1000));
      return { allowed: false, retryAfter, limit, remaining: 0 };
    }

    fresh.push(t);
    hits.set(ip, fresh);
    return { allowed: true, retryAfter: 0, limit, remaining: limit - fresh.length };
  }

  function sweep() {
    const cutoff = now() - windowMs;
    for (const ip of hits.keys()) {
      pruneIp(ip, cutoff);
    }
  }

  function start() {
    if (sweepTimer) {
      return;
    }
    sweepTimer = setInterval(sweep, sweepIntervalMs);
    if (typeof sweepTimer.unref === 'function') {
      sweepTimer.unref();
    }
  }

  function stop() {
    if (sweepTimer) {
      clearInterval(sweepTimer);
      sweepTimer = null;
    }
  }

  return {
    check,
    sweep,
    start,
    stop,
    size: () => hits.size,
  };
}

// Backend is selected once per process. Re-reading env per request would
// let a stale or partial config win silently between requests.
let backend = null;

function buildUpstashBackend(url, token) {
  const redis = new Redis({ url, token });
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(MAX_REQUESTS, `${WINDOW_SECONDS} s`),
    analytics: false,
    prefix: 'jlpt-kanji-quiz',
  });

  return {
    kind: 'upstash',
    async check(identifier) {
      const result = await ratelimit.limit(identifier);
      const out = {
        success: result.success,
        limit: result.limit,
        remaining: Math.max(0, result.remaining),
      };
      if (!result.success) {
        out.retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
      }
      return out;
    },
  };
}

function buildMemoryBackend() {
  console.warn(
    'Rate limit running in memory (dev mode). Set UPSTASH_REDIS_REST_URL for production.',
  );
  const limiter = createRateLimiter({ limit: MAX_REQUESTS, windowMs: WINDOW_MS });
  limiter.start();

  return {
    kind: 'memory',
    async check(identifier) {
      const result = limiter.check(identifier);
      const out = {
        success: result.allowed,
        limit: result.limit,
        remaining: result.remaining,
      };
      if (!result.allowed) {
        out.retryAfter = result.retryAfter;
      }
      return out;
    },
  };
}

function getBackend() {
  if (backend) {
    return backend;
  }
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  backend = url && token ? buildUpstashBackend(url, token) : buildMemoryBackend();
  return backend;
}

export async function checkRateLimit(identifier) {
  return getBackend().check(identifier);
}
