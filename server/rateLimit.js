// Sliding-window per-IP rate limiter. Pure JS, no deps.
//
// `now` and `sweepIntervalMs` are injectable so tests can drive time
// without real timers. In production, call `start()` to enable a periodic
// sweep that removes entries whose timestamps have all expired — this is
// what keeps the Map from growing for IPs that hit once and never return.

export const DEFAULT_LIMIT = 10;
export const DEFAULT_WINDOW_MS = 60_000;

export function createRateLimiter({
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS,
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
      return { allowed: false, retryAfter };
    }

    fresh.push(t);
    hits.set(ip, fresh);
    return { allowed: true, retryAfter: 0 };
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
