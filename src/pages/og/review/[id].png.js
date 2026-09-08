import { renderPng, pngResponse, fetchImageAsDataUrl } from '../../../lib/ogImage.js';
import { buildReviewCard } from '../../../lib/ogReviewCard.js';
import { loadPublicReview } from '../../../lib/reviewShare.js';

// 「レビューを書きました」シェア画像(2026-09-08)。
// /og/review/{check_id}.png で、商品画像・投稿者名・星評価・レビュータイトル・本文冒頭を合成したPNGを返す。
// /share/review/{check_id} ページの og:image がこのURLを指す。公開レビュー以外は共通OGP画像へ転送。

export const prerender = false;

export async function GET({ params, url }) {
  const fallback = () => Response.redirect(new URL('/ogp.png', url.origin), 302);
  const data = await loadPublicReview(params.id);
  if (!data) return fallback();

  try {
    const { product, review, nickname } = data;
    const raw = product.raw_data ?? {};
    const listUrl = raw.imageURL?.list ?? product.image_url;
    const largeUrl = listUrl ? listUrl.replace(/pt\.jpg(\?.*)?$/, 'pl.jpg$1') : null;
    const imageDataUrl = (await fetchImageAsDataUrl(largeUrl)) ?? (await fetchImageAsDataUrl(listUrl));
    const png = await renderPng(buildReviewCard({ product, review, nickname, imageDataUrl }), { origin: url.origin });
    // レビューは編集されることがあるので、商品カードより短め(1時間)にキャッシュ
    return pngResponse(png, { maxAgeSeconds: 3600 });
  } catch (err) {
    console.error('[og/review] 生成に失敗:', err);
    return fallback();
  }
}
