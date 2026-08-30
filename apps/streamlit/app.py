# シクフォニ推し活ツール（画像生成side）
#
#   タブ1  視聴TOP9タイル画像      watch-history.json
#   タブ2  コメントのワードクラウド   comments*.csv
#
# 新着一覧と未視聴チェックは Vercel 側のアプリが担当する。
#
# 起動:
#   pip install -e ".[web]"
#   streamlit run apps/streamlit/app.py

from __future__ import annotations

import os
import sys
from collections import Counter
from pathlib import Path

import streamlit as st

st.set_page_config(
    page_title="シクフォニ推し活ツール",
    page_icon="🎧",
    layout="wide",
)

# リポジトリ直下を import パスへ（Streamlit Cloud から直接起動しても動くように）
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import tiles  # noqa: E402
import wordclouds  # noqa: E402
from sixfonia_analytics import config, snapshot, takeout  # noqa: E402

# 動画マスタの配布URL。未設定でも視聴履歴からの推定にフォールバックする。
SNAPSHOT_URL = os.environ.get("SNAPSHOT_URL", "")

DISPLAY = {c["name"]: c["display"] for c in config.CHANNELS}


# ============================================================
# データの読み込み
# ============================================================
@st.cache_data(ttl=3600, show_spinner=False)
def load_snapshot(url: str) -> dict | None:
    if not url:
        return None
    try:
        return snapshot.load_snapshot(url)
    except Exception as e:  # ネットワーク断でもアプリは使えるようにする
        st.warning(f"動画マスタを取得できませんでした: {e}")
        return None


def channel_map_from_history(rows: list[dict]) -> dict[str, str]:
    """スナップショットが無いときの代替。視聴履歴の subtitles から推定する。

    削除・非公開動画は subtitles が欠落するため取りこぼす。
    正確な判定にはスナップショットが要る。
    """
    by_id = {c["channel_id"]: c["name"] for c in config.CHANNELS}
    out: dict[str, str] = {}
    for r in rows:
        name = by_id.get(r["channel_id"])
        if name:
            out[r["video_id"]] = name
    return out


# ============================================================
# サイドバー
# ============================================================
st.sidebar.header("入力")

history_file = st.sidebar.file_uploader(
    "視聴履歴 watch-history.json", type=["json"], accept_multiple_files=False,
    help="Google Takeout → YouTube と YouTube Music → history",
)
comment_files = st.sidebar.file_uploader(
    "コメント comments*.csv", type=["csv"], accept_multiple_files=True,
    help="comments.csv と comments(1).csv の両方を選べます",
)

st.sidebar.markdown("---")
theme_mode = st.sidebar.selectbox("画像の背景テーマ", ["デフォルト", "自動"])
snapshot_url = st.sidebar.text_input("動画マスタのURL（任意）", value=SNAPSHOT_URL,
                                     placeholder="https://.../data/videos.json")

st.sidebar.markdown("---")
st.sidebar.caption(
    "アップロードしたファイルはこのアプリのサーバー上のメモリで処理します。"
    "保存も外部送信もしませんが、**ブラウザ内だけで完結する処理ではありません**。"
)

snap = load_snapshot(snapshot_url)

# ============================================================
# 視聴履歴のパース（両タブで使う）
# ============================================================
history_rows: list[dict] = []
history_df = None
if history_file is not None:
    try:
        history_df = tiles.load_watch_history(history_file)
        history_file.seek(0)
        history_rows = takeout.parse_watch_history(history_file)
    except Exception as e:
        st.error(f"視聴履歴の読み込みに失敗しました: {e}")
        st.stop()

# チャンネル判定用のマップ: スナップショット優先、無ければ履歴から推定
if snap:
    video_channel_map = snapshot.video_channel_map(snap)
    map_source = f"動画マスタ（{len(snap['videos']):,}本 / 更新 {snap['updated_at'][:16]}）"
    if snapshot.is_stale(snap):
        st.warning("動画マスタが36時間以上更新されていません。取得バッチが失敗している可能性があります。")
else:
    video_channel_map = channel_map_from_history(history_rows)
    map_source = "視聴履歴からの推定（動画マスタ未設定）"


# ============================================================
# 画面
# ============================================================
st.title("🎧 シクフォニ推し活ツール")

tab_tiles, tab_cloud, tab_about = st.tabs(
    ["視聴TOP9タイル画像", "コメントのワードクラウド", "このアプリについて"]
)

# ------------------------------------------------------------
# タブ1: TOP9タイル画像
# ------------------------------------------------------------
with tab_tiles:
    if tiles.JP_FONT_PATH is None:
        st.warning(
            "日本語フォントが見つかりません。生成画像の日本語が □ になります。"
            "apps/streamlit/fonts/ に NotoSansJP-Regular.ttf を置くか、"
            "packages.txt に fonts-ipafont-gothic を追加してください。"
        )

    if history_file is None:
        st.info("サイドバーから watch-history.json をアップロードしてください。")
    elif history_df is None or history_df.empty:
        st.warning("動画として扱える履歴が見つかりませんでした。")
    else:
        min_date = history_df["time_jst"].dt.date.min()
        max_date = history_df["time_jst"].dt.date.max()

        st.caption(
            f"この履歴がカバーする期間: **{min_date} 〜 {max_date}**　"
            f"（{len(history_df):,}再生 / {history_df['video_id'].nunique():,}本）"
        )

        col_a, col_b = st.columns(2)
        start_date = col_a.date_input("開始日", value=min_date,
                                      min_value=min_date, max_value=max_date)
        end_date = col_b.date_input("終了日", value=max_date,
                                    min_value=min_date, max_value=max_date)

        if start_date > end_date:
            st.error("開始日は終了日以前にしてください。")
        else:
            filtered = tiles.apply_date_filter(history_df, start_date, end_date)
            if filtered.empty:
                st.warning("指定期間にデータがありません。")
            else:
                sub_all, sub_channel, sub_url = st.tabs(["全体", "チャンネル別", "URL入力"])

                with sub_all:
                    tiles.render_result_block(
                        df_source=filtered,
                        image_title="#私を構成するYouTube動画",
                        subtitle=f"対象期間：{start_date} ～ {end_date}",
                        theme=tiles.resolve_theme("デフォルト", None),
                        download_filename="my_core_videos_tile_all.png",
                        empty_message="表示できる動画がありません。",
                    )

                with sub_channel:
                    channels = sorted(filtered["channel_name"].dropna().unique().tolist())
                    if not channels:
                        st.warning("チャンネル情報がある履歴が見つかりませんでした。")
                    else:
                        selected = st.selectbox("対象チャンネル", options=channels,
                                                key="selected_channel_tab")
                        per_channel = filtered[filtered["channel_name"] == selected].copy()
                        tiles.render_result_block(
                            df_source=per_channel,
                            image_title=f"#私を構成するYouTube動画（{selected}）",
                            subtitle=f"対象期間：{start_date} ～ {end_date}",
                            theme=tiles.resolve_theme(theme_mode, selected),
                            download_filename=(
                                f"my_core_videos_tile_{tiles.safe_filename(selected)}.png"
                            ),
                            empty_message="このチャンネルでは表示できる動画がありません。",
                        )

                with sub_url:
                    st.caption(
                        "視聴履歴を使わず、YouTube URL を1行ずつ入力して"
                        "サムネだけの3×3を作ります。先頭から最大9件、重複は除外します。"
                    )
                    url_text = st.text_area(
                        "YouTube URL を改行区切りで入力", height=200,
                        placeholder=("https://www.youtube.com/watch?v=xxxxxxxxxxx\n"
                                     "https://youtu.be/yyyyyyyyyyy"),
                        key="manual_url_input",
                    )
                    if st.button("URLから画像を生成", use_container_width=True):
                        st.session_state["manual_df"] = tiles.build_manual_thumbnail_df(
                            url_text, max_n=9
                        )
                    manual_df = st.session_state.get("manual_df")
                    if manual_df is not None:
                        tiles.render_thumbnail_only_block(
                            thumbnail_df=manual_df,
                            image_title="#私を構成するYouTube動画（手動選択）",
                            subtitle=f"採用件数：{len(manual_df)} / 9",
                            theme=tiles.DEFAULT_THEME,
                            download_filename="my_thumbnail_board.png",
                        )

# ------------------------------------------------------------
# タブ2: コメントのワードクラウド
# ------------------------------------------------------------
with tab_cloud:
    if not comment_files:
        st.info("サイドバーから comments.csv をアップロードしてください。"
                "Takeout はコメントを複数ファイルに分けて出力するので、まとめて選べます。")
    elif not video_channel_map:
        st.warning(
            "コメントをチャンネルに割り当てられません。"
            "動画マスタのURLを設定するか、視聴履歴もあわせてアップロードしてください。"
        )
    else:
        comments = takeout.parse_comments(comment_files)
        st.caption(
            f"コメント **{len(comments):,}件**　/　チャンネル判定: {map_source}"
        )

        include_chats = st.checkbox(
            "ライブチャットも語彙に含める", value=False,
            help="live chats*.csv。短い定型が多いため既定はオフ",
        )
        chat_files = None
        if include_chats:
            chat_files = st.file_uploader("live chats*.csv", type=["csv"],
                                          accept_multiple_files=True, key="chat_upload")
            if chat_files:
                comments = comments + takeout.parse_live_chats(chat_files)

        with st.spinner("形態素解析中..."):
            result = wordclouds.analyze(comments, video_channel_map)

        rows = []
        for name in config.CHANNEL_NAMES:
            stat = result["channels"][name]
            rows.append({
                "チャンネル": DISPLAY[name],
                "件数": stat["comments"],
                "文字数": stat["chars"],
                "延べ語": stat["tokens"],
                "ユニーク語": stat["unique"],
                "判定": stat["verdict"],
            })
        overall = result["all"]
        rows.append({
            "チャンネル": "全体（7ch）",
            "件数": overall["comments"],
            "文字数": overall["chars"],
            "延べ語": overall["tokens"],
            "ユニーク語": overall["unique"],
            "判定": overall["verdict"],
        })
        st.dataframe(rows, use_container_width=True, hide_index=True)

        if result["unknown"]:
            st.caption(
                f"{result['unknown']:,}件は対象7チャンネル以外の動画へのコメント、"
                "または動画を特定できないコメントとして除外しました。"
            )

        if overall["tokens"] == 0:
            st.warning("対象7チャンネルへのコメントが見つかりませんでした。")
        else:
            mask = wordclouds.sakura_mask()

            def _draw(label: str, stat: dict, filename: str) -> None:
                st.subheader(label)
                if stat["verdict"] == wordclouds.VERDICT_EMPTY:
                    st.info(wordclouds.VERDICT_EMPTY)
                    return
                if stat["verdict"] == wordclouds.VERDICT_THIN:
                    st.warning(
                        f"{wordclouds.VERDICT_THIN}"
                        f"（延べ {stat['tokens']}語 / 目安 {wordclouds.MIN_TOKENS}語）"
                    )
                image = wordclouds.render_wordcloud(
                    stat["freq"], tiles.JP_FONT_PATH, mask=mask,
                    total_tokens=stat["tokens"],
                )
                col_img, col_top = st.columns([2, 1])
                with col_img:
                    st.image(image, use_container_width=True)
                    st.download_button(
                        "PNGをダウンロード",
                        data=tiles.pil_image_to_png_bytes(image),
                        file_name=filename, mime="image/png",
                        use_container_width=True, key=f"dl_{filename}",
                    )
                with col_top:
                    st.caption("頻出語")
                    st.dataframe(
                        [{"語": w, "回数": c} for w, c in stat["freq"].most_common(15)],
                        use_container_width=True, hide_index=True,
                    )

            _draw("全体（7チャンネル）", overall, "wordcloud_all.png")
            st.markdown("---")
            for name in config.CHANNEL_NAMES:
                _draw(DISPLAY[name], result["channels"][name], f"wordcloud_{name}.png")

# ------------------------------------------------------------
# タブ3: 説明
# ------------------------------------------------------------
with tab_about:
    st.markdown(
        """
### 入力について

Google Takeout の **「YouTube と YouTube Music」** から書き出したファイルを使います。

| 使うファイル | 置き場所 |
|---|---|
| `watch-history.json` | `YouTube と YouTube Music/history/` |
| `comments*.csv` | `YouTube と YouTube Music/comments/` |
| `live chats*.csv`（任意） | `YouTube と YouTube Music/live chats/` |

### 知っておいてほしいこと

- **視聴履歴には視聴時間が入っていません。** 記録されているのは再生を始めたイベントだけなので、
  ここでいう「よく見ている」は履歴に出てきた回数のことです。
- **視聴履歴には保存期間があります。** Google 側の自動削除設定によって古い分から消えるため、
  エクスポートに含まれるのは直近の一定期間だけのことがあります。
  期間は画面上部に表示しています。
- **コメントは全期間残ります。** 視聴履歴と違って古いものも残っています。
- **チャンネルの判定は動画IDで行っています。** 履歴の中のチャンネル名は、
  削除・非公開になった動画では欠落するためです。

### ファイルの扱い

アップロードされたファイルは、このアプリが動いているサーバーのメモリ上で処理します。
ディスクへの保存も外部への送信もしませんが、**ブラウザ内だけで完結する処理ではありません**。

### 非公式

ファンが個人で作った非公式ツールです。シクフォニおよび所属各位とは関係ありません。
"""
    )
