import { supabase } from '../../lib/supabase.js';

// オナ王(ona-king.com)に埋め込むカード用のAPI(2026-09-08、案1「オナ王からの導線」)。
// オナ王側には public/embed/onaking.js を <script> 1行で読み込んでもらい、そのスクリプトが
// このAPIを呼んで「この記事の商品のオナホめもカード」や「値下がり速報バナー」を描画する。
//
//   GET /api/onaking-card?url=https://ona-king.com/electric/a10cyclone/
//     → onaking_links(オナ王記事URL ↔ 商品)の対応表を引き、商品カードのデータを返す
//   GET /api/onaking-card?type=banner
//     → 直近の値下がり(v_recent_price_drops)と人気商品(want_count上位)を返す
//
// 公開データ(商品名・価格・件数)しか返さないので、CORSは全許可でよい。
// 年齢確認ゲート(src/middleware.js)は /api/ を対象外にしている(別サイトからの fetch には
// Cookieが付かないため、対象にするとゲートのHTMLが返ってしまう)。
// 結果はCDNに10分キャッシュさせる(価格更新は週1回なので十分)。

export const prerender = false;

const SITE_ORIGIN = 'https://onahomemo.com';
const UTM = 'utm_source=onaking&utm_medium=embed';

// products/[id].astro の SHOP_DEFS と同じ並び
const SHOPS = [
  { key: 'fanza', name: 'FANZA', priceField: 'price' },
  { key: 'pyuarabu', name: 'ぴゅあらば', priceField: 'pyuarabu_price' },
  { key: 'nls', name: 'NLS', priceField: 'nls_price' },
  { key: 'daimaoh', name: '大魔王', priceField: 'daimaoh_price' },
  { key: 'mzakka', name: 'M-ZAKKA', priceField: 'mzakka_price' },
  { key: 'hotpowers', name: 'ホットパワーズ', priceField: 'hotpowers_price' },
  { key: 'nobunagatoys', name: '信長トイズ', priceField: 'nobunagatoys_price' },
  { key: 'ems', name: 'エムズ', priceField: 'ems_price' },
];
const SHOP_NAMES = Object.fromEntries(SHOPS.map((s) => [s.key, s.name]));

const PRODUCT_SELECT =
  'id, dmm_content_id, name, maker, price, image_url, raw_data, nls_price, daimaoh_price, nobunagatoys_price, hotpowers_price, ems_price, pyuarabu_price, mzakka_price';

function json(body, { status = 200, cache = true } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': cache
        ? 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600'
        : 'private, no-store',
    },
  });
}

// オナ王記事URLの表記ゆれ(http/https、www有無、末尾スラッシュ有無、クエリ・ハッシュ)を吸収して
// onaking_links.onaking_url と照合するための候補一覧を作る
function urlVariants(input) {
  let u;
  try {
    u = new URL(String(input));
  } catch {
    return [];
  }
  const host = u.hostname.replace(/^www\./, '');
  if (host !== 'ona-king.com') return [];
  let path = u.pathname.replace(/\/+$/, '');
  const paths = [`${path}/`, path || '/'];
  const out = new Set();
  for (const p of paths) {
    for (const scheme of ['https', 'http']) {
      out.add(`${scheme}://ona-king.com${p}`);
      out.add(`${scheme}://www.ona-king.com${p}`);
    }
  }
  return [...out];
}

function productUrl(dmmContentId) {
  return `${SITE_ORIGIN}/products/${encodeURIComponent(dmmContentId)}/?${UTM}`;
}

function buildCard(product, stats) {
  const shops = SHOPS.map((s) => ({ key: s.key, shop: s.name, price: product[s.priceField] }))
    .filter((s) => s.price != null && Number(s.price) > 0)
    .map((s) => ({ ...s, price: Number(s.price) }))
    .sort((a, b) => a.price - b.price);
  const listPrice = product.raw_data?.prices?.list_price ? Number(product.raw_data.prices.list_price) : null;
  const fanzaPrice = product.price != null ? Number(product.price) : null;
  const discountPercent =
    listPrice && fanzaPrice && listPrice > fanzaPrice ? Math.round((1 - fanzaPrice / listPrice) * 100) : null;
  return {
    id: product.dmm_content_id,
    name: product.name,
    maker: product.maker ?? null,
    image: product.image_url ?? null,
    url: productUrl(product.dmm_content_id),
    lowest: shops[0] ?? null,
    shops,
    shop_count: shops.length,
    list_price: listPrice,
    discount_percent: discountPercent,
    rating_avg: stats?.site_rating_avg != null ? Number(stats.site_rating_avg) : null,
    rating_count: Number(stats?.site_rating_count ?? 0),
    used_count: Number(stats?.used_count ?? 0),
    want_count: Number(stats?.want_count ?? 0),
  };
}

async function cardForUrl(pageUrl) {
  const variants = urlVariants(pageUrl);
  if (variants.length === 0) return json({ found: false, reason: 'not_onaking_url' });

  const { data: link, error } = await supabase
    .from('onaking_links')
    .select('product_id')
    .in('onaking_url', variants)
    .limit(1)
    .maybeSingle();
  if (error) return json({ found: false, reason: 'lookup_failed' }, { status: 503, cache: false });
  if (!link) return json({ found: false });

  const [productResult, statsResult] = await Promise.all([
    supabase.from('products').select(PRODUCT_SELECT).eq('id', link.product_id).eq('is_onahole', true).maybeSingle(),
    supabase
      .from('products_with_stats')
      .select('site_rating_avg, site_rating_count, want_count, used_count')
      .eq('id', link.product_id)
      .maybeSingle(),
  ]);
  if (productResult.error) return json({ found: false, reason: 'product_failed' }, { status: 503, cache: false });
  if (!productResult.data) return json({ found: false });

  return json({ found: true, product: buildCard(productResult.data, statsResult.data) });
}

async function banner() {
  const [dropsResult, popularResult] = await Promise.all([
    supabase
      .from('v_recent_price_drops')
      .select('dmm_content_id, name, maker, drop_shop, old_price, new_price, drop_percent')
      .order('drop_percent', { ascending: false })
      .limit(3),
    supabase
      .from('products_with_stats')
      .select('dmm_content_id, name, maker, image_url, price, want_count, site_rating_avg, site_rating_count')
      .eq('is_onahole', true)
      .order('want_count', { ascending: false })
      .limit(3),
  ]);
  const drops = (dropsResult.data ?? []).map((d) => ({
    id: d.dmm_content_id,
    name: d.name,
    maker: d.maker,
    shop: SHOP_NAMES[d.drop_shop] ?? d.drop_shop,
    old_price: Number(d.old_price),
    new_price: Number(d.new_price),
    drop_percent: Number(d.drop_percent),
    url: productUrl(d.dmm_content_id),
  }));
  const popular = (popularResult.data ?? []).map((p) => ({
    id: p.dmm_content_id,
    name: p.name,
    maker: p.maker,
    image: p.image_url,
    price: p.price != null ? Number(p.price) : null,
    want_count: Number(p.want_count ?? 0),
    rating_avg: p.site_rating_avg != null ? Number(p.site_rating_avg) : null,
    rating_count: Number(p.site_rating_count ?? 0),
    url: productUrl(p.dmm_content_id),
  }));
  return json({
    site: { name: 'オナホめも', url: `${SITE_ORIGIN}/?${UTM}`, sale_url: `${SITE_ORIGIN}/sale/?${UTM}` },
    drops,
    popular,
  });
}

export async function GET({ url }) {
  try {
    if (url.searchParams.get('type') === 'banner') return await banner();
    const pageUrl = url.searchParams.get('url');
    if (!pageUrl) return json({ found: false, reason: 'missing_url' }, { status: 400, cache: false });
    return await cardForUrl(pageUrl);
  } catch (err) {
    console.error('[api/onaking-card]', err);
    return json({ found: false, reason: 'error' }, { status: 503, cache: false });
  }
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Max-Age': '86400',
    },
  });
}
