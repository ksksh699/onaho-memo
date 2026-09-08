import { h, starString, formatYen, brandBar, COLORS, OG_WIDTH, OG_HEIGHT } from './ogImage.js';

// 商品シェア画像のレイアウト(純粋な関数。DBアクセスなし)。
// src/pages/og/product/[id].png.js から使う。テストしやすいように分離している。

// 価格比較に載せているショップ(products/[id].astro の SHOP_DEFS と同じ並び)
const SHOPS = [
  { name: 'FANZA', priceField: 'price' },
  { name: 'ぴゅあらば', priceField: 'pyuarabu_price' },
  { name: 'NLS', priceField: 'nls_price' },
  { name: '大魔王', priceField: 'daimaoh_price' },
  { name: 'M-ZAKKA', priceField: 'mzakka_price' },
  { name: 'ホットパワーズ', priceField: 'hotpowers_price' },
  { name: '信長トイズ', priceField: 'nobunagatoys_price' },
  { name: 'エムズ', priceField: 'ems_price' },
];

export function largeImageUrl(product) {
  const raw = product.raw_data ?? {};
  const list = raw.imageURL?.list ?? product.image_url;
  if (!list) return null;
  // 一覧用(pt.jpg)より大きい画像(pl.jpg)を優先し、無ければ元のURLにフォールバックする
  return list.replace(/pt\.jpg(\?.*)?$/, 'pl.jpg$1');
}

export function buildProductCard({ product, stats, imageDataUrl }) {
  const shopPrices = SHOPS.map((s) => ({ name: s.name, price: product[s.priceField] }))
    .filter((s) => s.price != null && Number(s.price) > 0)
    .map((s) => ({ ...s, price: Number(s.price) }));
  const cheapest = shopPrices.length > 0 ? shopPrices.reduce((a, b) => (b.price < a.price ? b : a)) : null;
  const listPrice = product.raw_data?.prices?.list_price ? Number(product.raw_data.prices.list_price) : null;
  const discountPercent =
    listPrice && product.price && listPrice > product.price ? Math.round((1 - product.price / listPrice) * 100) : null;

  const ratingAvg = stats?.site_rating_avg != null ? Number(stats.site_rating_avg) : null;
  const ratingCount = Number(stats?.site_rating_count ?? 0);
  const usedCount = Number(stats?.used_count ?? 0);
  const wantCount = Number(stats?.want_count ?? 0);

  const imageBox = h(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 380,
        height: 430,
        borderRadius: 20,
        background: '#fff',
        border: `2px solid ${COLORS.border}`,
        overflow: 'hidden',
        flexShrink: 0,
      },
    },
    imageDataUrl
      ? h('img', {
          src: imageDataUrl,
          style: { width: 340, height: 400, objectFit: 'contain' },
        })
      : h('div', { style: { display: 'flex', fontSize: 28, color: COLORS.muted } }, 'No Image')
  );

  const ratingRow = h(
    'div',
    { style: { display: 'flex', alignItems: 'center', gap: 14, marginTop: 18 } },
    h('div', { style: { display: 'flex', fontSize: 34, color: COLORS.gold, letterSpacing: 2 } }, starString(ratingAvg)),
    ratingCount > 0
      ? h(
          'div',
          { style: { display: 'flex', fontSize: 26, color: COLORS.text, fontWeight: 700 } },
          `${ratingAvg.toFixed(1)}`,
          h('span', { style: { fontSize: 20, color: COLORS.muted, marginLeft: 8, fontWeight: 400 } }, `(${ratingCount}件の評価)`)
        )
      : h('div', { style: { display: 'flex', fontSize: 20, color: COLORS.muted } }, 'オナホめも評価はまだありません')
  );

  const priceBlock = cheapest
    ? h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', marginTop: 22 } },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'flex-end', gap: 14 } },
          h(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                padding: '4px 14px',
                borderRadius: 999,
                background: COLORS.sale,
                color: '#fff',
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 10,
              },
            },
            shopPrices.length > 1 ? '最安' : '価格'
          ),
          h('div', { style: { display: 'flex', fontSize: 56, fontWeight: 700, color: COLORS.accent, lineHeight: 1 } }, formatYen(cheapest.price)),
          h('div', { style: { display: 'flex', fontSize: 22, color: COLORS.muted, marginBottom: 8 } }, `${cheapest.name}(税込)`)
        ),
        h(
          'div',
          { style: { display: 'flex', gap: 18, marginTop: 10, fontSize: 20, color: COLORS.muted } },
          shopPrices.length > 1 ? h('div', { style: { display: 'flex' } }, `${shopPrices.length}ショップで価格比較`) : null,
          discountPercent ? h('div', { style: { display: 'flex', color: COLORS.sale, fontWeight: 700 } }, `FANZA ${discountPercent}%OFF(定価${formatYen(listPrice)})`) : null
        )
      )
    : h('div', { style: { display: 'flex', marginTop: 22, fontSize: 22, color: COLORS.muted } }, '価格情報なし');

  const statsRow = h(
    'div',
    { style: { display: 'flex', gap: 22, marginTop: 'auto', fontSize: 20, color: COLORS.muted } },
    h('div', { style: { display: 'flex' } }, `使った人 ${usedCount}人`),
    h('div', { style: { display: 'flex' } }, `気になる ${wantCount}人`)
  );

  const textCol = h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, height: 430 } },
    h('div', { style: { display: 'flex', fontSize: 24, color: COLORS.muted, fontWeight: 700 } }, product.maker ?? ''),
    h(
      'div',
      {
        style: {
          // satoriの lineClamp は block 要素にだけ効く(flexだと無視される)
          display: 'block',
          fontSize: 40,
          fontWeight: 700,
          lineHeight: 1.3,
          color: COLORS.text,
          marginTop: 6,
          lineClamp: 3,
        },
      },
      product.name
    ),
    ratingRow,
    priceBlock,
    statsRow
  );

  return h(
    'div',
    {
      style: {
        display: 'flex',
        width: OG_WIDTH,
        height: OG_HEIGHT,
        background: COLORS.bg,
        fontFamily: 'Noto Sans JP',
        position: 'relative',
      },
    },
    h(
      'div',
      { style: { display: 'flex', gap: 44, padding: '56px 56px 0 56px', width: OG_WIDTH } },
      imageBox,
      textCol
    ),
    brandBar('onahomemo.com で価格比較・レビュー')
  );
}

