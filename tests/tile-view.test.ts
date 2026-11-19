// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h } from '../src/ui/dom';
import { renderTile } from '../src/ui/tile-view';
import { tileLabel } from '../src/domain/tile';

afterEach(() => vi.restoreAllMocks());

describe('renderTile', () => {
  it('renders 34 mutually distinct SVGs', () => {
    const seen = new Set<string>();
    for (let t = 0; t < 34; t++) {
      const el = renderTile(t);
      expect(el.tagName.toLowerCase()).toBe('svg');
      seen.add(el.outerHTML);
    }
    expect(seen.size).toBe(34);
  });

  it('shows digit and suit for number tiles, kanji for honors', () => {
    expect(renderTile(2).textContent).toBe('3萬');
    expect(renderTile(9).textContent).toBe('1筒');
    expect(renderTile(26).textContent).toBe('9索');
    expect(renderTile(27).textContent).toContain('東');
    expect(renderTile(33).textContent).toContain('中');
  });

  it('falls back to tileLabel text when SVG generation fails', () => {
    const orig = document.createElementNS.bind(document);
    vi.spyOn(document, 'createElementNS').mockImplementation(((ns: string, name: string) => {
      if (ns === 'http://www.w3.org/2000/svg') throw new Error('boom');
      return orig(ns, name);
    }) as typeof document.createElementNS);
    const el = renderTile(2);
    expect(el.textContent).toBe(tileLabel(2));
    expect(el.querySelector('svg')).toBeNull();
  });
});

describe('h', () => {
  it('inserts strings as text, never as HTML', () => {
    const name = '<img src=x onerror=alert(1)>';
    const el = h('div', { class: 'n' }, name, h('span', null, name));
    expect(el.querySelector('img')).toBeNull();
    expect(el.childNodes[0].nodeType).toBe(3);
    expect(el.textContent).toBe(name + name);
  });

  it('wires event listeners and attributes', () => {
    const fn = vi.fn();
    const el = h('button', { onclick: fn, 'data-x': '1' }, 'ok');
    el.click();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(el.getAttribute('data-x')).toBe('1');
  });
});
