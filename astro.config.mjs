// @ts-check
import { defineConfig } from 'astro/config';

import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  // 注意: middlewareMode: 'edge' は使わないこと。Astroのエッジミドルウェアは全ページを
  // 同じ内部URL(/_render)経由で取得するため、ページ側の s-maxage(CDNキャッシュ)と
  // 組み合わさると「全ページが同じ内容になる」重大な不具合が起きる(2026-09-08に本番で発生)。
  adapter: vercel(),
});