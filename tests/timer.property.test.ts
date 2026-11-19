import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { remainingSeconds } from '../src/infra/timer';

// Feature: mahjong-machi-quiz-game, Property 20: 残り時間の表示
describe('Property 20: 残り時間の表示', () => {
  it('**Validates: Requirements 1.4** remainingSeconds は ceil((30000-e)/1000) で 1..30 の整数', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 29_999 }), (e) => {
        const r = remainingSeconds(e);
        return r === Math.ceil((30_000 - e) / 1000) && Number.isInteger(r) && r >= 1 && r <= 30;
      }),
      { numRuns: 200 },
    );
  });

  it('**Validates: Requirements 1.4** 経過時間に対して単調非増加', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 29_999 }),
        fc.integer({ min: 0, max: 29_999 }),
        (a, b) => {
          const [e1, e2] = a <= b ? [a, b] : [b, a];
          return remainingSeconds(e1) >= remainingSeconds(e2);
        },
      ),
      { numRuns: 200 },
    );
  });
});
