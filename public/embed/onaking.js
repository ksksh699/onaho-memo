/*
 * オナホめも 埋め込みスクリプト(オナ王 ona-king.com 用) 2026-09-08
 *
 * 使い方(オナ王側 = WordPress / Luxeritas):
 *   A. 記事ごとに好きな場所へ置く(2026-09-08 じょいさんの希望でこちらが基本):
 *        記事本文の「カスタムHTML」ブロックに次を貼る。
 *        <div data-onahomemo="card"></div>
 *        <script src="https://onahomemo.com/embed/onaking.js" async></script>
 *      scriptタグは何度読み込まれても1回しか動かない(二重表示しない)。
 *   B. トップページ等のウィジェット(カスタムHTML)にバナーを置く(2種類):
 *        <div data-onahomemo="banner"></div>   … 「できること3つ」(価格比較・使用記録・値下がり通知のタイル)
 *        <div data-onahomemo="stats"></div>    … 「数字で見せる」(掲載数・ショップ数・セール中の数)
 *        <script src="https://onahomemo.com/embed/onaking.js" async></script>
 *   C. 全ページ共通(フッター等)に scriptタグだけ置いた場合は、記事ページで中盤の
 *      「■販売サイトはこちら」(見出し + ショップのボタン群)の直後に自動でカードを1つ差し込む(自動モード)。
 *      その見出しが無い記事では、最後の「販売サイト一覧」ボックス(.item-box)の直後に1つ差し込む。
 *      ただし、その記事に data-onahomemo="card" の置き場が1つでもあれば自動差し込みはせず、置き場だけに描画する。
 *
 * どの場合も、記事URLに対応する商品がオナホめも側に登録されていなければ何も表示しない。
 *
 * scriptタグの data-* 属性で調整できる(省略時は括弧内の既定値):
 *   data-anchor-text="<文字列>"  自動モードの目印にする見出しの文字("販売サイトはこちら")
 *   data-after="<CSSセレクタ>"   見出しが無いときの予備の差し込み先(".item-box" の最後の1つ。"" で無効)
 *   data-content="<CSSセレクタ>" 記事本文の入れ物("#mainEntity > .clearfix")
 *   data-no-auto="1"             自動差し込みをしない(data-onahomemo の場所にだけ描画)
 *
 * 失敗しても(オナホめもが落ちている等)オナ王の表示には一切影響しないよう、全体を try で包む。
 */
(function () {
  'use strict';
  try {
    // 同じscriptを複数回読み込んでも(記事内とフッターの両方など)1回だけ動かす
    if (window.__onahomemoEmbedLoaded) return;
    window.__onahomemoEmbedLoaded = true;
    var ORIGIN = 'https://onahomemo.com';
    var API = ORIGIN + '/api/onaking-card';
    var script = document.currentScript;
    var opts = {
      // 自動差し込みの目印になる見出しテキスト(記事中盤の「■販売サイトはこちら」)
      anchorText: script && script.hasAttribute('data-anchor-text') ? script.getAttribute('data-anchor-text') : '販売サイトはこちら',
      // 見出しが無い記事での予備の差し込み先(最後の .item-box の直後)。data-after="" で無効化できる
      after: script && script.hasAttribute('data-after') ? script.getAttribute('data-after') : '.item-box',
      content: (script && script.getAttribute('data-content')) || '#mainEntity > .clearfix',
      noAuto: !!(script && script.getAttribute('data-no-auto')),
    };

    var CSS =
      '.om-embed{box-sizing:border-box;margin:16px 0;padding:20px 22px;border:1px solid #d9dfe9;border-radius:12px;background:#fff;font-family:inherit;color:#1f1f22;line-height:1.5;box-shadow:0 2px 10px rgba(43,95,173,.08)}' +
      '.om-embed *{box-sizing:border-box}' +
      '.om-head{display:flex;align-items:center;gap:10px;margin:0 0 14px;font-size:13px;color:#6b6b70}' +
      // text-decoration に !important を付けているのは、オナ王のテーマ側の「記事内リンクは下線」の
      // 指定(#mainEntity a など、こちらより詳細度が高い)に負けて、ラベル・商品名・ボタンにまで
      // 下線が付いてしまうため(2026-09-12)。
      '.om-embed a{text-decoration:none!important}' +
      '.om-logo{display:inline-block;padding:2px 10px;border-radius:999px;background:#2b5fad;color:#fff!important;font-weight:700;font-size:12px;letter-spacing:.02em;text-decoration:none}' +
      '.om-logo:hover{background:#3f74c4;color:#fff!important}' +
      '.om-body{display:flex;gap:18px;align-items:center}' +
      '.om-img{flex:0 0 112px;width:112px;height:112px;border-radius:10px;background:#f3f4f7;display:flex;align-items:center;justify-content:center;overflow:hidden}' +
      '.om-img img{max-width:100%;max-height:100%;object-fit:contain}' +
      '.om-main{flex:1;min-width:0}' +
      '.om-name{margin:0;font-size:17px;font-weight:700;line-height:1.35;color:#1f1f22!important;text-decoration:none;display:block}' +
      '.om-name:hover{color:#2b5fad!important;text-decoration:underline!important}' +
      '.om-maker{margin:3px 0 12px;font-size:12px;color:#7a7a80}' +
      '.om-pl{margin:0;font-size:12px;color:#6b6b70}' +
      '.om-price{margin:0;font-size:13px;color:#4a4a4d;line-height:1.15}' +
      '.om-price b{font-size:28px;color:#d0342c;letter-spacing:-.01em;margin-right:6px}' +
      '.om-stats{margin:10px 0 0;font-size:12px;color:#7a7a80}' +
      '.om-star{color:#e5a100}' +
      '.om-btn{display:block;margin:16px 0 0;padding:13px 14px;border-radius:8px;background:#2b5fad;color:#fff!important;text-align:center;font-weight:700;font-size:15px;text-decoration:none;line-height:1.3}' +
      '.om-btn:hover{background:#3f74c4;color:#fff!important;text-decoration:none}' +
      '.om-btn small{display:block;font-weight:400;font-size:11px;opacity:.9}' +
      '.om-off{display:inline-block;margin-left:6px;padding:2px 7px;border-radius:4px;background:#fdecea;color:#d0342c;font-size:12px;font-weight:700;vertical-align:middle}' +
      '.om-banner{padding:24px 26px}' +
      '.om-banner .om-head{margin-bottom:14px}' +
      '.om-banner .om-title{margin:0 0 16px;font-size:19px;font-weight:700;line-height:1.35;color:#1f1f22}' +
      '.om-banner .om-title em{font-style:normal;color:#2b5fad}' +
      '.om-banner .om-desc{margin:-8px 0 18px;font-size:13px;color:#4a4a4d}' +
      '.om-tiles{display:flex;gap:12px;margin:0 0 18px}' +
      '.om-tile{flex:1;min-width:0;border:1px solid #e6eaf2;border-radius:10px;padding:14px 12px;color:#1f1f22;text-decoration:none;display:block}' +
      '.om-tile:hover{border-color:#2b5fad;text-decoration:none}' +
      '.om-tile .om-ic{width:36px;height:36px;border-radius:10px;background:#eaf1fc;color:#2b5fad;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;margin:0 0 8px}' +
      '.om-tile b{display:block;font-size:14px;margin:0 0 4px}' +
      '.om-tile p{margin:0;font-size:12px;color:#6b6b70;line-height:1.5}' +
      '.om-stats-row{display:flex;gap:12px;margin:0 0 18px}' +
      '.om-stat{flex:1;background:#f4f7fc;border-radius:10px;padding:12px 10px;text-align:center;color:#1f1f22;text-decoration:none;display:block}' +
      '.om-stat:hover{background:#eaf1fc;text-decoration:none}' +
      '.om-stat b{display:block;font-size:24px;color:#2b5fad;line-height:1.1;letter-spacing:-.01em}' +
      '.om-stat b small{font-size:13px;margin-left:2px;font-weight:700}' +
      '.om-stat span{display:block;font-size:12px;color:#6b6b70;margin-top:4px}' +
      '.om-banner .om-btn{margin-top:0}' +
      // スマホ幅の商品カード(2026-09-12 案A): 画像枠をパッケージに合わせた縦長(92×124)にしてグレー背景をやめ、
      // 上下中央ではなく上揃え(商品名と頭を揃える)にする。正方形枠+上下中央だと、右のテキスト列より
      // 画像が小さいぶん上下に余白が空いて間延びして見えていたため。
      '@media (max-width:480px){.om-embed{padding:16px}.om-body{gap:14px;align-items:flex-start}.om-img{flex-basis:92px;width:92px;height:124px;background:none;border-radius:8px}.om-img img{filter:drop-shadow(0 1px 3px rgba(0,0,0,.15))}.om-name{font-size:15px}.om-maker{margin:2px 0 8px}.om-price b{font-size:24px}.om-stats{margin:6px 0 0}.om-btn{margin-top:14px}.om-banner{padding:18px 16px}.om-banner .om-title{font-size:17px}.om-tiles{flex-direction:column;gap:8px}.om-tile{display:grid;grid-template-columns:36px 1fr;column-gap:12px;align-items:start;padding:12px}.om-tile .om-ic{margin:0;grid-row:1/3}.om-tile b{margin-bottom:2px}.om-stat b{font-size:20px}}';

    function injectCss() {
      if (document.getElementById('om-embed-css')) return;
      var st = document.createElement('style');
      st.id = 'om-embed-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }

    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
    function yen(n) {
      return '¥' + Number(n).toLocaleString('ja-JP');
    }
    function safeUrl(u) {
      return /^https:\/\/onahomemo\.com\//.test(String(u)) ? u : ORIGIN + '/';
    }
    function safeImg(u) {
      return /^https:\/\//.test(String(u)) ? u : '';
    }
    function stars(avg) {
      var n = Math.round(Number(avg));
      return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
    }

    // カードの中身(2026-09-10 案B「すっきり」に変更): ショップ別の価格の羅列をやめ、
    // 最安値ひとつを大きく見せる。内訳(全ショップの価格)はオナホめも側で見てもらう。
    function cardHtml(p) {
      var priceHtml = '';
      if (p.lowest) {
        priceHtml =
          '<p class="om-pl">' + (p.shop_count > 1 ? 'いちばん安いのは' : '価格') + '</p>' +
          '<p class="om-price"><b>' + yen(p.lowest.price) + '</b>' + esc(p.lowest.shop) +
          (p.discount_percent ? '<span class="om-off">' + p.discount_percent + '%OFF</span>' : '') +
          '</p>';
      }
      var stats = [];
      if (p.rating_count > 0 && p.rating_avg != null) {
        stats.push('<span class="om-star">' + stars(p.rating_avg) + '</span> ' + Number(p.rating_avg).toFixed(1) + '（' + p.rating_count + '件）');
      }
      if (p.used_count > 0) stats.push('使った人 ' + p.used_count + '人');
      if (p.want_count > 0) stats.push('気になる ' + p.want_count + '人');
      var statsHtml = stats.length ? '<p class="om-stats">' + stats.join('・') + '</p>' : '';
      var url = safeUrl(p.url);
      var headLabel = p.shop_count > 1 ? p.shop_count + '店舗の価格を比較' : 'ショップ価格・みんなの使用記録';
      var btnLabel = p.shop_count > 1 ? p.shop_count + '店舗の価格とレビューを見る' : 'オナホめもで詳しく見る';
      return (
        '<div class="om-head"><a class="om-logo" href="' + esc(ORIGIN + '/?utm_source=onaking&utm_medium=embed') + '" target="_blank" rel="noopener">オナホめも</a>' +
        '<span>' + esc(headLabel) + '</span></div>' +
        '<div class="om-body">' +
        '<a class="om-img" href="' + esc(url) + '" target="_blank" rel="noopener">' +
        (safeImg(p.image) ? '<img src="' + esc(p.image) + '" alt="" loading="lazy">' : '') +
        '</a>' +
        '<div class="om-main">' +
        '<a class="om-name" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(p.name) + '</a>' +
        (p.maker ? '<p class="om-maker">' + esc(p.maker) + '</p>' : '') +
        priceHtml +
        statsHtml +
        '</div></div>' +
        '<a class="om-btn" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(btnLabel) + ' ▶</a>'
      );
    }

    // トップページ用バナー(2026-09-10 デザイン変更)。2種類ある:
    //   data-onahomemo="banner" … 案C「できること3つ」(価格比較・使用記録・値下がり通知のタイル)
    //   data-onahomemo="stats"  … 案B「数字で見せる」(掲載数・ショップ数・セール中の数)
    // どちらもユーザーの記録データ(気になる人数など)に依存しないので、利用者が少なくても見栄えが安定する。
    function num(n) {
      return Number(n || 0).toLocaleString('ja-JP');
    }
    function bannerHead(site, sub) {
      return (
        '<div class="om-head"><a class="om-logo" href="' + esc(safeUrl(site.url)) + '" target="_blank" rel="noopener">オナホめも</a>' +
        '<span>' + esc(sub) + '</span></div>'
      );
    }
    function featuresBannerHtml(data) {
      var site = data.site || {};
      var home = safeUrl(site.url);
      var sale = safeUrl(site.sale_url || site.url);
      return (
        bannerHead(site, 'オナ王の姉妹サイト') +
        '<p class="om-title">探す・比べる・記録する</p>' +
        '<div class="om-tiles">' +
        '<a class="om-tile" href="' + esc(home) + '" target="_blank" rel="noopener"><span class="om-ic">¥</span><b>8ショップの価格比較</b><p>FANZA・NLS・大魔王など、最安の店がひと目で分かる</p></a>' +
        '<a class="om-tile" href="' + esc(home) + '" target="_blank" rel="noopener"><span class="om-ic">✎</span><b>使った記録とレビュー</b><p>一軍・二軍・引退で整理。合計使用金額も見える</p></a>' +
        '<a class="om-tile" href="' + esc(sale) + '" target="_blank" rel="noopener"><span class="om-ic">↓</span><b>値下がり通知</b><p>気になる商品が最安値を更新したらお知らせ</p></a>' +
        '</div>' +
        '<a class="om-btn" href="' + esc(home) + '" target="_blank" rel="noopener">オナホめもを見る ▶<small>無料・登録なしで価格比較できます</small></a>'
      );
    }
    function statsBannerHtml(data) {
      var site = data.site || {};
      var st = data.stats || {};
      var home = safeUrl(site.url);
      var sale = safeUrl(site.sale_url || site.url);
      var statsHtml = '';
      if (st.products) {
        statsHtml =
          '<div class="om-stats-row">' +
          '<a class="om-stat" href="' + esc(home) + '" target="_blank" rel="noopener"><b>' + num(st.products) + '<small>点</small></b><span>掲載オナホ</span></a>' +
          '<a class="om-stat" href="' + esc(home) + '" target="_blank" rel="noopener"><b>' + num(st.shops || 8) + '<small>店舗</small></b><span>価格を比較</span></a>' +
          (st.sale_count
            ? '<a class="om-stat" href="' + esc(sale) + '" target="_blank" rel="noopener"><b>' + num(st.sale_count) + '<small>点</small></b><span>いまセール中</span></a>'
            : '') +
          '</div>';
      }
      return (
        bannerHead(site, 'オナホの価格比較・使用記録サイト') +
        '<p class="om-title">そのオナホ、<em>いちばん安い店</em>はどこ？</p>' +
        '<p class="om-desc">FANZA・NLS・大魔王・信長トイズなど8ショップの価格を商品ごとに比較。使った記録やレビューも残せます。</p>' +
        statsHtml +
        '<a class="om-btn" href="' + esc(home) + '" target="_blank" rel="noopener">オナホめもで価格を比較する ▶</a>'
      );
    }

    function makeBox(extraClass) {
      var el = document.createElement('div');
      el.className = 'om-embed' + (extraClass ? ' ' + extraClass : '');
      return el;
    }

    function getJson(url) {
      return fetch(url, { credentials: 'omit', mode: 'cors' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
    }

    function pageUrl() {
      var c = document.querySelector('link[rel="canonical"]');
      var u = (c && c.href) || location.href;
      return u.split('#')[0].split('?')[0];
    }

    // 「■販売サイトはこちら」のような見出しテキストを含む段落を探し、その直後に続くボタン群
    // (.wp-block-buttons など、リンクを含むブロック)まで含めた「差し込み位置の直前の要素」を返す。
    // 見出しが見つからなければ null。
    function findAnchor(text) {
      if (!text) return null;
      var scope = document.querySelector(opts.content) || document.body;
      var nodes = scope.querySelectorAll('p, h2, h3, h4, h5, div, span, strong');
      var head = null;
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        var t = (el.textContent || '').replace(/\s+/g, ' ');
        if (t.indexOf(text) === -1 || t.length > 120) continue;
        // テキストを含む要素のうち、本文の直下に近い「段落レベル」の要素を採用する
        while (el.parentElement && el.parentElement !== scope && /^(SPAN|STRONG|B|EM|A|BR)$/.test(el.tagName)) el = el.parentElement;
        head = el;
        break;
      }
      if (!head) return null;
      var last = head;
      var sib = head.nextElementSibling;
      // 直後の要素がリンク(ショップボタン)を含むブロックなら、その後ろに置く(空の <p> は読み飛ばす)
      for (var n = 0; sib && n < 3; n++) {
        var isEmptyP = sib.tagName === 'P' && !(sib.textContent || '').trim() && !sib.querySelector('img, a');
        if (isEmptyP) {
          sib = sib.nextElementSibling;
          continue;
        }
        if (sib.querySelector('a') && !/^H[1-6]$/.test(sib.tagName)) {
          last = sib;
          sib = sib.nextElementSibling;
          continue;
        }
        break;
      }
      return last;
    }

    function renderCards() {
      var manual = Array.prototype.slice.call(document.querySelectorAll('[data-onahomemo="card"]'));
      var isSingle = document.body && /(^|\s)single-post(\s|$)/.test(document.body.className);
      var targets = [];
      // 手動の置き場(data-onahomemo="card")がある記事では自動差し込みをしない
      if (!opts.noAuto && isSingle && manual.length === 0) {
        // 2026-09-10 変更: 記事中盤の「■販売サイトはこちら」(見出しの段落 + ショップのボタン群)の直後に1つだけ差し込む。
        // 以前の「販売サイト一覧ボックス(.item-box)の直後」は、ボックスが2つ続いて見栄えが悪いとのことで
        // 見出しが見つからない記事でのみ、最後の .item-box の直後に1つ差し込む(それも無ければ何もしない)。
        var anchor = findAnchor(opts.anchorText);
        if (anchor) {
          targets.push({ mode: 'after', el: anchor });
        } else if (opts.after) {
          var boxes = Array.prototype.slice.call(document.querySelectorAll(opts.after));
          if (boxes.length) targets.push({ mode: 'after', el: boxes[boxes.length - 1] });
        }
      }
      if (!manual.length && !targets.length) return;

      getJson(API + '?url=' + encodeURIComponent(pageUrl()))
        .then(function (data) {
          if (!data || !data.found || !data.product) return;
          injectCss();
          var html = cardHtml(data.product);
          manual.forEach(function (holder) {
            holder.innerHTML = '';
            var box = makeBox();
            box.innerHTML = html;
            holder.appendChild(box);
          });
          targets.forEach(function (t) {
            var box = makeBox();
            box.innerHTML = html;
            if (t.mode === 'after') t.el.parentNode.insertBefore(box, t.el.nextSibling);
            else t.el.appendChild(box);
          });
        })
        .catch(function () {});
    }

    function renderBanners() {
      var holders = Array.prototype.slice.call(document.querySelectorAll('[data-onahomemo="banner"], [data-onahomemo="stats"]'));
      if (!holders.length) return;
      getJson(API + '?type=banner')
        .then(function (data) {
          if (!data) return;
          injectCss();
          holders.forEach(function (holder) {
            holder.innerHTML = '';
            var box = makeBox('om-banner');
            box.innerHTML = holder.getAttribute('data-onahomemo') === 'stats' ? statsBannerHtml(data) : featuresBannerHtml(data);
            holder.appendChild(box);
          });
        })
        .catch(function () {});
    }

    function run() {
      try {
        renderCards();
        renderBanners();
      } catch (e) {
        /* オナ王側の表示には影響させない */
      }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
  } catch (e) {
    /* 何もしない */
  }
})();
