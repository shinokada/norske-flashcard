import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('$env/dynamic/public', () => ({ env: {} }));

import {
  CONTENT_LIMITS,
  TOTAL_CONTENT_LIMIT,
  ENFORCE_CONTENT_LIMITS,
  isOverLimit,
  recordContentUsage,
  shouldBlock,
  secondsUntilUtcMidnight,
  rateLimitedResponse,
  type ContentUsageTotals,
  type RecordRpc
} from './content-usage';

const quiet: ContentUsageTotals = {
  endpointRequests: 1,
  endpointEntries: 100,
  totalRequests: 1,
  totalEntries: 100
};

const okRpc = (usage: ContentUsageTotals = quiet) => vi.fn<RecordRpc>(async () => usage);

describe('shipping defaults', () => {
  it('ships log-only', () => {
    expect(ENFORCE_CONTENT_LIMITS).toBe(false);
  });
});

describe('isOverLimit', () => {
  const limit = CONTENT_LIMITS['quiz-entries'];

  it('is false at exactly the limits', () => {
    expect(
      isOverLimit('quiz-entries', {
        endpointRequests: limit.requestsPerDay,
        endpointEntries: limit.entriesPerDay,
        totalRequests: TOTAL_CONTENT_LIMIT.requestsPerDay,
        totalEntries: TOTAL_CONTENT_LIMIT.entriesPerDay
      })
    ).toBe(false);
  });

  it('is true when any one of the four counters goes over', () => {
    expect(isOverLimit('quiz-entries', { ...quiet, endpointRequests: limit.requestsPerDay + 1 })).toBe(true);
    expect(isOverLimit('quiz-entries', { ...quiet, endpointEntries: limit.entriesPerDay + 1 })).toBe(true);
    expect(isOverLimit('quiz-entries', { ...quiet, totalRequests: TOTAL_CONTENT_LIMIT.requestsPerDay + 1 })).toBe(true);
    expect(isOverLimit('quiz-entries', { ...quiet, totalEntries: TOTAL_CONTENT_LIMIT.entriesPerDay + 1 })).toBe(true);
  });

  it('uses the limit of the endpoint asked about', () => {
    const usage = { ...quiet, endpointRequests: 60 };
    expect(isOverLimit('c-uttrykk', usage)).toBe(true); // limit 50
    expect(isOverLimit('quiz-entries', usage)).toBe(false); // limit 100
  });
});

describe('recordContentUsage', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('does not touch the database for free callers', async () => {
    const rpc = okRpc();
    const r = await recordContentUsage({ userId: 'u1', plan: 'free', endpoint: 'quiz-entries', entries: 10 }, rpc);
    expect(r).toEqual({ counted: false, over: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('does not touch the database for guests (no user, no plan)', async () => {
    const rpc = okRpc();
    expect((await recordContentUsage({ userId: undefined, plan: undefined, endpoint: 'quiz-entries', entries: 10 }, rpc)).counted).toBe(false);
    expect((await recordContentUsage({ userId: null, plan: 'plus', endpoint: 'quiz-entries', entries: 10 }, rpc)).counted).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('counts a Plus call and returns the totals', async () => {
    const rpc = okRpc();
    const r = await recordContentUsage({ userId: 'u1', plan: 'plus', endpoint: 'review-entries', entries: 42 }, rpc);
    expect(rpc).toHaveBeenCalledWith('u1', 'review-entries', 42);
    expect(r).toEqual({ counted: true, over: false, usage: quiet });
    expect(warn).not.toHaveBeenCalled();
  });

  it('sanitises the entry count (negative, fractional, NaN)', async () => {
    const rpc = okRpc();
    await recordContentUsage({ userId: 'u1', plan: 'plus', endpoint: 'quiz-entries', entries: -5 }, rpc);
    await recordContentUsage({ userId: 'u1', plan: 'plus', endpoint: 'quiz-entries', entries: 7.9 }, rpc);
    await recordContentUsage({ userId: 'u1', plan: 'plus', endpoint: 'quiz-entries', entries: Number.NaN }, rpc);
    expect(rpc.mock.calls.map((c) => c[2])).toEqual([0, 7, 0]);
  });

  it('flags and logs an account that is over a limit, but still counts', async () => {
    const rpc = okRpc({ ...quiet, endpointRequests: CONTENT_LIMITS['quiz-entries'].requestsPerDay + 1 });
    const r = await recordContentUsage({ userId: 'u1', plan: 'plus', endpoint: 'quiz-entries', entries: 10 }, rpc);
    expect(r.counted).toBe(true);
    expect(r.over).toBe(true);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('fails open: a database error is logged, never thrown, never over', async () => {
    const rpc = vi.fn<RecordRpc>(async () => {
      throw new Error('connection refused');
    });
    const r = await recordContentUsage({ userId: 'u1', plan: 'plus', endpoint: 'quiz-entries', entries: 10 }, rpc);
    expect(r).toEqual({ counted: false, over: false });
    expect(error).toHaveBeenCalledOnce();
  });
});

describe('shouldBlock', () => {
  it('never blocks in log-only mode, even when over', () => {
    expect(shouldBlock({ counted: true, over: true, usage: quiet })).toBe(false);
  });

  it('blocks only when enforcing and over', () => {
    expect(shouldBlock({ counted: true, over: true, usage: quiet }, true)).toBe(true);
    expect(shouldBlock({ counted: true, over: false, usage: quiet }, true)).toBe(false);
  });

  it('never blocks an uncounted call (free, guest or database failure)', () => {
    expect(shouldBlock({ counted: false, over: false }, true)).toBe(false);
  });
});

describe('secondsUntilUtcMidnight', () => {
  it('counts down to the next UTC midnight', () => {
    expect(secondsUntilUtcMidnight(new Date('2026-10-12T00:00:00Z'))).toBe(86_400);
    expect(secondsUntilUtcMidnight(new Date('2026-10-12T23:00:00Z'))).toBe(3_600);
  });

  it('is never below 1, and rounds a partial second up', () => {
    expect(secondsUntilUtcMidnight(new Date('2026-10-12T23:59:59.500Z'))).toBe(1);
  });

  it('rolls over month and year ends', () => {
    expect(secondsUntilUtcMidnight(new Date('2026-12-31T23:00:00Z'))).toBe(3_600);
  });
});

describe('rateLimitedResponse', () => {
  it('is a 429 with Retry-After and no caching', async () => {
    const res = rateLimitedResponse(new Date('2026-10-12T23:00:00Z'));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('3600');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await res.json()).toEqual({ error: 'rate_limited' });
  });
});
