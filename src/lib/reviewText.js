// 口コミ(checks)のタイトル・本文冒頭を取り出す共通ロジック(2026-09-23)。
// 詳細レビュー(detail_review_*)があればそちらを優先する。
// トップページの「最新のレビュー」と口コミ一覧ページ(/reviews/)の両方から使う。

export function reviewDisplayTitle(r) {
  return r.detail_review_title || r.review_title || '';
}

// detail_review_text はリッチテキスト(HTML)で保存されている(商品ページでは set:html で描画)。
// 抜粋作成時にそのまま切り出すとタグが文字として見えてしまうため、先にタグを取り除く(2026-09-23、
// 口コミ一覧ページ公開後にじょいさんの報告で発覚)。review_text はもともとプレーンテキストなので対象外。
function stripHtml(html) {
  return String(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// maxLen は「文字数」の上限(全角換算ではなくJSの文字数扱い。既存のlatestReviewExcerptと同じ数え方)
export function reviewDisplayExcerpt(r, maxLen = 50) {
  const raw = r.detail_review_text || r.review_text || '';
  if (!raw) return '';
  const text = r.detail_review_text ? stripHtml(raw) : raw;
  if (!text) return '';
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}
