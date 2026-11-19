import { TILE_KINDS, toCounts } from './tile';
import type { Counts, Hand, Result, TileId } from './tile';

export type WaitError = { kind: 'invalidHand'; reason: 'count' | 'tooManyCopies' };

const HAND_SIZE = 13;

/** 面子のみで分解できるか(最小の牌から順に取り除く。早期終了あり) */
const decomposeMelds = (c: number[]): boolean => {
  let i = 0;
  while (i < TILE_KINDS && c[i] === 0) i++;
  if (i === TILE_KINDS) return true;

  // 刻子
  if (c[i] >= 3) {
    c[i] -= 3;
    const ok = decomposeMelds(c);
    c[i] += 3;
    if (ok) return true;
  }
  // 順子(数牌のみ、同じ種別内で 7 以下の数字から)
  if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
    c[i] -= 1;
    c[i + 1] -= 1;
    c[i + 2] -= 1;
    const ok = decomposeMelds(c);
    c[i] += 1;
    c[i + 1] += 1;
    c[i + 2] += 1;
    if (ok) return true;
  }
  return false;
};

/** 14枚の和了判定(4面子1雀頭または七対子)。国士無双は対象外。列挙は行わず早期終了する */
const isWinning = (counts: number[]): boolean => {
  // 七対子: 7種類すべてがちょうど2枚
  let pairs = 0;
  let chiitoi = true;
  for (let t = 0; t < TILE_KINDS; t++) {
    if (counts[t] === 0) continue;
    if (counts[t] === 2) pairs++;
    else {
      chiitoi = false;
      break;
    }
  }
  if (chiitoi && pairs === 7) return true;

  for (let t = 0; t < TILE_KINDS; t++) {
    if (counts[t] < 2) continue;
    counts[t] -= 2;
    const ok = decomposeMelds(counts);
    counts[t] += 2;
    if (ok) return true;
  }
  return false;
};

/** 13枚の手牌の待ち牌を昇順で返す。4枚持ちの牌種は除外する */
export const calcWaits = (hand13: Hand): Result<TileId[], WaitError> => {
  if (hand13.length !== HAND_SIZE) {
    return { ok: false, error: { kind: 'invalidHand', reason: 'count' } };
  }
  for (const t of hand13) {
    if (!Number.isInteger(t) || t < 0 || t >= TILE_KINDS) {
      return { ok: false, error: { kind: 'invalidHand', reason: 'count' } };
    }
  }
  const counts: number[] = [...(toCounts(hand13) as Counts)];
  if (counts.some((n) => n > 4)) {
    return { ok: false, error: { kind: 'invalidHand', reason: 'tooManyCopies' } };
  }

  const waits: TileId[] = [];
  for (let t = 0; t < TILE_KINDS; t++) {
    if (counts[t] >= 4) continue;
    counts[t] += 1;
    if (isWinning(counts)) waits.push(t);
    counts[t] -= 1;
  }
  return { ok: true, value: waits };
};
