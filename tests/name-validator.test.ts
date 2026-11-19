import { describe, expect, it } from 'vitest';
import { validateName } from '../src/domain/name-validator';

describe('validateName', () => {
  it('通常の名前はそのまま成功する', () => {
    expect(validateName('たろう')).toEqual({ ok: true, value: 'たろう' });
  });

  it('前後の半角・全角スペースを trim する', () => {
    expect(validateName(' \u3000太郎\u3000 ')).toEqual({ ok: true, value: '太郎' });
  });

  it('空文字は empty', () => {
    expect(validateName('')).toEqual({ ok: false, error: 'empty' });
  });

  it('空白のみ(全角含む)は empty', () => {
    expect(validateName('   ')).toEqual({ ok: false, error: 'empty' });
    expect(validateName('\u3000\u3000')).toEqual({ ok: false, error: 'empty' });
  });

  it('20文字は成功、21文字は tooLong', () => {
    expect(validateName('a'.repeat(20)).ok).toBe(true);
    expect(validateName('a'.repeat(21))).toEqual({ ok: false, error: 'tooLong' });
  });

  it('絵文字は1コードポイントとして数える', () => {
    expect(validateName('😀'.repeat(20)).ok).toBe(true);
    expect(validateName('😀'.repeat(21))).toEqual({ ok: false, error: 'tooLong' });
  });

  it('制御文字を含むと control', () => {
    expect(validateName('a\u0000b')).toEqual({ ok: false, error: 'control' });
    expect(validateName('a\nb')).toEqual({ ok: false, error: 'control' });
    expect(validateName('a\u007fb')).toEqual({ ok: false, error: 'control' });
    expect(validateName('a\u0085b')).toEqual({ ok: false, error: 'control' });
  });

  it('成功した値に再適用しても同じ値になる', () => {
    const r = validateName('  \u3000abc ');
    expect(r.ok && validateName(r.value)).toEqual(r);
  });
});
