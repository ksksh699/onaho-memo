import { supabase } from './supabase.js';

// 一覧ページ(メーカー別 /makers/、タグ別 /tags/、セール /sale/)の共通処理(2026-09-08)。
// これらは検索エンジンからの入口にするため、トップページと違いサーバー側で
// 商品カードまで描画する(HTMLに商品が入った状態で返す)。データは v_products_listing ビュー。

export const LISTING_PAGE_SIZE = 60;
export const NEW_ARRIVAL_DAYS = 14;

// トップページと同じ「セール系タグ」の判定キーワード(index.astro の CAMPAIGN_KEYWORDS と揃える)
export const CAMPAIGN_KEYWORDS = ['セール', '特価', '祭', 'キャンペーン', 'OFF', '割引'];

// 他ショップの表示名(商品ページの SHOP_DEFS と揃える)。他ショップのセール欄で使う
export const SHOP_LABELS = {
  // FANZA はセールの出どころが genre_tags なので sale_shops には入らないが、
  // セールページのショップ別チップでは並べて選べるようにしている
  fanza: 'FANZA',
  nls: 'NLS',
  daimaoh: '大魔王',
  nobunagatoys: '信長トイズ',
  ems: 'エムズ',
  hotpowers: 'ホットパワーズ',
  mzakka: 'M-ZAKKA',
  pyuarabu: 'ぴゅあらばショップ',
};

export const LISTING_SELECT =
  'id, dmm_content_id, name, maker, price, image_url, release_date, genre_tags, dmm_review_average, dmm_review_count, site_rating_avg, site_rating_count, list_price, discount_percent, sale_shops, shop_sale_best_discount, shop_sale_min_price, shop_sale_ends_on, best_discount_percent';

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

// ---- 絞り込み・並び替え(2026-09-08 追加。トップページの toolbar と同じ項目) ----
// 一覧ページはサーバー側描画なので、絞り込み条件はURLのクエリ(?q=&sort=&maker=…)で受け取り、
// フォーム送信(GET)でページごと描き直す。JSが無くても動き、条件付きURLをそのまま共有できる。

export const LISTING_SORT_OPTIONS = [
  { value: 'new', label: '新着順' },
  { value: 'discount_desc', label: '割引率が高い順' },
  { value: 'price_asc', label: '価格が安い順' },
  { value: 'price_desc', label: '価格が高い順' },
  { value: 'dmm_rating_desc', label: 'FANZA評価が高い順' },
  { value: 'dmm_count_desc', label: 'FANZAレビューが多い順' },
  { value: 'site_rating_desc', label: 'オナホめも評価が高い順' },
  { value: 'site_count_desc', label: 'オナホめもレビューが多い順' },
  { value: 'want_count_desc', label: '気になる人気順' },
];
const SORT_VALUES = new Set(LISTING_SORT_OPTIONS.map((o) => o.value));

function cleanText(v, max) {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}
function cleanInt(v, min, max) {
  const n = Number.parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n) || n < min || n > max) return '';
  return n;
}

// URLのクエリから絞り込み条件を取り出す(不正な値は無視して空にする)
export function parseListingFilters(searchParams, { defaultSort = 'new' } = {}) {
  const sort = searchParams.get('sort') ?? '';
  return {
    q: cleanText(searchParams.get('q'), 60),
    sort: SORT_VALUES.has(sort) ? sort : defaultSort,
    maker: cleanText(searchParams.get('maker'), 60),
    yearFrom: cleanInt(searchParams.get('year_from'), 1990, 2100),
    yearTo: cleanInt(searchParams.get('year_to'), 1990, 2100),
    priceMin: cleanInt(searchParams.get('price_min'), 0, 9999999),
    priceMax: cleanInt(searchParams.get('price_max'), 0, 9999999),
    sale: searchParams.get('sale') === '1',
    onaking: searchParams.get('onaking') === '1',
    // 他ショップのセール絞り込み(セールページのチップ)。知らないショップ名は無視する
    shop: SHOP_LABELS[searchParams.get('shop') ?? ''] ? searchParams.get('shop') : '',
  };
}

export function hasActiveFilters(f) {
  return Boolean(f.q || f.maker || f.yearFrom || f.yearTo || f.priceMin !== '' || f.priceMax !== '' || f.sale || f.onaking || f.shop);
}

// 絞り込み条件をクエリ文字列に戻す(ページ送りリンクや canonical に使う)
export function filterParams(f, { defaultSort = 'new' } = {}) {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.sort && f.sort !== defaultSort) p.set('sort', f.sort);
  if (f.maker) p.set('maker', f.maker);
  if (f.yearFrom) p.set('year_from', String(f.yearFrom));
  if (f.yearTo) p.set('year_to', String(f.yearTo));
  if (f.priceMin !== '') p.set('price_min', String(f.priceMin));
  if (f.priceMax !== '') p.set('price_max', String(f.priceMax));
  if (f.sale) p.set('sale', '1');
  if (f.onaking) p.set('onaking', '1');
  if (f.shop) p.set('shop', f.shop);
  return p;
}

// v_products_listing への問い合わせに絞り込み条件を足す(件数取得と本体取得の両方で使う)。
// 商品名検索の % _ は PostgREST のパターン文字なのでエスケープしておく。
export function applyListingFilters(query, f, { campaignTags = [] } = {}) {
  if (f.q) query = query.ilike('name', `%${f.q.replace(/[%_\\]/g, '\\$&')}%`);
  if (f.maker) query = query.eq('maker', f.maker);
  // 「セール中」= FANZAのセール系タグ OR 他ショップでセール中(2026-09-12)。
  // 判定は v_products_listing.is_on_sale にまとめてあるので、ここではその列を見るだけ。
  // (campaignTags は以前この判定に使っていた名残。タグ一覧の表示など他の用途では今も使う)
  if (f.sale) query = query.eq('is_on_sale', true);
  // ショップ別の絞り込み(セールページのチップ)。
  // FANZAのセールはタグ由来なので has_fanza_sale、他ショップは sale_shops を見る。
  if (f.shop === 'fanza') query = query.eq('has_fanza_sale', true);
  else if (f.shop) query = query.contains('sale_shops', [f.shop]);
  if (f.onaking) query = query.eq('is_onaking_reviewed', true);
  if (f.yearFrom) query = query.gte('release_date', `${f.yearFrom}-01-01`);
  if (f.yearTo) query = query.lte('release_date', `${f.yearTo}-12-31`);
  if (f.priceMin !== '') query = query.gte('price', f.priceMin);
  if (f.priceMax !== '') query = query.lte('price', f.priceMax);
  return query;
}

// 並び替え(同順位は新着→ID順で安定させる)
export function applyListingSort(query, sort) {
  switch (sort) {
    case 'discount_desc':
      // FANZAの割引率と他ショップの割引率のうち高い方(best_discount_percent)で並べる
      query = query.order('best_discount_percent', { ascending: false });
      break;
    case 'price_asc':
      query = query.order('price', { ascending: true, nullsFirst: false });
      break;
    case 'price_desc':
      query = query.order('price', { ascending: false, nullsFirst: false });
      break;
    case 'dmm_rating_desc':
      query = query.order('dmm_review_average', { ascending: false, nullsFirst: false });
      break;
    case 'dmm_count_desc':
      query = query.order('dmm_review_count', { ascending: false, nullsFirst: false });
      break;
    case 'site_rating_desc':
      query = query.order('site_rating_avg', { ascending: false });
      break;
    case 'site_count_desc':
      query = query.order('site_rating_count', { ascending: false });
      break;
    case 'want_count_desc':
      query = query.order('want_count', { ascending: false });
      break;
    default:
      break;
  }
  return query.order('release_date', { ascending: false, nullsFirst: false }).order('dmm_content_id', { ascending: true });
}

// 一覧ページの絞り込みフォームに出す選択肢(メーカー上位・発売年)。
// トップページと同じく集計済みRPCを使う。失敗しても空配列で続行する。
export async function fetchListingFilterOptions() {
  const [makersResult, minResult, maxResult] = await Promise.all([
    supabase.rpc('get_maker_counts'),
    supabase.from('products').select('release_date').eq('is_onahole', true).not('release_date', 'is', null).order('release_date', { ascending: true }).limit(1),
    supabase.from('products').select('release_date').eq('is_onahole', true).not('release_date', 'is', null).order('release_date', { ascending: false }).limit(1),
  ]);
  const makers = (makersResult.data ?? []).filter((m) => m.maker && Number(m.cnt) > 0).slice(0, 60);
  const minYear = minResult.data?.[0]?.release_date ? new Date(minResult.data[0].release_date).getFullYear() : null;
  const maxYear = maxResult.data?.[0]?.release_date ? new Date(maxResult.data[0].release_date).getFullYear() : null;
  const years = [];
  if (minYear && maxYear) for (let y = maxYear; y >= minYear; y--) years.push(y);
  return { makers, years };
}

// ページ番号付きURLを作る(1ページ目は ?page を付けない = 正規URL)。
// filters を渡すと絞り込み条件のクエリも引き継ぐ。
export function pageHref(basePath, page, filters = null, opts = {}) {
  const p = filters ? filterParams(filters, opts) : new URLSearchParams();
  if (page > 1) p.set('page', String(page));
  const qs = p.toString();
  return qs ? `${basePath}?${qs}` : basePath;
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
