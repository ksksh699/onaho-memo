import { supabase } from './supabase.js';

// 通知機能: 「自分が建てたスレッドにコメントがついた」「自分のレビュー/コメントに
// 反応(コメント・いいね)があった」ことに気づけるよう、全ページ共通ヘッダーに
// 鈴アイコン+未読件数バッジを表示する。
//
// notifications テーブルへの書き込みはSupabase側のDBトリガー(SECURITY DEFINER関数)が
// 行っており、クライアント側からは一切insertしない(自分以外のユーザー宛てに行が
// 書き込めてしまうと不正なので、あえてRLSでinsertを許可していない)。
// クライアント側の役割は「自分宛ての通知を読む」「既読にする」の2つだけ。
//
// type別の内訳:
//   board_reply     … 自分が建てた掲示板スレッドに誰かが返信した
//   review_comment  … 自分のレビューに誰かがコメントした/自分が既にコメント済みの
//                      レビューに他の人がさらにコメントした
//   review_like     … 自分のレビューに誰かが「いいね」した
//   follow          … 自分が誰かにフォローされた
//   sale            … 自分が「気になる」に登録している商品がセールになった
//                      (sale_watchテーブルへのinsertトリガーで検知。1時間ごとのバッチ)

const NOTIFY_LIMIT = 20;

async function fetchRawNotifications(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, actor_id, type, thread_id, check_id, product_id, is_read, created_at')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(NOTIFY_LIMIT);

  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
}

async function getUnreadCount(userId) {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error(error);
    return 0;
  }
  return count ?? 0;
}

// notifications・profiles・checks・products・board_threadsの間には外部キー関係が
// 無いため(このプロジェクトの他のテーブルと同じ事情)、埋め込みselectではなく
// 手動で関連データをまとめて取得して結合する。
async function enrichNotifications(rows) {
  if (rows.length === 0) return [];

  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))];
  const threadIds = [...new Set(rows.filter((r) => r.type === 'board_reply').map((r) => r.thread_id).filter(Boolean))];
  const checkIds = [
    ...new Set(rows.filter((r) => r.type === 'review_comment' || r.type === 'review_like').map((r) => r.check_id).filter(Boolean)),
  ];

  const [profilesResult, threadsResult, checksResult] = await Promise.all([
    actorIds.length > 0
      ? supabase.from('profiles').select('id, nickname').in('id', actorIds)
      : Promise.resolve({ data: [] }),
    threadIds.length > 0
      ? supabase.from('board_threads').select('id, title').in('id', threadIds)
      : Promise.resolve({ data: [] }),
    checkIds.length > 0
      ? supabase.from('checks').select('id, product_id').in('id', checkIds)
      : Promise.resolve({ data: [] }),
  ]);

  const nicknameByUserId = {};
  for (const p of profilesResult.data ?? []) nicknameByUserId[p.id] = p.nickname;

  const titleByThreadId = {};
  for (const t of threadsResult.data ?? []) titleByThreadId[t.id] = t.title;

  const productIdByCheckId = {};
  const productIdSet = new Set();
  for (const c of checksResult.data ?? []) {
    productIdByCheckId[c.id] = c.product_id;
    productIdSet.add(c.product_id);
  }
  for (const r of rows) {
    if (r.type === 'sale' && r.product_id) productIdSet.add(r.product_id);
  }

  let productById = {};
  if (productIdSet.size > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('id, name, dmm_content_id')
      .in('id', [...productIdSet]);
    for (const p of products ?? []) productById[p.id] = p;
  }

  return rows.map((r) => {
    const actorName = nicknameByUserId[r.actor_id] ?? '削除されたユーザー';
    let text = '';
    let href = '/';

    if (r.type === 'board_reply') {
      const title = titleByThreadId[r.thread_id] ?? 'スレッド';
      text = `${actorName}さんがあなたのスレッド「${title}」にコメントしました`;
      href = `/board/${r.thread_id}/`;
    } else if (r.type === 'follow') {
      text = `${actorName}さんにフォローされました`;
      href = r.actor_id && nicknameByUserId[r.actor_id] ? `/users/${encodeURIComponent(nicknameByUserId[r.actor_id])}` : '/mypage';
    } else if (r.type === 'sale') {
      const product = productById[r.product_id];
      const productName = product?.name ?? '気になる商品';
      text = `「${productName}」がセール中です`;
      href = product?.dmm_content_id ? `/products/${product.dmm_content_id}/` : '/mypage';
    } else {
      const productId = productIdByCheckId[r.check_id];
      const product = productById[productId];
      const productName = product?.name ?? '商品';
      href = product?.dmm_content_id ? `/products/${product.dmm_content_id}/` : '/mypage';

      if (r.type === 'review_comment') {
        text = `${actorName}さんが「${productName}」のレビューにコメントしました`;
      } else if (r.type === 'review_like') {
        text = `${actorName}さんが「${productName}」のレビューに「いいね」しました`;
      }
    }

    return { ...r, text, href };
  });
}

function timeAgoLabel(isoDate) {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'たった今';
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;
  return new Date(isoDate).toLocaleDateString('ja-JP');
}

function bellSvg() {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>`;
}

function notificationItemHtml(n) {
  return `
    <a href="${n.href}" class="notify-item ${n.is_read ? '' : 'notify-item-unread'}" data-notify-id="${n.id}">
      <p class="notify-item-text">${n.text}</p>
      <p class="notify-item-time">${timeAgoLabel(n.created_at)}</p>
    </a>
  `;
}

export async function mountNotifyArea(container) {
  if (!container) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    container.innerHTML = '';
    return;
  }

  const userId = session.user.id;

  container.innerHTML = `
    <div class="notify-wrap">
      <button type="button" class="notify-bell-btn" id="notify-bell-btn" aria-label="通知">
        ${bellSvg()}
        <span class="notify-badge" id="notify-badge" hidden>0</span>
      </button>
      <div class="notify-dropdown" id="notify-dropdown" hidden>
        <p class="notify-dropdown-title">通知</p>
        <div class="notify-list" id="notify-list">
          <p class="notify-empty">読み込み中...</p>
        </div>
      </div>
    </div>
  `;

  const wrap = container.querySelector('.notify-wrap');
  const bellBtn = container.querySelector('#notify-bell-btn');
  const badge = container.querySelector('#notify-badge');
  const dropdown = container.querySelector('#notify-dropdown');
  const list = container.querySelector('#notify-list');

  function setBadge(count) {
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  setBadge(await getUnreadCount(userId));

  let loaded = false;

  async function openDropdown() {
    dropdown.hidden = false;

    if (!loaded) {
      loaded = true;
      const raw = await fetchRawNotifications(userId);
      const enriched = await enrichNotifications(raw);

      list.innerHTML =
        enriched.length > 0
          ? enriched.map((n) => notificationItemHtml(n)).join('')
          : `<p class="notify-empty">通知はまだありません</p>`;

      const unreadIds = raw.filter((r) => !r.is_read).map((r) => r.id);
      if (unreadIds.length > 0) {
        const { error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .in('id', unreadIds);
        if (!error) {
          setBadge(0);
          list.querySelectorAll('.notify-item-unread').forEach((el) => el.classList.remove('notify-item-unread'));
        }
      }
    }
  }

  function closeDropdown() {
    dropdown.hidden = true;
  }

  bellBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dropdown.hidden) {
      openDropdown();
    } else {
      closeDropdown();
    }
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) closeDropdown();
  });
}
