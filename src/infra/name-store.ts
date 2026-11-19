import { validateName } from '../domain/name-validator';

export interface KeyValueStorage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

const KEY = 'machi.player';

const parseStored = (raw: string): string | null => {
  let candidate: string;
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return null; // 破損した JSON
    }
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as { name?: unknown }).name !== 'string'
    ) {
      return null;
    }
    candidate = (parsed as { name: string }).name;
  } else {
    candidate = raw; // 名前の文字列そのもの
  }
  const v = validateName(candidate);
  return v.ok ? v.value : null;
};

/** Player_Name の保存。ストレージが使えない場合はメモリ保持にフォールバックする。 */
export class NameStore {
  private storage: KeyValueStorage | null;
  private memory: string | null = null;

  constructor(storage: KeyValueStorage | null) {
    this.storage = storage;
  }

  /** false ならストレージに保存されない(次回は再入力が必要)。 */
  get persistent(): boolean {
    return this.storage !== null;
  }

  load(): string | null {
    if (this.storage) {
      try {
        const raw = this.storage.getItem(KEY);
        if (raw === null || raw === undefined) return null;
        return parseStored(raw);
      } catch {
        this.storage = null;
      }
    }
    return this.memory;
  }

  save(name: string): void {
    const v = validateName(name);
    if (!v.ok) return;
    if (this.storage) {
      try {
        this.storage.setItem(KEY, JSON.stringify({ name: v.value }));
        return;
      } catch {
        this.storage = null;
      }
    }
    this.memory = v.value;
  }
}
