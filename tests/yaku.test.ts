import { describe, expect, it } from 'vitest';
import { enumerateInterpretations } from '../src/domain/interpretation';
import type { Interpretation } from '../src/domain/interpretation';
import { parseHand } from '../src/domain/hand-parser';
import { toCounts } from '../src/domain/tile';
import { detectYaku, detectYakuman, hasYakuman } from '../src/domain/yaku';
import type { YakuId, YakumanId } from '../src/domain/yaku';

const interps = (hand: string, win: string): { list: Interpretation[]; counts: number[] } => {
  const h = parseHand(hand);
  const w = parseHand(win);
  if (!h.ok || !w.ok) throw new Error(`bad input ${hand} ${win}`);
  const counts = [...toCounts(h.value)];
  const list = enumerateInterpretations(counts, w.value[0]);
  expect(list.length).toBeGreaterThan(0);
  return { list, counts };
};

const idsOf = (i: Interpretation, counts: number[]): YakuId[] =>
  detectYaku(i, counts).map((e) => e.id);

/** いずれかの解釈で役が成立するか */
const someHas = (hand: string, win: string, id: YakuId): boolean => {
  const { list, counts } = interps(hand, win);
  return list.some((i) => idsOf(i, counts).includes(id));
};

// [役, 手牌14枚, 和了牌, 成立するか]
const yakuCases: [YakuId, string, string, boolean][] = [
  ['riichi', '123456m234p55789s', '2p', true],
  ['pinfu', '123456m234p55789s', '2p', true],
  ['pinfu', '123456m234p55789s', '3p', false], // カンチャン
  ['pinfu', '123456m234p789s11z', '2p', false], // 雀頭が役牌(東)
  ['pinfu', '123456m234p789s11z', '1z', false], // 単騎
  ['tanyao', '234m456p678s345p55s', '5s', true],
  ['tanyao', '234m456p678s345p11s', '1s', false],
  ['iipeikou', '112233m456p789s55p', '5p', true],
  ['iipeikou', '123456m789s234p55s', '5s', false],
  ['ryanpeikou', '112233m445566p77s', '7s', true],
  ['ryanpeikou', '112233m456p789s55p', '5p', false],
  ['yakuhai', '123m456p789s222z55p', '2z', true],
  ['yakuhai', '123m456p789s333z55p', '3z', false], // 西は役牌でない
  ['yakuhai', '123m456p789s444z55p', '4z', false], // 北は役牌でない
  ['yakuhai', '123m456p789s234p11z', '1z', false], // 雀頭のみ
  ['chiitoitsu', '1122m3344p5566s77z', '7z', true],
  ['chiitoitsu', '123m456p789s234p11z', '1z', false],
  ['toitoi', '111m333p555s777z22m', '1m', true],
  ['toitoi', '123m333p555s777z22m', '2m', false],
  ['sanankou', '111m333p555s777z22m', '1m', true], // 333p,555s,777z が暗刻。111m はロン
  ['sanankou', '111789m333p555s22z', '1m', false], // 暗刻2つ + ロンのシャボ刻子
  ['sanankou', '111789m333p555s22z', '2z', true], // 単騎待ちなら3暗刻
  ['sanshokuDoujun', '234m234p234s567m55p', '5p', true],
  ['sanshokuDoujun', '234m234p345s567m55p', '5p', false],
  ['sanshokuDoukou', '555m555p555s123m77z', '7z', true],
  ['sanshokuDoukou', '555m555p666s123m77z', '7z', false],
  ['ittsu', '123456789m234p55s', '5s', true],
  ['ittsu', '123456m789p234p55s', '5s', false],
  ['chanta', '123m789p999s111z22z', '2z', true],
  ['chanta', '234m789p999s111z22z', '2z', false],
  ['chanta', '123m789m123p999s11p', '1p', false], // 字牌なしは純全帯
  ['junchan', '123m789m123p999s11p', '1p', true],
  ['junchan', '123m789p999s111z22z', '2z', false], // 字牌ありは混全帯
  ['shousangen', '555z666z77z123m456p', '7z', true],
  ['shousangen', '555z666z11z123m456p', '1z', false],
  ['honroutou', '111m999p111s111z22z', '2z', true],
  ['honroutou', '111m999p111s111z22m', '2m', false],
  ['honitsu', '123456789m11z222z', '1z', true],
  ['honitsu', '123m456m789m234m55m', '5m', false], // 清一色
  ['honitsu', '123m456p789m11z222z', '1z', false],
  ['chinitsu', '123m456m789m234m55m', '5m', true],
  ['chinitsu', '123456789m11z222z', '1z', false], // 混一色
  ['chinitsu', '123m456p789m234m55m', '5m', false],
];

describe('detectYaku: 役ごとの成立・不成立', () => {
  it.each(yakuCases)('%s: %s (和了牌 %s) => %s', (id, hand, win, expected) => {
    expect(someHas(hand, win, id)).toBe(expected);
  });
});

describe('detectYaku: 詳細', () => {
  it('リーチは常に1翻で含まれる', () => {
    const { list, counts } = interps('123456m234p55789s', '2p');
    for (const i of list) {
      const entries = detectYaku(i, counts);
      expect(entries[0]).toEqual({ id: 'riichi', han: 1 });
    }
  });

  it('翻数が要件 6.2 の値と一致する', () => {
    const { list, counts } = interps('123456789m11z222z', '1z');
    const entries = detectYaku(list[0], counts);
    const han = Object.fromEntries(entries.map((e) => [e.id, e.han]));
    expect(han).toMatchObject({ riichi: 1, ittsu: 2, honitsu: 3, yakuhai: 1 });
  });

  it('役牌は刻子ごとに1件(tile 付き)で数え、東・南・白・發・中のみ', () => {
    const { list, counts } = interps('123m789s555z666z11p', '1p');
    const yakuhai = detectYaku(list[0], counts).filter((e) => e.id === 'yakuhai');
    expect(yakuhai.map((e) => e.tile)).toEqual([31, 32]);
    const { list: l2, counts: c2 } = interps('123m456p789s222z55p', '2z');
    expect(detectYaku(l2[0], c2).filter((e) => e.id === 'yakuhai').map((e) => e.tile)).toEqual([28]);
  });

  it('小三元は 2 翻で、三元牌の役牌が別に加算される', () => {
    const { list, counts } = interps('555z666z77z123m456p', '7z');
    const entries = detectYaku(list[0], counts);
    expect(entries.filter((e) => e.id === 'shousangen')).toEqual([{ id: 'shousangen', han: 2 }]);
    expect(entries.filter((e) => e.id === 'yakuhai')).toHaveLength(2);
  });

  it('一盃口と二盃口は排他', () => {
    const a = interps('112233m456p789s55p', '5p');
    const idsA = a.list.flatMap((i) => idsOf(i, a.counts));
    expect(idsA).toContain('iipeikou');
    expect(idsA).not.toContain('ryanpeikou');
    const b = interps('112233m445566p77s', '7s');
    const standard = b.list.find((i) => i.form === 'standard');
    const idsB = idsOf(standard as Interpretation, b.counts);
    expect(idsB).toContain('ryanpeikou');
    expect(idsB).not.toContain('iipeikou');
  });

  it('混全帯幺九と純全帯幺九は排他', () => {
    const a = interps('123m789p999s111z22z', '2z');
    const b = interps('123m789m123p999s11p', '1p');
    for (const i of a.list) {
      const ids = idsOf(i, a.counts);
      expect(ids.includes('chanta') && ids.includes('junchan')).toBe(false);
    }
    for (const i of b.list) {
      const ids = idsOf(i, b.counts);
      expect(ids.includes('chanta') && ids.includes('junchan')).toBe(false);
    }
  });

  it('混一色と清一色は排他', () => {
    for (const [h, w] of [
      ['123456789m11z222z', '1z'],
      ['123m456m789m234m55m', '5m'],
    ]) {
      const { list, counts } = interps(h, w);
      for (const i of list) {
        const ids = idsOf(i, counts);
        expect(ids.includes('honitsu') && ids.includes('chinitsu')).toBe(false);
      }
    }
  });

  it('混老頭は対々和と複合し、混全帯幺九とは複合しない', () => {
    const { list, counts } = interps('111m999p111s111z22z', '2z');
    const ids = idsOf(list[0], counts);
    expect(ids).toEqual(expect.arrayContaining(['honroutou', 'toitoi']));
    expect(ids).not.toContain('chanta');
    expect(ids).not.toContain('junchan');
  });

  describe('七対子形との複合', () => {
    const chiitoiIds = (hand: string, win: string): YakuId[] => {
      const { list, counts } = interps(hand, win);
      const i = list.find((x) => x.form === 'chiitoi') as Interpretation;
      expect(i).toBeDefined();
      return idsOf(i, counts);
    };

    it('七対子のみ', () => {
      expect(chiitoiIds('1122m3344p5566s77z', '7z')).toEqual(['riichi', 'chiitoitsu']);
    });
    it('断幺九と複合', () => {
      expect(chiitoiIds('223344m556677p88s', '8s')).toEqual(['riichi', 'tanyao', 'chiitoitsu']);
    });
    it('混老頭と複合', () => {
      expect(chiitoiIds('1199m1199p1199s11z', '1z')).toEqual(['riichi', 'chiitoitsu', 'honroutou']);
    });
    it('混一色と複合', () => {
      expect(chiitoiIds('11223344m5566z77z', '7z')).toEqual(['riichi', 'chiitoitsu', 'honitsu']);
    });
    it('清一色と複合し、二盃口や一盃口は付かない', () => {
      expect(chiitoiIds('11223344556677m', '7m')).toEqual(['riichi', 'chiitoitsu', 'chinitsu']);
    });
    it('平和、役牌、対々和などは付かない', () => {
      const ids = chiitoiIds('1122m3344p5566s77z', '7z');
      for (const x of ['pinfu', 'yakuhai', 'toitoi', 'iipeikou', 'sanankou', 'chanta'] as YakuId[]) {
        expect(ids).not.toContain(x);
      }
    });
  });
});

// [役満, 手牌14枚, 和了牌, 期待]
const yakumanCases: [YakumanId, string, string, boolean][] = [
  ['daisangen', '555z666z777z123m11p', '1p', true],
  ['daisangen', '555z666z77z123m456p', '7z', false], // 小三元
  ['suuankou', '111m333p555s777z22m', '2m', true], // 単騎
  ['suuankou', '111m333p555s777z22m', '1m', false], // シャボのロンは明刻
  ['suuankou', '111m333p555s123s77z', '7z', false], // 刻子3つ
  ['tsuuiisou', '111z222z555z666z77z', '7z', true],
  ['tsuuiisou', '111m222z555z666z77z', '7z', false],
  ['tsuuiisou', '1122z3344z5566z77z', '7z', true], // 七対子形でも成立
  ['shousuushii', '111z222z333z567m44z', '4z', true],
  ['shousuushii', '111z222z333z567m55m', '5m', false],
  ['daisuushii', '111z222z333z444z55m', '5m', true],
  ['daisuushii', '111z222z333z567m44z', '4z', false],
  ['chinroutou', '111m999m111p999p11s', '1s', true],
  ['chinroutou', '111m999p111s111z22z', '1m', false],
  ['ryuuiisou', '234s234s666s888s66z', '6z', true],
  ['ryuuiisou', '234s234s666s888s55z', '5z', false], // 白は緑でない
  ['ryuuiisou', '123s234s666s888s66z', '6z', false], // 1索は緑でない
  ['chuurenpoutou', '11123455678999m', '5m', true],
  ['chuurenpoutou', '123456789m234m55m', '5m', false],
  ['chuurenpoutou', '11123455678999p', '5p', true],
];

describe('hasYakuman / detectYakuman', () => {
  it.each(yakumanCases)('%s: %s (和了牌 %s) => %s', (id, hand, win, expected) => {
    const { list, counts } = interps(hand, win);
    const found = list.some((i) => detectYakuman(i, counts).includes(id));
    expect(found).toBe(expected);
    if (expected) expect(list.some((i) => hasYakuman(i, counts))).toBe(true);
  });

  it('役満のない手は false', () => {
    const { list, counts } = interps('123456m234p55789s', '2p');
    expect(list.some((i) => hasYakuman(i, counts))).toBe(false);
  });

  it('清一色の通常手は役満でない', () => {
    const { list, counts } = interps('123m456m789m234m55m', '5m');
    expect(list.some((i) => hasYakuman(i, counts))).toBe(false);
  });
});
