import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { isHighlighted } from '../src/ui/screens/ranking-screen';

// Feature: mahjong-machi-quiz-game, Property 26: 強調表示の規則
// **Validates: Requirements 10.11**
describe('Property 26: 強調表示の規則', () => {
  const name = fc.string({ maxLength: 12 });
  const pad = fc.stringOf(fc.constantFrom(' ', '\u3000', '\t'), { maxLength: 3 });

  it('trim 後に等しいときに限り真を返す', () => {
    fc.assert(
      fc.property(name, name, (row, player) => {
        expect(isHighlighted(row, player)).toBe(row.trim() === player.trim());
      }),
      { numRuns: 100 },
    );
  });

  it('同名の行はすべて強調される(別プレイヤーの行を含む)', () => {
    fc.assert(
      fc.property(name, pad, pad, fc.array(name, { maxLength: 10 }), (player, l, r, others) => {
        const rows = [...others, player, l + player.trim() + r, player];
        const flags = rows.map((n) => isHighlighted(n, player));
        rows.forEach((n, i) => {
          if (n.trim() === player.trim()) expect(flags[i]).toBe(true);
        });
        expect(flags.slice(-2).every(Boolean)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
