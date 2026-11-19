// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Timer } from '../src/infra/timer';

describe('Timer (Req 1.5, 1.6, 1.7)', () => {
  let t = 0;
  const clock = { now: () => t };

  beforeEach(() => {
    t = 0;
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('30秒時点から100ms以内に一度だけ終了を通知する (1.7)', () => {
    const onEnd = vi.fn();
    const timer = new Timer(clock, 30_000, () => {}, onEnd);
    timer.start();
    t = 29_999;
    vi.advanceTimersByTime(29_999);
    expect(onEnd).not.toHaveBeenCalled();
    t = 30_000;
    vi.advanceTimersByTime(100);
    expect(onEnd).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('端末の時刻(Date)を変更しても終了時刻は変わらない (1.5)', () => {
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    const onEnd = vi.fn();
    const timer = new Timer(clock, 30_000, () => {}, onEnd);
    timer.start();
    t = 10_000;
    vi.advanceTimersByTime(10_000);
    // 時計を1日進める / 戻す
    vi.setSystemTime(new Date('2024-01-02T00:00:00Z'));
    vi.setSystemTime(new Date('2023-12-01T00:00:00Z'));
    expect(timer.elapsedMs()).toBe(10_000);
    expect(onEnd).not.toHaveBeenCalled();
    t = 30_000;
    vi.advanceTimersByTime(20_000);
    expect(onEnd).toHaveBeenCalledTimes(1);
    timer.stop();
  });

  it('タブ非表示中も動き続け、visibilitychange で経過時間を再確認する (1.6)', () => {
    const onEnd = vi.fn();
    const timer = new Timer(clock, 30_000, () => {}, onEnd);
    timer.start();
    // 非表示タブでタイマーが間引かれ、clock だけ進んだ状況
    t = 31_000;
    expect(onEnd).not.toHaveBeenCalled();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('フィードバック表示中(他の処理の間)も停止しない (1.6)', () => {
    const ticks: number[] = [];
    const onEnd = vi.fn();
    const timer = new Timer(clock, 30_000, (s) => ticks.push(s), onEnd);
    timer.start();
    t = 5_000;
    vi.advanceTimersByTime(5_000);
    expect(timer.elapsedMs()).toBe(5_000);
    expect(ticks[ticks.length - 1]).toBe(25);
    t = 30_000;
    vi.advanceTimersByTime(25_000);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});
