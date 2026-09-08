// @ts-check
import { defineConfig } from 'astro/config';

import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel({
    // 年齢確認ゲート(src/middleware.js)を、VercelのCDNキャッシュより手前の
    // Routing Middleware(エッジ)で実行する。これにより、ページ側で「Vary: Cookie」を
    // 付けなくてもゲートが素通りされず、認証済みの訪問者は全員同じCDNキャッシュを共有できる
    // (Googleアナリティクスの _ga Cookieが訪問者ごとに違ってもキャッシュが効く)。
    middlewareMode: 'edge',
  }),
});