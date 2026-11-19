import { describe, expect, it } from 'vitest';
import { enumerateInterpretations } from '../src/domain/interpretation';
import type { Interpretation } from '../src/domain/interpretation';
import { parseHand } from '../src/domain/hand-parser';
import { toCounts } from '../src/domain/tile';

const run = (hand14: string, win: string): Interpretation[] => {
  const h = parseHand(hand14);
  const w = parseHand(win);
  if (!h.ok || !w.ok) throw new Error('bad input');
  return enumerateInterpretations(toCounts(h.value), w.value[0]);
};
const shapes = (is: Interpretation[]): string[] => [...new Set(is.map((i) => i.shape))].sort();

describe('enumerateInterpretations', () => {
  it('両面', () => {
    expect(shapes(run('234m456p789s111z22z', '4m'))).toEqual(['ryanmen']);
  });

  it('カンチャン', () => {
    expect(shapes(run('234m456p789s111z22z', '3m'))).toEqual(['kanchan']);
  });

  it('ペンチャン(12 待ち 3 / 89 待ち 7)', () => {
    expect(shapes(run('123m456p789s111z22z', '3m'))).toEqual(['penchan']);
    expect(shapes(run('789m456p123s111z22z', '7m'))).toEqual(['penchan']);
  });

  it('シャンポン', () => {
    const r = run('222m456p789s123s11z', '2m');
    expect(shapes(r)).toEqual(['shabo']);
  });

  it('単騎', () => {
    const r = run('123m456p789s111z22z', '2z');
    expect(r).toHaveLength(1);
    expect(r[0].shape).toBe('tanki');
    expect(r[0].pair).toBe(28);
    expect(r[0].melds).toHaveLength(4);
  });

  it('七対子の単騎', () => {
    const r = run('1133m2299p5577s44z', '4z');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ form: 'chiitoi', pair: null, melds: [], shape: 'chiitoiTanki' });
  });

  it('七対子は4枚持ちだと不成立', () => {
    expect(run('1111m22p33p44s55s66z', '6z')).toEqual([]);
  });

  it('同一の面子列は重複しない(123m が2組で和了牌 3m)', () => {
    const r = run('112233m456p789s55z', '3m');
    expect(r.filter((i) => i.shape === 'penchan')).toHaveLength(1);
  });

  it('異なる分解は別々に列挙する(111222333m は刻子3つ/順子3組)', () => {
    const r = run('111222333m456p11z', '3m');
    expect(r.filter((i) => i.shape === 'shabo')).toHaveLength(1);
    expect(r.filter((i) => i.shape === 'penchan')).toHaveLength(1);
  });

  it('和了形でなければ空', () => {
    expect(run('135m246p357s12345z', '1m')).toEqual([]);
  });

  it('国士無双は対象外', () => {
    expect(run('19m19p19s12345677z', '7z')).toEqual([]);
  });
});
