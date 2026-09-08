import { supabase } from '../../../lib/supabase.js';
import { renderPng, pngResponse, fetchImageAsDataUrl } from '../../../lib/ogImage.js';
import { buildProductCard, largeImageUrl } from '../../../lib/ogProductCard.js';

// 商品ページ用のシェア画像(2026-09-08)。
// /og/product/{dmm_content_id}.png で、商品画像・商品名・メーカー・オナホめも評価・
// ショップ別の最安価格を1枚に合成したPNG(1200x630)を返す。
// 商品ページ(products/[id].astro)の og:image がこのURLを指している。
// 生成結果はCDNに1日キャッシュされる(ogImage.js の pngResponse を参照)。

export const prerender = false;

export async function GET({ params, url }) {
  const id = params.id;
  const [productResult, statsResult] = await Promise.all([
    supabase
      .from('products')
      .select(
        'id, dmm_content_id, name, maker, price, image_url, raw_data, nls_price, daimaoh_price, nobunagatoys_price, hotpowers_price, ems_price, pyuarabu_price, mzakka_price'
      )
      .eq('dmm_content_id', id)
      .eq('is_onahole', true)
      .maybeSingle(),
    supabase
      .from('products_with_stats')
      .select('site_rating_avg, site_rating_count, want_count, used_count')
      .eq('dmm_content_id', id)
      .maybeSingle(),
  ]);

  const debug = url.searchParams.get('debug') === '1';
  const product = productResult.data;
  if (!product) {
    if (debug) return new Response(`product not found: ${JSON.stringify(productResult.error ?? null)}`, { status: 500 });
    // 存在しない商品はサイト共通のOGP画像へ
    return Response.redirect(new URL('/ogp.png', url.origin), 302);
  }

  try {
    const imageDataUrl =
      (await fetchImageAsDataUrl(largeImageUrl(product))) ??
      (await fetchImageAsDataUrl(product.raw_data?.imageURL?.list ?? product.image_url));
    const element = buildProductCard({ product, stats: statsResult.data, imageDataUrl });
    const png = await renderPng(element, { origin: url.origin });
    return pngResponse(png);
  } catch (err) {
    console.error('[og/product] 生成に失敗:', err);
    if (debug) return new Response(`${err?.name}: ${err?.message}\n${(err?.stack ?? '').split('\n').slice(0, 6).join('\n')}`, { status: 500 });
    return Response.redirect(new URL('/ogp.png', url.origin), 302);
  }
}
