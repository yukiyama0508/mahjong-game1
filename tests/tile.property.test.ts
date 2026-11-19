import fc from 'fast-check';
import { describe, it } from 'vitest';
import { sortForDisplay, suitOf, numberOf, TILE_KINDS } from '../src/domain/tile';

const SUIT_ORDER = { m: 0, p: 1, s: 2, z: 3 } as const;

const handArb = fc.array(fc.integer({ min: 0, max: TILE_KINDS - 1 }), { minLength: 13, maxLength: 14 });

describe('Property 21: 手牌の表示順', () => {
  /** **Validates: Requirements 5.1** */
  it('同じ多重集合を、萬筒索字の順・各種別内で昇順に並べる', () => {
    fc.assert(
      fc.property(handArb, (hand) => {
        const sorted = sortForDisplay(hand);
        // 多重集合が同一
        if ([...hand].sort((a, b) => a - b).join(',') !== [...sorted].sort((a, b) => a - b).join(',')) return false;
        // (種別順, 数字) の昇順
        for (let i = 1; i < sorted.length; i++) {
          const a = sorted[i - 1];
          const b = sorted[i];
          const ka = SUIT_ORDER[suitOf(a)] * 10 + numberOf(a);
          const kb = SUIT_ORDER[suitOf(b)] * 10 + numberOf(b);
          if (ka > kb) return false;
        }
        return true;
      }),
    );
  });

  /** **Validates: Requirements 5.1** */
  it('入力の並べ替えに関わらず結果が同一', () => {
    fc.assert(
      fc.property(handArb.chain((h) => fc.tuple(fc.constant(h), fc.shuffledSubarray(h, { minLength: h.length, maxLength: h.length }))), ([h, shuffled]) => {
        return sortForDisplay(h).join(',') === sortForDisplay(shuffled).join(',');
      }),
    );
  });
});
