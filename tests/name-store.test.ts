import { describe, expect, it } from 'vitest';
import { NameStore, type KeyValueStorage } from '../src/infra/name-store';

const fake = (init: Record<string, string> = {}) => {
  const data = { ...init };
  const s: KeyValueStorage & { data: Record<string, string> } = {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
  return s;
};

const throwing: KeyValueStorage = {
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('denied');
  },
};

describe('NameStore', () => {
  it('saves JSON under machi.player and round-trips trimmed name', () => {
    const st = fake();
    const s = new NameStore(st);
    s.save('  たろう　');
    expect(JSON.parse(st.data['machi.player'])).toEqual({ name: 'たろう' });
    expect(s.load()).toBe('たろう');
    expect(s.persistent).toBe(true);
  });

  it('reads a plain string and JSON', () => {
    expect(new NameStore(fake({ 'machi.player': 'hanako' })).load()).toBe('hanako');
    expect(new NameStore(fake({ 'machi.player': '{"name":" bob "}' })).load()).toBe('bob');
  });

  it('returns null when nothing stored or value is invalid/corrupted', () => {
    expect(new NameStore(fake()).load()).toBeNull();
    for (const v of ['', '   ', '{"name":', '{"name":1}', '[]', '{"x":"a"}', 'a\u0001b', 'x'.repeat(21)]) {
      expect(new NameStore(fake({ 'machi.player': v })).load()).toBeNull();
    }
  });

  it('falls back to memory when storage is null', () => {
    const s = new NameStore(null);
    expect(s.persistent).toBe(false);
    expect(s.load()).toBeNull();
    s.save(' ann ');
    expect(s.load()).toBe('ann');
  });

  it('falls back to memory when storage throws', () => {
    const s = new NameStore(throwing);
    s.save('ann');
    expect(s.persistent).toBe(false);
    expect(s.load()).toBe('ann');
  });

  it('does not throw when getItem throws', () => {
    const s = new NameStore(throwing);
    expect(s.load()).toBeNull();
    expect(s.persistent).toBe(false);
  });
});
