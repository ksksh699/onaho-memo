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
// セール系タグ(タグ別ページではなく /sale/ に集約するので除外)
const CAMPAIGN_KEYWORDS = ['セール', '特価', '祭', 'キャンペーン', 'OFF', '割引'];

// 商品以外の固定ページ。ログインが必要なページや個人向けページは載せない
const STATIC_PAGES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/sale/', changefreq: 'daily', priority: '0.8' },
  { path: '/makers/', changefreq: 'weekly', priority: '0.6' },
  { path: '/tags/', changefreq: 'weekly', priority: '0.6' },
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
  // 2026-09-08 デプロイ直後の初回呼び出しでSupabaseへの問い合わせが一時的に失敗し、
  // 「固定ページ5件だけのサイトマップ」がCDNに1日キャッシュされてしまった。
  // 一時的な失敗は1回だけ少し待って再試行し、それでも駄目なときは中途半端な内容を
  // 200で返さず(=Googleに「このサイトは5ページ」と教えてしまわない)、
  // キャッシュ禁止の503を返してクローラーに後で取り直してもらう。
  let products = null;
  for (let attempt = 1; attempt <= 2 && products === null; attempt++) {
    try {
      products = await fetchAllProducts();
    } catch (err) {
      console.error(`[sitemap.xml] 商品一覧の取得に失敗(${attempt}回目):`, err);
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  if (products === null) {
    return new Response('sitemap temporarily unavailable', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=UTF-8',
        'Cache-Control': 'private, no-store',
        'Retry-After': '600',
      },
    });
  }

  // メーカー別・ジャンル別の一覧ページ(集計RPCから)。失敗しても商品ページの出力は続ける
  let makerRows = [];
  let tagRows = [];
  try {
    const [m, t] = await Promise.all([supabase.rpc('get_maker_counts'), supabase.rpc('get_genre_tag_stats')]);
    makerRows = (m.data ?? []).filter((r) => r.maker && Number(r.cnt) > 0);
    tagRows = (t.data ?? []).filter((r) => r.tag && Number(r.cnt) >= 3 && !CAMPAIGN_KEYWORDS.some((k) => r.tag.includes(k)));
  } catch (err) {
    console.error('[sitemap.xml] メーカー/タグ一覧の取得に失敗:', err);
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

  for (const r of makerRows) {
    lines.push(
      `<url><loc>${SITE_ORIGIN}/makers/${escapeXml(encodeURIComponent(r.maker))}/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.5</priority></url>`
    );
  }
  for (const r of tagRows) {
    lines.push(
      `<url><loc>${SITE_ORIGIN}/tags/${escapeXml(encodeURIComponent(r.tag))}/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.4</priority></url>`
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
