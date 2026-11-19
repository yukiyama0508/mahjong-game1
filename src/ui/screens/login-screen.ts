import { validateName, type NameError } from '../../domain/name-validator';
import { h } from '../dom';

export interface LoginScreenProps {
  /** 名前変更で開いた場合の現在の名前(入力欄の初期値)。初回ログインでは省略 */
  initialName?: string;
  /** NameStore.persistent。false のとき「次回は再入力が必要」と表示する */
  persistent: boolean;
  /** validateName に通った trim 済みの名前で呼ばれる。保存と遷移は呼び出し側が行う(サーバーには接続しない) */
  onConfirm: (name: string) => void;
  /** 指定されたとき(名前変更時のみ)「戻る」ボタンを表示する */
  onBack?: () => void;
}

export const NAME_ERROR_MESSAGES: Record<NameError, string> = {
  empty: '名前を入力してください',
  tooLong: '名前は20文字以内で入力してください',
  control: '名前に制御文字は使えません',
};

export const NOT_PERSISTENT_MESSAGE = '名前は保存されません。次回は再入力が必要です';

export function renderLoginScreen(props: LoginScreenProps): HTMLElement {
  const input = h('input', {
    type: 'text',
    id: 'player-name',
    name: 'player-name',
    autocomplete: 'off',
    'aria-describedby': 'name-error',
  });
  input.value = props.initialName ?? '';

  const error = h('p', { id: 'name-error', class: 'error', role: 'alert' });

  const submit = (): void => {
    const result = validateName(input.value);
    if (!result.ok) {
      error.textContent = NAME_ERROR_MESSAGES[result.error];
      return;
    }
    error.textContent = '';
    props.onConfirm(result.value);
  };

  const form = h(
    'form',
    {
      novalidate: true,
      onsubmit: (e: Event) => {
        e.preventDefault();
        submit();
      },
    },
    h('label', { for: 'player-name' }, '名前'),
    input,
    error,
    h('button', { type: 'submit', class: 'primary' }, '決定'),
    props.onBack
      ? h('button', { type: 'button', onclick: () => props.onBack?.() }, '戻る')
      : null,
  );

  return h(
    'section',
    { class: 'screen login-screen' },
    h('h1', null, '名前を入力'),
    props.persistent ? null : h('p', { class: 'notice' }, NOT_PERSISTENT_MESSAGE),
    form,
  );
}
