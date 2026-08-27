import { supabase } from './supabase.js';

// サイト共通ヘッダーの右上に置く、小さなログイン状態表示エリアを描画する。
// トップページの大きなヒーローCTA(#hero-actions / #auth-area)とは別物で、
// 全ページ共通のナビゲーションバー(SiteHeader.astro)から呼び出される。
export async function mountAuthArea(container) {
  if (!container) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    container.innerHTML = `<a href="/login" class="site-auth-login">ログイン</a>`;
    return;
  }

  let mypageHref = '/mypage';
  let label = session.user.email ?? 'マイページ';

  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('id', session.user.id)
    .maybeSingle();

  if (profile?.nickname) {
    mypageHref = `/users/${encodeURIComponent(profile.nickname)}`;
    label = profile.nickname;
  }

  container.innerHTML = `
    <a href="${mypageHref}" class="site-auth-name">${label}</a>
    <button type="button" class="site-auth-logout">ログアウト</button>
  `;

  const logoutBtn = container.querySelector('.site-auth-logout');
  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    mountAuthArea(container);
  });
}
