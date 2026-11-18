/** 乱数源。next() は [0, 1) の値を返す。 */
export interface Rng {
  next(): number;
}

/** mulberry32 による決定的な乱数。テストと再現用。 */
export const createSeededRng = (seed: number): Rng => {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
};

/** 本番用。Math.random を使う。 */
export const createMathRng = (): Rng => ({
  next: () => Math.random(),
});
