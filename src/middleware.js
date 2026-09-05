import { defineMiddleware } from 'astro:middleware';

// アダルトコンテンツ(アダルトグッズのレビュー・情報)を含むサイトのため、
// 初回アクセス時に年齢確認ゲートを表示する。
// 「はい、18歳以上です」を押すとCookie(age_verified=1)を1年間保存し、
// 以後そのブラウザでは再表示しない(ユーザーの希望により「一度答えたら記憶する」方式)。
//
// 画像・CSS・JSなどの静的ファイルへのリクエストと、X(旧Twitter)などSNSの
// リンクカード生成用クローラーはゲートの対象外にする。
// (対象にしてしまうと、シェアしたリンクのプレビューカードが正しく作れなくなるため)

const COOKIE_NAME = 'age_verified';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1年

const ASSET_PATH_RE =
  /\.(?:css|js|mjs|json|ico|png|jpg|jpeg|gif|svg|webp|avif|webmanifest|txt|xml|map|woff2?|ttf)$/i;

const BOT_UA_RE =
  /bot|crawler|spider|facebookexternalhit|twitterbot|slackbot|discordbot|whatsapp|telegrambot|linkedinbot|pinterest|embedly|quora|vkshare|w3c_validator|googlebot|bingbot|yandex|baiduspider|line-poker|skypeuripreview/i;

function isExempt(context) {
  const { pathname } = context.url;

  if (ASSET_PATH_RE.test(pathname)) return true;
  if (pathname.startsWith('/_astro/')) return true;
  if (context.request.method !== 'GET') return true;

  const ua = context.request.headers.get('user-agent') ?? '';
  if (BOT_UA_RE.test(ua)) return true;

  return false;
}

function renderGatePage() {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>年齢確認 - オナホめも</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f6f6f5;
    color: #1f1f22;
    font-family: 'Noto Sans JP', sans-serif;
    padding: 1.5rem;
  }
  .gate-card {
    max-width: 420px;
    width: 100%;
    background: #ffffff;
    border: 1px solid #e2e1de;
    border-radius: 16px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
    padding: 2rem 1.75rem;
    text-align: center;
  }
  .gate-logo {
    font-size: 1.3rem;
    font-weight: 700;
    margin: 0 0 1rem;
  }
  .gate-text {
    font-size: 0.9rem;
    line-height: 1.7;
    color: #4a4a4d;
    margin: 0 0 1.6rem;
  }
  .gate-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }
  .gate-btn {
    display: block;
    width: 100%;
    padding: 0.85rem 1rem;
    border-radius: 999px;
    font-size: 0.95rem;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    border: none;
    text-decoration: none;
    box-sizing: border-box;
  }
  .gate-btn-yes {
    background: #2b5fad;
    color: #fff;
  }
  .gate-btn-yes:hover {
    background: #3f74c4;
  }
  .gate-btn-no {
    background: #f0f0ef;
    color: #6b6b70;
  }
  .gate-btn-no:hover {
    background: #e2e1de;
  }
</style>
</head>
<body>
  <div class="gate-card">
    <p class="gate-logo">オナホめも</p>
    <p class="gate-text">
      当サイトはアダルトコンテンツ(アダルトグッズのレビュー・情報)を含みます。<br />
      あなたは18歳以上ですか?
    </p>
    <div class="gate-buttons">
      <button type="button" class="gate-btn gate-btn-yes" id="gate-yes">はい、18歳以上です</button>
      <a class="gate-btn gate-btn-no" href="https://www.google.com/">いいえ</a>
    </div>
  </div>
  <script>
    document.getElementById('gate-yes').addEventListener('click', function () {
      document.cookie = '${COOKIE_NAME}=1; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax';
      location.reload();
    });
  </script>
</body>
</html>`;
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (isExempt(context)) {
    return next();
  }

  const verified = context.cookies.get(COOKIE_NAME)?.value === '1';
  if (verified) {
    return next();
  }

  return new Response(renderGatePage(), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      // このページ自体はCookieの有無で内容が変わるため、CDN/ブラウザにキャッシュさせない
      'Cache-Control': 'private, no-store',
    },
  });
});
