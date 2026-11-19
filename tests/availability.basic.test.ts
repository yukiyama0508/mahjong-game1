import { describe, expect, it } from 'vitest';
import { AvailabilityTracker, type Availability } from '../src/infra/availability';
import type { RankingClient } from '../src/infra/ranking-client';

function clientWith(check: () => Promise<boolean>): RankingClient {
  return {
    checkConnection: check,
    submitScore: async () => ({ status: 'error' }),
    fetchRanking: async () => ({ status: 'error' }),
  };
}

describe('AvailabilityTracker (basic)', () => {
  it('starts offline', () => {
    const t = new AvailabilityTracker(clientWith(async () => true), () => {});
    expect(t.current).toBe('offline');
  });

  it('becomes enabled on success and notifies', async () => {
    const seen: Availability[] = [];
    const t = new AvailabilityTracker(clientWith(async () => true), (a) => seen.push(a));
    expect(await t.refresh()).toBe(true);
    expect(t.current).toBe('enabled');
    expect(seen).toEqual(['enabled']);
  });

  it('becomes offline on failure or thrown error without throwing', async () => {
    let mode: 'ok' | 'false' | 'throw' = 'ok';
    const t = new AvailabilityTracker(
      clientWith(async () => {
        if (mode === 'throw') throw new Error('x');
        return mode === 'ok';
      }),
      () => {},
    );
    await t.refresh();
    mode = 'false';
    expect(await t.refresh()).toBe(false);
    expect(t.current).toBe('offline');
    mode = 'ok';
    await t.refresh();
    mode = 'throw';
    expect(await t.refresh()).toBe(false);
    expect(t.current).toBe('offline');
  });

  it('applies only the latest refresh when results arrive out of order', async () => {
    const resolvers: Array<(v: boolean) => void> = [];
    const t = new AvailabilityTracker(
      clientWith(() => new Promise<boolean>((r) => resolvers.push(r))),
      () => {},
    );
    const first = t.refresh();
    const second = t.refresh();
    resolvers[1](false);
    await second;
    resolvers[0](true); // 古い結果は反映されない
    await first;
    expect(t.current).toBe('offline');
  });
});
