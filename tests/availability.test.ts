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

describe('AvailabilityTracker', () => {
  it('stays offline before any refresh and does not notify', () => {
    const seen: Availability[] = [];
    const t = new AvailabilityTracker(clientWith(async () => true), (a) => seen.push(a));
    expect(t.current).toBe('offline');
    expect(seen).toEqual([]);
  });

  it('is enabled after success and offline after a later failure', async () => {
    let ok = true;
    const t = new AvailabilityTracker(clientWith(async () => ok), () => {});
    await t.refresh();
    expect(t.current).toBe('enabled');
    ok = false;
    await t.refresh();
    expect(t.current).toBe('offline');
  });

  it('stays offline when the first check fails, without notifying', async () => {
    const seen: Availability[] = [];
    const t = new AvailabilityTracker(clientWith(async () => false), (a) => seen.push(a));
    expect(await t.refresh()).toBe(false);
    expect(t.current).toBe('offline');
    expect(seen).toEqual([]);
  });

  it('notifies only when the value changes', async () => {
    const seen: Availability[] = [];
    let ok = true;
    const t = new AvailabilityTracker(clientWith(async () => ok), (a) => seen.push(a));
    await t.refresh();
    await t.refresh();
    ok = false;
    await t.refresh();
    await t.refresh();
    expect(seen).toEqual(['enabled', 'offline']);
  });

  it('does not fail refresh when onChange throws', async () => {
    const t = new AvailabilityTracker(clientWith(async () => true), () => {
      throw new Error('listener');
    });
    await expect(t.refresh()).resolves.toBe(true);
    expect(t.current).toBe('enabled');
  });
});
