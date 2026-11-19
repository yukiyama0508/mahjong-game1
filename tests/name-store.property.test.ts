import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { NameStore, type KeyValueStorage } from '../src/infra/name-store';

const KEY = 'machi.player';

const memoryStorage = (): KeyValueStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
};

const throwingStorage = (): KeyValueStorage => ({
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('denied');
  },
});

// 有効な名前: 制御文字を含まず、trim 後 1〜20 コードポイント(絵文字・JSON 風の名前を含む)
const visibleChar = fc.oneof(
  fc.char(),
  fc.integer({ min: 0xa0, max: 0xd7ff }).map((n) => String.fromCharCode(n)),
  fc.constantFrom('a', 'Z', '0', '{', '}', '[', ']', '"', ':', ',', '\\', ' ', '\u3000', '😀', '🀄', 'あ', '漢'),
);
const nameArb = fc
  .oneof(
    fc.array(visibleChar, { minLength: 1, maxLength: 20 }).map((a) => a.join('')),
    fc.constantFrom('{', '[', '{"name":"x"}', '["a"]', '{"name": 1}', 'null', '😀😀😀', '  たろう  ', '{"a"'),
  )
  .filter((s) => {
    const t = s.trim();
    return t.length > 0 && [...t].length <= 20;
  });

describe('Property 24: NameStore のラウンドトリップ', () => {
  // Feature: mahjong-machi-quiz-game, Property 24: NameStore のラウンドトリップ
  /** **Validates: Requirements 13.4, 13.12, 13.15** */
  it('localStorage が使える場合、save → load で trim 済みの名前が返る(新しいインスタンスでも)', () => {
    fc.assert(
      fc.property(nameArb, (name) => {
        const storage = memoryStorage();
        const store = new NameStore(storage);
        store.save(name);
        expect(store.load()).toBe(name.trim());
        expect(new NameStore(storage).load()).toBe(name.trim());
      }),
      { numRuns: 200 },
    );
  });

  // Feature: mahjong-machi-quiz-game, Property 24: NameStore のラウンドトリップ
  /** **Validates: Requirements 13.4, 13.12, 13.15** */
  it('getItem/setItem が例外を投げる場合、メモリ保持で同じ名前が返る', () => {
    fc.assert(
      fc.property(nameArb, (name) => {
        const store = new NameStore(throwingStorage());
        store.save(name);
        expect(store.load()).toBe(name.trim());
      }),
      { numRuns: 200 },
    );
  });

  // Feature: mahjong-machi-quiz-game, Property 24: NameStore のラウンドトリップ
  /** **Validates: Requirements 13.4, 13.12, 13.15** */
  it('null のストレージでも、メモリ保持で同じ名前が返る', () => {
    fc.assert(
      fc.property(nameArb, (name) => {
        const store = new NameStore(null);
        expect(store.persistent).toBe(false);
        store.save(name);
        expect(store.load()).toBe(name.trim());
      }),
      { numRuns: 200 },
    );
  });

  // Feature: mahjong-machi-quiz-game, Property 24: NameStore のラウンドトリップ
  /** **Validates: Requirements 13.4, 13.12, 13.15** */
  it('保存値が {"name": ...} の JSON、または名前そのものでも load は同じ名前を返す', () => {
    fc.assert(
      fc.property(nameArb, (name) => {
        const asJson = memoryStorage();
        asJson.data.set(KEY, JSON.stringify({ name }));
        expect(new NameStore(asJson).load()).toBe(name.trim());

        // 名前そのもの(先頭が { / [ の名前は JSON と区別できないため対象外)
        const t = name.trim();
        if (!t.startsWith('{') && !t.startsWith('[')) {
          const plain = memoryStorage();
          plain.data.set(KEY, name);
          expect(new NameStore(plain).load()).toBe(t);
        }
      }),
      { numRuns: 200 },
    );
  });
});
