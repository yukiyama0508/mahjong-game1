import { describe, expect, it } from 'vitest';
import { calcPoints, scoreQuestion, scoreWait } from '../src/domain/score-calculator';
import type { YakuId } from '../src/domain/yaku';

/** '234m567p11z' 形式(z: 1=東 2=南 3=西 4=北 5=白 6=發 7=中)を TileId 配列にする */
const parse = (s: string): number[] => {
  const base: Record<string, number> = { m: 0, p: 9, s: 18, z: 27 };
  const tiles: number[] = [];
  let digits = '';
  for (const ch of s) {
    if (ch in base) {
      for (const d of digits) tiles.push(base[ch] + Number(d) - 1);
      digits = '';
    } else digits += ch;
  }
  return tiles.sort((a, b) => a - b);
};
const one = (s: string): number => parse(s)[0];

interface Example {
  name: string;
  hand: string; // 13枚
  win: string; // 待ち牌1枚
  yaku: YakuId[]; // 役牌の複数刻子は同じ id を並べる
  fu: number;
  han: number;
  points: number;
}

/** 期待値はすべて日本麻雀のルール(要件 6.2, 6.4-6.9)から手計算したもの */
const examples: Example[] = [
  {
    name: '平和 2翻30符 = 2000(リーチ+平和)',
    hand: '234m567p789s66m45p',
    win: '3p',
    yaku: ['riichi', 'pinfu'],
    fu: 30,
    han: 2,
    points: 2000, // 30*2^4=480 → 1920 → 2000
  },
  {
    name: '平和+断幺九 3翻30符 = 3900',
    hand: '234m567p678s66m45p',
    win: '3p',
    yaku: ['riichi', 'pinfu', 'tanyao'],
    fu: 30,
    han: 3,
    points: 3900, // 960*4=3840
  },
  {
    name: '七対子単騎 3翻25符 = 3200',
    hand: '11m88m44p33p66s77s5m',
    win: '5m',
    yaku: ['riichi', 'chiitoitsu'],
    fu: 25,
    han: 3,
    points: 3200, // 25*32=800*4
  },
  {
    name: '七対子+断幺九 4翻25符 = 6400',
    hand: '22m88m44p33p66s77s5m',
    win: '5m',
    yaku: ['riichi', 'tanyao', 'chiitoitsu'],
    fu: 25,
    han: 4,
    points: 6400, // 25*64=1600*4
  },
  {
    name: '30符4翻 = 7700(リーチ+平和+断幺九+一盃口)',
    hand: '234m234m567p33s67s',
    win: '8s',
    yaku: ['riichi', 'pinfu', 'tanyao', 'iipeikou'],
    fu: 30,
    han: 4,
    points: 7700, // 30*64=1920*4=7680
  },
  {
    name: '60符3翻 = 7700(リーチ+三暗刻、幺九暗刻3つ+単騎)',
    hand: '111m999p456p111s5s',
    win: '5s',
    yaku: ['riichi', 'sanankou'],
    fu: 60, // 20+10+8*3+2=56
    han: 3,
    points: 7700, // 60*32=1920*4
  },
  {
    name: '一気通貫 + 平和 4翻30符 = 7700',
    hand: '123m456m789m55p34s',
    win: '2s',
    yaku: ['riichi', 'pinfu', 'ittsu'],
    fu: 30,
    han: 4,
    points: 7700,
  },
  {
    name: '満貫: 三色同順+平和+断幺九 5翻',
    hand: '234m234p234s77p56m',
    win: '4m',
    yaku: ['riichi', 'pinfu', 'tanyao', 'sanshokuDoujun'],
    fu: 30,
    han: 5,
    points: 8000,
  },
  {
    name: '跳満: 二盃口+平和+断幺九 6翻 = 12000',
    hand: '223344m678p67p55s',
    win: '8p',
    yaku: ['riichi', 'pinfu', 'tanyao', 'ryanpeikou'],
    fu: 30,
    han: 6,
    points: 12000,
  },
  {
    name: '跳満: 三暗刻+三色同刻+断幺九 6翻 = 12000',
    hand: '222m222p222s55p67s',
    win: '8s',
    yaku: ['riichi', 'tanyao', 'sanankou', 'sanshokuDoukou'],
    fu: 50, // 20+10+4*3=42
    han: 6,
    points: 12000,
  },
  {
    name: '倍満: 清一色+断幺九+リーチ 8翻 = 16000',
    hand: '234s567s888s33s46s',
    win: '5s',
    yaku: ['riichi', 'tanyao', 'chinitsu'],
    fu: 40,
    han: 8,
    points: 16000,
  },
  {
    name: '満貫: 純全帯幺九+リーチ 4翻40符(切り上げ満貫なしで基本点超過)',
    hand: '123m789p123s99p89s',
    win: '7s',
    yaku: ['riichi', 'junchan'],
    fu: 40, // 20+10+ペンチャン2=32
    han: 4,
    points: 8000, // 40*64=2560 > 2000
  },
  {
    name: '混全帯幺九 3翻40符 = 5200',
    hand: '123m789p123s3z3z89s',
    win: '7s',
    yaku: ['riichi', 'chanta'],
    fu: 40,
    han: 3,
    points: 5200,
  },
  {
    name: '混一色+役牌東 5翻 = 満貫',
    hand: '1z1z1z234m567m99m34m',
    win: '5m',
    yaku: ['riichi', 'yakuhai', 'honitsu'],
    fu: 40, // 20+10+東暗刻8=38
    han: 5,
    points: 8000,
  },
  {
    name: '小三元 + 役牌白發 5翻 = 満貫',
    hand: '5z5z5z6z6z6z7z7z234s56m',
    win: '4m',
    yaku: ['riichi', 'yakuhai', 'yakuhai', 'shousangen'],
    fu: 50, // 20+10+8+8=46
    han: 5,
    points: 8000,
  },
  {
    name: '混老頭 + 七対子 5翻25符 = 満貫',
    hand: '11m99m11p99p1z1z2z2z9s',
    win: '9s',
    yaku: ['riichi', 'chiitoitsu', 'honroutou'],
    fu: 25,
    han: 5,
    points: 8000,
  },
  {
    name: '南の刻子も役牌 1翻、東と同じ扱い',
    hand: '2z2z2z234m567p99m78s',
    win: '9s',
    yaku: ['riichi', 'yakuhai'],
    fu: 40,
    han: 2,
    points: 2600, // 640*4=2560
  },
  {
    name: '対々和+三暗刻: シャボ待ちの刻子は明刻だが他の3刻子は暗刻(符50)',
    hand: '222m555p888s33m44s',
    win: '3m',
    yaku: ['riichi', 'tanyao', 'toitoi', 'sanankou'],
    fu: 50, // 20+10+4+4+4+明刻2=44
    han: 6,
    points: 12000,
  },
];

describe('score examples (known hand/wait pairs)', () => {
  for (const ex of examples) {
    it(ex.name, () => {
      const r = scoreWait(parse(ex.hand), one(ex.win));
      expect(r.yaku.map((y) => y.id)).toEqual(ex.yaku);
      expect(r.han).toBe(ex.han);
      expect(r.fu).toBe(ex.fu);
      expect(r.points).toBe(ex.points);
    });
  }
  it('has at least 10 examples', () => {
    expect(examples.length).toBeGreaterThanOrEqual(10);
  });
});

describe('yaku near-misses (failure examples)', () => {
  const ids = (hand: string, win: string): YakuId[] =>
    scoreWait(parse(hand), one(win)).yaku.map((y) => y.id);

  it('平和: 役牌の雀頭では成立しない(符40)', () => {
    const r = scoreWait(parse('234m567p789s5z5z45p'), one('3p'));
    expect(r.yaku.map((y) => y.id)).toEqual(['riichi']);
    expect(r.fu).toBe(40); // 20+10+雀頭2
    expect(r.points).toBe(1300);
  });
  it('平和: 幺九牌を含んでも平和は成立するが断幺九は付かない', () => {
    expect(ids('234m567p789s66m45p', '3p')).not.toContain('tanyao');
  });
  it('役牌: 西・北の刻子は役牌にならない', () => {
    const r = scoreWait(parse('3z3z3z234m567p99m78s'), one('9s'));
    expect(r.yaku.map((y) => y.id)).toEqual(['riichi']);
    expect(r.fu).toBe(40);
    expect(r.points).toBe(1300);
  });
  it('小三元: 雀頭が三元牌でなければ成立しない', () => {
    const r = scoreWait(parse('5z5z5z6z6z6z1z1z234s56m'), one('4m'));
    expect(r.yaku.map((y) => y.id)).toEqual(['riichi', 'yakuhai', 'yakuhai']);
    expect(r.fu).toBe(50); // 20+10+8+8+雀頭2=48
    expect(r.points).toBe(6400);
  });
  it('二盃口は一盃口と重複しない', () => {
    const y = ids('223344m678p67p55s', '8p');
    expect(y).toContain('ryanpeikou');
    expect(y).not.toContain('iipeikou');
  });
  it('七対子は4面子形の手牌では付かない', () => {
    expect(ids('234m567p789s66m45p', '3p')).not.toContain('chiitoitsu');
  });
  it('一気通貫: 6萬待ちでは成立せず、9萬待ちでは成立する', () => {
    const hand = '123m456m78m99p345s';
    const q = scoreQuestion(parse(hand), [one('6m'), one('9m')]);
    expect(q.perWait.map((w) => w.winTile)).toEqual([5, 8]);
    expect(q.perWait[0].yaku.map((y) => y.id)).toEqual(['riichi', 'pinfu']);
    expect(q.perWait[0].points).toBe(2000);
    expect(q.perWait[1].yaku.map((y) => y.id)).toEqual(['riichi', 'pinfu', 'ittsu']);
    expect(q.perWait[1].points).toBe(7700);
    expect(q.questionScore).toBe(7700);
    expect(q.bestWaits).toEqual([8]);
  });
  it('三暗刻・対々和: シャボ待ちの刻子が明刻扱いなら成立しない(要件 6.7)', () => {
    const hand = '222m678m555p33s77s';
    for (const win of ['3s', '7s']) {
      const r = scoreWait(parse(hand), one(win));
      expect(r.yaku.map((y) => y.id)).toEqual(['riichi', 'tanyao']);
      expect(r.fu).toBe(40); // 20+10+4+4+明刻2
      expect(r.han).toBe(2);
      expect(r.points).toBe(2600);
    }
  });
  it('三暗刻: 同じ刻子構成でも単騎待ちなら暗刻3つで成立する', () => {
    const r = scoreWait(parse('222m678m555p333s8s'), one('8s'));
    expect(r.yaku.map((y) => y.id)).toEqual(['riichi', 'tanyao', 'sanankou']);
    expect(r.fu).toBe(50); // 20+10+12+単騎2=44
    expect(r.han).toBe(4);
    expect(r.points).toBe(8000);
  });
  it('三暗刻: 暗刻3つ+両面待ち(ロンで完成した順子)で成立する', () => {
    const r = scoreWait(parse('222m555p888s99s34m'), one('5m'));
    expect(r.yaku.map((y) => y.id)).toEqual(['riichi', 'sanankou']);
    expect(r.fu).toBe(50); // 20+10+4*3=42
    expect(r.han).toBe(3);
    expect(r.points).toBe(6400); // 50*32=1600*4
  });
  it('シャボ待ちの明刻符: 明刻(中張牌2符)として計算する', () => {
    // 111m 暗刻8 + 明刻333p 2 + 20 + 10 = 40。暗刻なら 42 → 50 符
    for (const win of ['3p', '5p']) {
      const r = scoreWait(parse('111m789m678s33p55p'), one(win));
      expect(r.yaku.map((y) => y.id)).toEqual(['riichi']);
      expect(r.fu).toBe(40);
      expect(r.points).toBe(1300); // 40*8=320*4=1280
    }
  });
  it('混全帯幺九と純全帯幺九: 字牌があれば混全、なければ純全', () => {
    expect(ids('123m789p123s3z3z89s', '7s')).toEqual(['riichi', 'chanta']);
    expect(ids('123m789p123s99p89s', '7s')).toEqual(['riichi', 'junchan']);
  });
});

describe('points table (満貫以上、子のロン)', () => {
  const cases: Array<[number, number, number]> = [
    // [fu, han, points]
    [30, 3, 3900],
    [40, 3, 5200],
    [50, 3, 6400],
    [60, 3, 7700], // 切り上げ満貫なし
    [30, 4, 7700], // 切り上げ満貫なし
    [40, 4, 8000], // 基本点 2560 > 2000
    [70, 3, 8000], // 基本点 2240 > 2000
    [25, 2, 1600],
    [30, 5, 8000],
    [30, 6, 12000],
    [30, 7, 12000],
    [30, 8, 16000],
    [30, 10, 16000],
    [30, 11, 24000],
    [30, 12, 24000],
    [30, 13, 32000],
    [30, 20, 32000],
  ];
  for (const [fu, han, points] of cases) {
    it(`${fu}符${han}翻 = ${points}`, () => {
      expect(calcPoints(fu, han)).toBe(points);
    });
  }
});
