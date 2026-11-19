import { describe, expect, it } from 'vitest';
import { NameStore } from '../src/infra/name-store';
import type { RankingClient, SubmitScoreResult } from '../src/infra/ranking-client';
import {
  COMMUNICATION_ERROR_MESSAGE,
  decideRegistration,
  RegistrationController,
  type RegistrationStatus,
} from '../src/infra/registration';

function fake(connected: boolean | 'throw', results: SubmitScoreResult[] | 'throw') {
  const calls: Array<[string, number, string]> = [];
  const client: RankingClient = {
    async checkConnection() {
      if (connected === 'throw') throw new Error('net');
      return connected;
    },
    async submitScore(n, s, id) {
      calls.push([n, s, id]);
      if (results === 'throw') throw new Error('net');
      return results.shift() ?? { status: 'error' };
    },
    async fetchRanking() {
      return { status: 'error' };
    },
  };
  return { client, calls };
}

const storeWith = (name: string) => {
  const s = new NameStore(null);
  s.save(name);
  return s;
};

describe('decideRegistration', () => {
  it('connection success -> register', () => {
    expect(decideRegistration(true)).toBe('register');
  });
  it('connection failure -> skipOffline', () => {
    expect(decideRegistration(false)).toBe('skipOffline');
  });
});

describe('RegistrationController', () => {
  it('sends no request and reports offline when the connection check fails or throws', async () => {
    for (const c of [false, 'throw'] as const) {
      const f = fake(c, [{ status: 'ok', rank: 1 }]);
      const ctrl = new RegistrationController(f.client, storeWith('a'));
      expect(await ctrl.registerSession(100, 's')).toEqual({ kind: 'notApplicable', reason: 'offline' });
      expect(f.calls).toHaveLength(0);
    }
  });

  it('turns a submit failure after a successful check into retryable failed', async () => {
    for (const r of [[{ status: 'error' as const }], 'throw' as const]) {
      const f = fake(true, r);
      const ctrl = new RegistrationController(f.client, storeWith('a'));
      expect(await ctrl.registerSession(10, 's')).toEqual({
        kind: 'failed',
        message: COMMUNICATION_ERROR_MESSAGE,
        retryable: true,
      });
      expect(f.calls).toHaveLength(1);
    }
  });

  it('registers score 0', async () => {
    const f = fake(true, [{ status: 'ok', rank: 5 }]);
    const ctrl = new RegistrationController(f.client, storeWith('a'));
    expect(await ctrl.registerSession(0, 's')).toEqual({ kind: 'done', rank: 5 });
    expect(f.calls).toEqual([['a', 0, 's']]);
  });

  it('registers entries with the same name again without confirmation', async () => {
    const f = fake(true, [
      { status: 'ok', rank: 1 },
      { status: 'ok', rank: 2 },
    ]);
    const ctrl = new RegistrationController(f.client, storeWith('same'));
    expect(await ctrl.registerSession(300, 's1')).toEqual({ kind: 'done', rank: 1 });
    expect(await ctrl.registerSession(300, 's2')).toEqual({ kind: 'done', rank: 2 });
    expect(f.calls).toEqual([
      ['same', 300, 's1'],
      ['same', 300, 's2'],
    ]);
  });

  it('notifies status transitions: registering then done', async () => {
    const seen: RegistrationStatus[] = [];
    const f = fake(true, [{ status: 'ok', rank: null }]);
    const ctrl = new RegistrationController(f.client, storeWith('a'), (s) => seen.push(s));
    await ctrl.registerSession(1, 's');
    expect(seen.map((s) => s.kind)).toEqual(['registering', 'registering', 'done']);
  });
});
