import { TILE_KINDS, numberOf, suitOf } from './tile';
import type { Counts, TileId } from './tile';
import type { Interpretation, Meld } from './interpretation';

/**
 * 対象とする役(要件 6.2)。常に「門前・子・ロン・リーチ付き・東場南家」を前提とする。
 * 牌 ID: 東=27, 南=28, 西=29, 北=30, 白=31, 發=32, 中=33
 */
export type YakuId =
  | 'riichi'
  | 'pinfu'
  | 'tanyao'
  | 'iipeikou'
  | 'yakuhai'
  | 'chiitoitsu'
  | 'toitoi'
  | 'sanankou'
  | 'sanshokuDoujun'
  | 'sanshokuDoukou'
  | 'ittsu'
  | 'chanta'
  | 'shousangen'
  | 'honroutou'
  | 'honitsu'
  | 'junchan'
  | 'ryanpeikou'
  | 'chinitsu';

/** 役牌は刻子ごとに1件(tile に刻子の牌を持つ) */
export interface YakuEntry {
  id: YakuId;
  han: number;
  tile?: TileId;
}

/** 役満(点数計算では扱わず、問題生成側の除外判定に使う) */
export type YakumanId =
  | 'daisangen'
  | 'suuankou'
  | 'tsuuiisou'
  | 'shousuushii'
  | 'daisuushii'
  | 'chinroutou'
  | 'ryuuiisou'
  | 'chuurenpoutou';

/** 役ごとの翻(門前)。役牌は刻子1つあたり */
export const YAKU_HAN: Readonly<Record<YakuId, number>> = {
  riichi: 1,
  pinfu: 1,
  tanyao: 1,
  iipeikou: 1,
  yakuhai: 1,
  chiitoitsu: 2,
  toitoi: 2,
  sanankou: 2,
  sanshokuDoujun: 2,
  sanshokuDoukou: 2,
  ittsu: 2,
  chanta: 2,
  shousangen: 2,
  honroutou: 2,
  honitsu: 3,
  junchan: 3,
  ryanpeikou: 3,
  chinitsu: 6,
};

const EAST = 27;
const SOUTH = 28;
const WHITE = 31;
const GREEN = 32;
const RED = 33;
const DRAGONS: readonly TileId[] = [WHITE, GREEN, RED];
const WINDS: readonly TileId[] = [27, 28, 29, 30];
/** 役牌: 場風の東、自風の南、三元牌 */
const YAKUHAI_TILES: readonly TileId[] = [EAST, SOUTH, WHITE, GREEN, RED];

const isHonor = (t: TileId): boolean => suitOf(t) === 'z';
const isTerminal = (t: TileId): boolean => !isHonor(t) && (numberOf(t) === 1 || numberOf(t) === 9);
const isYaochuu = (t: TileId): boolean => isHonor(t) || isTerminal(t);

const usedTiles = (hand14: Counts): TileId[] => {
  const tiles: TileId[] = [];
  for (let t = 0; t < TILE_KINDS; t++) if (hand14[t] > 0) tiles.push(t);
  return tiles;
};

const koutsuOf = (melds: readonly Meld[]): TileId[] =>
  melds.filter((m) => m.type === 'koutsu').map((m) => m.tile);
const shuntsuOf = (melds: readonly Meld[]): TileId[] =>
  melds.filter((m) => m.type === 'shuntsu').map((m) => m.tile);

/**
 * 暗刻の数。ロンで完成したシャボの刻子は明刻として数えない(要件 6.7)。
 */
const concealedKoutsuCount = (i: Interpretation): number =>
  i.melds.filter(
    (m) => m.type === 'koutsu' && !(i.shape === 'shabo' && m.tile === i.winTile),
  ).length;

/** 同一順子の組数(4つ同一なら2組)。一盃口なら1、二盃口なら2 */
const identicalShuntsuPairs = (shuntsu: readonly TileId[]): number => {
  const counts = new Map<TileId, number>();
  for (const t of shuntsu) counts.set(t, (counts.get(t) ?? 0) + 1);
  let pairs = 0;
  for (const c of counts.values()) pairs += Math.floor(c / 2);
  return pairs;
};

/**
 * 解釈ごとの役を返す。リーチ(1翻)は常に含まれる(要件 6.3)。
 * 結果は YakuId の定義順で、役牌は刻子の牌の昇順に並ぶ。
 * 七対子形と複合するのは断幺九、混老頭、混一色、清一色のみ。
 */
export const detectYaku = (i: Interpretation, hand14: Counts): YakuEntry[] => {
  const entries: YakuEntry[] = [{ id: 'riichi', han: YAKU_HAN.riichi }];
  const add = (id: YakuId, tile?: TileId): void => {
    entries.push(tile === undefined ? { id, han: YAKU_HAN[id] } : { id, han: YAKU_HAN[id], tile });
  };

  const tiles = usedTiles(hand14);
  const hasHonor = tiles.some(isHonor);
  const hasNumber = tiles.some((t) => !isHonor(t));
  const numberSuits = new Set(tiles.filter((t) => !isHonor(t)).map(suitOf));
  const allTanyao = tiles.every((t) => !isYaochuu(t));
  const allYaochuu = tiles.every(isYaochuu);

  const isChiitoi = i.form === 'chiitoi';
  const koutsu = koutsuOf(i.melds);
  const shuntsu = shuntsuOf(i.melds);
  const pair = i.pair;

  if (!isChiitoi) {
    // 平和: 全て順子、雀頭が役牌でない、両面待ち
    if (
      shuntsu.length === 4 &&
      pair !== null &&
      !YAKUHAI_TILES.includes(pair) &&
      i.shape === 'ryanmen'
    ) {
      add('pinfu');
    }
  }

  if (allTanyao) add('tanyao');

  if (!isChiitoi) {
    const peikou = identicalShuntsuPairs(shuntsu);
    if (peikou === 1) add('iipeikou');
    else if (peikou >= 2) add('ryanpeikou');

    for (const t of [...koutsu].sort((a, b) => a - b)) {
      if (YAKUHAI_TILES.includes(t)) add('yakuhai', t);
    }
  } else {
    add('chiitoitsu');
  }

  if (!isChiitoi) {
    if (koutsu.length === 4) add('toitoi');
    if (concealedKoutsuCount(i) >= 3) add('sanankou');

    // 三色同順 / 三色同刻
    const sanshoku = (list: readonly TileId[], maxNumber: number): boolean => {
      for (let n = 0; n < maxNumber; n++) {
        if (list.includes(n) && list.includes(n + 9) && list.includes(n + 18)) return true;
      }
      return false;
    };
    if (sanshoku(shuntsu, 7)) add('sanshokuDoujun');
    if (sanshoku(koutsu, 9)) add('sanshokuDoukou');

    // 一気通貫
    for (const base of [0, 9, 18]) {
      if ([0, 3, 6].every((d) => shuntsu.includes(base + d))) {
        add('ittsu');
        break;
      }
    }

    // 混全帯幺九 / 純全帯幺九: 全面子と雀頭に幺九牌を含み、順子を1つ以上含む
    const groupsHaveYaochuu =
      pair !== null &&
      isYaochuu(pair) &&
      koutsu.every(isYaochuu) &&
      shuntsu.every((t) => numberOf(t) === 1 || numberOf(t) === 7);
    if (groupsHaveYaochuu && shuntsu.length >= 1) {
      add(hasHonor ? 'chanta' : 'junchan');
    }

    // 小三元: 三元牌の刻子2つと三元牌の雀頭
    if (pair !== null && DRAGONS.includes(pair) && koutsu.filter((t) => DRAGONS.includes(t)).length === 2) {
      add('shousangen');
    }
  }

  // 混老頭: 全牌が幺九牌で、字牌と数牌の両方を含む(字牌のみ・数牌のみは役満)
  if (allYaochuu && hasHonor && hasNumber) add('honroutou');

  if (numberSuits.size === 1) {
    add(hasHonor ? 'honitsu' : 'chinitsu');
  }

  // YakuId の定義順に並べる(安定ソート)
  const order = Object.keys(YAKU_HAN);
  return entries
    .map((e, idx) => ({ e, idx }))
    .sort((a, b) => order.indexOf(a.e.id) - order.indexOf(b.e.id) || a.idx - b.idx)
    .map((x) => x.e);
};

/** 緑一色を構成できる牌: 索子の 2,3,4,6,8 と發 */
const GREEN_TILES: readonly TileId[] = [19, 20, 21, 23, 25, GREEN];

const isChuuren = (hand14: Counts): boolean => {
  const tiles = usedTiles(hand14);
  if (tiles.length === 0 || tiles.some(isHonor)) return false;
  if (new Set(tiles.map(suitOf)).size !== 1) return false;
  const base = Math.floor(tiles[0] / 9) * 9;
  for (let n = 0; n < 9; n++) {
    const need = n === 0 || n === 8 ? 3 : 1;
    if (hand14[base + n] < need) return false;
  }
  return true;
};

/**
 * 成立している役満を返す(要件 A6, 3.7, 4.11)。
 * 四暗刻はロン和了のため単騎待ち(4つの刻子がすべて暗刻)のときのみ成立する。
 */
export const detectYakuman = (i: Interpretation, hand14: Counts): YakumanId[] => {
  const result: YakumanId[] = [];
  const tiles = usedTiles(hand14);
  const koutsu = koutsuOf(i.melds);
  const isStandard = i.form === 'standard';

  if (isStandard && DRAGONS.every((d) => koutsu.includes(d))) result.push('daisangen');
  if (isStandard && koutsu.length === 4 && i.shape === 'tanki') result.push('suuankou');
  if (tiles.every(isHonor)) result.push('tsuuiisou');

  if (isStandard) {
    const windKoutsu = koutsu.filter((t) => WINDS.includes(t)).length;
    if (windKoutsu === 4) result.push('daisuushii');
    else if (windKoutsu === 3 && i.pair !== null && WINDS.includes(i.pair)) {
      result.push('shousuushii');
    }
  }

  if (tiles.every((t) => isTerminal(t))) result.push('chinroutou');
  if (tiles.every((t) => GREEN_TILES.includes(t))) result.push('ryuuiisou');
  if (isStandard && isChuuren(hand14)) result.push('chuurenpoutou');
  return result;
};

/** 役満が1つでも成立しているか */
export const hasYakuman = (i: Interpretation, hand14: Counts): boolean =>
  detectYakuman(i, hand14).length > 0;
