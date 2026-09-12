# オナホめも 引き継ぎメモ(Claude 用)

新しいチャットを始めるとき、このファイルの内容を最初のメッセージに貼るか、
「C:\projects\onahole-site\CLAUDE_HANDOVER.md を読んでから始めて」と伝える。
最終更新: 2026-09-12

---

## 1. サイトと構成

- **オナホめも** https://onahomemo.com — オナホールの価格比較・レビュー・使用記録サイト(公式X: @onahomemo)
- 姉妹サイト **オナ王** https://ona-king.com — WordPress(Luxeritas)。管理者は「てぃんこ」。オナホめもへの導線(埋め込みカード・バナー)を設置済み
- フロント: Astro + @astrojs/vercel、Vercel(リージョン hnd1)。GitHub `ksksh699/onaho-memo` の main に push すると自動デプロイ
  - ローカル: `C:\projects\onahole-site`(Claude はファイルを書くだけ。**git add / commit / push は自分でやる**)
  - CDNキャッシュ: `public, max-age=0, s-maxage=N, stale-while-revalidate` + `Vary: Cookie`。`middlewareMode: 'edge'` は使わない
  - 年齢確認ゲート: `src/middleware.js`(cookie `age_verified=1`)。静的ファイル・`/_astro/`・`/api/`・GET以外・ボットは対象外
- DB: Supabase プロジェクト `tdhrnsuwsqgoqbhomxqv`(ap-northeast-1)。Claude は **Supabase MCP の execute_sql / apply_migration** で読み書きする
  - anon キーは公開前提(サイトJSに埋め込み済み)。RLS あり。サービスロールキーは onahole-db の .env(gitignore)にのみ
  - **Supabase のキーをブラウザJSに渡さない**
- 商品データ更新: `C:\projects\onahole-db`(GitHub Actions `update-products`、毎週月曜 12:00 JST。FANZA API から取り込み)。手動実行は GitHub → Actions → Run workflow
  - 実行サマリーに「ショップリンク欠けレポート」が出る(`v_shop_link_gaps` ビュー由来)
  - M-ZAKKA のカタログ巡回は `C:\projects\onahole-db\mzakka_crawl.py` → `mzakka_catalog.csv`

## 2. DB の主なテーブル・関数

- `products`: dmm_content_id(URL末尾。`storeago…`=FANZA通販の海外製汎用品、`manual-…`=手動追加品)、name、maker、price(FANZA税込。手動追加品は各ショップ価格の最小値)、affiliate_url(FANZA。手動追加品は NULL)、release_date、genre_tags、raw_data
  - ショップ列: `{shop}_url / {shop}_price / {shop}_matched_at / {shop}_checked_at`。shop = nls / daimaoh / nobunagatoys / pyuarabu / ems(エムズ) / hotpowers / mzakka
- `products_with_stats` ビュー(want_count, used_count, site_rating_avg, monthly_view_count)、`v_products_listing`、`v_recent_price_drops`、`v_shop_link_gaps`、`v_shop_price_outliers`
- `checks`(ユーザーの記録・レビュー)、`profiles`(nickname, is_public, sns_links)、`access_logs`、`x_post_log`、`shop_price_checks`
- カタログキャッシュ: `nls_catalog_cache`(pcode)、`daimaoh_catalog_cache`(item_num)、`nobunagatoys_catalog_cache`、`pyuarabu_catalog_cache`、`hotpowers_catalog_cache`、`ms_catalog_cache`(pid=パス+?pclass_id=)、`mzakka_catalog_cache`(M+数字)
  - **絶対に DROP / TRUNCATE / DELETE しない。更新は UPSERT のみ**
- `shop_product_ids`(product_id, shop, shop_pid): 自社商品 ↔ 各ショップの商品ID の対応表。`shop_sales` と products を突き合わせるのに使う(8章)
- `shop_sales`(shop, shop_pid, …, is_active): 他ショップのセール巡回結果。PK(shop, shop_pid)(8章)
- `shop_runbook`: ショップごとの手順書(巡回方法・名寄せ段階・既知リスク・URLテンプレート)。ショップ作業の前に必ず読む
- 名寄せ関数: `norm_name`(全角英数字→半角、先頭の【…】除去、2026-09-11 から記号ゆれ 〜/～ ！/! （）/() ［］/[] ・/･ －/- ：/: も統一)→ `norm_name2` → `deep_norm` の順に緩くなる
- pg_cron: `refresh-stats-cache-hourly`(`refresh_stats_cache()`)、`refresh-sale-watch-hourly`
- セール判定: genre_tags に `['セール','特価','祭','キャンペーン','OFF','割引']` のいずれかを含む(index.astro / listing.js / sitemap.xml.js)。FANZAのキャンペーン名が変わってもこの語を含んでいればコード変更不要。変わったら `select public.refresh_stats_cache();` を手動実行

## 3. アフィリエイト(厳守)

| ショップ | 方式 | URL形式 |
|---|---|---|
| NLS | URLテンプレート | `https://www.e-nls.com/access.php?agency_id=af952539-mem&pcode={pcode}`(pcode は数字・英数字どちらもある) |
| 通販大魔王 | URLテンプレート | `https://daimaoh.co.jp/jump/zl361209-ohm/item{item_num}/` |
| 信長トイズ | e-click(オナホめも媒体ID 33655) | `https://www.e-click.jp/redirects/direct/33655/4171/?url=https%3A//www.nobunaga-toys.com/%3Fpid%3D{pid}`(オナ王は 32080/4171。混同しない) |
| ぴゅあらば / エムズ / ホットパワーズ | BannerBridge(proID: ぴゅあらば 19817、エムズ 17577) | `https://track.bannerbridge.net/clickprod.php?adID={adID}&affID=96868&siteID=218939` |
| M-ZAKKA | afb(PID 11282、サイト 991597) | `https://t.afi-b.com/visit.php?a=x112829-{code}&p=Y9915974` |

- **BannerBridge のサイトIDは必ず 218939(オナホめも)。187709(オナ王)は絶対に使わない**。管理画面 https://admin.bannerbridge.net/af/links_prod_list/list は開くたびに右上 `#siteIDSelect` が 187709 に戻っていることが多いので、作業前に必ず 218939 に切り替える(切替・再読み込みのたびにプログラムも再選択)
  - 作成手順: プログラム選択 →「テキストリンクを作成」タブ → `#linkURL_text` に商品ページURL、`#linkText_text` に dmm_content_id → 「作成」(`#button2`)をクリック。事前に `window.alert` を「メッセージを配列に貯める関数」に差し替えておくと固まらずに結果を読める。作成後はページ再読み込み → プログラム再選択 → DataTable(`$('table.dataTable').DataTable().data()`)の URL↔adID から adID を取る(html/tagcopy には触れない)。JSの戻り値に `? = &` を含むURLを入れると安全フィルタでブロックされるので **adID の数字だけ返す**
- afb(M-ZAKKA): https://www.afi-b.com/pa/promodetail/?adv_id=11282&s=991597&page=item の「バナー・リンク作成」に `https://mzakka.com/pc/detail/item.php?item_id={pid}` とテキスト(dmm_content_id)を入れて「リンクコード作成」。直後にフォーム下のテキストエリアに出る `a=x112829-{code}` を読む。**クリックは直前にスクリーンショットを撮ってから座標クリック**(ref クリックは効かないことがある)。`www.mzakka.com` は使わない(`mzakka.com`)
- リンク作成は画面操作で行う。JSからの XHR / fetch / $.ajax 直接送信は禁止(フォーム値をJSで入れてページのボタンを押すのは可)
- **自分のアフィリエイトURL(track.bannerbridge.net / t.afi-b.com / e-click.jp / e-nls.com access.php)をクリック・fetch しない**(自己クリック)
- **ログイン・パスワード入力は代行しない**。セッション切れなら候補を報告して再ログインを頼む
- 名寄せは価格比 0.6〜1.6 と既存マッチとの衝突チェック必須。サイズ・色・世代・DVD同梱・FANZA限定・数量限定版は別商品。曖昧なら書かずに報告
  - エムズの「【数量限定版】○○」は norm_name で通常版「○○」と同じキーになる。自社側に両方あるときは 通常版↔TMT-、限定版↔TAMS- と目視で当てる
- **ショップごとに価格が違うのはバグではない**(FANZAは在庫限り品が高騰、リグレジャパンは信長が特売)。価格差だけを理由に書き換え・削除しない。「希望小売価格」を実売と取り違えない
- 同じ products 行に複数ショップを書くときは UPDATE 文をショップごとに分ける(1文の複数CTEで同じ行を2回更新すると片方が黙って無視される)
- **オナ王側の埋め込みの置き場所(2026-09-12 確定)**: 記事ページの自動差し込みは、Luxeritas「子テーマの編集 → フッター」(add-footer.php)末尾の `<script src="https://onahomemo.com/embed/onaking.js" async></script>` 1行で動く。**フッターウィジェット(カスタムHTML)に置くとスマホで出ない**(Luxeritas の hide_mobile_footer=true でモバイルはフッターウィジェット領域ごと非出力)。トップページのバナーは固定ページ本文(page-12127)に直接。記事ごとの手動配置はパターン「オナホめも記事内リンク」(wp_block 44674)。オナ王記事↔商品の対応表は `onaking_links`
- 埋め込みカード(public/embed/onaking.js)は、オナ王テーマの `#mainEntity a`(下線)/`#mainEntity p`(段落余白)に負けるため、text-decoration・color・margin・line-height に !important を付けている。スマホ幅は画像枠 92×124・上揃え・影なし、商品名は2行で省略。自動差し込み時はカード直前に案内文(`.om-lead`、13px、data-lead-text で変更可)
- Luxeritas の「子テーマの編集」で保存するとき、ブラウザ操作だと「ページを離れますか」の確認で保存が黙って取り消されることがある。window の beforeunload を止めてから submit すると通る

## 4. 定期タスク(Routine。すべて claude-sonnet-5・Supabase MCP)

- `trig_01LHTBRfKmkLqhVDS89Bp7YX` 週次ショップリンク自動マッチング(木曜 06:00 JST)。対象=発売6週間以内 + 古い商品でも norm_name 完全一致候補があるもの。価格の再確認(週20件まで)も含む
- `trig_011eRrWeBLnARwPUpGwcctSE` X投稿文案(毎日 20:00 JST)
- `trig_011wcaFcbWcsunuhxY6kCHwn` 週次アクセス分析(月曜 09:00 JST)
- プロンプト変更は `update_trigger`(削除・再作成しない)

## 5. フロントの主なファイル

- `src/pages/index.astro`(トップ。商品一覧の見出しに件数、絞り込みで「該当 N件 / 全 M件」)、`src/lib/listing.js` + `src/components/ListingToolbar.astro`(セール/メーカー/タグ一覧の絞り込み)
- `src/pages/products/[id].astro`(商品ページ。ショップ一覧は最安・掲載ありを優先表示)
- `src/pages/mypage.astro`(マイページ。TOP3のXシェア促し、使った一覧の検索/並び替え、手動追加商品はショップごとに URL/価格を入力)、`src/pages/users/[nickname].astro`(公開プロフィール)
- `src/pages/signup.astro` / `reset-password.astro` + `src/lib/passwordRules.js`(8文字以上・英字と数字。Supabase Auth 設定と同じ)
- `src/lib/safeUrl.js`(SNSリンクは http/https のみ。DB側にも `profiles_sns_links_safe` 制約)
- `src/pages/api/onaking-card.js` + `public/embed/onaking.js`(オナ王向け埋め込み。`<div data-onahomemo="card|banner|stats">` + `<script src="https://onahomemo.com/embed/onaking.js" async>`。CORS *、10分キャッシュ)
- `src/styles/global.css`

## 6. Claude 側の作業環境メモ

- 用途に応じたモデル: 反復作業・決まった修正・画面操作は Sonnet、原因不明のバグ・設計判断は Opus、取り返しのつかない変更の判断だけ Fable。案件が終わったらチャットを分ける
- ブラウザ操作は Claude in Chrome(ユーザーの実Chrome。WP管理・BannerBridge・afb・NLS にログイン済み)。JSの戻り値にクエリ文字列を含めるとブロックされる
- クラウド側サンドボックスから Supabase REST / onahomemo.com へは直接アクセスできない(DBは MCP、サイト確認は Chrome で)
- ビルド確認: `npm ci` 後 `npm run build`。Vercel アダプタが `public/fonts/NotoSansJP-*.ttf` 不在で失敗するのはローカルのみの問題(コンパイルが通っていればOK)
- 未着手の課題: 非公開プロフィール(is_public=false)が API 経由で読める件(ポリシー変更 + 公開ビュー + nickname 参照箇所の監査)/ GA の `_ga` cookie で CDN キャッシュが効きにくい件

## 7. 直近の状況(2026-09-11〜12)

- FANZA のキャンペーンが「セール開催中」タグに切り替わり、355商品がセール中。コード変更なしで対応済み
- ショップリンク欠けレポート(607件)を確認し、126リンクを追加(欠けは 600件に)。残りの大半は storeago 系(72件)と FANZA独占・限定版
- norm_name の記号ゆれ統一と、木曜ルーチンの対象拡大を実施済み
- 手動追加品「やわらかちゃんのオナホールデビュー」「放課後ノ花外活動」は他店にも在庫があったためリンク追加(price は最安値に更新)
- 9/11 深夜〜12: hole6053(ViViDoll AYAKA)に NLS(pcode 52586)・M-ZAKKA(afb x112829-h7405885_b)を追加。トイズハートの「メーカーセール」タグ反映のため update-products を手動実行(セール中 909件に)。レビュー本文の改行が消える件は `.review-body` に white-space:pre-wrap で修正。セールページ(/sale/)の「最近値下がりした商品」欄を撤去し、ログイン中ユーザーの「気になる」商品のうちセール中のものを上位3件+開閉で表示する欄に置き換え(ブラウザ側スクリプト、checks.status='interested' と v_products_listing)。オナ王カードのスマホ表示を調整(上記3章)

## 8. 他ショップのセール情報の巡回(2026-09-12 ステップ1〜4 すべて完了・稼働中)

じょいさんの要望: FANZA以外のショップのセールも拾いたい。価格ベース(定価比・値下がり履歴)ではなく**巡回方式**で行う(NLSは毎週水曜に新作数本を1週間セール、他店は不定期に数十〜百本)。

### 進捗
1. **対応表 `shop_product_ids`(product_id, shop, shop_pid)**: 完了。NLS 3,659 / 大魔王 2,003 / 信長 3,344 は `{shop}_url` から SQL で抽出、エムズ 2,318 / ホットパワーズ 9,280 / ぴゅあらば 7,525(BannerBridge)と M-ZAKKA 1,761(afb)は管理画面の作成済みリンク一覧から作成。以後リンクを作ったらこの表にも書く。対応表に無いものは norm_name で名寄せして補う
2. **`shop_sales`**: 完了(下記)
3. **巡回スクリプト `crawl-shop-sales.js`**: 完了。6ショップすべて取得できている
   (2026-09-12 初回投入: 大魔王57 / 信長132 / エムズ384 / ホットパワーズ15 / M-ZAKKA347 / NLS3 = **有効939件**。
   うち `shop_product_ids` 経由で自社商品に紐づいたのは **339件(36%)**)
4. **表示**: 完了(2026-09-12)。下記「表示まわり」を参照。
   残件は「気になる」商品の他ショップセール通知のみ(未着手)

### `shop_sales` テーブル
`(shop, shop_pid, name, sale_price, regular_price, discount_percent, sale_label, ends_on, source_url, first_seen_at, last_seen_at, is_active)`、PK(shop, shop_pid)、公開SELECTポリシーあり。
巡回ごとに見つかった行を UPSERT(`last_seen_at` 更新・`is_active=true`、`first_seen_at` は据え置き)、**その巡回で見つからなかった同ショップの行は `is_active=false`。行は削除しない**。`regular_price` / `discount_percent` / `ends_on` はショップによって取れない(NULL)。`shop_pid` は `shop_product_ids.shop_pid` と同じ形式。

### 巡回スクリプト `C:\projects\onahole-db\crawl-shop-sales.js`
```
node crawl-shop-sales.js                  全ショップ巡回・DB更新
node crawl-shop-sales.js --check          疎通確認のみ(DB更新なし・取得可否と件数だけ)
node crawl-shop-sales.js --only=nls,ems   指定ショップだけ
node crawl-shop-sales.js --exclude=mzakka 指定ショップを除外
```
ESM。`.env` を dotenv で読むので PC 実行時は環境変数の指定不要。依存に **cheerio** を追加済み(`package.json`)。

**壊さないための決まり(重要)**:
- HTTPステータスが2xxでない場合と、一覧の枠組み(`ul.pic_list` 等)がページに無い場合は**必ず例外にする**。403やメンテナンスページを「セール0件」と誤認すると、そのショップの既存セール行が全部 `is_active=false` に落ちるため
- 取得に失敗したショップの既存行は**一切触らない**(例外で抜けるので非アクティブ化処理まで到達しない)
- 一部ショップの失敗ではジョブを落とさない(`report-shop-link-gaps.js` と同じ方針)。全ショップ失敗時のみ exit 1
- **文字コードは Content-Type / meta の charset を見てデコードする**(NLS=Shift_JIS、信長トイズ=EUC-JP、他=UTF-8)。
  決め打ちにすると文字化けし、商品名も「通常◯◯円→◯◯円」の抽出も静かに失敗する(実際に一度やらかした)
- ページ送りがあるショップは、取りこぼしたまま成功扱いにしないこと(同上の理由)

### 表示まわり(2026-09-12 実装)
- **商品ページ**(`src/pages/products/[id].astro`): ショップ一覧で、セール中のショップに「SALE 40%OFF 9/19まで」のバッジを出す。
  **価格も巡回で取得したセール価格に差し替える**(`{shop}_price` は週1回の価格確認なのでセール中は古い高い価格のままになるため)。
  「最安」バッジも同じ price を見ているので自動的にセール価格ベースになる。割引率・終了日が取れないショップは「SALE」だけ表示
- **セールページ**(`src/pages/sale/`): FANZAと他ショップを**1つの一覧に統合**。並びの既定は割引率順で、
  FANZAと他ショップの割引率のうち高い方(`best_discount_percent`)を見る。上部にショップ別の絞り込みチップ
  (すべて / FANZA / M-ZAKKA / エムズ / 信長トイズ / ホットパワーズ)。チップは `?shop=` で本体一覧に効く
- **トップページ**(`src/pages/index.astro`): 「セール対象のみ」と「本日のセール対象」件数を同じ判定に統一
- **商品カード**(`ProductCards.astro` とトップの `renderCards`): 他ショップでセール中なら
  ショップ名・セール価格・割引率・終了日の行を追加し、SALEリボンも出す
- 2026-09-12時点の件数: セール中 **638件**(FANZA 413 / 他ショップ 236 / 両方 11)

### DBビュー(表示用)
- `v_product_shop_sales`: shop_sales(is_active) を shop_product_ids 経由で products に紐づけた行。商品ページ用
- `v_shop_sale_by_product`: 上を商品1行に集約(sale_shops / shop_sale_best_discount / shop_sale_min_price / shop_sale_ends_on)
- `products_with_stats` と `v_products_listing` に列を追加:
  `has_shop_sale` / `sale_shops` / `shop_sale_*` / `is_on_sale` / `has_fanza_sale`(+ listing のみ `best_discount_percent`)
  - **`is_on_sale` =「FANZAのセール系タグ OR 他ショップでセール中」**。判定はSQL側の1か所にまとめてあり、JSは列を見るだけ
  - **SQL内のキーワードは `src/lib/listing.js` の `CAMPAIGN_KEYWORDS` と揃えること**(products_with_stats に2か所)
  - 置き換え時に、旧JS判定(タグ一覧をキーワードで絞って overlaps)と同じ結果(413件・差分ゼロ)になることを照合済み

### 運用
- GitHub Actions `.github/workflows/crawl-shop-sales.yml`: 毎日 22:00 UTC(= 翌7:00 JST)。`--exclude=mzakka,daimaoh` で本番巡回、結果は Job Summary の表に。参考情報として M-ZAKKA の `--check` も毎回実行(`continue-on-error`)し、クラウドから通るようになったら気づけるようにしてある。**大魔王は実Chromeが要るので Actions では一切実行しない**
- PC: `run_shop_sales_crawl.bat`(`--only=mzakka,daimaoh`)を run_mzakka_crawl.bat と同じ要領でタスクスケジューラに登録。
  大魔王が画面ありのChromeを使うので **「ユーザーがログオンしているときのみ実行する」**にすること。ログは `shop_sales_crawl_task.log`
  - 2026-09-12 に登録済み。タスク名 **`onahomemo-shop-sales-crawl`**、毎日 8:00、ログオン中のみ、
    8時にPCが起動していなかった場合は起動後に実行(StartWhenAvailable)。所要時間は実測21秒
  - 手動実行は `schtasks /run /tn "onahomemo-shop-sales-crawl"`。時刻変更はタスクスケジューラのトリガータブから
- 依存: `cheerio`(全ショップ)と `playwright-core`(大魔王のみ)。`playwright-core` はブラウザ本体をダウンロードせず、PCの実Chromeを使う。
  `.gitignore` に `.chrome-profile-daimaoh/` と `shop_sales_crawl_task.log` を追加済み

### 各ショップの現状(2026-09-12 実測)
- **NLS(3件)**: https://www.e-nls.com/disp_new.php 。`dl.newitem-list` ごとに `dd.txt-sale` があるものだけがセール。`a[href^="/pict1-{pcode}"]`、`dd.txt-sale`(img alt「期間限定SALE」+ 本文「09/15まで」)、`span.txt_nedan` がセール価格。通常価格は無い。Shift_JIS。**年齢確認は GET → 同URLに `auth18=1` を POST(受け取ったCookieを付ける) → 必要なら再GET**。実測ではPOSTのレスポンスにそのまま本文(183KB)が返る。Cookie無しでいきなりPOSTするとゲートのまま。一度だけ通過に失敗した実績があるため最大3回リトライする実装。「メルマガセール」は要ログインなので対象外。
  **NLSのセールは「発売したての新商品」なので、対応表にまだ無いことが多い**(2026-09-12時点で3件中0件が未マッチ)。
  木曜の自動マッチングルーチンが拾うのを待つ形になる
- **信長トイズ(132件)**: https://www.nobunaga-toys.com/?mode=grp&gid=2398364&sort=n&page={N} 。`a.try-list__link[href="?pid={pid}"]`、**EUC-JP**。`h3.try-list__name` の「【信長限定特価！通常4180円→1505円】商品名」の【】内にしか価格が無い
  (一覧の要素は画像と商品名だけ)。表記が手入力でかなり揺れる(通常価格 / 通常価 / ⇒ / 「22000円相当→10000円」/
  「通常円3080→1257円」)ため、決め打ちの正規表現ではなく **矢印の前の最後の数値=通常価格、後の最初の数値=セール価格** で拾う。
  「限定大特価」「大特価還元祭」など価格を書いていないラベルが約60件あり、それらは sale_price が NULL のままになる
  (表示時は products.nobunagatoys_price で補う想定)
- **エムズ(384件)**: https://www.ms-online.co.jp/sale_bargain?list=1&orderby=2&pageno={N}(24件/ページ)。`.ec-shelfGrid__item`、`shop_pid` は パス+`?pclass_id=`。`.price-off[data-rate]` が割引率、**通常価格は `.price-box` 内の `span.price > s`、セール価格は `span.price02`**(設計時メモの `.price01`→`.price02` は実物と違ったので注意)。商品名は `.h3_title p`、名前に「【期間限定割引～9/19】」があれば終了日として取る
- **ホットパワーズ(15件)**: https://www.hotpowers.jp/ec/sale(1ページ)。`.ec-sale-section li.ec-shelfGrid__item`、`a[href$="/products/detail/{pid}"]`、`.ec-saleBadge__prices` の `<s>`通常・もう片方がセール価格、chip に「27.2%OFF」、商品名は `.ec-sale-grid__title`。入口 https://www.hotpowers.jp/ は年齢確認ページだが /ec/ は直接開ける
- **M-ZAKKA(347件・PCからのみ)**: 「セール!」カテゴリ(st1=1862)は定価より安い全商品なので除外。トップ https://mzakka.com/ から張られている文言に「セール」を含む `category.php` リンクを都度たどる。`li > a[href*="item.php?item_id=M…"]`、`p.price`「9,020円→<strong>5,412円</strong>」。ドメインは www なし。クラウドIPからは取得できないため PC のタスクスケジューラに回す
- **通販大魔王(57件・PC専用)**: https://daimaoh.co.jp/list.php?c=421&sort=price&_page={N}(20件/ページ)。
  `ul.pic_list > li`(`a[href="./item{N}.html"]`、`h3.name span`、`p.price`+`small`税込)。通常価格の表示なし。
  **サイト全体が Cloudflare のボット判定の内側にあり、Node の fetch では全URLが 403(「Just a moment...」)**。
  UA・ヘッダを本物のブラウザに寄せても、PC(日本の家庭用IP)から実行しても同じで、TLS/クライアント指紋での判定。
  そのため `playwright-core` + PCの実Chrome経由で取得する。実測でわかった必須条件:
  - `headless:false`(画面あり)。headless では判定画面から進めない
  - `args:['--disable-blink-features=AutomationControlled']` と `ignoreDefaultArgs:['--enable-automation']`。
    **これが無いと1ページ目は通っても2ページ目で判定画面に入り抜けられない**(実測)
  - 一覧が出るまで `waitForSelector` 一発ではなく数秒おきに見に行く(判定画面は自動リロードされるため)
  - ページ間は5秒あける
  1ページ目の「（57件中1〜20件）」から総件数を読み、**最後に取得件数と照合して足りなければ失敗にする**
  (途中で止まったまま成功扱いにすると、取れなかった商品が is_active=false にされてしまうため)。
  なお **`match-daimaoh.js`(素のfetchでsitemap.xmlを叩く)は同じ理由で現在動かないはず**。
  `daimaoh_catalog_cache` はセール判定には使えない(`【特価】`を含む行が4件しか無く、更新日時の列も無い)
- **ぴゅあらば**: セールページなし(全商品が常に希望小売価格比○%OFF表示)。巡回対象外。price_history の値下がりで代替

