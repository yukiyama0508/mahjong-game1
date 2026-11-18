import type { Clock } from './clock';

export const DEFAULT_DURATION_MS = 30_000;
export const TICK_INTERVAL_MS = 100;

/** 残り秒数(切り上げ)。1 以上 ceil(durationMs/1000) 以下に収める。 */
export const remainingSeconds = (
  elapsedMs: number,
  durationMs: number = DEFAULT_DURATION_MS,
): number => {
  const max = Math.max(1, Math.ceil(durationMs / 1000));
  const sec = Math.ceil((durationMs - elapsedMs) / 1000);
  return Math.min(max, Math.max(1, sec));
};

export class Timer {
  private startedAt: number | null = null;
  private ended = false;
  private running = false;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastElapsed = 0;

  constructor(
    private readonly clock: Clock,
    private readonly durationMs: number,
    private readonly onTick: (remainingSec: number) => void,
    private readonly onEnd: () => void,
  ) {}

  private readonly onVisibility = (): void => {
    this.check();
  };

  start(): void {
    this.stop();
    this.startedAt = this.clock.now();
    this.ended = false;
    this.running = true;
    this.lastElapsed = 0;
    this.onTick(remainingSeconds(0, this.durationMs));
    this.timeoutId = setTimeout(() => this.check(), this.durationMs);
    this.intervalId = setInterval(() => this.check(), TICK_INTERVAL_MS);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibility);
    }
  }

  /** 停止する。停止後の elapsedMs は停止時点の値を返す。 */
  stop(): void {
    if (this.running && this.startedAt !== null) {
      this.lastElapsed = Math.max(0, this.clock.now() - this.startedAt);
    }
    this.running = false;
    if (this.timeoutId !== null) clearTimeout(this.timeoutId);
    if (this.intervalId !== null) clearInterval(this.intervalId);
    this.timeoutId = null;
    this.intervalId = null;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibility);
    }
  }

  elapsedMs(): number {
    if (!this.running || this.startedAt === null) return this.lastElapsed;
    return Math.max(0, this.clock.now() - this.startedAt);
  }

  private check(): void {
    if (!this.running) return;
    const elapsed = this.elapsedMs();
    if (elapsed >= this.durationMs) {
      if (this.ended) return;
      this.ended = true;
      this.stop();
      this.lastElapsed = elapsed;
      this.onEnd();
      return;
    }
    this.onTick(remainingSeconds(elapsed, this.durationMs));
  }
}
