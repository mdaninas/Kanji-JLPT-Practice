import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '../rateLimit.js';

function controlledClock(start = 1_700_000_000_000) {
  let current = start;
  return {
    now: () => current,
    advance: (ms) => {
      current += ms;
    },
    set: (value) => {
      current = value;
    },
  };
}

describe('createRateLimiter', () => {
  it('allows requests up to the limit within the window', () => {
    const clock = controlledClock();
    const limiter = createRateLimiter({ limit: 10, windowMs: 60_000, now: clock.now });

    for (let index = 0; index < 10; index += 1) {
      expect(limiter.check('1.1.1.1').allowed).toBe(true);
    }
  });

  it('rejects the 11th request inside the window with a retryAfter in seconds', () => {
    const clock = controlledClock();
    const limiter = createRateLimiter({ limit: 10, windowMs: 60_000, now: clock.now });

    for (let index = 0; index < 10; index += 1) {
      limiter.check('1.1.1.1');
    }

    const blocked = limiter.check('1.1.1.1');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBe(60);
  });

  it('shrinks retryAfter as time passes inside the window', () => {
    const clock = controlledClock();
    const limiter = createRateLimiter({ limit: 10, windowMs: 60_000, now: clock.now });

    for (let index = 0; index < 10; index += 1) {
      limiter.check('1.1.1.1');
    }

    clock.advance(45_000);
    expect(limiter.check('1.1.1.1')).toEqual({
      allowed: false,
      retryAfter: 15,
      limit: 10,
      remaining: 0,
    });
  });

  it('allows the IP again after the sliding window passes', () => {
    const clock = controlledClock();
    const limiter = createRateLimiter({ limit: 10, windowMs: 60_000, now: clock.now });

    for (let index = 0; index < 10; index += 1) {
      limiter.check('1.1.1.1');
    }
    expect(limiter.check('1.1.1.1').allowed).toBe(false);

    clock.advance(60_001);
    expect(limiter.check('1.1.1.1').allowed).toBe(true);
  });

  it('tracks IPs independently', () => {
    const clock = controlledClock();
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, now: clock.now });

    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(false);

    expect(limiter.check('b').allowed).toBe(true);
    expect(limiter.check('b').allowed).toBe(true);
    expect(limiter.check('b').allowed).toBe(false);
  });

  it('honors a sliding window (not a fixed bucket)', () => {
    const clock = controlledClock();
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: clock.now });

    limiter.check('x');
    clock.advance(20_000);
    limiter.check('x');
    clock.advance(20_000);
    limiter.check('x');
    expect(limiter.check('x').allowed).toBe(false);

    clock.advance(21_000); // first hit now older than 60s, others still inside
    expect(limiter.check('x').allowed).toBe(true);
    expect(limiter.check('x').allowed).toBe(false);
  });

  it('drops IP entries once their timestamps expire (no memory leak)', () => {
    const clock = controlledClock();
    const limiter = createRateLimiter({ limit: 10, windowMs: 60_000, now: clock.now });

    limiter.check('a');
    limiter.check('b');
    limiter.check('c');
    expect(limiter.size()).toBe(3);

    clock.advance(60_001);
    limiter.sweep();
    expect(limiter.size()).toBe(0);
  });

  it('prunes expired timestamps for an IP on its next check', () => {
    const clock = controlledClock();
    const limiter = createRateLimiter({ limit: 10, windowMs: 60_000, now: clock.now });

    for (let index = 0; index < 5; index += 1) {
      limiter.check('a');
    }
    clock.advance(60_001);
    limiter.check('a');
    // Only the fresh hit should remain — without pruning, sliding window would
    // have inherited 5 stale timestamps and `size()` would still show entries
    // pointing at old data.
    clock.advance(60_001);
    limiter.sweep();
    expect(limiter.size()).toBe(0);
  });

  it('start() and stop() manage the sweep timer without throwing', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, sweepIntervalMs: 60_000 });
    expect(() => {
      limiter.start();
      limiter.start(); // idempotent
      limiter.stop();
      limiter.stop(); // idempotent
    }).not.toThrow();
  });
});
