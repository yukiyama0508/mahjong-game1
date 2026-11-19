import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { toggleTile, clearAnswer } from '../src/ui/answer-selection';
import { TILE_KINDS } from '../src/domain/tile';

const tileArb = fc.integer({ min: 0, max: TILE_KINDS - 1 });
const answerArb = fc.uniqueArray(tileArb, { maxLength: TILE_KINDS }).map((a) => new Set(a));

// Feature: mahjong-machi-quiz-game, Property 22: 回答の選択操作
describe('Property 22: answer selection', () => {
  /** **Validates: Requirements 5.5, 5.6, 5.8** */
  it('toggle adds/removes only t, is an involution, and clear empties', () => {
    fc.assert(
      fc.property(answerArb, tileArb, (answer, t) => {
        const before = new Set(answer);
        const next = toggleTile(answer, t);
        // original unchanged
        expect(answer).toEqual(before);
        if (!before.has(t)) {
          expect(next.has(t)).toBe(true);
          expect(next.size).toBe(before.size + 1);
        } else {
          expect(next.has(t)).toBe(false);
          expect(next.size).toBe(before.size - 1);
        }
        for (const x of before) if (x !== t) expect(next.has(x)).toBe(true);
        for (const x of next) if (x !== t) expect(before.has(x)).toBe(true);
        // double toggle restores
        expect(toggleTile(next, t)).toEqual(before);
        // clear
        expect(clearAnswer(answer).size).toBe(0);
      }),
      { numRuns: 100 },
    );
  });
});
