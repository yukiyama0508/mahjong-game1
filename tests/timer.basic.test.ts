import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Timer, remainingSeconds } from '../src/infra/timer';

describe('Timer basic', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('remainingSeconds は切り上げで 1..30', () => {
    expect(remainingSeconds(0)).toBe(30);
    expect(remainingSeconds(1)).toBe(30);
    expect(remainingSeconds(29_999)).toBe(1);
  });

  it('30秒で一度だけ終了を通知する', () => {
    let t = 0;
    const onEnd = vi.fn();
    const ticks: number[] = [];
    const timer = new Timer({ now: () => t }, 30_000, (s) => ticks.push(s), onEnd);
    timer.start();
    expect(ticks[0]).toBe(30);
    t = 29_900;
    vi.advanceTimersByTime(29_900);
    expect(onEnd).not.toHaveBeenCalled();
    t = 30_000;
    vi.advanceTimersByTime(100);
    expect(onEnd).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});
