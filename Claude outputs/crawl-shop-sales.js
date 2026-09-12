#!/usr/bin/env node
/**
 * crawl-shop-sales.js
 *
 * FANZA以外の各ショップの「セール中」商品を巡回して public.shop_sales に反映するスクリプト。
 * 詳細設計は C:\projects\onahole-site\CLAUDE_HANDOVER.md の「8. 次の案件」を参照(このスクリプトはその実装)。
 *
 * 使い方:
 *   node crawl-shop-sales.js                 全ショップを巡回してDBを更新
 *   node crawl-shop-sales.js --check         疎通確認のみ(各ショップの取得可否・件数を表示。DBは更新しない)
 *   node crawl-shop-sales.js --only=nls,ems  指定ショップだけ対象にする
 *   node crawl-shop-sales.js --exclude=mzakka  指定ショップを除外する(例: クラウドから弾かれるM-ZAKKAを除く)
 *
 * 必要な環境変数(DB更新時。--check のみの場合は不要):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ※ update-products ワークフローで使っているものと同じ変数名でなければ、下の2行を実際の名前に合わせて書き換えてください。
 *
 * 依存パッケージ: @supabase/supabase-js, cheerio
 *   npm install @supabase/supabase-js cheerio
 *
 * このファイルは ESM(import構文)で書いています。package.json に "type": "module" が無い場合は
 *   - package.json に "type": "module" を追加する
 *   - もしくはこのファイルを crawl-shop-sales.mjs にリネームする
 * のどちらかが必要です(update-products 側の書き方に合わせてください)。
 *
 * 【自己クリック禁止の順守】このスクリプトが叩くのは各ショップの「素の」一覧ページのみで、
 * 自分のアフィリエイトURL(track.bannerbridge.net / t.afi-b.com / e-click.jp / e-nls.com access.php)には
 * 一切アクセスしません(CLAUDE_HANDOVER.md 3章の禁止事項を厳守)。
 */

import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import fs from 'node:fs';

// ---------------------------------------------------------------------------
// CLI引数
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const CHECK_ONLY = argv.includes('--check');
const onlyArg = argv.find((a) => a.startsWith('--only='));
const excludeArg = argv.find((a) => a.startsWith('--exclude='));
const ONLY = onlyArg ? onlyArg.slice('--only='.length).split(',').filter(Boolean) : null;
const EXCLUDE = excludeArg ? excludeArg.slice('--exclude='.length).split(',').filter(Boolean) : [];

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ---------------------------------------------------------------------------
// 共通ユーティリティ
// ---------------------------------------------------------------------------

/** UA・タイムアウト付きの生fetch */
async function doFetch(url, { headers = {}, timeoutMs = 15000, ...rest } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...rest,
      headers: { 'User-Agent': UA, 'Accept-Language': 'ja,en;q=0.8', ...headers },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Shift_JIS / UTF-8 を自動判定してデコードする */
async function fetchDecoded(url, opts = {}) {
  const res = await doFetch(url, opts);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get('content-type') || '';
  let charset = null;
  const ctMatch = ct.match(/charset=([^;]+)/i);
  if (ctMatch) charset = ctMatch[1].trim().toLowerCase();
  if (!charset) {
    const head = buf.slice(0, 2048).toString('latin1');
    const metaMatch = head.match(/charset=["']?([a-zA-Z0-9_-]+)/i);
    if (metaMatch) charset = metaMatch[1].toLowerCase();
  }
  const isSjis = charset && (charset.includes('shift') || charset === 'sjis' || charset === 'x-sjis');
  const text = isSjis ? new TextDecoder('shift_jis').decode(buf) : buf.toString('utf-8');
  return { res, text };
}

/** Node の fetch には Set-Cookie を集約して取り出す getSetCookie() があればそれを使う。無ければ単一ヘッダにフォールバック */
function getSetCookies(res) {
  if (typeof res.headers.getSetCookie === 'function') {
    const list = res.headers.getSetCookie();
    if (list && list.length) return list;
  }
  const raw = res.headers.get('set-cookie');
  return raw ? [raw] : [];
}

function cookieHeaderFrom(setCookies) {
  return setCookies.map((c) => c.split(';')[0]).join('; ');
}

/** "3,069 円" のような文字列から整数円を取り出す */
function yen(s) {
  if (!s) return null;
  const n = String(s).replace(/[^\d]/g, '');
  return n ? parseInt(n, 10) : null;
}

/** "09/15" 等の月日文字列から ends_on (YYYY-MM-DD) を推測する。年をまたぐケースは翌年扱いにする */
function guessEndsOn(text) {
  if (!text) return null;
  const m = String(text).match(/(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const now = new Date();
  let year = now.getUTCFullYear();
  let d = new Date(Date.UTC(year, month - 1, day));
  const diffDays = (d.getTime() - now.getTime()) / 86400000;
  if (diffDays < -60) {
    d = new Date(Date.UTC(year + 1, month - 1, day));
  }
  return d.toISOString().slice(0, 10);
}

/** "【〇〇】残り" から先頭の【】ラベルと、それを除いた本文を取り出す */
function splitBracketLabel(rawText) {
  const m = rawText.match(/^【([^】]*)】\s*/);
  if (!m) return { label: null, rest: rawText.trim() };
  return { label: m[1], rest: rawText.slice(m[0].length).trim() };
}

// ---------------------------------------------------------------------------
// ショップごとのアダプタ
// ---------------------------------------------------------------------------
const adapters = {};

// --- NLS -------------------------------------------------------------------
// 「新商品」ページに載っている、期間限定SALEバッジの付いた商品だけを対象にする。
// 通常価格の表示は無い。入口に年齢確認あり(POST auth18=1 でセッションCookieが立つ想定)。
adapters.nls = {
  label: 'NLS',
  async crawl() {
    const url = 'https://www.e-nls.com/disp_new.php';

    // 年齢確認ゲートの突破: フォーム action="" (=同URL) に auth18=1 をPOSTするとセッションが立つ
    const gateRes = await doFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'auth18=1',
    });
    const cookieHeader = cookieHeaderFrom(getSetCookies(gateRes));

    const { text } = await fetchDecoded(url, {
      headers: cookieHeader ? { Cookie: cookieHeader } : {},
    });
    const $ = cheerio.load(text);
    const lists = $('dl.newitem-list');

    if (lists.length === 0) {
      throw new Error('NLS: dl.newitem-list が見つかりません(年齢確認ゲートを通過できていない可能性)');
    }

    const items = [];
    lists.each((_, el) => {
      const $el = $(el);
      const saleDd = $el.find('dd.txt-sale');
      if (saleDd.length === 0) return; // セール表示が無い商品はスキップ

      const a = $el.find('dt a[href^="/pict1-"]').first();
      const href = a.attr('href') || '';
      const m = href.match(/\/pict1-([^?]+)/);
      const shop_pid = m ? m[1] : null;
      if (!shop_pid) return;

      const name = $el.find('dt.newitem-txt a').first().text().trim() || null;
      const saleLabel = saleDd.find('img').attr('alt') || null;
      const saleText = saleDd.text().trim(); // 例: "09/15まで"
      const sale_price = yen($el.find('span.txt_nedan').first().text());

      items.push({
        shop: 'nls',
        shop_pid,
        name,
        sale_price,
        regular_price: null,
        discount_percent: null,
        sale_label: saleLabel,
        ends_on: guessEndsOn(saleText),
        source_url: url,
      });
    });
    return items;
  },
};

// --- 通販大魔王 --------------------------------------------------------------
// セール商品カテゴリ。20件/ページ。通常価格の表示なし。
adapters.daimaoh = {
  label: '通販大魔王',
  async crawl() {
    const items = [];
    const perPage = 20;
    for (let page = 1; page <= 10; page++) {
      const url = `https://daimaoh.co.jp/list.php?c=421&sort=price&_page=${page}`;
      const { text } = await fetchDecoded(url);
      const $ = cheerio.load(text);
      const lis = $('ul.pic_list > li');
      if (lis.length === 0) break;

      lis.each((_, el) => {
        const $el = $(el);
        const a = $el.find('a[href^="./item"]').first();
        const href = a.attr('href') || '';
        const m = href.match(/item(\d+)\.html/);
        const shop_pid = m ? m[1] : null;
        if (!shop_pid) return;

        const name = $el.find('h3.name span').first().text().trim() || null;
        const taxIncludedText = $el.find('small').first().text(); // "(税込：66円)"
        const preTaxText = $el.find('p.price').first().text();
        const sale_price = yen(taxIncludedText) ?? yen(preTaxText);

        items.push({
          shop: 'daimaoh',
          shop_pid,
          name,
          sale_price,
          regular_price: null,
          discount_percent: null,
          sale_label: null,
          ends_on: null,
          source_url: url,
        });
      });

      if (lis.length < perPage) break;
    }
    return items;
  },
};

// --- 信長トイズ --------------------------------------------------------------
// 限定特価品グループ。商品名に「【信長限定特価！通常4180円→1505円】商品名」という形式で
// 通常価格・セール価格が埋め込まれている。
adapters.nobunagatoys = {
  label: '信長トイズ',
  async crawl() {
    const items = [];
    const perPage = 30;
    for (let page = 1; page <= 10; page++) {
      const url = `https://www.nobunaga-toys.com/?mode=grp&gid=2398364&sort=n&page=${page}`;
      const { text } = await fetchDecoded(url);
      const $ = cheerio.load(text);
      const links = $('a.try-list__link');
      if (links.length === 0) break;

      links.each((_, el) => {
        const $a = $(el);
        const href = $a.attr('href') || '';
        const m = href.match(/pid=(\d+)/);
        const shop_pid = m ? m[1] : null;
        if (!shop_pid) return;

        const rawName = $a.find('h3.try-list__name').first().text().trim();
        const pm = rawName.match(/通常\s*([\d,]+)\s*円\s*→\s*([\d,]+)\s*円/);
        const regular_price = pm ? yen(pm[1]) : null;
        const sale_price = pm ? yen(pm[2]) : null;
        // 「【信長限定特価！通常4180円→1505円】商品名」の【】内には価格情報も混ざっているので、
        // 価格パターンを除いた残りをラベルとして使う
        const { label: rawLabel, rest } = splitBracketLabel(rawName);
        const label = rawLabel ? rawLabel.replace(/通常\s*[\d,]+\s*円\s*→\s*[\d,]+\s*円/, '').trim() || null : null;

        items.push({
          shop: 'nobunagatoys',
          shop_pid,
          name: rest || rawName,
          sale_price,
          regular_price,
          discount_percent:
            regular_price && sale_price ? Math.round((1 - sale_price / regular_price) * 1000) / 10 : null,
          sale_label: label,
          ends_on: null,
          source_url: url,
        });
      });

      if (links.length < perPage) break;
    }
    return items;
  },
};

// --- エムズ ------------------------------------------------------------------
// セール一覧。24件/ページ。割引率は data-rate、通常価格は <s>、セール価格は price02。
// 商品名に「【期間限定割引~9/19】」のように終了日が入ることがある。
adapters.ems = {
  label: 'エムズ',
  async crawl() {
    const items = [];
    const perPage = 24;
    for (let page = 1; page <= 20; page++) {
      const url = `https://www.ms-online.co.jp/sale_bargain?list=1&orderby=2&pageno=${page}`;
      const { text } = await fetchDecoded(url);
      const $ = cheerio.load(text);
      const lis = $('.ec-shelfGrid__item');
      if (lis.length === 0) break;

      lis.each((_, el) => {
        const $el = $(el);
        const a = $el.find('a[href*="pclass_id="]').first();
        const href = a.attr('href') || '';
        // shop_product_ids.shop_pid と同じ形式(パス + "?pclass_id=...") にする
        const shop_pid = href.replace(/^https?:\/\/[^/]+/, '') || null;
        if (!shop_pid) return;

        const rateEl = $el.find('.price-off').first();
        const discount_percent = rateEl.attr('data-rate') ? parseFloat(rateEl.attr('data-rate')) : null;

        let regular_price = null;
        let sale_price = null;
        $el.find('.price-box > span, .ec-shelfGrid__info span').each((__, sp) => {
          const $sp = $(sp);
          if ($sp.find('s').length) {
            const v = yen($sp.find('s').text());
            if (v) regular_price = v;
          } else if (/円/.test($sp.text()) && $sp.find('s').length === 0) {
            const v = yen($sp.text());
            if (v) sale_price = v;
          }
        });

        let name = $el.find('.h3_title p').first().text().trim() || null;
        if (!name) {
          name = $el.find('.ec-shelfGrid__item-image img').first().attr('alt') || null;
        }

        let ends_on = null;
        if (name) {
          const dm = name.match(/[~～]\s*(\d{1,2}\/\d{1,2})/);
          if (dm) ends_on = guessEndsOn(dm[1]);
        }
        const label = name ? (name.match(/^【([^】]*)】/) || [])[1] || null : null;

        items.push({
          shop: 'ems',
          shop_pid,
          name,
          sale_price,
          regular_price,
          discount_percent,
          sale_label: label,
          ends_on,
          source_url: url,
        });
      });

      if (lis.length < perPage) break;
    }
    return items;
  },
};

// --- ホットパワーズ -----------------------------------------------------------
// /ec/sale は1ページで全件表示(15件程度)。
adapters.hotpowers = {
  label: 'ホットパワーズ',
  async crawl() {
    const url = 'https://www.hotpowers.jp/ec/sale';
    const { text } = await fetchDecoded(url);
    const $ = cheerio.load(text);
    const items = [];

    $('.ec-sale-section li.ec-shelfGrid__item').each((_, el) => {
      const $el = $(el);
      const a = $el.find('a[href*="/products/detail/"]').first();
      const href = a.attr('href') || '';
      const m = href.match(/\/products\/detail\/(\d+)/);
      const shop_pid = m ? m[1] : null;
      if (!shop_pid) return;

      const name = $el.find('.ec-sale-grid__title').first().text().trim() || null;

      let regular_price = null;
      let sale_price = null;
      $el.find('.ec-saleBadge__prices > span').each((__, sp) => {
        const $sp = $(sp);
        if ($sp.find('s').length) regular_price = yen($sp.find('s').text());
        else sale_price = yen($sp.text());
      });

      const chipText = $el.find('.ec-saleBadge__chip').first().text().trim().replace(/\s+/g, ' ');
      const dm = chipText.match(/([\d.]+)\s*%OFF/);
      const discount_percent = dm ? parseFloat(dm[1]) : null;

      items.push({
        shop: 'hotpowers',
        shop_pid,
        name,
        sale_price,
        regular_price,
        discount_percent,
        sale_label: chipText || null,
        ends_on: null,
        source_url: url,
      });
    });
    return items;
  },
};

// --- M-ZAKKA -----------------------------------------------------------------
// 「セール!」(st1=1862、定価より安い全商品なので対象外)を除く、トップページに張られている
// 文言に「セール」を含む category.php リンクを都度たどる。
// クラウド側(GitHub Actions等)からは取得できない実績があるため、その場合は PC 側での実行が必要
// (--only=mzakka で PC のタスクスケジューラから実行する運用を想定)。
adapters.mzakka = {
  label: 'M-ZAKKA',
  async crawl() {
    const base = 'https://mzakka.com/';
    const { text: homeText } = await fetchDecoded(base);
    const $home = cheerio.load(homeText);

    const saleUrls = new Set();
    $home('a[href*="category.php"]').each((_, el) => {
      const $a = $home(el);
      const text = $a.text();
      const href = $a.attr('href');
      if (!href || !text.includes('セール')) return;
      let u;
      try {
        u = new URL(href, base);
      } catch {
        return;
      }
      if (u.searchParams.get('st1') === '1862') return; // 「セール!」は定価より安い全品カテゴリなので除外(設計承認済み)
      saleUrls.add(u.toString());
    });

    const items = [];
    const seenPids = new Set();

    for (const catUrl of saleUrls) {
      let prevFirstHref = null;
      for (let page = 1; page <= 10; page++) {
        const sep = catUrl.includes('?') ? '&' : '?';
        const pageUrl = page === 1 ? catUrl : `${catUrl}${sep}page=${page}`;
        const { text } = await fetchDecoded(pageUrl);
        const $ = cheerio.load(text);

        const lis = $('li').filter(
          (__, el) => $(el).find('a[href*="item.php?item_id=M"]').length > 0 && $(el).find('p.price').length > 0
        );
        if (lis.length === 0) break;

        const firstHref = lis.first().find('a[href*="item.php?item_id=M"]').first().attr('href') || null;
        if (firstHref && firstHref === prevFirstHref) break; // ページ番号が進んでも中身が変わらない=最終ページ超過
        prevFirstHref = firstHref;

        lis.each((__, el) => {
          const $el = $(el);
          const a = $el.find('a[href*="item.php?item_id=M"]').first();
          const href = a.attr('href') || '';
          const m = href.match(/item_id=(M\d+)/);
          const shop_pid = m ? m[1] : null;
          if (!shop_pid || seenPids.has(shop_pid)) return;
          seenPids.add(shop_pid);

          const rawName = $el.find('h3').first().text().trim();
          const priceText = $el.find('p.price').first().text().trim(); // "9,020円→5,412円"
          const pm = priceText.match(/([\d,]+)\s*円\s*→\s*([\d,]+)\s*円/);
          const regular_price = pm ? yen(pm[1]) : null;
          const sale_price = pm ? yen(pm[2]) : yen(priceText);
          const { label, rest } = splitBracketLabel(rawName);

          items.push({
            shop: 'mzakka',
            shop_pid,
            name: rest || rawName,
            sale_price,
            regular_price,
            discount_percent:
              regular_price && sale_price ? Math.round((1 - sale_price / regular_price) * 1000) / 10 : null,
            sale_label: label,
            ends_on: null,
            source_url: catUrl,
          });
        });
      }
    }
    return items;
  },
};

// ぴゅあらばはセールページが無いため対象外(price_history の値下がり検知で代替。設計承認済み)

// ---------------------------------------------------------------------------
// メイン処理
// ---------------------------------------------------------------------------
async function main() {
  const shopKeys = Object.keys(adapters).filter((k) => (!ONLY || ONLY.includes(k)) && !EXCLUDE.includes(k));

  if (shopKeys.length === 0) {
    console.error('対象ショップが0件です(--only / --exclude を確認してください)');
    process.exit(1);
  }

  let supabase = null;
  if (!CHECK_ONLY) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が設定されていません(--check ならDB接続不要です)');
      process.exit(1);
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }

  const summary = [];

  for (const key of shopKeys) {
    const adapter = adapters[key];
    const row = { shop: key, label: adapter.label, ok: false, count: 0, upserted: 0, deactivated: 0, error: null };
    try {
      const items = await adapter.crawl();
      row.ok = true;
      row.count = items.length;

      if (!CHECK_ONLY) {
        if (items.length > 0) {
          const nowIso = new Date().toISOString();
          const { error } = await supabase
            .from('shop_sales')
            .upsert(
              items.map((it) => ({ ...it, last_seen_at: nowIso, is_active: true })),
              { onConflict: 'shop,shop_pid' }
            );
          if (error) throw error;
          row.upserted = items.length;
        }

        // 今回見つからなかった、そのショップの既存アクティブ行を is_active=false にする
        // (crawl() が例外を投げた場合はこのブロックに到達しないので、取得失敗時に誤って
        //  既存のアクティブなセールを消してしまうことは無い)
        const { data: activeRows, error: selErr } = await supabase
          .from('shop_sales')
          .select('shop_pid')
          .eq('shop', key)
          .eq('is_active', true);
        if (selErr) throw selErr;

        const foundSet = new Set(items.map((it) => it.shop_pid));
        const stale = (activeRows || []).map((r) => r.shop_pid).filter((p) => !foundSet.has(p));
        if (stale.length > 0) {
          const { error: deactErr } = await supabase
            .from('shop_sales')
            .update({ is_active: false })
            .eq('shop', key)
            .in('shop_pid', stale);
          if (deactErr) throw deactErr;
          row.deactivated = stale.length;
        }
      }
    } catch (e) {
      row.error = (e && e.message) || String(e);
    }

    summary.push(row);
    console.log(
      `[${key}] ok=${row.ok} count=${row.count} upserted=${row.upserted} deactivated=${row.deactivated}` +
        (row.error ? ` error=${row.error}` : '')
    );
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [];
    lines.push(`## 他ショップセール巡回結果 ${CHECK_ONLY ? '(疎通確認)' : ''}`);
    lines.push('');
    lines.push('| ショップ | 状態 | 件数 | upsert | 非アクティブ化 | エラー |');
    lines.push('|---|---|---|---|---|---|');
    for (const r of summary) {
      const err = r.error ? r.error.replace(/\|/g, '\\|').slice(0, 200) : '';
      lines.push(`| ${r.label} (${r.shop}) | ${r.ok ? '✅' : '❌'} | ${r.count} | ${r.upserted} | ${r.deactivated} | ${err} |`);
    }
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
  }

  const anyFail = summary.some((r) => !r.ok);
  if (anyFail) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
