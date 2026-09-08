// @ts-check
import { defineConfig } from 'astro/config';

import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  // 注意: middlewareMode: 'edge' は使わないこと。Astroのエッジミドルウェアは全ページを
  // 同じ内部URL(/_render)経由で取得するため、ページ側の s-maxage(CDNキャッシュ)と
  // 組み合わさると「全ページが同じ内容になる」重大な不具合が起きる(2026-09-08に本番で発生)。
  adapter: vercel({
    // シェア画像(OGP)の自動生成(src/lib/ogImage.js)で使う日本語フォントを、
    // Vercelのサーバー関数にも同梱する(public/ に置いてあるだけでは関数から読めない)
    // satori(文字組みに harfbuzzjs を使う)が実行時に読む hb.wasm は、通常の依存関係の追跡では
    // 関数に同梱されず本番だけ失敗した(2026-09-08)。明示的に同梱する。
    includeFiles: [
      './public/fonts/NotoSansJP-Regular.ttf',
      './public/fonts/NotoSansJP-Bold.ttf',
      './node_modules/harfbuzzjs/hb.wasm',
    ],
  }),
});