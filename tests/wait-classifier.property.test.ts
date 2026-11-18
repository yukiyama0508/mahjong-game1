import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { classifyHand } from '../src/domain/wait-classifier';
import { calcWaits } from '../src/domain/wait-calculator';
import { enumerateInterpretations } from '../src/domain/interpretation';
import type { WaitShape } from '../src/domain/interpretation';
import { toCounts } from '../src/domain/tile';
import type { TileId } from '../src/domain/tile';

const withinFour = (tiles: readonly TileId[]): boolean => toCounts(tiles).every((n) => n <= 4);

const meldArb = fc.oneof(
  fc.tuple(fc.integer({ min: 0, max: 2 }), fc.integer({ min: 0, max: 6 })).map(([s, n]) => {
    const b = s * 9 + n;
    return [b, b + 1, b + 2];
  }),
  fc.integer({ min: 0, max: 33 }).map((t) => [t, t, t]),
);

/** 14枚の和了形(4面子1雀頭 or 七対子)から1枚抜いた13枚 */
const tenpaiArb: fc.Arbitrary<TileId[]> = fc
  .tuple(
    fc.array(meldArb, { minLength: 4, maxLength: 4 }),
    fc.integer({ min: 0, max: 33 }),
    fc.uniqueArray(fc.integer({ min: 0, max: 33 }), { minLength: 7, maxLength: 7 }),
    fc.boolean(),
    fc.nat(13),
  )
  .map(([melds, pair, sevenPairs, useChiitoi, dropIdx]) => {
    const tiles: TileId[] = useChiitoi
      ? sevenPairs.flatMap((t) => [t, t])
      : [...melds.flat(), pair, pair];
    tiles.splice(dropIdx % 14, 1);
    return tiles;
  })
  .filter(withinFour);

const shuffled = <T>(xs: readonly T[], keys: readonly number[]): T[] =>
  xs
    .map((x, i) => [x, keys[i % keys.length], i] as const)
    .sort((a, b) => a[1] - b[1] || a[2] - b[2])
    .map(([x]) => x);

/** calcWaits / enumerateInterpretations から独立に計算した待ち形の集合 */
const independent = (hand: readonly TileId[]) => {
  const r = calcWaits(hand);
  if (!r.ok) throw new Error('unexpected error');
  const base = [...toCounts(hand)];
  const all = new Set<WaitShape>();
  for (const w of r.value) {
    const c = [...base];
    c[w]++;
    for (const i of enumerateInterpretations(c, w)) all.add(i.shape);
  }
  return { waits: r.value, shapes: all };
};

// Feature: mahjong-machi-quiz-game, Property 7: 待ち形分類は定義と一致する
describe('Property 7: 待ち形分類は定義と一致する', () => {
  it('multi ⇔ 待ち3種類以上 or 待ち形2種類以上。それ以外は単一の待ち形と一致する', () => {
    fc.assert(
      fc.property(tenpaiArb, (hand) => {
        const { waits, shapes } = independent(hand);
        fc.pre(waits.length > 0);
        const result = classifyHand(hand);
        const expectMulti = waits.length >= 3 || shapes.size >= 2;
        expect(result.type === 'multi').toBe(expectMulti);
        if (!expectMulti) {
          expect(shapes.size).toBe(1);
          expect(result.type).toBe([...shapes][0]);
        }
        // shapesByWait の全ての待ち形は type と整合する
        if (result.type !== 'multi') {
          for (const w of waits) expect(result.shapesByWait.get(w)).toEqual([result.type]);
        }
      }),
      { numRuns: 400 },
    );
  });

  it('牌の並べ替えに対して分類結果は不変', () => {
    fc.assert(
      fc.property(
        tenpaiArb,
        fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 13, maxLength: 13 }),
        (hand, keys) => {
          expect(classifyHand(shuffled(hand, keys)).type).toBe(classifyHand(hand).type);
        },
      ),
      { numRuns: 300 },
    );
  });
});
