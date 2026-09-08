import { supabase } from './supabase.js';

// 「レビューを書きました」シェア用の共通データ取得(2026-09-08)。
// /share/review/{check_id} ページと /og/review/{check_id}.png 画像の両方で使う。
// 公開レビュー(is_public=true かつ 評価か本文がある)だけを返し、それ以外は null。
// 投稿者のニックネームはプロフィールが公開設定のときだけ付ける。

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loadPublicReview(checkId) {
  if (!checkId || !UUID_RE.test(checkId)) return null;

  const { data: review } = await supabase
    .from('checks')
    .select(
      'id, user_id, product_id, rating, review_title, review_text, detail_review_title, detail_review_text, item_ratings, updated_at, is_public, products(id, dmm_content_id, name, maker, price, image_url, raw_data)'
    )
    .eq('id', checkId)
    .eq('is_public', true)
    .maybeSingle();
  if (!review || !review.products) return null;
  if (!review.rating && !review.review_text && !review.detail_review_text) return null;

  let nickname = null;
  if (review.user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('nickname, is_public')
      .eq('id', review.user_id)
      .maybeSingle();
    if (profile?.is_public && profile.nickname) nickname = profile.nickname;
  }

  return { review, product: review.products, nickname };
}

export function reviewShareText(product, review) {
  const stars = review.rating ? `${'★'.repeat(Number(review.rating))}${'☆'.repeat(5 - Number(review.rating))} ` : '';
  return `「${product.name}」のレビューを書きました ${stars}#オナホ #オナホめも`;
}
