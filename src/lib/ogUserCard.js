import { h, brandBar, COLORS, OG_WIDTH, OG_HEIGHT } from './ogImage.js';

// 公開プロフィール用シェア画像のレイアウト(純粋な関数。DBアクセスなし)。
// src/pages/og/user/[nickname].png.js から使う。
//   左: アバター・ニックネーム・推しメーカー・使った数/レビュー数
//   右: マイベストTOP3(順位・商品画像・商品名)
// 「自分のTOP3をXでシェアする」動機になるよう、TOP3を主役にしている。

const RANK_LABELS = ['1位', '2位', '3位'];

function top3Slot(rank, slot) {
  const base = {
    display: 'flex',
    flexDirection: 'column',
    width: 200,
    height: 330,
    borderRadius: 18,
    background: '#fff',
    border: `2px solid ${slot ? COLORS.accent : COLORS.border}`,
    padding: 14,
  };
  if (!slot) {
    return h(
      'div',
      { style: { ...base, alignItems: 'center', justifyContent: 'center' } },
      h('div', { style: { display: 'flex', fontSize: 20, fontWeight: 700, color: COLORS.muted } }, RANK_LABELS[rank]),
      h('div', { style: { display: 'flex', fontSize: 16, color: COLORS.muted, marginTop: 6 } }, '未選択')
    );
  }
  return h(
    'div',
    { style: base },
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 8 } },
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2px 10px',
            borderRadius: 999,
            background: rank === 0 ? COLORS.gold : COLORS.accent,
            color: '#fff',
            fontSize: 18,
            fontWeight: 700,
          },
        },
        RANK_LABELS[rank]
      )
    ),
    h(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 168,
          height: 168,
          marginTop: 10,
          borderRadius: 12,
          background: COLORS.bg,
          overflow: 'hidden',
        },
      },
      slot.imageDataUrl
        ? h('img', { src: slot.imageDataUrl, style: { width: 160, height: 160, objectFit: 'contain' } })
        : h('div', { style: { display: 'flex', fontSize: 16, color: COLORS.muted } }, 'No Image')
    ),
    h('div', { style: { display: 'flex', fontSize: 14, color: COLORS.muted, marginTop: 10 } }, slot.maker ?? ''),
    h(
      'div',
      {
        style: {
          display: 'block',
          fontSize: 17,
          fontWeight: 700,
          lineHeight: 1.35,
          color: COLORS.text,
          marginTop: 2,
          lineClamp: 2,
        },
      },
      slot.name
    )
  );
}

export function buildUserCard({ profile, avatarDataUrl, top3, usedCount, reviewCount }) {
  const avatar = h(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 120,
        height: 120,
        borderRadius: 60,
        background: COLORS.accent,
        overflow: 'hidden',
        color: '#fff',
        fontSize: 48,
        fontWeight: 700,
        flexShrink: 0,
      },
    },
    avatarDataUrl
      ? h('img', { src: avatarDataUrl, style: { width: 120, height: 120, objectFit: 'cover' } })
      : (profile.nickname ?? '?').slice(0, 1)
  );

  const left = h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', width: 380, flexShrink: 0 } },
    avatar,
    h(
      'div',
      {
        style: {
          display: 'block',
          fontSize: 40,
          fontWeight: 700,
          color: COLORS.text,
          marginTop: 18,
          lineHeight: 1.25,
          lineClamp: 2,
        },
      },
      profile.nickname
    ),
    h('div', { style: { display: 'flex', fontSize: 20, color: COLORS.muted, marginTop: 6 } }, 'のオナホめも'),
    profile.oshi_maker
      ? h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 22 } },
          h('div', { style: { display: 'flex', fontSize: 18, color: COLORS.muted } }, '推しメーカー'),
          h(
            'div',
            {
              style: {
                display: 'flex',
                padding: '4px 14px',
                borderRadius: 999,
                background: COLORS.accent,
                color: '#fff',
                fontSize: 20,
                fontWeight: 700,
              },
            },
            profile.oshi_maker
          )
        )
      : null,
    h(
      'div',
      { style: { display: 'flex', gap: 26, marginTop: 'auto' } },
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column' } },
        h('div', { style: { display: 'flex', fontSize: 44, fontWeight: 700, color: COLORS.accent, lineHeight: 1 } }, String(usedCount)),
        h('div', { style: { display: 'flex', fontSize: 18, color: COLORS.muted, marginTop: 6 } }, '使ったオナホ')
      ),
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column' } },
        h('div', { style: { display: 'flex', fontSize: 44, fontWeight: 700, color: COLORS.accent, lineHeight: 1 } }, String(reviewCount)),
        h('div', { style: { display: 'flex', fontSize: 18, color: COLORS.muted, marginTop: 6 } }, 'レビュー')
      )
    )
  );

  const right = h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', flex: 1 } },
    h('div', { style: { display: 'flex', fontSize: 24, fontWeight: 700, color: COLORS.accent } }, 'マイベストTOP3'),
    h(
      'div',
      { style: { display: 'flex', gap: 16, marginTop: 14 } },
      top3Slot(0, top3[0]),
      top3Slot(1, top3[1]),
      top3Slot(2, top3[2])
    )
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
    h('div', { style: { display: 'flex', gap: 40, padding: '56px 56px 0 56px', width: OG_WIDTH, height: 558 } }, left, right),
    brandBar('onahomemo.com')
  );
}
