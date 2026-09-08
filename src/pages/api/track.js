import { supabase } from '../../lib/supabase.js';

// 自前アクセス計測の受け口(2026-09-08)。
// SiteHeader.astro のスクリプトが、ページ表示時とショップリンククリック時に
// navigator.sendBeacon でここへ小さなJSONを送ってくる。
// サーバー側で「国」「端末種別」「訪問者ハッシュ」を付け足してから、
// Supabaseの log_access_event() 関数(SECURITY DEFINER)経由で access_logs に記録する。
//
// プライバシー配慮:
//   - 生のIPアドレスは保存しない。sha256(日付|IP|UA) の先頭32桁だけを保存する。
//     日付が入っているので翌日には別の値になり、長期間の追跡には使えない。
//   - Cookieは使わない(タブ単位のsessionStorageのみ)。
// 計測に失敗しても閲覧体験には一切影響させないため、どんなエラーでも 204 を返す。

export const prerender = false;

// middleware.js と同じ判定。クローラーの閲覧はログに入れない
const BOT_UA_RE =
  /bot|crawler|spider|facebookexternalhit|twitterbot|slackbot|discordbot|whatsapp|telegrambot|linkedinbot|pinterest|embedly|quora|vkshare|w3c_validator|googlebot|bingbot|yandex|baiduspider|line-poker|skypeuripreview|headlesschrome|lighthouse/i;

const SHOP_KEYS = new Set([
  'fanza',
  'pyuarabu',
  'nls',
  'daimaoh',
  'mzakka',
  'hotpowers',
  'nobunagatoys',
  'ems',
]);

function deviceFromUA(ua) {
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet';
  if (/Mobi|iPhone|Android|IEMobile|Opera Mini/i.test(ua)) return 'mobile';
  return 'desktop';
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const noContent = () => new Response(null, { status: 204 });

export async function POST({ request }) {
  try {
    const ua = request.headers.get('user-agent') ?? '';
    if (BOT_UA_RE.test(ua)) return noContent();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return noContent();

    const event = body.event === 'shop_click' ? 'shop_click' : body.event === 'pageview' ? 'pageview' : null;
    if (!event) return noContent();

    const path = typeof body.path === 'string' && body.path.startsWith('/') ? body.path.slice(0, 300) : '/';
    const productId = typeof body.product === 'string' && body.product ? body.product.slice(0, 50) : null;
    const shop = event === 'shop_click' && SHOP_KEYS.has(body.shop) ? body.shop : null;
    const hasListing = event === 'shop_click' ? Boolean(body.listing) : null;
    const sessionId = typeof body.sid === 'string' && body.sid ? body.sid.slice(0, 64) : null;

    let referrerHost = null;
    if (typeof body.referrer === 'string' && body.referrer) {
      try {
        referrerHost = new URL(body.referrer).host.slice(0, 200) || null;
      } catch {
        referrerHost = null;
      }
    }

    let utmSource = null;
    try {
      utmSource = new URL(path, 'https://onahomemo.com').searchParams.get('utm_source');
    } catch {
      utmSource = null;
    }

    const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
    const day = new Date().toISOString().slice(0, 10);
    const visitorHash = (await sha256Hex(`${day}|${ip}|${ua}`)).slice(0, 32);
    const country = request.headers.get('x-vercel-ip-country') ?? null;

    await supabase.rpc('log_access_event', {
      p_event: event,
      p_path: path,
      p_product_id: productId,
      p_shop: shop,
      p_has_listing: hasListing,
      p_referrer_host: referrerHost,
      p_device: deviceFromUA(ua),
      p_country: country,
      p_visitor_hash: visitorHash,
      p_session_id: sessionId,
      p_utm_source: utmSource,
    });
  } catch (err) {
    console.error('[api/track]', err);
  }
  return noContent();
}
