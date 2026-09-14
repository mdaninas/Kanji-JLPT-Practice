import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const MAX_REQUESTS = 10;
export const WINDOW_SECONDS = 60;
export const DAILY_LIMIT = Number(process.env.QUIZ_DAILY_LIMIT || 300);

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
    if (!timestamps) return [];
    let firstFresh = 0;
    while (firstFresh < timestamps.length && timestamps[firstFresh] <= cutoff) {
      firstFresh += 1;
    }
    const fresh = firstFresh === 0 ? timestamps : timestamps.slice(firstFresh);
    if (fresh.length === 0) hits.delete(ip);
    else if (fresh !== timestamps) hits.set(ip, fresh);
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
    for (const ip of hits.keys()) pruneIp(ip, cutoff);
  }

  function start() {
    if (sweepTimer) return;
    sweepTimer = setInterval(sweep, sweepIntervalMs);
    if (typeof sweepTimer.unref === 'function') sweepTimer.unref();
  }

  function stop() {
    if (sweepTimer) {
      clearInterval(sweepTimer);
      sweepTimer = null;
    }
  }

  return { check, sweep, start, stop, size: () => hits.size };
}

let backend = null;

function buildUpstashBackend(url, token) {
  const redis = new Redis({ url, token });
  const perIp = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(MAX_REQUESTS, `${WINDOW_SECONDS} s`),
    analytics: false,
    prefix: 'jlpt-kanji-quiz',
  });
  const globalDaily = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(DAILY_LIMIT, '1 d'),
    prefix: 'jlpt-kanji-quiz-global',
  });

  return {
    kind: 'upstash',
    async check(identifier) {
      const [ipResult, globalResult] = await Promise.all([
        perIp.limit(identifier),
        globalDaily.limit('global'),
      ]);

      const success = ipResult.success && globalResult.success;
      const out = {
        success,
        limit: ipResult.limit,
        remaining: Math.max(0, ipResult.remaining),
      };

      if (!success) {
        const resetMs = !globalResult.success ? globalResult.reset : ipResult.reset;
        out.retryAfter = Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
        out.code = !globalResult.success ? 'daily_limit_exceeded' : 'rate_limited';
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
      return {
        success: result.allowed,
        limit: result.limit,
        remaining: result.remaining,
        retryAfter: result.allowed ? 0 : result.retryAfter,
        code: result.allowed ? undefined : 'rate_limited',
      };
    },
  };
}

function getBackend() {
  if (backend) return backend;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  backend = url && token ? buildUpstashBackend(url, token) : buildMemoryBackend();
  return backend;
}

export function isProductionWithoutUpstash() {
  return Boolean(process.env.VERCEL) && !(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export async function checkRateLimit(identifier) {
  return getBackend().check(identifier);
}
