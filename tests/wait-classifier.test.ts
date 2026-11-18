import { describe, expect, it } from 'vitest';
import { parseHand } from '../src/domain/hand-parser';
import { classifyHand } from '../src/domain/wait-classifier';
import { calcWaits } from '../src/domain/wait-calculator';

const classify = (s: string) => {
  const r = parseHand(s);
  if (!r.ok) throw new Error(`bad hand ${s}`);
  return classifyHand(r.value);
};

describe('classifyHand', () => {
  it.each([
    ['23m456p789s11122z', 'ryanmen'],
    ['13m456p789s11122z', 'kanchan'],
    ['12m456p789s11122z', 'penchan'],
    ['123m456p789s1122z', 'shabo'],
    ['123m456p789s1112z', 'tanki'],
    ['1133m2255p4466s7z', 'chiitoiTanki'],
    ['1112345678999m', 'multi'],
  ])('%s は %s', (hand, type) => {
    expect(classify(hand).type).toBe(type);
  });

  it('待ち牌ごとの待ち形を返す', () => {
    const c = classify('23m456p789s11122z');
    expect([...c.shapesByWait.keys()]).toEqual([0, 3]);
    expect(c.shapesByWait.get(0)).toEqual(['ryanmen']);
  });

  it('待ちが2種類で待ち形が2種類にまたがる手は multi', () => {
    // 2344m: 1m(両面) と 4m(単騎・両面のどちらでも和了)で待ち形が混在する
    const r = parseHand('2344m456p789s111z');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const waits = calcWaits(r.value);
    expect(waits.ok && waits.value).toEqual([0, 3]);
    const c = classifyHand(r.value);
    expect(c.type).toBe('multi');
    expect(c.shapesByWait.get(3)).toEqual(expect.arrayContaining(['tanki']));
  });

  it('ノーテン手は待ちなしで multi', () => {
    const c = classify('1469m1469p1469s1z');
    expect(c.shapesByWait.size).toBe(0);
    expect(c.type).toBe('multi');
  });
});
