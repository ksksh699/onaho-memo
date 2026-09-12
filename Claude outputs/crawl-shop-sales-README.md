# crawl-shop-sales セットアップメモ

## 配置先
- `crawl-shop-sales.js` → `C:\projects\onahole-db\crawl-shop-sales.js`
- `crawl-shop-sales.yml` → `C:\projects\onahole-db\.github\workflows\crawl-shop-sales.yml`

配置後、`git add / commit / push` は従来どおりご自身でお願いします。

## 必要な作業(このスクリプト固有)

1. **依存パッケージの追加**
   ```
   npm install @supabase/supabase-js cheerio
   ```
   (`@supabase/supabase-js` は update-products で既に入っていればそのままで大丈夫です)

2. **package.json の module 形式**
   このファイルは `import` 構文(ESM)で書いています。`onahole-db/package.json` に
   `"type": "module"` が無い場合は、以下のどちらかが必要です。
   - `package.json` に `"type": "module"` を追加する
   - もしくは `crawl-shop-sales.js` を `crawl-shop-sales.mjs` にリネームし、
     `crawl-shop-sales.yml` 内の `node crawl-shop-sales.js` も
     `node crawl-shop-sales.mjs` に合わせて書き換える

3. **GitHub Secrets**
   ワークフローは `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` という名前のSecretsを使う想定です。
   `update-products` ワークフローで既に別の名前を使っている場合は、そちらの名前に
   `crawl-shop-sales.yml` を合わせてください。

## 初回デプロイ後に確認してほしいこと

- **NLS の年齢確認ゲート突破**: `node crawl-shop-sales.js --check --only=nls` を一度実行し、
  `ok=true` かつ `count` が0より大きいことを確認してください。もし
  `NLS: dl.newitem-list が見つかりません(年齢確認ゲートを通過できていない可能性)` という
  エラーになった場合は、ゲート突破の仕組み(POST `auth18=1` → Set-Cookie を次のGETに渡す)が
  実際のCookie形式と合っていない可能性があるので、Claude に実行結果を共有してください。
  ※ この部分はクラウド側サンドボックスから e-nls.com へ直接アクセスできない制約上、
  ブラウザ操作(Claude in Chrome)でHTML構造とゲートの仕組み(フォーム action="" に
  `auth18=1` をPOST)までは確認済みですが、Node実行での動作そのものは未検証です。

- **M-ZAKKA のクラウドブロック**: ワークフローには参考情報として
  `node crawl-shop-sales.js --check --only=mzakka` を毎回実行するステップを入れています
  (失敗してもジョブ全体は止まりません)。Actions の実行結果でここが `ok=true` になるようなら
  M-ZAKKA も本番巡回に含めるよう `crawl-shop-sales.yml` の `--exclude=mzakka` を外してください。
  弾かれる場合は、`mzakka_crawl.py` と同じ要領で、PC のタスクスケジューラから
  ```
  node crawl-shop-sales.js --only=mzakka
  ```
  を定期実行する運用にしてください(その場合もDB更新には `SUPABASE_URL` /
  `SUPABASE_SERVICE_ROLE_KEY` を環境変数として渡す必要があります)。

## 動作モードのおさらい

```
node crawl-shop-sales.js                    全ショップ巡回・DB更新
node crawl-shop-sales.js --check            疎通確認のみ(DB更新なし。各ショップの取得可否・件数を表示)
node crawl-shop-sales.js --only=nls,ems     指定ショップだけ
node crawl-shop-sales.js --exclude=mzakka   指定ショップを除外
```

各ショップのアダプタは、2026-09-12にブラウザで実地確認したDOM構造に基づいています
(ハンドオーバーの設計内容と一致していることを確認済み)。サイト側のマークアップが変わった
場合はセレクタの調整が必要です。
