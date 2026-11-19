import type { TileId } from '../domain/tile';

/** 回答集合 */
export type Answer = ReadonlySet<TileId>;

/** 未選択なら加え、選択済みなら取り除く。元の集合は変更しない */
export const toggleTile = (answer: Answer, t: TileId): Set<TileId> => {
  const next = new Set(answer);
  if (next.has(t)) next.delete(t);
  else next.add(t);
  return next;
};

/** 任意の回答を空にする */
export const clearAnswer = (_answer?: Answer): Set<TileId> => new Set<TileId>();
