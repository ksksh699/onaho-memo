import { supabase } from '../../../lib/supabase.js';
import { renderPng, pngResponse, fetchImageAsDataUrl } from '../../../lib/ogImage.js';
import { buildUserCard } from '../../../lib/ogUserCard.js';

// 公開プロフィール用のシェア画像(2026-09-08)。
// /og/user/{nickname}.png で、ニックネーム・アバター・推しメーカー・使った数・レビュー数・
// マイベストTOP3 を1枚に合成したPNG(1200x630)を返す。
// users/[nickname].astro の og:image がこのURLを指している。
// 非公開プロフィール・存在しないニックネームは、サイト共通のOGP画像へ転送する。

export const prerender = false;

const REVIEW_FILTER =
  'review_text.not.is.null,detail_review_text.not.is.null,rating.not.is.null,item_ratings.not.is.null,review_images.not.is.null,similar_products.not.is.null';

export async function GET({ params, url }) {
  const nickname = decodeURIComponent(params.nickname ?? '');
  const fallback = () => Response.redirect(new URL('/ogp.png', url.origin), 302);

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, nickname, avatar_url, oshi_maker, best_product_id_1, best_product_id_2, best_product_id_3, is_public')
    .eq('nickname', nickname)
    .maybeSingle();
  if (!profile || profile.is_public === false) return fallback();

  const top3Ids = [profile.best_product_id_1, profile.best_product_id_2, profile.best_product_id_3];
  const validIds = top3Ids.filter(Boolean);

  const [productsResult, usedResult, reviewResult] = await Promise.all([
    validIds.length > 0
      ? supabase.from('products').select('id, name, maker, image_url, raw_data').in('id', validIds)
      : Promise.resolve({ data: [] }),
    supabase.from('checks').select('*', { count: 'exact', head: true }).eq('user_id', profile.id).eq('status', 'used'),
    supabase
      .from('checks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('is_public', true)
      .or(REVIEW_FILTER),
  ]);

  const productById = new Map((productsResult.data ?? []).map((p) => [p.id, p]));

  try {
    const [avatarDataUrl, ...top3Images] = await Promise.all([
      fetchImageAsDataUrl(profile.avatar_url),
      ...top3Ids.map((pid) => {
        const p = pid ? productById.get(pid) : null;
        if (!p) return Promise.resolve(null);
        const listUrl = p.raw_data?.imageURL?.list ?? p.image_url;
        return fetchImageAsDataUrl(listUrl);
      }),
    ]);

    const top3 = top3Ids.map((pid, i) => {
      const p = pid ? productById.get(pid) : null;
      if (!p) return null;
      return { name: p.name, maker: p.maker, imageDataUrl: top3Images[i] };
    });

    const element = buildUserCard({
      profile,
      avatarDataUrl,
      top3,
      usedCount: usedResult.count ?? 0,
      reviewCount: reviewResult.count ?? 0,
    });
    const png = await renderPng(element, { origin: url.origin });
    return pngResponse(png, { maxAgeSeconds: 3600 });
  } catch (err) {
    console.error('[og/user] 生成に失敗:', err);
    return fallback();
  }
}
