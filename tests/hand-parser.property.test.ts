import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { parseHand, serializeHand } from '../src/domain/hand-parser';
import { numberOf, suitOf, toCounts } from '../src/domain/tile';
import type { TileId } from '../src/domain/tile';

/** 各牌種4枚以下、min〜max枚の牌の列(順序はランダム) */
const tilesArb = (min: number, max: number) =>
  fc
    .uniqueArray(fc.tuple(fc.integer({ min: 0, max: 33 }), fc.integer({ min: 0, max: 3 })), {
      minLength: min,
      maxLength: max,
      selector: ([t, k]) => t * 4 + k,
    })
    .map((pairs) => pairs.map(([t]) => t as TileId));

const validHandArb = tilesArb(1, 14);

const tileStr = (t: TileId) => `${numberOf(t)}${suitOf(t)}`;

/** 牌の列を、同種別が複数グループに分かれうる文字列にする(連続する同種別は mergeFlags に従い結合) */
const toGroupedString = (tiles: readonly TileId[], mergeFlags: readonly boolean[]): string => {
  let out = '';
  let digits = '';
  let curSuit = '';
  tiles.forEach((t, i) => {
    const suit = suitOf(t);
    if (digits !== '' && (suit !== curSuit || !mergeFlags[i % mergeFlags.length])) {
      out += digits + curSuit;
      digits = '';
    }
    digits += String(numberOf(t));
    curSuit = suit;
  });
  return out + digits + curSuit;
};

const CANONICAL = /^(\d+m)?(\d+p)?(\d+s)?(\d+z)?$/;

describe('Property 1: 手牌文字列のラウンドトリップ', () => {
  /** **Validates: Requirements 3.11, 12.6** */
  it('parseHand(serializeHand(h)) は h と同じ牌種ごとの枚数を返す', () => {
    fc.assert(
      fc.property(validHandArb, (tiles) => {
        const r = parseHand(serializeHand(tiles));
        expect(r.ok).toBe(true);
        if (r.ok) expect(toCounts(r.value)).toEqual(toCounts(tiles));
      }),
    );
  });
});

describe('Property 2: シリアライザの正準形と parse-print-parse', () => {
  /** **Validates: Requirements 12.1, 12.5, 12.7, 12.8** */
  it('並べ替えに依らず同一の正準形を返し、parse-print-parse が一致する', () => {
    fc.assert(
      fc.property(
        validHandArb,
        fc.array(fc.boolean(), { minLength: 1, maxLength: 14 }),
        (tiles, merge) => {
          const s = toGroupedString(tiles, merge);
          const parsed = parseHand(s);
          expect(parsed.ok).toBe(true);
          if (!parsed.ok) return;

          const canon = serializeHand(parsed.value);
          // 任意の並べ替え(ここでは入力順・逆順・降順)でも同一
          expect(serializeHand(tiles)).toBe(canon);
          expect(serializeHand([...tiles].reverse())).toBe(canon);
          expect(serializeHand([...tiles].sort((a, b) => b - a))).toBe(canon);

          // 正準形: m,p,s,z の順で各種別は高々1回、数字は昇順、牌を含む種別のみ
          expect(canon).toMatch(CANONICAL);
          for (const group of canon.match(/\d+[mpsz]/g) ?? []) {
            const digits = group.slice(0, -1);
            expect([...digits].sort().join('')).toBe(digits);
          }

          // parse-print-parse
          expect(parseHand(canon)).toEqual(parsed);
        },
      ),
    );
  });

  it('同じ種別を複数グループに分けた表記もまとめられる(例)', () => {
    expect(serializeHand((parseHand('1m2p3m2p') as { ok: true; value: TileId[] }).value)).toBe('13m22p');
  });
});

describe('Property 3: 不正な手牌文字列の拒否', () => {
  const invalidCharArb = fc.constantFrom(' ', 'a', 'x', 'M', '-', 'あ', '日', '８', '.');

  /** **Validates: Requirements 12.2, 12.3, 12.4** */
  it('0 を任意の位置に挿入すると拒否される', () => {
    fc.assert(
      fc.property(validHandArb, fc.nat(), (tiles, n) => {
        const s = serializeHand(tiles);
        const pos = n % (s.length + 1);
        const r = parseHand(s.slice(0, pos) + '0' + s.slice(pos));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toEqual({ kind: 'redTile', position: pos });
      }),
    );
  });

  it('使用できない文字を任意の位置に挿入すると、その位置を報告して拒否される', () => {
    fc.assert(
      fc.property(validHandArb, fc.nat(), invalidCharArb, (tiles, n, ch) => {
        const s = serializeHand(tiles);
        const pos = n % (s.length + 1);
        const r = parseHand(s.slice(0, pos) + ch + s.slice(pos));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toEqual({ kind: 'invalidChar', position: pos, char: ch });
      }),
    );
  });

  it('字牌の 8 / 9 を含む文字列は拒否される', () => {
    fc.assert(
      fc.property(tilesArb(1, 13), fc.constantFrom('8', '9'), (tiles, d) => {
        const r = parseHand(`${d}z${serializeHand(tiles)}`);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toEqual({ kind: 'honorOutOfRange', position: 0 });
      }),
    );
  });

  it('空文字列は枚数エラーになる', () => {
    expect(parseHand('')).toEqual({ ok: false, error: { kind: 'tileCount', count: 0 } });
  });

  it('15枚以上は枚数エラーになる', () => {
    fc.assert(
      fc.property(tilesArb(15, 30), (tiles) => {
        const r = parseHand(serializeHand(tiles));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toEqual({ kind: 'tileCount', count: tiles.length });
      }),
    );
  });

  it('同一牌が5枚以上なら牌種を特定したエラーになる', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 33 }), fc.integer({ min: 5, max: 14 }), (t, copies) => {
        const r = parseHand(tileStr(t).repeat(copies));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toEqual({ kind: 'tooManyCopies', tile: t });
      }),
    );
  });
});
