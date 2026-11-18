import { enumerateInterpretations } from './interpretation';
import type { WaitShape } from './interpretation';
import { toCounts } from './tile';
import type { Hand, TileId } from './tile';
import { calcWaits } from './wait-calculator';

export type WaitType = WaitShape | 'multi';

export interface WaitClassification {
  type: WaitType;
  /** 各待ち牌(昇順)について、全 Interpretation の待ち形(重複なし) */
  shapesByWait: ReadonlyMap<TileId, readonly WaitShape[]>;
}

/**
 * 13枚のテンパイ手の待ち形を分類する。
 * 待ち牌が3種類以上、または全待ち牌の全 Interpretation の待ち形が2種類以上にまたがる場合は 'multi'。
 * それ以外は共通する単一の待ち形を返す。
 * 不正な手牌・ノーテン手(待ちなし)は shapesByWait が空で type は 'multi' になる(呼び出し側で待ちの有無を確認すること)。
 */
export const classifyHand = (hand13: Hand): WaitClassification => {
  const shapesByWait = new Map<TileId, readonly WaitShape[]>();
  const waits = calcWaits(hand13);
  if (!waits.ok || waits.value.length === 0) return { type: 'multi', shapesByWait };

  const base = [...toCounts(hand13)];
  const all = new Set<WaitShape>();
  for (const w of waits.value) {
    const counts = [...base];
    counts[w] += 1;
    const shapes = new Set<WaitShape>();
    for (const i of enumerateInterpretations(counts, w)) shapes.add(i.shape);
    shapesByWait.set(w, [...shapes]);
    for (const s of shapes) all.add(s);
  }

  if (waits.value.length >= 3 || all.size !== 1) return { type: 'multi', shapesByWait };
  return { type: [...all][0], shapesByWait };
};
