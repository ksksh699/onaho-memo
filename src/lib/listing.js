import { supabase } from './supabase.js';

// 一覧ページ(メーカー別 /makers/、タグ別 /tags/、セール /sale/)の共通処理(2026-09-08)。
// これらは検索エンジンからの入口にするため、トップページと違いサーバー側で
// 商品カードまで描画する(HTMLに商品が入った状態で返す)。データは v_products_listing ビュー。

export const LISTING_PAGE_SIZE = 60;
export const NEW_ARRIVAL_DAYS = 14;

// トップページと同じ「セール系タグ」の判定キーワード(index.astro の CAMPAIGN_KEYWORDS と揃える)
export const CAMPAIGN_KEYWORDS = ['セール', '特価', '祭', 'キャンペーン', 'OFF', '割引'];

export const LISTING_SELECT =
  'id, dmm_content_id, name, maker, price, image_url, release_date, genre_tags, dmm_review_average, dmm_review_count, site_rating_avg, site_rating_count, list_price, discount_percent';

export function isCampaignTag(tag) {
  return CAMPAIGN_KEYWORDS.some((k) => String(tag).includes(k));
}

// セール系タグの一覧(get_genre_tag_stats からキーワードで抽出)
export async function fetchCampaignTags() {
  const { data } = await supabase.rpc('get_genre_tag_stats');
  return (data ?? []).map((r) => r.tag).filter(isCampaignTag);
}

export function parsePage(searchParams) {
  const n = Number.parseInt(searchParams.get('page') ?? '1', 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 999) : 1;
}

export function pageRange(page) {
  const from = (page - 1) * LISTING_PAGE_SIZE;
  return [from, from + LISTING_PAGE_SIZE - 1];
}

export function totalPages(count) {
  return Math.max(1, Math.ceil((count ?? 0) / LISTING_PAGE_SIZE));
}

export function isNewArrival(releaseDate) {
  if (!releaseDate) return false;
  const release = new Date(releaseDate);
  if (Number.isNaN(release.getTime())) return false;
  const diffDays = (Date.now() - release.getTime()) / 86400000;
  return diffDays >= 0 && diffDays <= NEW_ARRIVAL_DAYS;
}

export function isPreorder(releaseDate) {
  if (!releaseDate) return false;
  const release = new Date(releaseDate);
  return !Number.isNaN(release.getTime()) && release.getTime() > Date.now();
}

// 一覧ページ共通のキャッシュ設定。内容はログイン状態に依存しないのでCDNに10分キャッシュ。
// Vary: Cookie は年齢確認ゲートの素通り防止(index.astro の説明を参照)。
export function setListingCacheHeaders(response) {
  response.headers.set('Vary', 'Cookie');
  response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600');
}

// ページ番号付きURLを作る(1ページ目は ?page を付けない = 正規URL)
export function pageHref(basePath, page) {
  return page <= 1 ? basePath : `${basePath}?page=${page}`;
}

// ページネーションに表示するページ番号(1・最後・現在の前後2つ、間は null=「…」)
export function pagerPages(current, total) {
  const set = new Set([1, total]);
  for (let p = current - 2; p <= current + 2; p++) if (p >= 1 && p <= total) set.add(p);
  const pages = [...set].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < pages.length; i++) {
    if (i > 0 && pages[i] - pages[i - 1] > 1) out.push(null);
    out.push(pages[i]);
  }
  return out;
}
