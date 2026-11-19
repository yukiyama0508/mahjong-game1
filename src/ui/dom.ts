export type Child = Node | string | null | undefined | false;

export interface Props {
  class?: string;
  /** on で始まらないキーは setAttribute、`on*` 系は addEventListener に渡す */
  [key: string]: string | number | boolean | EventListener | null | undefined;
}

/**
 * 要素を作る小さなヘルパー。文字列の子要素は必ず createTextNode で挿入する(innerHTML は使わない)。
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Props | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;
      if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'class') {
        el.className = String(value);
      } else {
        el.setAttribute(key, value === true ? '' : String(value));
      }
    }
  }
  appendChildren(el, children);
  return el;
}

export function appendChildren(parent: Node, children: readonly Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    parent.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
}

/** 子要素を置き換える(文字列は textNode) */
export function replaceChildren(parent: Element, ...children: Child[]): void {
  while (parent.firstChild) parent.removeChild(parent.firstChild);
  appendChildren(parent, children);
}
