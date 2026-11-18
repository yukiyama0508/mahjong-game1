import { describe, expect, it } from 'vitest';
import { parseHand, serializeHand } from '../src/domain/hand-parser';

describe('parseHand', () => {
  it('parses a mixed-suit string (Req 12.1)', () => {
    const r = parseHand('123m456p789s1122z');
    expect(r).toEqual({ ok: true, value: [0, 1, 2, 12, 13, 14, 24, 25, 26, 27, 27, 28, 28] });
  });

  it('merges multiple groups of the same suit', () => {
    const a = parseHand('1m2p3m');
    const b = parseHand('13m2p');
    expect(a).toEqual(b);
    expect(a).toEqual({ ok: true, value: [0, 2, 10] });
  });

  it('reports invalid characters with position', () => {
    expect(parseHand('12m4x')).toEqual({
      ok: false,
      error: { kind: 'invalidChar', position: 4, char: 'x' },
    });
  });

  it('reports digits without suit', () => {
    expect(parseHand('12m34')).toEqual({ ok: false, error: { kind: 'missingSuit', position: 3 } });
  });

  it('reports suit without digits', () => {
    expect(parseHand('12mp')).toEqual({ ok: false, error: { kind: 'orphanSuit', position: 3 } });
    expect(parseHand('m')).toEqual({ ok: false, error: { kind: 'orphanSuit', position: 0 } });
  });

  it('reports honor numbers out of range', () => {
    expect(parseHand('18z')).toEqual({ ok: false, error: { kind: 'honorOutOfRange', position: 1 } });
    expect(parseHand('9z')).toEqual({ ok: false, error: { kind: 'honorOutOfRange', position: 0 } });
  });

  it('reports red tile 0', () => {
    expect(parseHand('120m')).toEqual({ ok: false, error: { kind: 'redTile', position: 2 } });
  });

  it('reports tile count errors (Req 12.3)', () => {
    expect(parseHand('')).toEqual({ ok: false, error: { kind: 'tileCount', count: 0 } });
    expect(parseHand('123456789m123456p')).toEqual({
      ok: false,
      error: { kind: 'tileCount', count: 15 },
    });
  });

  it('accepts 14 tiles and 1 tile', () => {
    expect(parseHand('123456789m12345p')).toMatchObject({ ok: true });
    expect(parseHand('11112222333344m')).toMatchObject({ ok: true });
    expect(parseHand('1m')).toEqual({ ok: true, value: [0] });
  });

  it('reports a tile held 5 times (Req 12.4)', () => {
    expect(parseHand('11111m')).toEqual({ ok: false, error: { kind: 'tooManyCopies', tile: 0 } });
    expect(parseHand('1111z1z')).toEqual({ ok: false, error: { kind: 'tooManyCopies', tile: 27 } });
  });
});

describe('serializeHand', () => {
  it('outputs canonical form (Req 12.5)', () => {
    expect(serializeHand([27, 27, 24, 12, 0, 1, 2, 13, 14, 25, 26, 28, 28])).toBe('123m456p789s1122z');
  });

  it('omits suits without tiles and is order independent', () => {
    expect(serializeHand([20, 18, 19])).toBe('123s');
    expect(serializeHand([19, 18, 20])).toBe('123s');
  });

  it('round-trips through parseHand', () => {
    const r = parseHand('9m1p3m5z');
    expect(r.ok && serializeHand(r.value)).toBe('39m1p5z');
  });
});

