import { describe, expect, it } from 'vitest';
import { parseHand } from '../src/domain/hand-parser';
import { calcWaits } from '../src/domain/wait-calculator';
import { calcPoints, scoreQuestion, scoreWait } from '../src/domain/score-calculator';
import type { Hand, TileId } from '../src/domain/tile';

const hand = (s: string): Hand => {
  const r = parseHand(s);
  if (!r.ok) throw new Error(`bad hand ${s}`);
  return r.value;
};
const tile = (s: string): TileId => hand(s)[0];

describe('calcPoints (child ron)', () => {
  const rows: [number, number, number][] = [
    [30, 1, 1000],
    [30, 2, 2000],
    [25, 2, 1600],
    [40, 2, 2600],
    [30, 3, 3900],
    [40, 3, 5200],
    [50, 3, 6400],
    [60, 3, 7700], // 切り上げ満貫なし
    [30, 4, 7700], // 切り上げ満貫なし
    [40, 4, 8000],
    [70, 3, 8000],
    [30, 5, 8000],
    [30, 6, 12000],
    [30, 7, 12000],
    [30, 8, 16000],
    [30, 10, 16000],
    [30, 11, 24000],
    [30, 12, 24000],
    [30, 13, 32000],
  ];
  it.each(rows)('fu=%i han=%i -> %i', (fu, han, expected) => {
    expect(calcPoints(fu, han)).toBe(expected);
  });
});

describe('scoreWait known examples', () => {
  it('pinfu + riichi: 2han 30fu = 2000', () => {
    const s = scoreWait(hand('123m456p789s23p99m'), tile('1p'));
    expect([s.han, s.fu, s.points]).toEqual([2, 30, 2000]);
  });

  it('chiitoitsu tanki: 3han 25fu = 3200', () => {
    const s = scoreWait(hand('1122m3344p5566s1z'), tile('1z'));
    expect(s.interpretation.form).toBe('chiitoi');
    expect([s.han, s.fu, s.points]).toEqual([3, 25, 3200]);
  });

  it('30fu 4han = 7700 (riichi pinfu tanyao iipeikou)', () => {
    const s = scoreWait(hand('234m234m567p34s88s'), tile('5s'));
    expect([s.han, s.fu, s.points]).toEqual([4, 30, 7700]);
  });

  it('60fu 3han = 7700 with shabo ron triplet open', () => {
    const s = scoreWait(hand('111m456p1122777z'), tile('1z'));
    expect(s.fu).toBe(60);
    expect(s.han).toBe(3);
    expect(s.points).toBe(7700);
  });

  it('shabo-ron triplet counts as open for fu (50fu, not 60fu)', () => {
    const s = scoreWait(hand('111s999m22p456p33z'), tile('2p'));
    expect(s.interpretation.shape).toBe('shabo');
    expect([s.han, s.fu, s.points]).toEqual([1, 50, 1600]);
  });

  it('chinitsu + riichi = haneman 12000', () => {
    const s = scoreWait(hand('111m234m567m78m99m'), tile('6m'));
    expect(s.han).toBe(7);
    expect(s.points).toBe(12000);
  });

  it('chinitsu + pinfu + iipeikou + riichi = baiman 16000', () => {
    const s = scoreWait(hand('123m123m456m78m99m'), tile('6m'));
    expect(s.han).toBe(9);
    expect(s.points).toBe(16000);
  });
});

describe('scoreQuestion', () => {
  it('picks the highest-scoring wait and lists best waits', () => {
    const h = hand('22m33z456p456s789p');
    const waits = calcWaits(h);
    expect(waits.ok).toBe(true);
    if (!waits.ok) return;
    const q = scoreQuestion(h, waits.value);
    expect(q.perWait.map((w) => w.winTile)).toEqual([...waits.value]);
    expect(q.questionScore).toBe(Math.max(...q.perWait.map((w) => w.points)));
    expect(q.bestWaits.length).toBeGreaterThan(0);
  });

  it('shabo with yakuhai wait is the best wait', () => {
    const h = hand('22m77z456p456s789p');
    const waits = calcWaits(h);
    if (!waits.ok) throw new Error('no waits');
    const q = scoreQuestion(h, waits.value);
    expect(q.bestWaits).toEqual([tile('7z')]);
    expect(q.questionScore).toBe(2600);
  });
});
