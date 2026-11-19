import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OfflineRankingClient,
  SupabaseRankingClient,
  createRankingClient,
  type SupabaseLike,
  type SupabaseQuery,
  type SupabaseResponse,
} from '../src/infra/ranking-client';

interface Call {
  table: string;
  ops: string[];
  args: Record<string, unknown[]>;
  signal?: AbortSignal;
}

type Handler = (call: Call) => SupabaseResponse | Promise<SupabaseResponse>;

function makeFake(handler: Handler): { client: SupabaseLike; calls: Call[] } {
  const calls: Call[] = [];
  const makeQuery = (call: Call): SupabaseQuery => {
    const q: SupabaseQuery = {
      select: (...a) => (call.ops.push('select'), (call.args.select = a), q),
      insert: (...a) => (call.ops.push('insert'), (call.args.insert = a), q),
      gt: (...a) => (call.ops.push('gt'), (call.args.gt = a), q),
      order: (..._a) => (call.ops.push('order'), q),
      limit: (...a) => (call.ops.push('limit'), (call.args.limit = a), q),
      abortSignal: (s) => ((call.signal = s), q),
      then: (onF, onR) => Promise.resolve().then(() => handler(call)).then(onF, onR),
    };
    return q;
  };
  return {
    calls,
    client: {
      from: (table) => {
        const call: Call = { table, ops: [], args: {} };
        calls.push(call);
        return makeQuery(call);
      },
    },
  };
}

const never = (): Promise<SupabaseResponse> => new Promise(() => {});
const isInsert = (c: Call) => c.ops.includes('insert');

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('SupabaseRankingClient.submitScore', () => {
  const cases: Array<[string, SupabaseResponse | 'reject', unknown]> = [
    ['23514 → validation', { error: { code: '23514', message: 'bad name' } }, { status: 'validation', reason: 'bad name' }],
    ['network error (thrown) → error', 'reject', { status: 'error' }],
    ['other code 42501 → error', { error: { code: '42501', message: 'denied' } }, { status: 'error' }],
    ['error without code → error', { error: { message: 'Failed to fetch' } }, { status: 'error' }],
    ['PGRST error → error', { error: { code: 'PGRST301' } }, { status: 'error' }],
  ];

  it.each(cases)('%s', async (_n, insertRes, expected) => {
    const { client, calls } = makeFake((c) => {
      if (isInsert(c)) {
        if (insertRes === 'reject') return Promise.reject(new Error('network'));
        return insertRes;
      }
      return { count: 0 };
    });
    const r = await new SupabaseRankingClient(client).submitScore('名前', 100, 'sid');
    expect(r).toEqual(expected);
    // 失敗時は順位取得をしない
    expect(calls.filter((c) => !isInsert(c))).toHaveLength(0);
  });

  it('success inserts the right row and computes rank = count + 1', async () => {
    const { client, calls } = makeFake((c) => (isInsert(c) ? {} : { count: 4 }));
    const r = await new SupabaseRankingClient(client).submitScore('Taro', 250, 'sid-1');
    expect(r).toEqual({ status: 'ok', rank: 5 });
    expect(calls[0].table).toBe('ranking_entries');
    expect(calls[0].args.insert).toEqual([{ name: 'Taro', total_score: 250, session_id: 'sid-1' }]);
    expect(calls[1].args.gt).toEqual(['total_score', 250]);
  });

  it('23505 (duplicate session) → ok', async () => {
    const { client } = makeFake((c) => (isInsert(c) ? { error: { code: '23505' } } : { count: 0 }));
    const r = await new SupabaseRankingClient(client).submitScore('Taro', 10, 'sid');
    expect(r).toEqual({ status: 'ok', rank: 1 });
  });

  const rankFailures: Array<[string, SupabaseResponse | 'reject' | 'hang']> = [
    ['rank query error', { error: { code: 'XX000' } }],
    ['rank query throws', 'reject'],
    ['rank count missing', {}],
    ['rank count negative', { count: -1 }],
    ['rank query timeout', 'hang'],
  ];
  it.each(rankFailures)('rank failure (%s) still ok with null rank', async (_n, rankRes) => {
    const { client } = makeFake((c) => {
      if (isInsert(c)) return {};
      if (rankRes === 'reject') return Promise.reject(new Error('x'));
      if (rankRes === 'hang') return never();
      return rankRes;
    });
    const p = new SupabaseRankingClient(client).submitScore('Taro', 10, 'sid');
    await vi.advanceTimersByTimeAsync(5000);
    expect(await p).toEqual({ status: 'ok', rank: null });
  });

  it('insert timeout after 5s → error, and aborts the signal', async () => {
    const { client, calls } = makeFake(() => never());
    const p = new SupabaseRankingClient(client).submitScore('Taro', 10, 'sid');
    let settled = false;
    void p.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(4999);
    expect(settled).toBe(false);
    expect(calls[0].signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toEqual({ status: 'error' });
    expect(calls[0].signal?.aborted).toBe(true);
  });
});

describe('SupabaseRankingClient.checkConnection', () => {
  const cases: Array<[string, SupabaseResponse | 'reject', boolean]> = [
    ['success', { data: null }, true],
    ['error response', { error: { code: '42501' } }, false],
    ['thrown network error', 'reject', false],
  ];
  it.each(cases)('%s → %s', async (_n, res, expected) => {
    const { client, calls } = makeFake(() =>
      res === 'reject' ? Promise.reject(new Error('network')) : res,
    );
    expect(await new SupabaseRankingClient(client).checkConnection()).toBe(expected);
    expect(calls[0].table).toBe('ranking_entries');
    expect(calls[0].args.select?.[1]).toEqual({ head: true });
  });

  it('timeout after 5s → false', async () => {
    const { client, calls } = makeFake(() => never());
    const p = new SupabaseRankingClient(client).checkConnection();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await p).toBe(false);
    expect(calls[0].signal?.aborted).toBe(true);
  });
});

describe('SupabaseRankingClient.fetchRanking', () => {
  const row = { rank: 1, name: 'A', total_score: 300, created_at: '2024-01-01T00:00:00Z' };

  it('maps rows (rank may be a numeric string, e.g. bigint)', async () => {
    const { client, calls } = makeFake(() => ({
      data: [row, { ...row, rank: '2', name: 'B', total_score: 200 }],
    }));
    const r = await new SupabaseRankingClient(client).fetchRanking();
    expect(r).toEqual({
      status: 'ok',
      entries: [
        { rank: 1, name: 'A', totalScore: 300, createdAt: '2024-01-01T00:00:00Z' },
        { rank: 2, name: 'B', totalScore: 200, createdAt: '2024-01-01T00:00:00Z' },
      ],
    });
    expect(calls[0].table).toBe('ranking_view');
    expect(calls[0].args.limit).toEqual([100]);
  });

  it('empty list → ok with no entries', async () => {
    const { client } = makeFake(() => ({ data: [] }));
    expect(await new SupabaseRankingClient(client).fetchRanking()).toEqual({ status: 'ok', entries: [] });
  });

  const bad: Array<[string, SupabaseResponse | 'reject']> = [
    ['data is not an array', { data: { rank: 1 } }],
    ['data is null', { data: null }],
    ['row is null', { data: [null] }],
    ['name missing', { data: [{ ...row, name: undefined }] }],
    ['total_score is a string', { data: [{ ...row, total_score: '300' }] }],
    ['created_at missing', { data: [{ ...row, created_at: undefined }] }],
    ['rank not numeric', { data: [{ ...row, rank: 'abc' }] }],
    ['one bad row among good ones', { data: [row, { foo: 1 }] }],
    ['error response', { error: { code: '42501' }, data: [row] }],
    ['thrown network error', 'reject'],
  ];
  it.each(bad)('%s → error', async (_n, res) => {
    const { client } = makeFake(() =>
      res === 'reject' ? Promise.reject(new Error('network')) : res,
    );
    expect(await new SupabaseRankingClient(client).fetchRanking()).toEqual({ status: 'error' });
  });

  it('timeout after 5s → error', async () => {
    const { client } = makeFake(() => never());
    const p = new SupabaseRankingClient(client).fetchRanking();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await p).toEqual({ status: 'error' });
  });
});

describe('OfflineRankingClient', () => {
  it('checkConnection is false, submit/fetch resolve to error without throwing', async () => {
    const c = new OfflineRankingClient();
    await expect(c.checkConnection()).resolves.toBe(false);
    await expect(c.submitScore()).resolves.toEqual({ status: 'error' });
    await expect(c.fetchRanking()).resolves.toEqual({ status: 'error' });
  });

  it('createRankingClient(null) returns an offline client', async () => {
    const c = createRankingClient(null);
    expect(c).toBeInstanceOf(OfflineRankingClient);
    expect(await c.checkConnection()).toBe(false);
  });

  it('createRankingClient(fake) returns a Supabase client', () => {
    const { client } = makeFake(() => ({}));
    expect(createRankingClient(client)).toBeInstanceOf(SupabaseRankingClient);
  });
});
