/*
 * オナホめも 埋め込みスクリプト(オナ王 ona-king.com 用) 2026-09-08
 *
 * オナ王側(WordPress / Luxeritas)に次の1行を入れると動く:
 *   <script src="https://onahomemo.com/embed/onaking.js" async></script>
 *
 * やること:
 *   1. 個別記事ページ(body.single-post)では、記事URLをオナホめものAPI(/api/onaking-card)に
 *      問い合わせ、対応する商品があれば「オナホめもで価格比較・レビュー」カードを
 *      「販売サイト一覧」ボックス(.item-box)の直後に差し込む。記事末尾にボックスが無ければ
 *      本文の末尾にも1つ足す。対応する商品が無い記事では何もしない。
 *   2. <div data-onahomemo="banner"></div> を置いた場所(トップページのウィジェット等)に、
 *      値下がり速報・人気商品つきのバナーを描画する。
 *   3. <div data-onahomemo="card"></div> を置いた場所にもカードを描画する(手動配置用)。
 *
 * scriptタグの data-* 属性で調整できる(省略時は括弧内の既定値):
 *   data-after="<CSSセレクタ>"   カードを直後に差し込む要素(".item-box")
 *   data-content="<CSSセレクタ>" 記事本文の入れ物(末尾追加用。"#mainEntity > .clearfix")
 *   data-no-auto="1"             自動差し込みをしない(data-onahomemo の場所にだけ描画)
 *
 * 失敗しても(オナホめもが落ちている等)オナ王の表示には一切影響しないよう、全体を try で包む。
 */
(function () {
  'use strict';
  try {
    var ORIGIN = 'https://onahomemo.com';
    var API = ORIGIN + '/api/onaking-card';
    var script = document.currentScript;
    var opts = {
      after: (script && script.getAttribute('data-after')) || '.item-box',
      content: (script && script.getAttribute('data-content')) || '#mainEntity > .clearfix',
      noAuto: !!(script && script.getAttribute('data-no-auto')),
    };

    var CSS =
      '.om-embed{box-sizing:border-box;margin:16px 0;padding:14px;border:1px solid #d9dfe9;border-radius:12px;background:#fff;font-family:inherit;color:#1f1f22;line-height:1.5;box-shadow:0 2px 10px rgba(43,95,173,.08)}' +
      '.om-embed *{box-sizing:border-box}' +
      '.om-head{display:flex;align-items:center;gap:8px;margin:0 0 10px;font-size:13px;color:#4a4a4d}' +
      '.om-logo{display:inline-block;padding:2px 10px;border-radius:999px;background:#2b5fad;color:#fff;font-weight:700;font-size:12px;letter-spacing:.02em;text-decoration:none}' +
      '.om-logo:hover{background:#3f74c4;color:#fff}' +
      '.om-body{display:flex;gap:12px;align-items:flex-start}' +
      '.om-img{flex:0 0 88px;width:88px;height:88px;border-radius:8px;background:#f3f4f7;display:flex;align-items:center;justify-content:center;overflow:hidden}' +
      '.om-img img{max-width:100%;max-height:100%;object-fit:contain}' +
      '.om-main{flex:1;min-width:0}' +
      '.om-name{margin:0;font-size:15px;font-weight:700;line-height:1.35;color:#1f1f22;text-decoration:none;display:block}' +
      '.om-name:hover{color:#2b5fad;text-decoration:underline}' +
      '.om-maker{margin:2px 0 6px;font-size:12px;color:#7a7a80}' +
      '.om-price{margin:0;font-size:13px;color:#4a4a4d}' +
      '.om-price b{font-size:20px;color:#d0342c;margin:0 4px 0 2px}' +
      '.om-shops{margin:6px 0 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:4px 10px;font-size:12px;color:#4a4a4d}' +
      '.om-shops li{white-space:nowrap}' +
      '.om-shops li b{color:#1f1f22;font-weight:600}' +
      '.om-stats{margin:6px 0 0;font-size:12px;color:#7a7a80}' +
      '.om-star{color:#e5a100}' +
      '.om-btn{display:block;margin:12px 0 0;padding:11px 14px;border-radius:8px;background:#2b5fad;color:#fff;text-align:center;font-weight:700;font-size:15px;text-decoration:none;line-height:1.3}' +
      '.om-btn:hover{background:#3f74c4;color:#fff;text-decoration:none}' +
      '.om-btn small{display:block;font-weight:400;font-size:11px;opacity:.9}' +
      '.om-off{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:4px;background:#fdecea;color:#d0342c;font-size:11px;font-weight:700}' +
      '.om-banner .om-title{margin:0 0 4px;font-size:15px;font-weight:700}' +
      '.om-banner .om-desc{margin:0 0 10px;font-size:12px;color:#4a4a4d}' +
      '.om-list{margin:0;padding:0;list-style:none}' +
      '.om-list li{display:flex;gap:8px;align-items:baseline;padding:6px 0;border-top:1px dashed #e2e1de;font-size:13px}' +
      '.om-list li:first-child{border-top:0}' +
      '.om-list a{color:#1f1f22;text-decoration:none;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.om-list a:hover{color:#2b5fad;text-decoration:underline}' +
      '.om-list .om-meta{flex:0 0 auto;font-size:12px;color:#4a4a4d;white-space:nowrap}' +
      '.om-list .om-meta b{color:#d0342c}' +
      '.om-sub{margin:10px 0 4px;font-size:12px;font-weight:700;color:#2b5fad}' +
      '@media (max-width:480px){.om-img{flex-basis:72px;width:72px;height:72px}.om-name{font-size:14px}}';

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

    function cardHtml(p) {
      var shopsHtml = '';
      if (p.shops && p.shops.length > 1) {
        shopsHtml =
          '<ul class="om-shops">' +
          p.shops
            .slice(0, 4)
            .map(function (s) {
              return '<li>' + esc(s.shop) + ' <b>' + yen(s.price) + '</b></li>';
            })
            .join('') +
          (p.shops.length > 4 ? '<li>ほか' + (p.shops.length - 4) + '店舗</li>' : '') +
          '</ul>';
      }
      var priceHtml = '';
      if (p.lowest) {
        priceHtml =
          '<p class="om-price">' +
          (p.shop_count > 1 ? '最安' : '価格') +
          '<b>' +
          yen(p.lowest.price) +
          '</b>' +
          esc(p.lowest.shop) +
          (p.discount_percent ? '<span class="om-off">FANZA ' + p.discount_percent + '%OFF</span>' : '') +
          '</p>';
      }
      var stats = [];
      if (p.rating_count > 0 && p.rating_avg != null) {
        stats.push('<span class="om-star">' + stars(p.rating_avg) + '</span> ' + Number(p.rating_avg).toFixed(1) + '(' + p.rating_count + '件)');
      }
      if (p.used_count > 0) stats.push('使った ' + p.used_count + '人');
      if (p.want_count > 0) stats.push('気になる ' + p.want_count + '人');
      var statsHtml = stats.length ? '<p class="om-stats">' + stats.join('　') + '</p>' : '';
      var url = safeUrl(p.url);
      var btnLabel = p.shop_count > 1 ? p.shop_count + '店舗の価格を比較する' : 'オナホめもで詳しく見る';
      return (
        '<div class="om-head"><a class="om-logo" href="' + esc(ORIGIN + '/?utm_source=onaking&utm_medium=embed') + '" target="_blank" rel="noopener">オナホめも</a>' +
        '<span>ショップ別の価格比較・みんなの使用記録</span></div>' +
        '<div class="om-body">' +
        '<a class="om-img" href="' + esc(url) + '" target="_blank" rel="noopener">' +
        (safeImg(p.image) ? '<img src="' + esc(p.image) + '" alt="" loading="lazy">' : '') +
        '</a>' +
        '<div class="om-main">' +
        '<a class="om-name" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(p.name) + '</a>' +
        (p.maker ? '<p class="om-maker">' + esc(p.maker) + '</p>' : '') +
        priceHtml +
        shopsHtml +
        statsHtml +
        '</div></div>' +
        '<a class="om-btn" href="' + esc(url) + '" target="_blank" rel="noopener">' +
        esc(btnLabel) +
        ' ▶<small>レビュー・使った人の評価も見られます</small></a>'
      );
    }

    function bannerHtml(data) {
      var site = data.site || {};
      var html =
        '<div class="om-head"><a class="om-logo" href="' + esc(safeUrl(site.url)) + '" target="_blank" rel="noopener">オナホめも</a>' +
        '<span>オナホの価格比較・使用記録サイト</span></div>' +
        '<p class="om-title">8つのショップの価格を一度に比較</p>' +
        '<p class="om-desc">FANZA・NLS・大魔王・信長トイズなどの価格を商品ごとに比較。使った記録やレビューも残せます。</p>';
      if (data.drops && data.drops.length) {
        html +=
          '<p class="om-sub">値下がり速報(7日以内)</p><ul class="om-list">' +
          data.drops
            .map(function (d) {
              return (
                '<li><a href="' + esc(safeUrl(d.url)) + '" target="_blank" rel="noopener">' + esc(d.name) + '</a>' +
                '<span class="om-meta">' + esc(d.shop) + ' <b>' + yen(d.new_price) + '</b> (' + d.drop_percent + '%↓)</span></li>'
              );
            })
            .join('') +
          '</ul>';
      } else if (data.popular && data.popular.length) {
        html +=
          '<p class="om-sub">いま気になられている商品</p><ul class="om-list">' +
          data.popular
            .map(function (p) {
              return (
                '<li><a href="' + esc(safeUrl(p.url)) + '" target="_blank" rel="noopener">' + esc(p.name) + '</a>' +
                '<span class="om-meta">気になる ' + p.want_count + '人</span></li>'
              );
            })
            .join('') +
          '</ul>';
      }
      html +=
        '<a class="om-btn" href="' + esc(safeUrl(site.sale_url || site.url)) + '" target="_blank" rel="noopener">セール中・値下がり商品を見る ▶<small>オナホめも onahomemo.com</small></a>';
      return html;
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

    function renderCards() {
      var manual = Array.prototype.slice.call(document.querySelectorAll('[data-onahomemo="card"]'));
      var isSingle = document.body && /(^|\s)single-post(\s|$)/.test(document.body.className);
      var targets = [];
      if (!opts.noAuto && isSingle) {
        var boxes = Array.prototype.slice.call(document.querySelectorAll(opts.after));
        boxes.forEach(function (b) {
          targets.push({ mode: 'after', el: b });
        });
        var content = document.querySelector(opts.content);
        if (content) {
          var lastBox = boxes[boxes.length - 1];
          var h2s = Array.prototype.slice.call(content.querySelectorAll('h2'));
          var needsTail =
            !lastBox ||
            h2s.some(function (h) {
              return !!(lastBox.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING);
            });
          if (needsTail) targets.push({ mode: 'append', el: content });
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
      var holders = Array.prototype.slice.call(document.querySelectorAll('[data-onahomemo="banner"]'));
      if (!holders.length) return;
      getJson(API + '?type=banner')
        .then(function (data) {
          if (!data) return;
          injectCss();
          holders.forEach(function (holder) {
            holder.innerHTML = '';
            var box = makeBox('om-banner');
            box.innerHTML = bannerHtml(data);
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
