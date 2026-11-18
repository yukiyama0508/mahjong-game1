import { TILE_KINDS, numberOf, suitOf } from './tile';
import type { Counts, TileId } from './tile';

export type Meld = { type: 'shuntsu' | 'koutsu'; tile: TileId }; // shuntsu の tile は最小の牌
export type WaitShape = 'ryanmen' | 'kanchan' | 'penchan' | 'shabo' | 'tanki' | 'chiitoiTanki';
export interface Interpretation {
  form: 'standard' | 'chiitoi';
  pair: TileId | null; // standard のとき雀頭。chiitoi のとき null
  melds: readonly Meld[]; // standard は4つ。chiitoi は空
  winTile: TileId;
  shape: WaitShape; // 和了牌がどこを完成させたか
}

const meldOrder = (m: Meld): number => (m.type === 'shuntsu' ? 0 : 1) * TILE_KINDS + m.tile;

/** 面子列を整列して正規化する */
const sortMelds = (melds: readonly Meld[]): Meld[] =>
  [...melds].sort((a, b) => meldOrder(a) - meldOrder(b));

/** 残りの牌を最小の牌から刻子・順子に分解し、すべての面子列を集める */
const decompose = (counts: number[], start: number, acc: Meld[], out: Meld[][]): void => {
  let t = start;
  while (t < TILE_KINDS && counts[t] === 0) t++;
  if (t >= TILE_KINDS) {
    out.push(sortMelds(acc));
    return;
  }
  if (counts[t] >= 3) {
    counts[t] -= 3;
    acc.push({ type: 'koutsu', tile: t });
    decompose(counts, t, acc, out);
    acc.pop();
    counts[t] += 3;
  }
  if (suitOf(t) !== 'z' && numberOf(t) <= 7 && counts[t + 1] > 0 && counts[t + 2] > 0) {
    counts[t] -= 1;
    counts[t + 1] -= 1;
    counts[t + 2] -= 1;
    acc.push({ type: 'shuntsu', tile: t });
    decompose(counts, t, acc, out);
    acc.pop();
    counts[t] += 1;
    counts[t + 1] += 1;
    counts[t + 2] += 1;
  }
};

const shuntsuShape = (m: Meld, win: TileId): WaitShape => {
  if (win === m.tile + 1) return 'kanchan';
  if (win === m.tile + 2 && numberOf(m.tile) === 1) return 'penchan'; // 123 の 3
  if (win === m.tile && numberOf(m.tile) === 7) return 'penchan'; // 789 の 7
  return 'ryanmen';
};

const meldsKey = (melds: readonly Meld[]): string =>
  melds.map((m) => `${m.type[0]}${m.tile}`).join(',');

/**
 * 14枚の手牌と和了牌から、成立するすべての Interpretation を重複なく列挙する。
 * 国士無双は対象外。
 */
export const enumerateInterpretations = (hand14: Counts, winTile: TileId): Interpretation[] => {
  const result: Interpretation[] = [];
  const seen = new Set<string>();
  const push = (i: Interpretation): void => {
    const key = `${i.form}|${i.pair}|${meldsKey(i.melds)}|${i.winTile}|${i.shape}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(i);
  };

  const total = hand14.reduce((a, b) => a + b, 0);
  if (total !== 14 || hand14.length !== TILE_KINDS || hand14[winTile] < 1) return result;

  // 4面子1雀頭
  const counts = [...hand14];
  for (let pair = 0; pair < TILE_KINDS; pair++) {
    if (counts[pair] < 2) continue;
    counts[pair] -= 2;
    const decomps: Meld[][] = [];
    decompose(counts, 0, [], decomps);
    counts[pair] += 2;
    for (const melds of decomps) {
      if (pair === winTile) {
        push({ form: 'standard', pair, melds, winTile, shape: 'tanki' });
      }
      for (const m of melds) {
        if (m.type === 'koutsu') {
          if (m.tile === winTile) push({ form: 'standard', pair, melds, winTile, shape: 'shabo' });
        } else if (winTile >= m.tile && winTile <= m.tile + 2) {
          push({ form: 'standard', pair, melds, winTile, shape: shuntsuShape(m, winTile) });
        }
      }
    }
  }

  // 七対子: 異なる7種類の対子(4枚持ちは不成立)
  let pairs = 0;
  let ok = true;
  for (let t = 0; t < TILE_KINDS; t++) {
    if (hand14[t] === 2) pairs++;
    else if (hand14[t] !== 0) ok = false;
  }
  if (ok && pairs === 7 && hand14[winTile] === 2) {
    push({ form: 'chiitoi', pair: null, melds: [], winTile, shape: 'chiitoiTanki' });
  }

  return result;
};
