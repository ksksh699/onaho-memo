// ユーザーが入力したURL(プロフィールのSNSリンクなど)の安全確認(2026-09-08)。
// href に javascript: や data: のURLを入れられると、リンクを踏んだ人のブラウザで
// 任意のスクリプトが動いてしまう(XSS)ため、http / https 以外は受け付けない。
// DB側にも同じ条件の CHECK 制約(profiles_sns_links_safe)があり、二重に守っている。

export const USER_URL_MAX_LENGTH = 300;

// 入力文字列を整えて http(s) のURLとして返す。不正なら null。
//   - 前後の空白を除く
//   - 「x.com/abc」のようにスキームが無ければ https:// を補う
//   - http: / https: 以外のスキーム(javascript:, data:, file: …)は不可
//   - 空白や < > " を含むもの、長すぎるものは不可
export function normalizeHttpUrl(input) {
  let s = String(input ?? '').trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
  if (s.length > USER_URL_MAX_LENGTH) return null;
  if (/[\s<>"]/.test(s)) return null;
  let url;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname || !url.hostname.includes('.')) return null;
  return url.href;
}

// 表示側の最終確認(DBから来た値でも念のため通す)
export function isSafeHttpUrl(value) {
  return normalizeHttpUrl(value) !== null && /^https?:\/\//i.test(String(value).trim());
}
