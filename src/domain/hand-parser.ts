import { TILE_KINDS, suitOf, numberOf } from './tile';
import type { Hand, Result, Suit, TileId } from './tile';

export type ParseError =
  | { kind: 'invalidChar'; position: number; char: string }
  | { kind: 'missingSuit'; position: number } // 数字列の後に種別文字がない
  | { kind: 'orphanSuit'; position: number } // 数字なしの種別文字
  | { kind: 'honorOutOfRange'; position: number } // z に 8, 9
  | { kind: 'redTile'; position: number } // 0
  | { kind: 'tileCount'; count: number } // 0枚、または15枚以上
  | { kind: 'tooManyCopies'; tile: TileId };

const SUIT_BASE: Record<Suit, number> = { m: 0, p: 9, s: 18, z: 27 };
const MAX_TILES = 14;

/**
 * 手牌文字列を Hand(昇順の TileId 配列)に変換する。
 * 左から右へ走査し、最初に見つけた不正を返す。
 * 同じ種別が複数グループに分かれていても1つにまとめる。
 */
export const parseHand = (s: string): Result<Hand, ParseError> => {
  const counts = new Array<number>(TILE_KINDS).fill(0);
  let total = 0;
  // 種別文字を待っている数字(値と位置)
  let pending: { digit: number; position: number }[] = [];

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch >= '0' && ch <= '9') {
      if (ch === '0') return { ok: false, error: { kind: 'redTile', position: i } };
      pending.push({ digit: Number(ch), position: i });
    } else if (ch === 'm' || ch === 'p' || ch === 's' || ch === 'z') {
      if (pending.length === 0) return { ok: false, error: { kind: 'orphanSuit', position: i } };
      for (const { digit, position } of pending) {
        if (ch === 'z' && digit > 7) {
          return { ok: false, error: { kind: 'honorOutOfRange', position } };
        }
        counts[SUIT_BASE[ch] + digit - 1] += 1;
        total += 1;
      }
      pending = [];
    } else {
      return { ok: false, error: { kind: 'invalidChar', position: i, char: ch } };
    }
  }

  if (pending.length > 0) {
    return { ok: false, error: { kind: 'missingSuit', position: pending[0].position } };
  }
  if (total < 1 || total > MAX_TILES) {
    return { ok: false, error: { kind: 'tileCount', count: total } };
  }
  for (let t = 0; t < TILE_KINDS; t++) {
    if (counts[t] > 4) return { ok: false, error: { kind: 'tooManyCopies', tile: t } };
  }

  const hand: TileId[] = [];
  for (let t = 0; t < TILE_KINDS; t++) {
    for (let k = 0; k < counts[t]; k++) hand.push(t);
  }
  return { ok: true, value: hand };
};

/** m, p, s, z の順、各種別は牌があるときだけ1回、数字は昇順 */
export const serializeHand = (h: Hand): string => {
  const sorted = [...h].sort((a, b) => a - b);
  let out = '';
  for (const suit of ['m', 'p', 's', 'z'] as const) {
    const digits = sorted.filter((t) => suitOf(t) === suit).map((t) => String(numberOf(t)));
    if (digits.length > 0) out += digits.join('') + suit;
  }
  return out;
};
