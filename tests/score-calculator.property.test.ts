import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  calcPoints,
  hasYakuman,
  scoreInterpretation,
  scoreQuestion,
  scoreWait,
} from '../src/domain/score-calculator';
import { calcWaits } from '../src/domain/wait-calculator';
import { enumerateInterpretations } from '../src/domain/interpretation';
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
const rawTenpaiArb: fc.Arbitrary<TileId[]> = fc
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
    return tiles.sort((a, b) => a - b);
  })
  .filter(withinFour);

const allInterpretations = (hand: readonly TileId[], w: TileId) => {
  const counts = [...toCounts(hand)];
  counts[w] += 1;
  return { counts, list: enumerateInterpretations(counts, w) };
};

/** 役満を含まないテンパイ手(設計上、役満は点数計算の対象外) */
const tenpaiArb: fc.Arbitrary<TileId[]> = rawTenpaiArb.filter((hand) => {
  const r = calcWaits(hand);
  if (!r.ok || r.value.length === 0) return false;
  return r.value.every((w) => {
    const { counts, list } = allInterpretations(hand, w);
    return list.every((i) => !hasYakuman(i, counts));
  });
});

const waitsOf = (hand: readonly TileId[]): TileId[] => {
  const r = calcWaits(hand);
  if (!r.ok) throw new Error('unexpected error');
  return r.value;
};

const shuffled = <T>(xs: readonly T[], keys: readonly number[]): T[] =>
  xs
    .map((x, i) => [x, keys[i % keys.length], i] as const)
    .sort((a, b) => a[1] - b[1] || a[2] - b[2])
    .map(([x]) => x);

const view = (s: ReturnType<typeof scoreWait>) => ({
  yaku: s.yaku,
  fu: s.fu,
  han: s.han,
  points: s.points,
});

const FUS = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];

// Feature: mahjong-machi-quiz-game, Property 8: 点数計算の決定性と順序非依存
describe('Property 8: 点数計算の決定性と順序非依存', () => {
  /** **Validates: Requirements 6.11, 6.13, 6.14** */
  it('繰り返しと並べ替えで同一結果、perWait は待ち集合と同数で昇順', () => {
    fc.assert(
      fc.property(
        tenpaiArb,
        fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 13, maxLength: 13 }),
        (hand, keys) => {
          const waits = waitsOf(hand);
          const other = shuffled(hand, keys);
          for (const w of waits) {
            const a = scoreWait(hand, w);
            expect(view(scoreWait(hand, w))).toEqual(view(a));
            expect(view(scoreWait(other, w))).toEqual(view(a));
          }
          const q = scoreQuestion(hand, waits);
          const q2 = scoreQuestion(other, waits);
          expect(q.perWait.map((p) => p.winTile)).toEqual(waits);
          expect(q.perWait.length).toBe(waits.length);
          expect(q2.questionScore).toBe(q.questionScore);
          expect(q2.perWait.map(view)).toEqual(q.perWait.map(view));
        },
      ),
      { numRuns: 300 },
    );
  });
});

// Feature: mahjong-machi-quiz-game, Property 9: 点数の構造と範囲
describe('Property 9: 点数の構造と範囲', () => {
  /** **Validates: Requirements 6.3, 6.5, 6.6, 6.15** */
  it('リーチ含有・100の倍数・範囲・平和30符・七対子25符・翻の合計', () => {
    fc.assert(
      fc.property(tenpaiArb, (hand) => {
        for (const w of waitsOf(hand)) {
          const s = scoreWait(hand, w);
          const riichi = s.yaku.find((y) => y.id === 'riichi');
          expect(riichi?.han).toBe(1);
          expect(s.points % 100).toBe(0);
          expect(s.points).toBeGreaterThanOrEqual(1000);
          expect(s.points).toBeLessThanOrEqual(32000);
          if (s.yaku.some((y) => y.id === 'pinfu')) {
            expect(s.fu).toBe(30);
            expect(s.interpretation.form).toBe('standard');
          }
          if (s.interpretation.form === 'chiitoi') expect(s.fu).toBe(25);
          expect(s.han).toBe(s.yaku.reduce((sum, y) => sum + y.han, 0));
        }
      }),
      { numRuns: 300 },
    );
  });
});

// Feature: mahjong-machi-quiz-game, Property 10: 高点法と Question_Score の最大性
describe('Property 10: 高点法と Question_Score の最大性', () => {
  /** **Validates: Requirements 6.10, 6.11, 6.12, 6.16** */
  it('scoreWait は全 Interpretation の最大で、同点なら翻、符の順に大きいものを採る', () => {
    fc.assert(
      fc.property(tenpaiArb, (hand) => {
        for (const w of waitsOf(hand)) {
          const { counts, list } = allInterpretations(hand, w);
          const scores = list.map((i) => scoreInterpretation(i, counts));
          const best = scoreWait(hand, w);
          const max = Math.max(...scores.map((s) => s.points));
          expect(best.points).toBe(max);
          const ties = scores.filter((s) => s.points === max);
          const maxHan = Math.max(...ties.map((s) => s.han));
          expect(best.han).toBe(maxHan);
          const maxFu = Math.max(...ties.filter((s) => s.han === maxHan).map((s) => s.fu));
          expect(best.fu).toBe(maxFu);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('questionScore は perWait の最大値、bestWaits はその最大を持つ待ち牌の集合', () => {
    fc.assert(
      fc.property(tenpaiArb, (hand) => {
        const waits = waitsOf(hand);
        const q = scoreQuestion(hand, waits);
        const max = Math.max(...q.perWait.map((p) => p.points));
        expect(q.questionScore).toBe(max);
        expect([...q.bestWaits]).toEqual(
          q.perWait.filter((p) => p.points === max).map((p) => p.winTile),
        );
        for (const p of q.perWait) expect(p.points).toBe(scoreWait(hand, p.winTile).points);
      }),
      { numRuns: 300 },
    );
  });
});

// Feature: mahjong-machi-quiz-game, Property 11: 点数は符と翻について単調
describe('Property 11: 点数は符と翻について単調', () => {
  const fuArb = fc.constantFrom(...FUS);
  const hanArb = fc.integer({ min: 1, max: 13 });

  /** **Validates: Requirements 6.8, 6.17** */
  it('翻について単調', () => {
    fc.assert(
      fc.property(fuArb, hanArb, hanArb, (fu, a, b) => {
        const [h1, h2] = a <= b ? [a, b] : [b, a];
        expect(calcPoints(fu, h1)).toBeLessThanOrEqual(calcPoints(fu, h2));
      }),
      { numRuns: 300 },
    );
  });

  it('符について単調', () => {
    fc.assert(
      fc.property(fuArb, fuArb, hanArb, (a, b, han) => {
        const [f1, f2] = a <= b ? [a, b] : [b, a];
        expect(calcPoints(f1, han)).toBeLessThanOrEqual(calcPoints(f2, han));
      }),
      { numRuns: 300 },
    );
  });

  it('リーチ以外の役を1つ外して符を変えずに計算した点数は外す前以下', () => {
    fc.assert(
      fc.property(tenpaiArb, (hand) => {
        for (const w of waitsOf(hand)) {
          const { counts, list } = allInterpretations(hand, w);
          for (const i of list) {
            const s = scoreInterpretation(i, counts);
            for (const y of s.yaku) {
              if (y.id === 'riichi') continue;
              expect(calcPoints(s.fu, s.han - y.han)).toBeLessThanOrEqual(s.points);
            }
          }
        }
      }),
      { numRuns: 300 },
    );
  });
});
