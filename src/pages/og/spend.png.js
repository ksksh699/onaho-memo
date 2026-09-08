import { renderPng, pngResponse } from '../../lib/ogImage.js';
import { parseSpendParams, buildSpendCard } from '../../lib/shareSpend.js';

// 「合計使用金額」シェア画像(2026-09-08)。
// /og/spend.png?a=金額&n=本数&u=ニックネーム で、金額・本数・換算例を合成したPNGを返す。
// /share/spend ページの og:image がこのURLを指す。DBアクセスは無い(パラメータだけで描く)。

export const prerender = false;

export async function GET({ url }) {
  const params = parseSpendParams(url.searchParams);
  try {
    const png = await renderPng(buildSpendCard(params), { origin: url.origin });
    return pngResponse(png, { maxAgeSeconds: 604800 }); // 同じ金額なら同じ絵なので1週間キャッシュ
  } catch (err) {
    console.error('[og/spend] 生成に失敗:', err);
    if (url.searchParams.get('debug') === '1') {
      return new Response(`${err?.name}: ${err?.message}\n${(err?.stack ?? '').split('\n').slice(0, 6).join('\n')}`, { status: 500 });
    }
    return Response.redirect(new URL('/ogp.png', url.origin), 302);
  }
}
