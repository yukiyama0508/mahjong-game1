import { numberOf, suitOf, toCounts } from './tile';
import type { Counts, Hand, TileId } from './tile';
import { enumerateInterpretations } from './interpretation';
import type { Interpretation, Meld } from './interpretation';
import { detectYaku, hasYakuman as hasYakumanImpl } from './yaku';
import type { YakuEntry } from './yaku';

export interface InterpretationScore {
  interpretation: Interpretation;
  yaku: readonly YakuEntry[];
  fu: number;
  han: number;
  points: number;
}
export interface WaitScore extends InterpretationScore {
  winTile: TileId;
}
export interface QuestionScoring {
  perWait: readonly WaitScore[]; // 待ち牌の昇順
  questionScore: number; // perWait の points の最大値
  bestWaits: readonly TileId[]; // questionScore と等しい待ち牌
}

/** 役満の検出は yaku.ts の実装をそのまま公開する */
export const hasYakuman: (i: Interpretation, hand14: Counts) => boolean = hasYakumanImpl;

const isHonor = (t: TileId): boolean => suitOf(t) === 'z';
const isYaochuu = (t: TileId): boolean => isHonor(t) || numberOf(t) === 1 || numberOf(t) === 9;
/** 役牌(東=27、南=28、白發中=31..33)。雀頭符の対象 */
const isYakuhaiTile = (t: TileId): boolean => t === 27 || t === 28 || (t >= 31 && t <= 33);

const ceilTo = (n: number, unit: number): number => Math.ceil(n / unit) * unit;

/** 子のロン点。切り上げ満貫は採用しない(要件 6.8, 6.9) */
export const calcPoints = (fu: number, han: number): number => {
  let base = fu * Math.pow(2, han + 2);
  if (han >= 5 || base > 2000) {
    if (han >= 13) base = 8000;
    else if (han >= 11) base = 6000;
    else if (han >= 8) base = 4000;
    else if (han >= 6) base = 3000;
    else base = 2000;
  }
  return ceilTo(base * 4, 100);
};

/** 4面子1雀頭の符(平和は30符固定、七対子は25符固定) */
const calcFu = (i: Interpretation, yaku: readonly YakuEntry[]): number => {
  if (i.form === 'chiitoi') return 25;
  if (yaku.some((y) => y.id === 'pinfu')) return 30;
  let fu = 20 + 10; // 副底 + 門前ロン
  for (const m of i.melds) {
    if (m.type !== 'koutsu') continue;
    // シャボ待ちでロン和了した刻子は明刻扱い(要件 6.7)
    const open = i.shape === 'shabo' && m.tile === i.winTile;
    const yao = isYaochuu(m.tile);
    fu += open ? (yao ? 4 : 2) : yao ? 8 : 4;
  }
  if (i.pair !== null && isYakuhaiTile(i.pair)) fu += 2;
  if (i.shape === 'kanchan' || i.shape === 'penchan' || i.shape === 'tanki') fu += 2;
  return ceilTo(fu, 10);
};

export const scoreInterpretation = (i: Interpretation, hand14: Counts): InterpretationScore => {
  const yaku = detectYaku(i, hand14);
  const han = yaku.reduce((s, y) => s + y.han, 0);
  const fu = calcFu(i, yaku);
  return { interpretation: i, yaku, fu, han, points: calcPoints(fu, han) };
};

const meldsKey = (melds: readonly Meld[]): string =>
  melds.map((m) => `${m.type === 'shuntsu' ? 0 : 1}${String(m.tile).padStart(2, '0')}`).join(',');

/** 同点・同翻・同符のときの決定的な順序: form(standard が先)、雀頭、面子列、待ち形 */
const shapeKey = (i: Interpretation): string =>
  `${i.form === 'standard' ? 0 : 1}|${String(i.pair ?? -1).padStart(2, '0')}|${meldsKey(i.melds)}|${i.shape}`;

const compareScores = (a: InterpretationScore, b: InterpretationScore): number =>
  b.points - a.points ||
  b.han - a.han ||
  b.fu - a.fu ||
  (shapeKey(a.interpretation) < shapeKey(b.interpretation)
    ? -1
    : shapeKey(a.interpretation) > shapeKey(b.interpretation)
      ? 1
      : 0);

/** 高点法: 全 Interpretation から点数、翻、符の順で最大のものを採用する */
export const scoreWait = (hand13: Hand, winTile: TileId): WaitScore => {
  const counts = [...toCounts(hand13)];
  counts[winTile] += 1;
  const interpretations = enumerateInterpretations(counts, winTile);
  if (interpretations.length === 0) {
    throw new Error(`Tile ${winTile} does not complete the hand`);
  }
  const scores = interpretations.map((i) => scoreInterpretation(i, counts));
  scores.sort(compareScores);
  return { ...scores[0], winTile };
};

export const scoreQuestion = (hand13: Hand, waits: readonly TileId[]): QuestionScoring => {
  const sorted = [...waits].sort((a, b) => a - b);
  const perWait = sorted.map((w) => scoreWait(hand13, w));
  const questionScore = perWait.reduce((m, w) => Math.max(m, w.points), 0);
  const bestWaits = perWait.filter((w) => w.points === questionScore).map((w) => w.winTile);
  return { perWait, questionScore, bestWaits };
};
