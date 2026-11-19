import { numberOf, suitOf, tileLabel, type Suit, type TileId } from '../domain/tile';

export interface TileOptions {
  /** 一辺のピクセル数(既定 40) */
  size?: number;
}

/** 通常は SVG 要素。生成に失敗した場合は tileLabel のテキストを持つ span を返す */
export type TileElement = SVGElement | HTMLElement;

const SVG_NS = 'http://www.w3.org/2000/svg';
const SUIT_CHAR: Record<Exclude<Suit, 'z'>, string> = { m: '萬', p: '筒', s: '索' };
const SUIT_COLOR: Record<Suit, string> = { m: '#c0392b', p: '#1f5fa8', s: '#1e8449', z: '#222222' };
const HONOR_CHAR = ['東', '南', '西', '北', '白', '發', '中'];

const svgEl = (tag: string, attrs: Record<string, string>, text?: string): SVGElement => {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text !== undefined) el.appendChild(document.createTextNode(text));
  return el as SVGElement;
};

const buildTileSvg = (t: TileId, size: number): SVGElement => {
  if (!Number.isInteger(t) || t < 0 || t > 33) throw new RangeError(`invalid tile: ${t}`);
  const suit = suitOf(t);
  const svg = svgEl('svg', {
    viewBox: '0 0 40 40',
    width: String(size),
    height: String(size),
    role: 'img',
    'aria-label': tileLabel(t),
    class: 'tile',
    'data-tile': String(t),
  });
  svg.appendChild(
    svgEl('rect', { x: '1', y: '1', width: '38', height: '38', rx: '4', fill: '#fffdf5', stroke: '#555', 'stroke-width': '1.5' }),
  );
  const font = "'Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,sans-serif";
  if (suit === 'z') {
    const n = numberOf(t);
    const color = n === 7 ? '#c0392b' : n === 6 ? '#1e8449' : SUIT_COLOR.z;
    if (n === 5) {
      // 白は枠線のみ(牌ごとに異なる図柄にするため漢字を描かず枠で表す)
      svg.appendChild(svgEl('rect', { x: '9', y: '9', width: '22', height: '22', fill: 'none', stroke: '#1f5fa8', 'stroke-width': '2' }));
      svg.appendChild(svgEl('text', { x: '20', y: '27', 'text-anchor': 'middle', 'font-size': '14', 'font-family': font, fill: '#1f5fa8' }, HONOR_CHAR[n - 1]));
    } else {
      svg.appendChild(svgEl('text', { x: '20', y: '29', 'text-anchor': 'middle', 'font-size': '26', 'font-weight': 'bold', 'font-family': font, fill: color }, HONOR_CHAR[n - 1]));
    }
  } else {
    const color = SUIT_COLOR[suit];
    svg.appendChild(svgEl('text', { x: '20', y: '23', 'text-anchor': 'middle', 'font-size': '20', 'font-weight': 'bold', 'font-family': font, fill: '#222' }, String(numberOf(t))));
    svg.appendChild(svgEl('text', { x: '20', y: '35', 'text-anchor': 'middle', 'font-size': '13', 'font-weight': 'bold', 'font-family': font, fill: color }, SUIT_CHAR[suit]));
  }
  return svg;
};

export function renderTile(t: TileId, opts: TileOptions = {}): TileElement {
  const size = opts.size ?? 40;
  try {
    return buildTileSvg(t, size);
  } catch {
    const span = document.createElement('span');
    span.className = 'tile tile-fallback';
    span.setAttribute('data-tile', String(t));
    span.style.display = 'inline-block';
    span.style.minWidth = `${size}px`;
    span.style.minHeight = `${size}px`;
    span.style.textAlign = 'center';
    span.appendChild(document.createTextNode(tileLabel(t)));
    return span;
  }
}
