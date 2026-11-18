import { describe, expect, it } from 'vitest';
import { parseHand } from '../src/domain/hand-parser';
import { calcWaits } from '../src/domain/wait-calculator';

const waitsOf = (s: string): number[] => {
  const h = parseHand(s);
  if (!h.ok) throw new Error(`bad hand ${s}`);
  const r = calcWaits(h.value);
  if (!r.ok) throw new Error(`calc failed ${s}`);
  return r.value;
};

describe('calcWaits', () => {
  it('九蓮宝燈形 1112345678999m → 9 waits (Req 2.1)', () => {
    expect(waitsOf('1112345678999m')).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('国士無双形 → no waits (Req 2.6)', () => {
    expect(waitsOf('19m19p19s1234567z')).toEqual([]);
  });

  it('両面: 23m 456p 789s 111z 22z → 1m,4m', () => {
    expect(waitsOf('23m456p789s11122z')).toEqual([0, 3]);
  });

  it('単騎: 123m456p789s111z5z → 白単騎', () => {
    expect(waitsOf('123m456p789s1115z')).toEqual([31]);
  });

  it('七対子 → 単騎待ち', () => {
    expect(waitsOf('1133m2244p5566s7z')).toEqual([33]);
  });

  it('カンチャンとペンチャン', () => {
    expect(waitsOf('13m456p789s11122z')).toEqual([1]);
    expect(waitsOf('12m456p789s11122z')).toEqual([2]);
  });

  it('シャボ待ち', () => {
    expect(waitsOf('123m456p789s1122z')).toEqual([27, 28]);
  });

  it('4枚持ちの牌種は待ちから除外 (Req 2.3)', () => {
    // 1m を5枚目にすれば和了できるが、4枚持ちなので 1m は待ちに含めない
    expect(waitsOf('1111234m456p789s')).toEqual([3]);
  });

  it('ノーテン手は空', () => {
    expect(waitsOf('1358m1358p1358s1z')).toEqual([]);
  });

  it('枚数が13枚でない場合は invalidHand/count (Req 2.7)', () => {
    const r = calcWaits([0, 1, 2]);
    expect(r).toEqual({ ok: false, error: { kind: 'invalidHand', reason: 'count' } });
    const r14 = calcWaits([0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6]);
    expect(r14.ok).toBe(false);
  });

  it('同一牌5枚以上は invalidHand/tooManyCopies (Req 2.7)', () => {
    const r = calcWaits([0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(r).toEqual({ ok: false, error: { kind: 'invalidHand', reason: 'tooManyCopies' } });
  });
});
