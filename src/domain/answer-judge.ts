import type { TileId } from './tile';

export interface JudgeResult {
  correct: boolean;
  /** 待ちなのに選ばれなかった牌(昇順) */
  missing: TileId[];
  /** 待ちでないのに選ばれた牌(昇順) */
  extra: TileId[];
}

/** 回答の集合が待ち集合と完全一致するときのみ正解 */
export const judgeAnswer = (answer: ReadonlySet<TileId>, waits: readonly TileId[]): JudgeResult => {
  const waitSet = new Set(waits);
  const missing = [...waitSet].filter((t) => !answer.has(t)).sort((a, b) => a - b);
  const extra = [...answer].filter((t) => !waitSet.has(t)).sort((a, b) => a - b);
  return { correct: missing.length === 0 && extra.length === 0, missing, extra };
};
