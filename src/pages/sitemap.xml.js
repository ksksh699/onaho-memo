import { supabase } from '../lib/supabase.js';

// 検索エンジン向けサイトマップ(2026-09-08)。
// 商品ページは4000件超あり、追加・更新も続くため、ビルド時に固定せず
// リクエスト時にSupabaseから一覧を取り出して生成する。
// 生成結果はCDNに1日キャッシュさせる(s-maxage=86400)ので、DBへの負荷は1日1回程度で済む。
// robots.txt からこのURL(https://onahomemo.com/sitemap.xml)を参照している。
//
// 年齢確認ゲート(src/middleware.js)は拡張子 .xml のURLを対象外にしているので、
// クローラーはCookie無しでもこのファイルを取得できる。

export const prerender = false;

const SITE_ORIGIN = 'https://onahomemo.com';

// 商品以外の固定ページ。ログインが必要なページや個人向けページは載せない
const STATIC_PAGES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/board/', changefreq: 'daily', priority: '0.6' },
  { path: '/terms', changefreq: 'yearly', priority: '0.1' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.1' },
  { path: '/contact', changefreq: 'yearly', priority: '0.1' },
];

// Supabase(PostgREST)は1回の問い合わせで最大1000行までしか返さないため、
// 範囲を少しずつずらしながら全件を集める
async function fetchAllProducts() {
  const PAGE = 1000;
  const all = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('products')
      .select('dmm_content_id, updated_at, release_date')
      .eq('is_onahole', true)
      .not('dmm_content_id', 'is', null)
      .order('dmm_content_id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return all;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export async function GET() {
  let products = [];
  try {
    products = await fetchAllProducts();
  } catch (err) {
    console.error('[sitemap.xml] 商品一覧の取得に失敗:', err);
    // DB障害時でも固定ページだけのサイトマップを返し、クローラーにエラーを見せない
  }

  const today = new Date().toISOString().slice(0, 10);
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  for (const p of STATIC_PAGES) {
    lines.push(
      `<url><loc>${SITE_ORIGIN}${p.path}</loc><lastmod>${today}</lastmod><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`
    );
  }

  for (const p of products) {
    const lastmod = toDate(p.updated_at) ?? toDate(p.release_date);
    lines.push(
      `<url><loc>${SITE_ORIGIN}/products/${escapeXml(encodeURIComponent(p.dmm_content_id))}/</loc>` +
        (lastmod ? `<lastmod>${lastmod}</lastmod>` : '') +
        `<changefreq>weekly</changefreq><priority>0.7</priority></url>`
    );
  }

  lines.push('</urlset>');

  return new Response(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
