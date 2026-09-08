import { h, brandBar, starString, COLORS, OG_WIDTH, OG_HEIGHT } from './ogImage.js';

// 「レビューを書きました」シェア画像のレイアウト(純粋な関数。DBアクセスなし)。
// src/pages/og/review/[id].png.js から使う。
//   左: 商品画像
//   右: 「レビューを書きました」・投稿者名・星評価・レビュータイトル・本文の冒頭・商品名
// レビュー本文は2行までに切り、全文は商品ページ/シェアページで読んでもらう。

export function buildReviewCard({ product, review, nickname, imageDataUrl }) {
  const title = review.detail_review_title || review.review_title || '';
  const text = (review.detail_review_text || review.review_text || '').replace(/\s+/g, ' ').trim();
  const rating = review.rating ? Number(review.rating) : null;

  const imageBox = h(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 340,
        height: 430,
        borderRadius: 20,
        background: '#fff',
        border: `2px solid ${COLORS.border}`,
        overflow: 'hidden',
        flexShrink: 0,
      },
    },
    imageDataUrl
      ? h('img', { src: imageDataUrl, style: { width: 300, height: 400, objectFit: 'contain' } })
      : h('div', { style: { display: 'flex', fontSize: 26, color: COLORS.muted } }, 'No Image')
  );

  const textCol = h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, height: 430 } },
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 14 } },
      h(
        'div',
        {
          style: {
            display: 'flex',
            padding: '6px 16px',
            borderRadius: 999,
            background: COLORS.sale,
            color: '#fff',
            fontSize: 22,
            fontWeight: 700,
          },
        },
        'レビューを書きました'
      ),
      h('div', { style: { display: 'flex', fontSize: 24, color: COLORS.muted, fontWeight: 700 } }, nickname ? `by ${nickname}` : '')
    ),
    rating
      ? h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 14, marginTop: 20 } },
          h('div', { style: { display: 'flex', fontSize: 40, color: COLORS.gold, letterSpacing: 2 } }, starString(rating)),
          h('div', { style: { display: 'flex', fontSize: 30, fontWeight: 700, color: COLORS.text } }, `${rating}.0`)
        )
      : null,
    title
      ? h(
          'div',
          {
            style: {
              display: 'block',
              fontSize: 38,
              fontWeight: 700,
              lineHeight: 1.3,
              color: COLORS.text,
              marginTop: 16,
              lineClamp: 2,
            },
          },
          title
        )
      : null,
    text
      ? h(
          'div',
          {
            style: {
              display: 'block',
              fontSize: title ? 24 : 30,
              lineHeight: 1.5,
              color: title ? COLORS.muted : COLORS.text,
              marginTop: 12,
              lineClamp: title ? 2 : 4,
            },
          },
          text
        )
      : null,
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', marginTop: 'auto', paddingTop: 12, borderTop: `2px solid ${COLORS.border}` } },
      h('div', { style: { display: 'flex', fontSize: 18, color: COLORS.muted } }, product.maker ?? ''),
      h(
        'div',
        { style: { display: 'block', fontSize: 24, fontWeight: 700, color: COLORS.text, lineHeight: 1.3, lineClamp: 1 } },
        product.name
      )
    )
  );

  return h(
    'div',
    {
      style: {
        display: 'flex',
        width: OG_WIDTH,
        height: OG_HEIGHT,
        background: COLORS.bg,
        fontFamily: 'Noto Sans JP',
        position: 'relative',
      },
    },
    h('div', { style: { display: 'flex', gap: 40, padding: '56px 56px 0 56px', width: OG_WIDTH } }, imageBox, textCol),
    brandBar('onahomemo.com でレビュー・価格比較')
  );
}
