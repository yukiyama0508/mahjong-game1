import { describe, expect, it } from 'vitest';
import { createMathRng, createSeededRng } from '../src/domain/rng';

const take = (n: number, next: () => number): number[] => Array.from({ length: n }, next);

describe('rng', () => {
  it('同じシードなら同じ列を返す', () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    expect(take(20, () => a.next())).toEqual(take(20, () => b.next()));
  });

  it('異なるシードなら異なる列を返す', () => {
    const a = createSeededRng(1);
    const b = createSeededRng(2);
    expect(take(10, () => a.next())).not.toEqual(take(10, () => b.next()));
  });

  it('値は [0, 1) に収まる', () => {
    const seeded = createSeededRng(123456789);
    const math = createMathRng();
    for (let i = 0; i < 1000; i++) {
      for (const v of [seeded.next(), math.next()]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
  });
});
