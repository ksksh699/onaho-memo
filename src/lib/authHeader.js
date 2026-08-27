import { supabase } from './supabase.js';

// ヘッダー/フッターの「マイページ」リンクの遷移先を解決する。
// ログイン済みでニックネーム設定済みなら公開プロフィールページへ、
// それ以外(未ログイン・ニックネーム未設定)は/mypageへ(ログイン導線や
// ニックネーム設定導線を持つため、フォールバック先として適切)。
export async function getMypageHref() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return '/mypage';

  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('id', session.user.id)
    .maybeSingle();

  if (profile?.nickname) {
    return `/users/${encodeURIComponent(profile.nickname)}`;
  }

  return '/mypage';
}

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
