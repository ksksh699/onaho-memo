// 口コミ(checks)のタイトル・本文冒頭を取り出す共通ロジック(2026-09-23)。
// 詳細レビュー(detail_review_*)があればそちらを優先する。
// トップページの「最新のレビュー」と口コミ一覧ページ(/reviews/)の両方から使う。

export function reviewDisplayTitle(r) {
  return r.detail_review_title || r.review_title || '';
}

// maxLen は「文字数」の上限(全角換算ではなくJSの文字数扱い。既存のlatestReviewExcerptと同じ数え方)
export function reviewDisplayExcerpt(r, maxLen = 50) {
  const text = r.detail_review_text || r.review_text || '';
  if (!text) return '';
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}
