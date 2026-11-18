/** 0-8: 萬子1-9, 9-17: 筒子1-9, 18-26: 索子1-9, 27-33: 東南西北白發中 */
export type TileId = number;
/** m: 萬子, p: 筒子, s: 索子, z: 字牌 */
export type Suit = 'm' | 'p' | 's' | 'z';
/** 長さ34の配列。counts[t] は牌種 t の枚数(0〜4) */
export type Counts = readonly number[];
/** 昇順にソートされた牌の配列。13枚(問題)または14枚(和了形) */
export type Hand = readonly TileId[];

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const TILE_KINDS = 34;

const SUITS: readonly Suit[] = ['m', 'p', 's', 'z'];
const SUIT_NAMES: Record<Suit, string> = { m: '萬', p: '筒', s: '索', z: '' };
const HONOR_NAMES: readonly string[] = ['東', '南', '西', '北', '白', '發', '中'];

export const suitOf = (t: TileId): Suit => SUITS[Math.floor(t / 9)];

/** 数牌は1-9、字牌は1-7 */
export const numberOf = (t: TileId): number => (t % 9) + 1;

export const toCounts = (hand: Hand): Counts => {
  const counts = new Array<number>(TILE_KINDS).fill(0);
  for (const t of hand) counts[t] += 1;
  return counts;
};

/** 萬→筒→索→字牌、字牌は東南西北白發中(TileId の昇順と一致) */
export const sortForDisplay = (hand: Hand): TileId[] => [...hand].sort((a, b) => a - b);

/** 「3萬」「東」等(SVG生成失敗時の代替表示) */
export const tileLabel = (t: TileId): string => {
  const suit = suitOf(t);
  if (suit === 'z') return HONOR_NAMES[numberOf(t) - 1];
  return `${numberOf(t)}${SUIT_NAMES[suit]}`;
};
