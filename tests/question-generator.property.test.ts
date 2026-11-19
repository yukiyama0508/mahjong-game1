import fc from 'fast-check';
import { describe, it } from 'vitest';
import { enumerateInterpretations } from '../src/domain/interpretation';
import { generateQuestion } from '../src/domain/question-generator';
import type { Question, QuestionKind } from '../src/domain/question-generator';
import { createSeededRng } from '../src/domain/rng';
import { hasYakuman, scoreInterpretation } from '../src/domain/score-calculator';
import { suitOf, toCounts } from '../src/domain/tile';
import { calcWaits } from '../src/domain/wait-calculator';
import { classifyHand } from '../src/domain/wait-classifier';

const NUM_RUNS = 200;
const seedArb = fc.integer({ min: 0, max: 0x7fffffff });
const kindArb = fc.constantFrom<QuestionKind>('normal', 'chinitsu');

/** 失敗時に seed と問題を出力するため、違反メッセージを返す形で検査する */
const run = (seed: number, kind: QuestionKind, prev: string | null, check: (q: Question) => string | null): void => {
  const q = generateQuestion(kind, createSeededRng(seed), prev);
  const err = check(q);
  if (err !== null) {
    throw new Error(`seed=${seed} kind=${kind} prev=${prev} handKey=${q.handKey} target=${q.targetType} waits=[${q.waits}]: ${err}`);
  }
};

/** 全待ち牌の全 Interpretation を列挙する */
const allInterps = (q: Question) =>
  q.waits.flatMap((w) => {
    const counts = [...toCounts(q.hand)];
    counts[w] += 1;
    return enumerateInterpretations(counts, w).map((i) => ({ i, counts, w }));
  });

const commonCheck = (q: Question): string | null => {
  if (q.hand.length !== 13) return 'hand length != 13';
  if (toCounts(q.hand).some((c) => c > 4)) return 'tile count > 4';
  const waits = calcWaits(q.hand);
  if (!waits.ok) return 'calcWaits failed';
  if (waits.value.join() !== q.waits.join()) return `waits mismatch (calc=[${waits.value}])`;
  for (const w of q.waits) {
    const counts = [...toCounts(q.hand)];
    counts[w] += 1;
    if (enumerateInterpretations(counts, w).length === 0) return `no interpretation for wait ${w}`;
  }
  for (const { i, counts, w } of allInterps(q)) {
    if (hasYakuman(i, counts)) return `yakuman for wait ${w}`;
  }
  return null;
};

const normalCheck = (q: Question): string | null => {
  const base = commonCheck(q);
  if (base !== null) return base;
  if (q.kind !== 'normal' || q.targetType === null) return 'kind/targetType invalid';
  const n = q.waits.length;
  const t = q.targetType;
  if (['kanchan', 'penchan', 'tanki', 'chiitoiTanki'].includes(t) && n !== 1) return `wait count ${n} for ${t}`;
  if (['ryanmen', 'shabo'].includes(t) && n !== 2) return `wait count ${n} for ${t}`;
  if (t === 'multi' && n < 2) return `wait count ${n} for multi`;
  if (t !== 'multi') {
    for (const { i, w } of allInterps(q)) {
      if (i.shape !== t) return `shape ${i.shape} != ${t} for wait ${w}`;
    }
  } else {
    const suits = new Set(q.hand.map(suitOf));
    if (suits.size === 1 && !suits.has('z')) return 'multi hand is single-suit (chinitsu-like)';
  }
  if (classifyHand(q.hand).type !== t) return `classifyHand=${classifyHand(q.hand).type}`;
  // 役が1つ以上(リーチを含むため常に成立するが、採点結果で確認する)
  if (q.scoring.perWait.length !== n) return 'scoring length mismatch';
  for (const s of q.scoring.perWait) if (s.yaku.length < 1) return `no yaku for wait ${s.winTile}`;
  for (const { i, counts, w } of allInterps(q)) {
    if (scoreInterpretation(i, counts).yaku.length < 1) return `no yaku for interpretation of wait ${w}`;
  }
  return null;
};

const chinitsuCheck = (q: Question): string | null => {
  const base = commonCheck(q);
  if (base !== null) return base;
  if (q.kind !== 'chinitsu') return 'kind invalid';
  const suits = new Set(q.hand.map(suitOf));
  if (suits.size !== 1 || suits.has('z')) return `suits=${[...suits]}`;
  if (q.waits.length < 2) return `wait count ${q.waits.length}`;
  for (const { i, counts, w } of allInterps(q)) {
    if (!scoreInterpretation(i, counts).yaku.some((y) => y.id === 'chinitsu')) return `no chinitsu for wait ${w}`;
  }
  return null;
};

describe('Property 12: 通常問題は妥当である', () => {
  // Feature: mahjong-machi-quiz-game, Property 12: 通常問題は妥当である
  /** **Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 3.10** */
  it('任意のシードで生成される通常問題は妥当である', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        run(seed, 'normal', null, normalCheck);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Property 13: 連続する問題の手牌は異なる', () => {
  // Feature: mahjong-machi-quiz-game, Property 13: 連続する問題の手牌は異なる
  /** **Validates: Requirements 3.8** */
  it('生成される問題の手牌は直前の手牌と異なる', () => {
    fc.assert(
      fc.property(seedArb, kindArb, seedArb, (seed, kind, prevSeed) => {
        const prev = generateQuestion(kind, createSeededRng(prevSeed), null).handKey;
        // 同じシードから生成すると prev と一致しやすいため、同シードも含めて検査する
        run(seed, kind, prev, (q) => (q.handKey === prev ? 'handKey equals prev' : null));
        run(prevSeed, kind, prev, (q) => (q.handKey === prev ? 'handKey equals prev (same seed)' : null));
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Property 14: 清一色問題は妥当である', () => {
  // Feature: mahjong-machi-quiz-game, Property 14: 清一色問題は妥当である
  /** **Validates: Requirements 4.9, 4.10, 4.11** */
  it('任意のシードで生成される清一色問題は妥当である', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        run(seed, 'chinitsu', null, chinitsuCheck);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
