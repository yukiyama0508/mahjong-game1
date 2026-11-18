import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { judgeAnswer } from '../src/domain/answer-judge';
import { TILE_KINDS } from '../src/domain/tile';

const tileSetArb = fc.uniqueArray(fc.integer({ min: 0, max: TILE_KINDS - 1 }), { maxLength: TILE_KINDS });

// Feature: mahjong-machi-quiz-game, Property 17: 正誤判定は集合の一致
describe('Property 17: 正誤判定は集合の一致', () => {
  /** **Validates: Requirements 7.1, 7.4, 7.5** */
  it('correct ⇔ A = W、missing = W \\ A、extra = A \\ W', () => {
    fc.assert(
      fc.property(tileSetArb, tileSetArb, (a, w) => {
        const answer = new Set(a);
        const waitSet = new Set(w);
        const r = judgeAnswer(answer, w);
        const missing = [...waitSet].filter((t) => !answer.has(t)).sort((x, y) => x - y);
        const extra = [...answer].filter((t) => !waitSet.has(t)).sort((x, y) => x - y);
        const equal = answer.size === waitSet.size && missing.length === 0;
        expect(r.correct).toBe(equal);
        expect(r.missing).toEqual(missing);
        expect(r.extra).toEqual(extra);
        if (r.correct) {
          expect(r.missing).toEqual([]);
          expect(r.extra).toEqual([]);
        }
      }),
      { numRuns: 200 },
    );
  });

  /** **Validates: Requirements 7.1, 7.4, 7.5** */
  it('A = W のとき常に correct', () => {
    fc.assert(
      fc.property(tileSetArb, (w) => {
        expect(judgeAnswer(new Set(w), w).correct).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
