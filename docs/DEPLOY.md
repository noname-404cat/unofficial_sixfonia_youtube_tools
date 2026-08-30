# デプロイ手順

**3つとも YouTube API キーを必要としない。** 環境変数の設定も要らない。

| | アプリ | 置き場所 | Root Directory / Main file | 環境変数 |
|---|---|---|---|---|
| A | 新着一覧 | Vercel | `apps/web-arrivals` | なし |
| B | 未視聴チェック | Vercel | `apps/web-viewer` | なし |
| C・D | TOP9タイル画像 / ワードクラウド | Streamlit Cloud | `apps/streamlit/app.py` | `SNAPSHOT_URL`（任意） |

B は以前ブラウザから YouTube API を叩いていたが、動画マスタを読む形に変えたので
キーは不要になった。

---

## 1. GitHub（非公開リポジトリ）

```bash
gh auth login -h github.com          # noname-404cat で認証する（対話が必要）
gh repo create noname-404cat/unofficial_sixfonia_youtube_tools --private --source=. --remote=origin --push
```

### Actions のシークレット

動画マスタの日次更新に使う。

```bash
gh secret set YOUTUBE_API_KEY
```

設定後、`Actions` タブから `Update video snapshot` を手動実行して動作を確認する。
成功すると `apps/web-arrivals/public/data/videos.json` が更新コミットされ、
Vercel が自動で再デプロイする。

> ワークフローは同一リポジトリへコミットするため、既定の `GITHUB_TOKEN` で足りる。
> PAT は要らない。

---

## 2. Vercel（新着一覧）

1. [vercel.com/new](https://vercel.com/new) でリポジトリを Import
2. **Root Directory** に `apps/web-arrivals` を指定する ← これが唯一の必須設定
3. Framework は Next.js が自動検出される
4. 環境変数は**不要**
5. Deploy

デプロイ後のURLを控える。`https://<プロジェクト名>.vercel.app` の形になる。
動画マスタはこのURLの `/data/videos.json` で公開され、Streamlit 側もこれを読む。

### 確認

- 昨日 / 今週 / 今月 の3区分が出る
- ブラウザの devtools のネットワークタブに `googleapis.com` へのリクエストが**出ない**
- コンソールにエラーが出ない

---

## 2-2. Vercel（未視聴チェック）

同じリポジトリからもう1つプロジェクトを作る。

1. [vercel.com/new](https://vercel.com/new) で同じリポジトリを Import
2. **Root Directory** に `apps/web-viewer` を指定
3. 環境変数は**不要**

> 動画マスタは新着一覧アプリの `/data/videos.json` を読む。別オリジンになるので、
> 新着一覧側の `next.config.mjs` で CORS ヘッダーを出している。
> 参照先を変えたい場合だけ `NEXT_PUBLIC_SNAPSHOT_BASE` を設定する。

### 確認

- **CSVをアップロードせずに**未視聴チェックが使える
- 視聴履歴を入れると、履歴の期間が但し書きに表示される
- `googleapis.com` へのリクエストが出ない

---

## 3. Streamlit Community Cloud（画像生成）

1. [share.streamlit.io](https://share.streamlit.io) で New app
2. リポジトリを選び、**Main file path** に `apps/streamlit/app.py` を指定
3. Advanced settings → Secrets に、Vercel のURLを入れる

```toml
SNAPSHOT_URL = "https://<プロジェクト名>.vercel.app/data/videos.json"
```

4. Deploy

依存は直下の `requirements.txt`、日本語フォントは直下の `packages.txt`（`fonts-ipafont-gothic`）
から入る。**どちらもリポジトリ直下に無いと読まれない。**

> `packages.txt` に**コメントを書いてはいけない**。中身がそのまま `apt-get` に渡されるため、
> `#` で始まる行もパッケージ名として扱われ `E: Unable to locate package #` で失敗する。
> パッケージ名だけを1行ずつ書く。`requirements.txt` は pip が読むのでコメント可。

> `SNAPSHOT_URL` は未設定でも動く。その場合コメントのチャンネル判定を
> 視聴履歴からの推定で行うため、精度が落ちる（削除・非公開動画を取りこぼす）。

### 確認

- 「視聴TOP9タイル画像」タブに `watch-history.json` を入れて画像が出る
- 生成画像の日本語が □ になっていない（□ なら `packages.txt` が読まれていない）
- 「コメントのワードクラウド」タブに `comments*.csv` を入れて7チャンネル分の判定表が出る

---

## 4. デプロイ後

| 項目 | 内容 |
|---|---|
| 動画マスタの更新 | 毎日 JST 23:00 に Actions が実行 → コミット → Vercel が再デプロイ |
| Streamlit のスリープ | 無料枠はアクセスが無いとスリープする。復帰に30秒ほどかかる |
| 鮮度の警告 | 動画マスタが36時間以上古いと新着一覧に警告バナーが出る。Actions の失敗に気づける |

## 残っている課題

- **APIキーのローテート**が未実施。どのアプリからも使っていないが、旧キーは
  元の v0 リポジトリの Git 履歴に残っている
- **再生数**は BigQuery から日次バッチで抽出して `data/stats.json` として配る予定。
  未実装で、アプリ側の取得口だけ用意してある
