import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { calcWaits } from '../src/domain/wait-calculator';
import { enumerateInterpretations } from '../src/domain/interpretation';
import { parseHand } from '../src/domain/hand-parser';
import { TILE_KINDS, toCounts } from '../src/domain/tile';
import type { Hand, TileId } from '../src/domain/tile';

const parse = (s: string): Hand => {
  const r = parseHand(s);
  if (!r.ok) throw new Error(`bad hand ${s}`);
  return r.value;
};

const waitsOf = (hand: Hand): TileId[] => {
  const r = calcWaits(hand);
  if (!r.ok) throw new Error('unexpected error');
  return r.value;
};

const withinFour = (tiles: readonly TileId[]): boolean => toCounts(tiles).every((n) => n <= 4);

/** 面子(順子/刻子)1つ分の牌 */
const meldArb = fc.oneof(
  fc.tuple(fc.integer({ min: 0, max: 2 }), fc.integer({ min: 0, max: 6 })).map(([s, n]) => {
    const b = s * 9 + n;
    return [b, b + 1, b + 2];
  }),
  fc.integer({ min: 0, max: 33 }).map((t) => [t, t, t]),
);

/** テンパイ手を作りやすい13枚: 4面子1雀頭から1枚抜く / 七対子から1枚抜く / それにランダムな1枚置換 */
const nearTenpaiArb: fc.Arbitrary<TileId[]> = fc
  .tuple(
    fc.array(meldArb, { minLength: 4, maxLength: 4 }),
    fc.integer({ min: 0, max: 33 }),
    fc.uniqueArray(fc.integer({ min: 0, max: 33 }), { minLength: 7, maxLength: 7 }),
    fc.boolean(),
    fc.nat(13),
    fc.integer({ min: 0, max: 33 }),
    fc.boolean(),
  )
  .map(([melds, pair, sevenPairs, useChiitoi, dropIdx, repl, doReplace]) => {
    const tiles: TileId[] = useChiitoi
      ? sevenPairs.flatMap((t) => [t, t])
      : [...melds.flat(), pair, pair];
    tiles.splice(dropIdx % 14, 1);
    if (doReplace) tiles[dropIdx % 13] = repl;
    return tiles;
  })
  .filter(withinFour);

/** 小さな牌プール(1種の数牌 + 字牌2種)からのランダムな13枚。待ちなしも多く含む */
const smallPoolArb: fc.Arbitrary<TileId[]> = fc
  .array(fc.integer({ min: 0, max: 10 }), { minLength: 13, maxLength: 13 })
  .map((xs) => xs.map((x) => (x < 9 ? x : 27 + (x - 9))))
  .filter(withinFour);

const hand13Arb = fc.oneof(nearTenpaiArb, smallPoolArb);

const shuffled = <T>(xs: readonly T[], keys: readonly number[]): T[] =>
  xs
    .map((x, i) => [x, keys[i % keys.length], i] as const)
    .sort((a, b) => a[1] - b[1] || a[2] - b[2])
    .map(([x]) => x);

// ---- 素朴な参考実装(再帰で全探索。calcWaits とは独立) ----

/** 面子のみで分解できるか: 先頭の牌を含む順子/刻子を試す */
const naiveMelds = (c: number[]): boolean => {
  const i = c.findIndex((n) => n > 0);
  if (i < 0) return true;
  const out = (k: number) => k >= 0 && k < TILE_KINDS;
  // 刻子
  if (c[i] >= 3) {
    c[i] -= 3;
    const ok = naiveMelds(c);
    c[i] += 3;
    if (ok) return true;
  }
  // 順子
  if (i < 27 && Math.floor(i / 9) === Math.floor((i + 2) / 9) && out(i + 2) && c[i + 1] > 0 && c[i + 2] > 0) {
    c[i]--;
    c[i + 1]--;
    c[i + 2]--;
    const ok = naiveMelds(c);
    c[i]++;
    c[i + 1]++;
    c[i + 2]++;
    if (ok) return true;
  }
  return false;
};

const naiveWin14 = (c: number[]): boolean => {
  const kinds = c.filter((n) => n > 0);
  if (kinds.length === 7 && kinds.every((n) => n === 2)) return true;
  for (let t = 0; t < TILE_KINDS; t++) {
    if (c[t] >= 2) {
      c[t] -= 2;
      const ok = naiveMelds(c);
      c[t] += 2;
      if (ok) return true;
    }
  }
  return false;
};

const naiveWaits = (hand: readonly TileId[]): TileId[] => {
  const base = [...toCounts(hand)];
  const res: TileId[] = [];
  for (let t = 0; t < TILE_KINDS; t++) {
    if (base[t] >= 4) continue;
    const c = [...base];
    c[t]++;
    if (naiveWin14(c)) res.push(t);
  }
  return res;
};

// Feature: mahjong-machi-quiz-game, Property 4: 待ち集合の並べ替え不変性
describe('Property 4: 待ち集合の並べ替え不変性', () => {
  it('任意の並べ替えで calcWaits の結果は変わらない', () => {
    fc.assert(
      fc.property(
        hand13Arb,
        fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 13, maxLength: 13 }),
        (hand, keys) => {
          expect(waitsOf(shuffled(hand, keys))).toEqual(waitsOf(hand));
        },
      ),
      { numRuns: 300 },
    );
  });
});

// Feature: mahjong-machi-quiz-game, Property 6: 不正な手牌の拒否
describe('Property 6: 不正な手牌の拒否', () => {
  it('13枚でない牌の列はエラーになる', () => {
    fc.assert(
      fc.property(
        fc
          .integer({ min: 0, max: 20 })
          .filter((n) => n !== 13)
          .chain((n) => fc.array(fc.integer({ min: 0, max: 33 }), { minLength: n, maxLength: n })),
        (tiles) => {
          const r = calcWaits(tiles);
          expect(r.ok).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('同一牌種を5枚以上含む13枚はエラーになる', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 33 }),
        fc.integer({ min: 5, max: 13 }),
        fc.array(fc.integer({ min: 0, max: 33 }), { minLength: 13, maxLength: 13 }),
        (t, k, others) => {
          const tiles = [...Array<TileId>(k).fill(t), ...others.slice(0, 13 - k)];
          const r = calcWaits(tiles);
          expect(r.ok).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// Feature: mahjong-machi-quiz-game, Property 5: 待ち集合と Interpretation の存在の同値
describe('Property 5: 待ち集合と Interpretation の存在の同値', () => {
  it('calcWaits は素朴な参考実装と一致する', () => {
    fc.assert(
      fc.property(hand13Arb, (hand) => {
        expect(waitsOf(hand)).toEqual(naiveWaits(hand));
      }),
      { numRuns: 500 },
    );
  });

  it('牌種 t が待ち ⇔ 3枚以下かつ enumerateInterpretations が非空', () => {
    fc.assert(
      fc.property(hand13Arb, (hand) => {
        const waits = new Set(waitsOf(hand));
        const counts = toCounts(hand);
        for (let t = 0; t < TILE_KINDS; t++) {
          let hasInterp = false;
          if (counts[t] <= 3) {
            const c = [...counts];
            c[t]++;
            hasInterp = enumerateInterpretations(c, t).length > 0;
          }
          expect(waits.has(t)).toBe(hasInterp);
        }
      }),
      { numRuns: 500 },
    );
  });

  it('九蓮宝燈形(1112345678999m)は 1〜9 萬の9種類を待つ (Req 2.5)', () => {
    expect(waitsOf(parse('1112345678999m'))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('国士無双形は待ちなし (Req 2.6)', () => {
    expect(waitsOf(parse('19m19p19s1234567z'))).toEqual([]); // 13面待ちも対象外
    expect(waitsOf(parse('19m19p19s1123456z'))).toEqual([]); // 単騎形(7z待ち)も対象外
  });

  it('4枚持ちの牌は待ちに含めない / ノーテンは空 (Req 2.3, 2.4)', () => {
    expect(waitsOf(parse('1111m2345678p11z'))).not.toContain(0);
    expect(waitsOf(parse('1357m2468p13s135z'))).toEqual([]);
  });
});
