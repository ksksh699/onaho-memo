// パスワードの条件(2026-09-08)。
// Supabase Auth 側の設定(Authentication → Providers → Email)と揃えている:
//   - Minimum password length: 8
//   - Password requirements: Letters and digits(英字と数字を両方含む)
// サーバー側でも同じ条件で弾かれるが、送信前にブラウザで分かるようにするための共通処理。
// 新規登録(signup.astro)とパスワード再設定(reset-password.astro)で使う。
// ログイン画面には適用しない(条件変更前に登録した人のパスワードはそのまま使えるため)。

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULES = [
  { key: 'length', label: `${PASSWORD_MIN_LENGTH}文字以上`, test: (pw) => pw.length >= PASSWORD_MIN_LENGTH },
  { key: 'letter', label: '英字(a〜z、A〜Z)を含む', test: (pw) => /[A-Za-z]/.test(pw) },
  { key: 'digit', label: '数字(0〜9)を含む', test: (pw) => /[0-9]/.test(pw) },
];

// 条件を満たしていなければ日本語のエラー文を、満たしていれば null を返す
export function validatePassword(pw) {
  const failed = PASSWORD_RULES.filter((r) => !r.test(pw));
  if (failed.length === 0) return null;
  return `パスワードは次の条件を満たしてください: ${failed.map((r) => r.label).join('、')}`;
}

// Supabase Auth が返す英語のエラーを日本語に読み替える(該当しなければ null)
export function translateAuthPasswordError(message) {
  const m = String(message ?? '');
  if (/Password should be at least/i.test(m)) {
    return `パスワードは${PASSWORD_MIN_LENGTH}文字以上で入力してください。`;
  }
  if (/Password should contain at least one character of each/i.test(m) || /weak password/i.test(m)) {
    return 'パスワードには英字と数字の両方を含めてください。';
  }
  return null;
}

// 入力欄の下に「✓ 8文字以上 / ✓ 英字を含む / ✓ 数字を含む」のチェックリストを出し、
// 入力に合わせてリアルタイムで更新する。
//   input: パスワードの <input>
//   container: チェックリストを描画する要素(<ul class="pw-rules">)
export function mountPasswordRules(input, container) {
  if (!input || !container) return;
  container.innerHTML = '';
  const items = PASSWORD_RULES.map((rule) => {
    const li = document.createElement('li');
    li.className = 'pw-rule';
    li.dataset.rule = rule.key;
    const mark = document.createElement('span');
    mark.className = 'pw-rule-mark';
    mark.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.textContent = rule.label;
    li.append(mark, text);
    container.appendChild(li);
    return { rule, li };
  });
  const update = () => {
    const pw = input.value;
    for (const { rule, li } of items) {
      const ok = pw.length > 0 && rule.test(pw);
      li.classList.toggle('ok', ok);
      li.querySelector('.pw-rule-mark').textContent = ok ? '✓' : '・';
    }
  };
  input.addEventListener('input', update);
  update();
}
