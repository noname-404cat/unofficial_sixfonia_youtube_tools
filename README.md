# unofficial_sixfonia_youtube_tools

シクフォニ（非公式）のファン向け YouTube ツール群。
7チャンネルの新着を追い、自分の視聴履歴やコメントを画像にする。

仕様は [docs/oshikatsu_apps_overview.md](docs/oshikatsu_apps_overview.md)。

## 何ができるか

| | ツール | 解くこと | 入力 | 置き場所 |
|---|---|---|---|---|
| **A** | 新着一覧（昨日 / 今週 / 今月） | 7チャンネルの投稿を追い切れない | なし | `apps/web-arrivals` |
| **B** | 未視聴チェック | 見逃した動画を掘り起こす | `watch-history.json` | `apps/web-viewer` |
| **C** | 視聴TOP9タイル画像 | 推し活を見せる | `watch-history.json` | `apps/streamlit` |
| **D** | コメントのワードクラウド | 推し活を見せる | `comments*.csv` | `apps/streamlit` |

入力ファイルは Google Takeout の「YouTube と YouTube Music」から書き出す。

## 構成

```
sixfonia_analytics/     共通パッケージ（Python）
  config.py             チャンネル定義（7ch）・語彙プリセット
  snapshot.py           動画マスタの生成・読み込み
  takeout.py            Takeout のパーサ
apps/
  web-arrivals/         A: 新着一覧（Next.js / Vercel）
  web-viewer/           B: 未視聴チェック（Next.js / Vercel）
  streamlit/            C+D: 画像生成（Streamlit）
.github/workflows/
  update_snapshot.yml   動画マスタの日次更新
tests/                  57件。匿名フィクスチャで実データの挙動を固定
```

## 動画マスタのスナップショット

4ツールが共有する唯一のデータ源。**アプリからは YouTube API を呼ばない。**

元は新着一覧が `search.list`（**100 units/回**）を7チャンネル分、ページを開くたびに
叩いていたため、1日14回のアクセスで無料枠 10,000 units を使い切っていた。
`playlistItems.list`（**1 unit/回**）に置き換え、1日1回だけ取得することで
**約200 units/日**に収まる。

```
GitHub Actions（毎日 JST 23:00）
  └ apps/web-arrivals/public/data/videos.json をコミット
      ├ 新着一覧      … ビルド時に import（Vercel が自動で再デプロイ）
      └ Streamlit     … 公開URL /data/videos.json を fetch
```

同じリポジトリへコミットするので、Actions 既定の `GITHUB_TOKEN` で足りる（PAT 不要）。

手元で生成する場合:

```bash
YOUTUBE_API_KEY=xxx python -m sixfonia_analytics.snapshot --out apps/web-arrivals/public/data/videos.json
```

## セットアップ

### Python（スナップショット / Streamlit）

```bash
pip install -e ".[web,dev]"
streamlit run apps/streamlit/app.py
```

### Next.js アプリ

```bash
cd apps/web-arrivals && pnpm install && pnpm dev
```

`apps/web-viewer` は `.env.example` を `.env.local` にコピーしてキーを入れる。

## デプロイ

### Vercel（A・B）

1リポジトリから **2プロジェクト**を作る。Project Settings → General → **Root Directory** を
それぞれ `apps/web-arrivals` / `apps/web-viewer` に設定するだけでよい。

| プロジェクト | Root Directory | 環境変数 |
|---|---|---|
| 新着一覧 | `apps/web-arrivals` | 不要（APIを呼ばない） |
| 未視聴チェック | `apps/web-viewer` | `NEXT_PUBLIC_YOUTUBE_API_KEY` |

### Streamlit Community Cloud（C・D）

Main file path に `apps/streamlit/app.py` を指定する。
依存は `apps/streamlit/requirements.txt`、日本語フォントは `apps/streamlit/packages.txt`。
環境変数 `SNAPSHOT_URL` に新着一覧アプリの `/data/videos.json` を入れると、
コメントのチャンネル判定が正確になる（未設定でも視聴履歴から推定して動く）。

## 環境変数

| 名前 | 置き場所 | 用途 |
|---|---|---|
| `YOUTUBE_API_KEY` | GitHub Actions secrets | スナップショット生成 |
| `NEXT_PUBLIC_YOUTUBE_API_KEY` | Vercel（web-viewer）/ `.env.local` | 未視聴チェックの動画情報取得 |
| `SNAPSHOT_URL` | Streamlit Cloud | 動画マスタの取得元 |

**キーはソースに書かない。** `.gitignore` が `.env*` を除外している（`.env.example` のみ追跡）。

## テスト

```bash
pytest tests -q
```

個人の視聴履歴はコミットできないため、実データで確認した挙動を
`tests/fixtures/` の匿名フィクスチャで固定している。

## 未対応

- `NEXT_PUBLIC_YOUTUBE_API_KEY` はブラウザに配信される。恒久対応はサーバー側 route handler へ寄せること
- 未視聴チェックの母集団はまだ CSV アップロード依存。スナップショット参照への切替は未着手
- ワードクラウドはチャンネル別に出すが、語数が足りるのは暇72 と全体のみ

## 非公式

ファンが個人で作った非公式ツールです。シクフォニおよび所属各位とは関係ありません。
