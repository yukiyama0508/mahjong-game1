/** 単調増加する時計。端末の時刻変更の影響を受けない。 */
export interface Clock {
  now(): number;
}

/** 本番用の Clock。performance.now() は単調増加。 */
export const systemClock: Clock = {
  now: () => performance.now(),
};
