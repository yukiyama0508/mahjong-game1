import type { Result } from './tile';

export type NameError = 'empty' | 'tooLong' | 'control';

const MAX_NAME_LENGTH = 20;
// supabase/migrations/0001_init.sql の is_valid_player_name と同じ範囲(NUL も含める)
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;

/**
 * 名前を検証する。成功時は trim 済みの名前を返す。
 * String.prototype.trim は全角スペース(U+3000)を含む空白を取り除く。
 */
export const validateName = (raw: string): Result<string, NameError> => {
  const name = raw.trim();
  if (name.length === 0) return { ok: false, error: 'empty' };
  if (CONTROL_CHARS.test(name)) return { ok: false, error: 'control' };
  if ([...name].length > MAX_NAME_LENGTH) return { ok: false, error: 'tooLong' };
  return { ok: true, value: name };
};
