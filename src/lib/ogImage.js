import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

// シェア画像(OGP)の自動生成(2026-09-08)。
// XやLINEでURLが共有されたときに出る画像を、商品ごと・プロフィールごとに
// その場で合成して返すための共通処理。
//   - satori: HTMLに似た要素ツリーからSVGを作る(ブラウザ不要)
//   - @resvg/resvg-js: SVGをPNGに変換する
// 呼び出し側(src/pages/og/*.js)は、この renderPng() に要素ツリーを渡すだけでよい。
//
// フォントは public/fonts/ の Noto Sans JP(Regular/Bold の日本語サブセット、各約5MB)。
// Vercelの関数には astro.config.mjs の includeFiles で同梱している。万一ファイルが
// 読めない環境では、自サイトの /fonts/ から取得する(フォールバック)。

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export const COLORS = {
  bg: '#f6f6f5',
  card: '#ffffff',
  text: '#1f1f22',
  muted: '#6b6b70',
  accent: '#2b5fad',
  border: '#e2e1de',
  sale: '#d84f39',
  gold: '#b8863c',
};

const FONT_FILES = [
  { name: 'Noto Sans JP', weight: 400, file: 'NotoSansJP-Regular.ttf' },
  { name: 'Noto Sans JP', weight: 700, file: 'NotoSansJP-Bold.ttf' },
];

let fontsPromise = null;

async function readFontData(file, origin) {
  const candidates = [
    path.join(process.cwd(), 'public', 'fonts', file),
    path.join(process.cwd(), 'fonts', file),
  ];
  for (const p of candidates) {
    try {
      return fs.readFileSync(p);
    } catch {
      /* 次の候補へ */
    }
  }
  if (origin) {
    const res = await fetch(`${origin}/fonts/${file}`);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  }
  throw new Error(`font not found: ${file}`);
}

// 一度読んだフォントはプロセス内で使い回す(サーバーレスの同一インスタンス内で再利用される)
export function loadFonts(origin) {
  if (!fontsPromise) {
    fontsPromise = Promise.all(
      FONT_FILES.map(async (f) => ({
        name: f.name,
        weight: f.weight,
        style: 'normal',
        data: await readFontData(f.file, origin),
      }))
    ).catch((err) => {
      fontsPromise = null; // 失敗したら次回また試す
      throw err;
    });
  }
  return fontsPromise;
}

// 画像URLを取得して data: URL にして返す(satoriに外部URLを直接渡すより、
// タイムアウトや失敗時の扱いを自分で制御できる)。失敗したら null。
export async function fetchImageAsDataUrl(url, { timeoutMs = 4000 } = {}) {
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; onahomemo-og/1.0)' },
    });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || 'image/jpeg';
    if (!type.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return null;
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// satori用の要素を作る小さなヘルパー(JSXを使わずに済ませる)
export const h = (type, props = {}, ...children) => {
  const kids = children.flat().filter((c) => c !== null && c !== undefined && c !== false);
  return {
    type,
    props: {
      ...props,
      children: kids.length === 1 ? kids[0] : kids.length === 0 ? undefined : kids,
    },
  };
};

export async function renderPng(element, { origin } = {}) {
  const fonts = await loadFonts(origin);
  const svg = await satori(element, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts,
  });
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: OG_WIDTH },
    font: { loadSystemFonts: false },
  });
  return resvg.render().asPng();
}

export function pngResponse(png, { maxAgeSeconds = 86400 } = {}) {
  return new Response(png, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      // CDNに1日キャッシュ。価格や評価の変化は最大1日遅れて画像に反映される
      'Cache-Control': `public, max-age=0, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds}`,
    },
  });
}

// 星表示用: 4.3 → "★★★★☆" のような文字列
export function starString(avg) {
  const n = Math.max(0, Math.min(5, Math.round(Number(avg) || 0)));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

export function formatYen(n) {
  return `¥${Number(n).toLocaleString('ja-JP')}`;
}

// 共通のブランド帯(画面下部)
export function brandBar(label = 'onahomemo.com') {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 72,
        padding: '0 56px',
        background: COLORS.accent,
        color: '#fff',
      },
    },
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 14 } },
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: 10,
            background: '#fff',
            color: COLORS.accent,
            fontWeight: 700,
            fontSize: 24,
          },
        },
        'メ'
      ),
      h('div', { style: { fontSize: 28, fontWeight: 700, letterSpacing: 1 } }, 'オナホめも')
    ),
    h('div', { style: { fontSize: 22, opacity: 0.9 } }, label)
  );
}
