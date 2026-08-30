# 視聴回数 Top9 の 3x3 タイル画像を作る。
#
# 元は単体の Streamlit アプリ（my_9videos_youtube）。UI は app.py へ移し、
# ここは描画と集計の関数だけを持つ。
#
# 元コードからの変更点:
# - 視聴履歴のパースを sixfonia_analytics.takeout に委譲した。
#   元実装は日本語ロケールの " を視聴しました" しか外せず、英語ロケールで
#   エクスポートされた実データではタイトルが "Watched 【…】" のままになっていた。
# - 動画IDの抽出も takeout 側に統一（11文字固定）。
# - CHANNEL_THEMES にシクフォニ7チャンネル分を追加した。
#
# 元コードから維持しているもの:
# - Streamlit キャッシュは使わない
# - ダウンロード用ファイル名を安全化
# - 日本語フォントを実際に日本語が描けるか検証してから採用（文字化け対策）
# - タイトル行数に応じてタイル高さを可変にし、折り返しバグを修正（間延び対策）

from __future__ import annotations

import glob
import io
import re
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Optional

import pandas as pd
import requests
import streamlit as st
from PIL import Image, ImageDraw, ImageFont

from sixfonia_analytics import config, takeout


# =========================
# 基本設定
# =========================
THUMB_TIMEOUT = 8

# デフォルトテーマ
DEFAULT_THEME = {
    "bg_color": (248, 248, 248),
    "text_color": (40, 40, 40),
    "subtext_color": (110, 110, 110),
    "card_bg": (255, 255, 255),
    "card_border": (225, 225, 225),
    "text_bg": (255, 255, 255),
    "placeholder_bg": (236, 236, 236),
}

# チャンネル別テーマ。
#
# キーは config.CHANNELS の name。視聴履歴に入っているチャンネル名
# （例 "雨乃こさめ【シクフォニ】"）は表記ゆれがあるため、
# resolve_theme() が display 名の部分一致で解決する。
#
# ★色は仮置き。各メンバーのイメージカラーが決まったら差し替える。
def _theme(bg, text, subtext, card, border, placeholder) -> dict:
    return {
        "bg_color": bg,
        "text_color": text,
        "subtext_color": subtext,
        "card_bg": card,
        "card_border": border,
        "text_bg": card,
        "placeholder_bg": placeholder,
    }


CHANNEL_THEMES = {
    "sixfonia": _theme((250, 246, 249), (44, 30, 40), (124, 100, 114),
                       (255, 255, 255), (232, 216, 226), (240, 228, 236)),
    "hima72":   _theme((244, 247, 252), (30, 40, 58), (100, 114, 138),
                       (255, 255, 255), (214, 226, 242), (228, 237, 249)),
    "kosame":   _theme((246, 250, 250), (30, 48, 50), (100, 128, 130),
                       (255, 255, 255), (210, 232, 233), (226, 242, 243)),
    "illuma":   _theme((252, 248, 242), (52, 40, 28), (132, 112, 88),
                       (255, 255, 255), (238, 224, 204), (246, 236, 222)),
    "mikoto":   _theme((250, 245, 250), (46, 32, 48), (124, 100, 128),
                       (255, 255, 255), (230, 214, 234), (240, 228, 243)),
    "suchi":    _theme((248, 250, 244), (38, 46, 30), (110, 124, 96),
                       (255, 255, 255), (222, 232, 208), (235, 242, 224)),
    "lan":      _theme((246, 246, 248), (36, 36, 44), (110, 110, 126),
                       (255, 255, 255), (220, 220, 230), (234, 234, 241)),
}

# =========================
# レイアウト定数
# =========================
IMAGE_W = 1200
OUTER_PAD_X = 36
GRID_GAP = 14  # 元は22。間延びの一因だったので詰めた

COLS = 3
ROWS = 3

# ヘッダー（画像上端からの絶対座標）
HEADER_TITLE_Y = 26
HEADER_SUB_Y = 70
HEADER_RULE_Y = 104
BODY_TOP_Y = 132  # 罫線からタイル上端まで28px
FOOTER_H = 42  # 本文下端〜画像下端（フッター文字含む）

# タイル
TILE_W = (IMAGE_W - OUTER_PAD_X * 2 - GRID_GAP * (COLS - 1)) // COLS
THUMB_RATIO = 16 / 9
THUMB_H = int(TILE_W / THUMB_RATIO)
CARD_RADIUS = 18

# テキスト領域（高さは固定せず、行数から積み上げる）
TEXT_PAD_X = 14
TEXT_PAD_TOP = 10
TEXT_PAD_BOTTOM = 12
TITLE_LINE_H = 24
TITLE_MAX_LINES = 2
CHANNEL_GAP = 4
CHANNEL_LINE_H = 20


def text_area_h(title_line_count: int) -> int:
    """タイトル行数から、そのタイルのテキスト領域の高さを求める"""
    n = max(1, min(title_line_count, TITLE_MAX_LINES))
    return (
        TEXT_PAD_TOP
        + n * TITLE_LINE_H
        + CHANNEL_GAP
        + CHANNEL_LINE_H
        + TEXT_PAD_BOTTOM
    )


# URL入力タブ用（サムネだけ）
THUMB_ONLY_TITLE_Y = 26
THUMB_ONLY_SUB_Y = 66
THUMB_ONLY_RULE_Y = 98
THUMB_ONLY_BODY_TOP_Y = 124
THUMB_ONLY_TILE_H = THUMB_H
THUMB_ONLY_IMAGE_H = (
    THUMB_ONLY_BODY_TOP_Y
    + ROWS * THUMB_ONLY_TILE_H
    + (ROWS - 1) * GRID_GAP
    + FOOTER_H
)


# =========================
# フォント
# =========================
APP_DIR = Path(__file__).resolve().parent

FONT_CANDIDATES: list[Path] = [
    # 1) リポジトリ同梱（最優先。環境に依存しないので確実）
    APP_DIR / "fonts" / "NotoSansJP-Regular.ttf",
    APP_DIR / "fonts" / "ipaexg.ttf",
    # 2) Linux（Streamlit Community Cloud / Debian）
    Path("/usr/share/fonts/truetype/fonts-japanese-gothic.ttf"),
    Path("/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf"),
    Path("/usr/share/fonts/opentype/ipaexfont-gothic/ipaexg.ttf"),
    Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
    Path("/usr/share/fonts/opentype/noto/NotoSansCJKjp-Regular.otf"),
    Path("/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc"),
    # 3) macOS
    Path("/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc"),
    Path("/System/Library/Fonts/Hiragino Sans.ttc"),
    # 4) Windows
    Path("C:/Windows/Fonts/YuGothM.ttc"),
    Path("C:/Windows/Fonts/meiryo.ttc"),
    Path("C:/Windows/Fonts/msgothic.ttc"),
]


def _supports_japanese(font) -> bool:
    """「あ」が .notdef(□) に落ちていないかを判定する。

    ほぼ全フォントで未定義の私用領域文字と描画結果を比較し、
    同一なら「あ」も □ にフォールバックしていると判断する。
    """
    try:
        ja = font.getmask("あ")
        missing = font.getmask("\ue000")
        if ja.size != missing.size:
            return True
        return bytes(ja) != bytes(missing)
    except Exception:
        return False


def _find_japanese_font_path() -> Optional[str]:
    for path in FONT_CANDIDATES:
        if not path.exists():
            continue
        try:
            probe = ImageFont.truetype(str(path), size=24)
        except Exception:
            continue
        if _supports_japanese(probe):
            return str(path)

    # 候補が全滅した場合の総なめ
    patterns = [
        str(APP_DIR / "fonts" / "*.tt[fc]"),
        str(APP_DIR / "fonts" / "*.otf"),
        "/usr/share/fonts/**/*Noto*CJK*",
        "/usr/share/fonts/**/*ipa*",
    ]
    for pattern in patterns:
        for found in glob.glob(pattern, recursive=True):
            try:
                probe = ImageFont.truetype(found, size=24)
            except Exception:
                continue
            if _supports_japanese(probe):
                return found
    return None


JP_FONT_PATH = _find_japanese_font_path()


@lru_cache(maxsize=32)
def load_font(size: int):
    if JP_FONT_PATH:
        try:
            return ImageFont.truetype(JP_FONT_PATH, size=size)
        except Exception:
            pass
    try:
        return ImageFont.load_default(size=size)  # Pillow >= 10.1
    except TypeError:
        return ImageFont.load_default()


FONT_HEADER = load_font(34)
FONT_SUB = load_font(18)
FONT_TITLE = load_font(18)
FONT_CHANNEL = load_font(15)
FONT_FOOTER = load_font(12)
FONT_PH = load_font(18)
FONT_PH_SMALL = load_font(12)
FONT_URL_HEADER = load_font(30)


# =========================
# ユーティリティ
# =========================
def safe_filename(text: str) -> str:
    return re.sub(r'[\\/:*?"<>|]+', "_", text).strip()


# =========================
# データ処理
# =========================
# 動画IDの抽出とタイトルの正規化は takeout 側に一本化した。
# ここから呼ぶだけにして、実装が2箇所に分かれないようにする。
extract_video_id = takeout.extract_video_id


def load_watch_history(uploaded_file) -> pd.DataFrame:
    """watch-history.json を DataFrame にする。

    列: video_id / title_clean / channel_name / time_jst

    パースは takeout.parse_watch_history に任せる。これにより
    英語ロケール（"Watched …"）と日本語ロケール（"… を視聴しました"）の
    両方が正しく扱われ、コミュニティ投稿も落ちる。
    """
    rows = takeout.parse_watch_history(uploaded_file)
    if not rows:
        return pd.DataFrame(columns=["video_id", "title_clean", "channel_name", "time_jst"])

    df = pd.DataFrame([{
        "video_id": r["video_id"],
        "title_clean": r["title"] or "タイトル不明",
        "channel_name": r["channel_name"],
        "time_jst": r["watched_at"],
    } for r in rows])
    df["time_jst"] = pd.to_datetime(df["time_jst"], utc=True).dt.tz_convert("Asia/Tokyo")
    return df


def apply_date_filter(df: pd.DataFrame, start_date: date, end_date: date) -> pd.DataFrame:
    dates = df["time_jst"].dt.date
    return df[(dates >= start_date) & (dates <= end_date)].copy()


def build_top_videos(df: pd.DataFrame, top_n: int = 9) -> pd.DataFrame:
    """
    「自分を構成している動画」なので累積回数ベース。
    同率時は latest_seen_jst が新しい方を上位。
    """
    if df.empty:
        return pd.DataFrame(columns=[
            "video_id", "watch_count", "latest_seen_jst",
            "title", "channel_name", "thumbnail_url"
        ])

    agg = (
        df.groupby("video_id")
        .agg(
            watch_count=("video_id", "size"),
            latest_seen_jst=("time_jst", "max"),
        )
        .reset_index()
    )

    latest_meta_idx = df.groupby("video_id")["time_jst"].idxmax()
    meta = df.loc[latest_meta_idx, ["video_id", "title_clean", "channel_name"]].copy()
    meta = meta.rename(columns={"title_clean": "title"})

    out = agg.merge(meta, on="video_id", how="left")
    out["channel_name"] = out["channel_name"].fillna("チャンネル不明")
    out["thumbnail_url"] = out["video_id"].apply(
        lambda vid: f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"
    )

    out = out.sort_values(
        ["watch_count", "latest_seen_jst"],
        ascending=[False, False]
    ).reset_index(drop=True)

    return out.head(top_n).copy()


def build_manual_thumbnail_df(text: str, max_n: int = 9) -> pd.DataFrame:
    """
    URL入力タブ用。
    改行区切りのYouTube URLから video_id を抽出し、
    サムネだけ表示するための DataFrame を作る。
    """
    rows = []
    seen = set()

    for line in text.splitlines():
        url = line.strip()
        if not url:
            continue

        video_id = extract_video_id(url)
        if not video_id:
            continue
        if video_id in seen:
            continue

        seen.add(video_id)
        rows.append({
            "video_id": video_id,
            "thumbnail_url": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
        })

        if len(rows) >= max_n:
            break

    return pd.DataFrame(rows)


# =========================
# テーマ
# =========================
def theme_key_for(channel_name: Optional[str]) -> Optional[str]:
    """視聴履歴のチャンネル名から config.CHANNELS の name を推定する。

    履歴に入っている名前は "雨乃こさめ【シクフォニ】" のように装飾を伴うため、
    完全一致ではなく display 名の部分一致で照合する。
    """
    if not channel_name:
        return None
    if channel_name in CHANNEL_THEMES:
        return channel_name
    for ch in config.CHANNELS:
        if ch["display"] and ch["display"] in channel_name:
            return ch["name"]
    return None


def resolve_theme(mode: str, selected_channel: Optional[str] = None) -> dict:
    if mode != "自動":
        return DEFAULT_THEME
    key = theme_key_for(selected_channel)
    return CHANNEL_THEMES.get(key, DEFAULT_THEME) if key else DEFAULT_THEME


# =========================
# サムネイル取得
# =========================
def fetch_thumbnail(url: str) -> Optional[Image.Image]:
    try:
        resp = requests.get(url, timeout=THUMB_TIMEOUT)
        resp.raise_for_status()
        img = Image.open(io.BytesIO(resp.content)).convert("RGB")
        return img
    except Exception:
        return None


def fit_and_crop(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    src_w, src_h = img.size
    src_ratio = src_w / src_h
    dst_ratio = target_w / target_h

    if src_ratio > dst_ratio:
        new_h = target_h
        new_w = int(new_h * src_ratio)
    else:
        new_w = target_w
        new_h = int(new_w / src_ratio)

    img = img.resize((new_w, new_h), Image.LANCZOS)

    left = max((new_w - target_w) // 2, 0)
    top = max((new_h - target_h) // 2, 0)

    return img.crop((left, top, left + target_w, top + target_h))


def make_placeholder_thumb(video_id: str, width: int, height: int, theme: dict) -> Image.Image:
    img = Image.new("RGB", (width, height), theme["placeholder_bg"])
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, width - 1, height - 1), outline=theme["card_border"], width=1)
    draw.text((20, height // 2 - 22), "No Thumbnail", fill=theme["subtext_color"], font=FONT_PH)
    draw.text((20, height // 2 + 10), video_id, fill=theme["subtext_color"], font=FONT_PH_SMALL)
    return img


# =========================
# テキスト描画
# =========================
def _text_width(draw: ImageDraw.ImageDraw, text: str, font) -> float:
    return draw.textlength(text, font=font)


def _ellipsize(draw: ImageDraw.ImageDraw, line: str, font, max_width: int) -> str:
    if _text_width(draw, line + "…", font) <= max_width:
        return line + "…"
    while line:
        line = line[:-1]
        if _text_width(draw, line + "…", font) <= max_width:
            return line + "…"
    return "…"


def wrap_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    font,
    max_width: int,
    max_lines: int,
) -> list[str]:
    text = " ".join(str(text).split())
    lines: list[str] = []
    current = ""
    truncated = False

    for ch in text:
        trial = current + ch
        if _text_width(draw, trial, font) <= max_width:
            current = trial
            continue

        if not current:  # 1文字でも入らない場合は諦めて置く
            current = ch
            continue

        lines.append(current)
        current = ch

        if len(lines) >= max_lines:
            truncated = True
            current = ""
            break

    if current:
        lines.append(current)

    if truncated and lines:
        lines[-1] = _ellipsize(draw, lines[-1], font, max_width)

    return lines or [""]


# =========================
# 履歴ベース画像生成
# =========================
def draw_tile(
    base_img: Image.Image,
    row: pd.Series,
    x: int,
    y: int,
    tile_h: int,
    title_lines: list[str],
    title_slot_lines: int,
    theme: dict,
):
    draw = ImageDraw.Draw(base_img)

    draw.rounded_rectangle(
        (x, y, x + TILE_W, y + tile_h),
        radius=CARD_RADIUS,
        fill=theme["card_bg"],
    )

    thumb = fetch_thumbnail(row["thumbnail_url"])
    if thumb is None:
        thumb = make_placeholder_thumb(row["video_id"], TILE_W, THUMB_H, theme)
    else:
        thumb = fit_and_crop(thumb, TILE_W, THUMB_H)

    base_img.paste(thumb, (x, y))

    text_y = y + THUMB_H
    draw.rounded_rectangle(
        (x, text_y, x + TILE_W, y + tile_h),
        radius=CARD_RADIUS,
        fill=theme["text_bg"],
    )
    draw.rectangle((x, text_y, x + TILE_W, text_y + CARD_RADIUS), fill=theme["text_bg"])

    current_y = text_y + TEXT_PAD_TOP
    for line in title_lines:
        draw.text((x + TEXT_PAD_X, current_y), line, fill=theme["text_color"], font=FONT_TITLE)
        current_y += TITLE_LINE_H

    # 同じ行のタイル同士でチャンネル名の高さを揃える
    channel_y = text_y + TEXT_PAD_TOP + title_slot_lines * TITLE_LINE_H + CHANNEL_GAP
    channel_line = wrap_text(
        draw, f"by {row['channel_name']}", FONT_CHANNEL,
        TILE_W - TEXT_PAD_X * 2, max_lines=1,
    )[0]
    draw.text((x + TEXT_PAD_X, channel_y), channel_line, fill=theme["subtext_color"], font=FONT_CHANNEL)

    # 枠線はテキスト背景で消されないよう最後に描く
    draw.rounded_rectangle(
        (x, y, x + TILE_W, y + tile_h),
        radius=CARD_RADIUS,
        outline=theme["card_border"],
        width=1,
    )


def generate_tile_image(top_df: pd.DataFrame, image_title: str, subtitle: str, theme: dict) -> Image.Image:
    probe = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    title_max_w = TILE_W - TEXT_PAD_X * 2

    # 1) 先に全タイルの折り返しを確定させる
    wrapped = [
        wrap_text(probe, str(r["title"]), FONT_TITLE, title_max_w, TITLE_MAX_LINES)
        for _, r in top_df.iterrows()
    ]

    # 2) 行ごとに必要なぶんだけ高さを確保する（間延びの解消）
    slot_lines: list[int] = []
    row_heights: list[int] = []
    for r in range(ROWS):
        cells = wrapped[r * COLS:(r + 1) * COLS]
        n = max((len(c) for c in cells), default=1)
        slot_lines.append(n)
        row_heights.append(THUMB_H + text_area_h(n))

    body_h = sum(row_heights) + GRID_GAP * (ROWS - 1)
    image_h = BODY_TOP_Y + body_h + FOOTER_H

    img = Image.new("RGB", (IMAGE_W, image_h), theme["bg_color"])
    draw = ImageDraw.Draw(img)

    draw.text((OUTER_PAD_X, HEADER_TITLE_Y), image_title, fill=theme["text_color"], font=FONT_HEADER)
    draw.text((OUTER_PAD_X, HEADER_SUB_Y), subtitle, fill=theme["subtext_color"], font=FONT_SUB)
    draw.line(
        (OUTER_PAD_X, HEADER_RULE_Y, IMAGE_W - OUTER_PAD_X, HEADER_RULE_Y),
        fill=theme["card_border"], width=2,
    )

    y = BODY_TOP_Y
    for r in range(ROWS):
        for c in range(COLS):
            idx = r * COLS + c
            x = OUTER_PAD_X + c * (TILE_W + GRID_GAP)
            if idx < len(top_df):
                draw_tile(
                    img, top_df.iloc[idx], x, y,
                    row_heights[r], wrapped[idx], slot_lines[r], theme,
                )
            else:
                draw.rounded_rectangle(
                    (x, y, x + TILE_W, y + row_heights[r]),
                    radius=CARD_RADIUS,
                    fill=theme["bg_color"],
                    outline=theme["card_border"],
                    width=1,
                )
        y += row_heights[r] + GRID_GAP

    footer = "Generated from Google Takeout watch-history.json / No external YouTube API used"
    draw.text((OUTER_PAD_X, image_h - 26), footer, fill=theme["subtext_color"], font=FONT_FOOTER)

    return img


# =========================
# URL入力用 画像生成（サムネだけ）
# =========================
def draw_thumbnail_only_tile(base_img: Image.Image, row: pd.Series, x: int, y: int, theme: dict):
    draw = ImageDraw.Draw(base_img)

    draw.rounded_rectangle(
        (x, y, x + TILE_W, y + THUMB_ONLY_TILE_H),
        radius=CARD_RADIUS,
        fill=theme["card_bg"],
        outline=theme["card_border"],
        width=1,
    )

    thumb = fetch_thumbnail(row["thumbnail_url"])
    if thumb is None:
        thumb = make_placeholder_thumb(row["video_id"], TILE_W, THUMB_ONLY_TILE_H, theme)
    else:
        thumb = fit_and_crop(thumb, TILE_W, THUMB_ONLY_TILE_H)

    base_img.paste(thumb, (x, y))


def generate_thumbnail_only_image(thumbnail_df: pd.DataFrame, image_title: str, subtitle: str, theme: dict) -> Image.Image:
    img = Image.new("RGB", (IMAGE_W, THUMB_ONLY_IMAGE_H), theme["bg_color"])
    draw = ImageDraw.Draw(img)

    draw.text((OUTER_PAD_X, THUMB_ONLY_TITLE_Y), image_title, fill=theme["text_color"], font=FONT_URL_HEADER)
    draw.text((OUTER_PAD_X, THUMB_ONLY_SUB_Y), subtitle, fill=theme["subtext_color"], font=FONT_SUB)
    draw.line(
        (OUTER_PAD_X, THUMB_ONLY_RULE_Y, IMAGE_W - OUTER_PAD_X, THUMB_ONLY_RULE_Y),
        fill=theme["card_border"], width=2,
    )

    start_y = THUMB_ONLY_BODY_TOP_Y
    for idx, (_, row) in enumerate(thumbnail_df.iterrows()):
        r = idx // COLS
        c = idx % COLS
        x = OUTER_PAD_X + c * (TILE_W + GRID_GAP)
        y = start_y + r * (THUMB_ONLY_TILE_H + GRID_GAP)
        draw_thumbnail_only_tile(img, row, x, y, theme)

    total_slots = ROWS * COLS
    for idx in range(len(thumbnail_df), total_slots):
        r = idx // COLS
        c = idx % COLS
        x = OUTER_PAD_X + c * (TILE_W + GRID_GAP)
        y = start_y + r * (THUMB_ONLY_TILE_H + GRID_GAP)

        draw.rounded_rectangle(
            (x, y, x + TILE_W, y + THUMB_ONLY_TILE_H),
            radius=CARD_RADIUS,
            fill=theme["bg_color"],
            outline=theme["card_border"],
            width=1,
        )

    footer = "Generated from manually entered YouTube URLs / Thumbnail-only mode"
    draw.text((OUTER_PAD_X, THUMB_ONLY_IMAGE_H - 24), footer, fill=theme["subtext_color"], font=FONT_FOOTER)

    return img


def pil_image_to_png_bytes(img: Image.Image) -> bytes:
    bio = io.BytesIO()
    img.save(bio, format="PNG")
    return bio.getvalue()


# =========================
# 共通描画
# =========================
def render_result_block(
    df_source: pd.DataFrame,
    image_title: str,
    subtitle: str,
    theme: dict,
    download_filename: str,
    empty_message: str,
):
    if df_source.empty:
        st.warning(empty_message)
        return

    top_df = build_top_videos(df_source, top_n=9)

    with st.spinner("画像生成中..."):
        summary_image = generate_tile_image(
            top_df=top_df,
            image_title=image_title,
            subtitle=subtitle,
            theme=theme,
        )
        png_bytes = pil_image_to_png_bytes(summary_image)

    col1, col2, col3 = st.columns(3)
    col1.metric("総視聴履歴数", f"{len(df_source):,}")
    col2.metric("ユニーク動画数", f"{df_source['video_id'].nunique():,}")
    col3.metric("画像タイル数", f"{len(top_df):,}/9")

    st.markdown("---")
    st.subheader("生成画像プレビュー")
    st.image(summary_image, use_container_width=True)

    st.download_button(
        label="PNGをダウンロード",
        data=png_bytes,
        file_name=download_filename,
        mime="image/png",
        use_container_width=True,
    )

    st.markdown("---")
    st.subheader("選ばれた9本")

    preview_cols = st.columns(3)
    for idx, row in enumerate(top_df.itertuples(index=False)):
        with preview_cols[idx % 3]:
            st.image(row.thumbnail_url, use_container_width=True)
            st.markdown(f"**{row.title}**")
            st.caption(f"{row.channel_name}")


def render_thumbnail_only_block(
    thumbnail_df: pd.DataFrame,
    image_title: str,
    subtitle: str,
    theme: dict,
    download_filename: str,
):
    if thumbnail_df.empty:
        st.warning("有効なYouTube URLが見つかりませんでした。")
        return

    with st.spinner("画像生成中..."):
        summary_image = generate_thumbnail_only_image(
            thumbnail_df=thumbnail_df,
            image_title=image_title,
            subtitle=subtitle,
            theme=theme,
        )
        png_bytes = pil_image_to_png_bytes(summary_image)

    col1, col2 = st.columns(2)
    col1.metric("採用件数", f"{len(thumbnail_df):,}/9")
    col2.metric("表示形式", "サムネのみ")

    st.markdown("---")
    st.subheader("生成画像プレビュー")
    st.image(summary_image, use_container_width=True)

    st.download_button(
        label="PNGをダウンロード",
        data=png_bytes,
        file_name=download_filename,
        mime="image/png",
        use_container_width=True,
    )

    st.markdown("---")
    st.subheader("採用された動画ID")
    st.dataframe(thumbnail_df[["video_id"]], use_container_width=True, hide_index=True)

