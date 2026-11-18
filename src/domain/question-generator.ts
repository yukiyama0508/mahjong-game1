import { enumerateInterpretations } from './interpretation';
import { parseHand, serializeHand } from './hand-parser';
import type { Rng } from './rng';
import { hasYakuman, scoreQuestion } from './score-calculator';
import type { QuestionScoring } from './score-calculator';
import { suitOf, toCounts, TILE_KINDS } from './tile';
import type { Hand, TileId } from './tile';
import { calcWaits } from './wait-calculator';
import { classifyHand } from './wait-classifier';
import type { WaitType } from './wait-classifier';

export type QuestionKind = 'normal' | 'chinitsu';

export interface Question {
  kind: QuestionKind;
  targetType: WaitType | null; // normal のみ
  hand: Hand; // 13枚、昇順
  handKey: string; // serializeHand(hand)
  waits: readonly TileId[];
  scoring: QuestionScoring;
}

const MAX_ATTEMPTS = 100;
const HAND_SIZE = 13;

/** 通常問題の対象待ち形(等確率で選ぶ) */
const TARGET_TYPES: readonly WaitType[] = [
  'ryanmen',
  'kanchan',
  'penchan',
  'shabo',
  'tanki',
  'chiitoiTanki',
  'multi',
];

/** 通常問題のフォールバック(手牌文字列)。待ち形ごとに1つ以上 */
export const NORMAL_FALLBACKS: readonly string[] = [
  '23m456p123789s11z', // 両面 1m-4m
  '13m456p123789s11z', // カンチャン 2m
  '12m456p123789s11z', // ペンチャン 3m
  '22m456789p123s11z', // シャボ 2m-東
  '123m456p789p123s5z', // 単騎 白
  '1133m5577p2244s1z', // 七対子の単騎 東
  '23456m456p789s11z', // 多面待ち 1m-4m-7m
];

/** 清一色問題のフォールバック(手牌文字列)。5つ以上 */
export const CHINITSU_FALLBACKS: readonly string[] = [
  '2223456778899m',
  '1233445566789p',
  '1123456788899s',
  '3334455667788p',
  '2345567888999m',
  '2233445566778s',
];

// ---- 検証 ----

const countsOk = (hand: Hand): boolean => {
  const counts = toCounts(hand);
  return hand.length === HAND_SIZE && hand.every((t) => t >= 0 && t < TILE_KINDS) && counts.every((c) => c <= 4);
};

/** 待ち牌ごとに Interpretation が存在し、役満がないこと(役はリーチで常に1つ以上) */
const noYakuman = (hand: Hand, waits: readonly TileId[]): boolean => {
  const base = [...toCounts(hand)];
  for (const w of waits) {
    const counts = [...base];
    counts[w] += 1;
    const interps = enumerateInterpretations(counts, w);
    if (interps.length === 0) return false;
    if (interps.some((i) => hasYakuman(i, counts))) return false;
  }
  return true;
};

/** 共通部分: 手牌・待ち・得点の整合 */
const baseConsistent = (q: Question): boolean => {
  if (!countsOk(q.hand)) return false;
  if (q.handKey !== serializeHand(q.hand)) return false;
  const waits = calcWaits(q.hand);
  if (!waits.ok) return false;
  if (waits.value.length !== q.waits.length || waits.value.some((w, i) => w !== q.waits[i])) return false;
  if (q.scoring.perWait.length !== q.waits.length) return false;
  if (q.scoring.perWait.some((s, i) => s.winTile !== q.waits[i] || s.yaku.length < 1)) return false;
  return true;
};

/** 要件 3.1〜3.7, 3.10 */
export const validateNormalQuestion = (q: Question): boolean => {
  if (q.kind !== 'normal' || q.targetType === null) return false;
  if (!baseConsistent(q)) return false;
  const n = q.waits.length;
  if (n === 0) return false;
  const cls = classifyHand(q.hand);
  if (cls.type !== q.targetType) return false;
  switch (q.targetType) {
    case 'kanchan':
    case 'penchan':
    case 'tanki':
    case 'chiitoiTanki':
      if (n !== 1) return false;
      break;
    case 'ryanmen':
    case 'shabo':
      if (n !== 2) return false;
      break;
    case 'multi': {
      if (n < 2) return false;
      const suits = new Set(q.hand.map(suitOf));
      if (suits.size === 1 && !suits.has('z')) return false; // 清一色は不可
      break;
    }
  }
  return noYakuman(q.hand, q.waits);
};

/** 要件 4.9〜4.11 */
export const validateChinitsuQuestion = (q: Question): boolean => {
  if (q.kind !== 'chinitsu' || q.targetType !== null) return false;
  if (!baseConsistent(q)) return false;
  const suits = new Set(q.hand.map(suitOf));
  if (suits.size !== 1 || suits.has('z')) return false;
  if (q.waits.length < 2) return false;
  if (q.scoring.perWait.some((s) => !s.yaku.some((y) => y.id === 'chinitsu'))) return false;
  return noYakuman(q.hand, q.waits);
};

// ---- 構築 ----

const buildQuestion = (kind: QuestionKind, targetType: WaitType | null, hand: Hand): Question => {
  const sorted = [...hand].sort((a, b) => a - b);
  const waitsRes = calcWaits(sorted);
  const waits = waitsRes.ok ? waitsRes.value : [];
  return {
    kind,
    targetType,
    hand: sorted,
    handKey: serializeHand(sorted),
    waits,
    scoring: scoreQuestion(sorted, waits),
  };
};

// ---- 候補生成 ----

const randInt = (rng: Rng, n: number): number => Math.floor(rng.next() * n);

/** 牌を1枚追加する。5枚目になるなら false */
const add = (counts: number[], t: TileId): boolean => {
  if (t < 0 || t >= TILE_KINDS || counts[t] >= 4) return false;
  counts[t] += 1;
  return true;
};

const addAll = (counts: number[], tiles: readonly TileId[]): boolean => tiles.every((t) => add(counts, t));

const toHand = (counts: readonly number[]): Hand => {
  const hand: TileId[] = [];
  counts.forEach((c, t) => {
    for (let i = 0; i < c; i++) hand.push(t);
  });
  return hand;
};

/** 面子を1つ作る。suits が指定されればその数牌種のみ(0..2) */
const randMeld = (rng: Rng, suit: number | null): TileId[] => {
  const s = suit ?? randInt(rng, 4);
  if (s === 3) {
    const t = 27 + randInt(rng, 7);
    return [t, t, t];
  }
  if (randInt(rng, 2) === 0) {
    const t = s * 9 + randInt(rng, 9);
    return [t, t, t];
  }
  const t = s * 9 + randInt(rng, 7);
  return [t, t + 1, t + 2];
};

const randTile = (rng: Rng, suit: number | null): TileId =>
  suit === null ? randInt(rng, TILE_KINDS) : suit * 9 + randInt(rng, 9);

/** 4面子1雀頭(14枚)を作り、1枚抜いて13枚にする */
const standardMinusOne = (rng: Rng, suit: number | null): Hand | null => {
  const counts = new Array<number>(TILE_KINDS).fill(0);
  for (let i = 0; i < 4; i++) if (!addAll(counts, randMeld(rng, suit))) return null;
  const p = randTile(rng, suit);
  if (!addAll(counts, [p, p])) return null;
  const hand = [...toHand(counts)];
  hand.splice(randInt(rng, hand.length), 1);
  return hand;
};

const meldsAndOthers = (rng: Rng, melds: number, extra: readonly TileId[]): Hand | null => {
  const counts = new Array<number>(TILE_KINDS).fill(0);
  for (let i = 0; i < melds; i++) if (!addAll(counts, randMeld(rng, null))) return null;
  if (!addAll(counts, extra)) return null;
  return toHand(counts);
};

/** 塔子(2枚)を作る。両面・カンチャン・ペンチャン */
const randTatsu = (rng: Rng, type: 'ryanmen' | 'kanchan' | 'penchan'): TileId[] => {
  const base = randInt(rng, 3) * 9;
  if (type === 'ryanmen') {
    const a = base + 1 + randInt(rng, 6); // 数字2..7
    return [a, a + 1];
  }
  if (type === 'kanchan') {
    const a = base + randInt(rng, 7); // 数字1..7
    return [a, a + 2];
  }
  return randInt(rng, 2) === 0 ? [base, base + 1] : [base + 7, base + 8];
};

const candidateFor = (target: WaitType, rng: Rng): Hand | null => {
  switch (target) {
    case 'ryanmen':
    case 'kanchan':
    case 'penchan': {
      const p = randTile(rng, null);
      return meldsAndOthers(rng, 3, [p, p, ...randTatsu(rng, target)]);
    }
    case 'shabo': {
      const a = randTile(rng, null);
      const b = randTile(rng, null);
      return meldsAndOthers(rng, 3, [a, a, b, b]);
    }
    case 'tanki':
      return meldsAndOthers(rng, 4, [randTile(rng, null)]);
    case 'chiitoiTanki': {
      const counts = new Array<number>(TILE_KINDS).fill(0);
      const used = new Set<TileId>();
      while (used.size < 6) used.add(randTile(rng, null));
      for (const t of used) addAll(counts, [t, t]);
      if (!add(counts, randTile(rng, null))) return null;
      return toHand(counts);
    }
    case 'multi':
      return standardMinusOne(rng, null);
    default:
      return null;
  }
};

// ---- フォールバック ----

const fallbackHands = (list: readonly string[]): Hand[] =>
  list.map((s) => {
    const r = parseHand(s);
    if (!r.ok) throw new Error(`Invalid fallback hand: ${s}`);
    return r.value;
  });

const pick = <T>(items: readonly T[], rng: Rng): T => items[randInt(rng, items.length)];

const normalFallback = (target: WaitType, rng: Rng, prevHandKey: string | null): Question => {
  const all = fallbackHands(NORMAL_FALLBACKS).filter((h) => classifyHand(h).type === target);
  const pool = all.filter((h) => serializeHand(h) !== prevHandKey);
  return buildQuestion('normal', target, pick(pool.length > 0 ? pool : all, rng));
};

const chinitsuFallback = (rng: Rng, prevHandKey: string | null): Question => {
  const all = fallbackHands(CHINITSU_FALLBACKS);
  const pool = all.filter((h) => serializeHand(h) !== prevHandKey);
  return buildQuestion('chinitsu', null, pick(pool.length > 0 ? pool : all, rng));
};

// ---- 公開 API ----

export const generateQuestion = (kind: QuestionKind, rng: Rng, prevHandKey: string | null): Question => {
  if (kind === 'chinitsu') {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const hand = standardMinusOne(rng, randInt(rng, 3));
      if (hand === null) continue;
      const q = buildQuestion('chinitsu', null, hand);
      if (q.handKey === prevHandKey) continue;
      if (validateChinitsuQuestion(q)) return q;
    }
    return chinitsuFallback(rng, prevHandKey);
  }

  const target = TARGET_TYPES[randInt(rng, TARGET_TYPES.length)];
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const hand = candidateFor(target, rng);
    if (hand === null || hand.length !== HAND_SIZE) continue;
    const q = buildQuestion('normal', target, hand);
    if (q.handKey === prevHandKey) continue;
    if (validateNormalQuestion(q)) return q;
  }
  return normalFallback(target, rng, prevHandKey);
};
