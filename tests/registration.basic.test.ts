import { describe, expect, it } from 'vitest';
import { NameStore } from '../src/infra/name-store';
import type { RankingClient, SubmitScoreResult } from '../src/infra/ranking-client';
import { decideRegistration, RegistrationController } from '../src/infra/registration';

function fake(connected: boolean, results: SubmitScoreResult[]) {
  const calls: Array<[string, number, string]> = [];
  let checks = 0;
  const client: RankingClient = {
    async checkConnection() {
      checks++;
      return connected;
    },
    async submitScore(n, s, id) {
      calls.push([n, s, id]);
      return results.shift() ?? { status: 'error' };
    },
    async fetchRanking() {
      return { status: 'error' };
    },
  };
  return { client, calls, checks: () => checks };
}

const makeStore = () => {
  const s = new NameStore(null);
  s.save('たろう');
  return s;
};

describe('RegistrationController (basic)', () => {
  it('decideRegistration', () => {
    expect(decideRegistration(true)).toBe('register');
    expect(decideRegistration(false)).toBe('skipOffline');
  });

  it('registers on connection success, including score 0', async () => {
    const f = fake(true, [{ status: 'ok', rank: 3 }]);
    const c = new RegistrationController(f.client, makeStore());
    expect(await c.registerSession(0, 'sid')).toEqual({ kind: 'done', rank: 3 });
    expect(f.calls).toEqual([['たろう', 0, 'sid']]);
  });

  it('sends no request when offline', async () => {
    const f = fake(false, []);
    const c = new RegistrationController(f.client, makeStore());
    expect(await c.registerSession(100, 'sid')).toEqual({ kind: 'notApplicable', reason: 'offline' });
    expect(f.calls).toHaveLength(0);
  });

  it('retries with the same payload after failure, then stops after done', async () => {
    const f = fake(true, [{ status: 'error' }, { status: 'ok', rank: null }]);
    const c = new RegistrationController(f.client, makeStore());
    const first = await c.registerSession(500, 'sid');
    expect(first).toMatchObject({ kind: 'failed', retryable: true });
    expect(await c.retry()).toEqual({ kind: 'done', rank: null });
    await c.retry();
    expect(f.calls).toEqual([
      ['たろう', 500, 'sid'],
      ['たろう', 500, 'sid'],
    ]);
  });

  it('validation error is non-retryable with the reason', async () => {
    const f = fake(true, [{ status: 'validation', reason: 'bad' }]);
    const c = new RegistrationController(f.client, makeStore());
    expect(await c.registerSession(1, 'sid')).toEqual({
      kind: 'failed',
      message: 'bad',
      retryable: false,
    });
  });
});
