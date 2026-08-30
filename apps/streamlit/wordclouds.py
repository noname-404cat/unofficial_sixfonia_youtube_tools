# 自分のコメントからワードクラウドを作る。
#
# 元は Colab の For_LAN_youtube_wordcloud.py（入力は「再生リストの概要欄」）。
# 入力層を Takeout のコメントに差し替え、描画側（janome・桜マスク・配色）は流用した。
#
# 実データでサンプルを作って分かったこと（対応済み）:
# - "ww" / "www" が名詞判定され、最大級の語として描画されてしまう
# - "再生" "投稿" "配信" "short" "ver" などのYouTube一般語がどのチャンネルでも
#   上位を占め、チャンネルの個性を消す
# - "---" のような記号列が語として描画される
# - prefer_horizontal=0.95 だと5%が縦向きになり、日本語が読めない
# - 語数が少ないと max_words を埋められず、全語が同じ大きさで並んで情報を持たない

from __future__ import annotations

import csv
import random
import re
import tempfile
from collections import Counter
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image, ImageChops, ImageDraw

from sixfonia_analytics import config

# ============================================================
# しきい値
# ============================================================
# 延べ語数がこれを下回ると「参考値」扱いにする。
# 文字数で判定していたが、1,140字あっても延べ117語しかない例があり、
# max_words の枠を埋められずワードクラウドとして成立しなかった。
MIN_TOKENS = 300

# ============================================================
# 語彙
# ============================================================
_PRESET = config.VOCAB_PRESETS["default"]

# 1語として扱いたい語（janome のユーザー辞書に入れる）
CUSTOM_WORDS: list[str] = list(_PRESET["single_words"])

# YouTube 一般語。どのチャンネルでも同じ顔ぶれになるため落とす。
YOUTUBE_STOPWORDS = {
    "動画", "再生", "投稿", "配信", "コメント", "チャンネル", "アーカイブ",
    "視聴", "公開", "登録", "通知", "高評価", "概要", "欄", "サムネ",
    "フル", "ショート", "short", "shorts", "ver", "live", "part",
}

# 笑い・相槌などの内容を持たない語
FILLER_STOPWORDS = {
    "さん", "ちゃん", "くん", "今回", "自分", "感じ", "思い", "思う",
    "本当", "ほんと", "ほんとに", "ホント", "めっちゃ", "めちゃ", "すごく",
}

STOPWORDS: set[str] = set(_PRESET["stop_words"]) | YOUTUBE_STOPWORDS | FILLER_STOPWORDS
SYNONYM_MAP: dict[str, str] = dict(_PRESET["synonym_map"])

# w の連続（ww / ｗｗｗ / WWW）は笑いなので語として扱わない
LAUGH_RE = re.compile(r"^[wｗWＷ]+$")
# かな・漢字・英数字を1文字も含まない語（"---" など）は落とす
WORD_CHAR_RE = re.compile(r"[ぁ-んァ-ヶー一-龥a-zA-Z0-9]")

URL_RE = re.compile(r"https?://\S+")
TIME_RE = re.compile(r"\b\d{1,2}:\d{2}(?::\d{2})?\b")


# ============================================================
# 形態素解析
# ============================================================
def build_tokenizer(custom_words: Optional[list[str]] = None):
    """ユーザー辞書つきの janome Tokenizer を返す。

    janome は純Pythonでビルド不要なので Streamlit Cloud でも確実に動く。
    辞書ファイルはカレントに書けない環境があるため一時ディレクトリへ出す。
    """
    from janome.tokenizer import Tokenizer

    words = custom_words if custom_words is not None else CUSTOM_WORDS
    if not words:
        return Tokenizer()

    tmpdir = Path(tempfile.mkdtemp(prefix="sixfonia_udic_"))
    udic = tmpdir / "user_dict.csv"
    with udic.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        for word in words:
            writer.writerow([word, "名詞", word])
    return Tokenizer(str(udic), udic_type="simpledic", udic_enc="utf8")


def extract_nouns(tokenizer, text: str, stopwords: Optional[set[str]] = None) -> list[str]:
    """名詞だけを取り出す。非自立・代名詞・数、1文字語、記号列、笑いは除く。"""
    stops = STOPWORDS if stopwords is None else stopwords
    text = TIME_RE.sub(" ", URL_RE.sub(" ", text or ""))

    words: list[str] = []
    for token in tokenizer.tokenize(text):
        pos = token.part_of_speech.split(",")
        if pos[0] != "名詞" or pos[1] in ("非自立", "代名詞", "数"):
            continue
        word = token.surface
        if len(word) < 2 or word.isdigit():
            continue
        if LAUGH_RE.match(word) or not WORD_CHAR_RE.search(word):
            continue
        if word in stops or word.lower() in stops:
            continue
        words.append(SYNONYM_MAP.get(word, word))
    return words


# ============================================================
# 桜マスク（元コードのまま）
# ============================================================
SIZE = 900
PETAL_W = 0.34
PETAL_H = 0.46
NOTCH = 0.22
_CENTER = SIZE // 2


def sakura_mask() -> np.ndarray:
    """5枚花びらの桜シルエット。白(255)=描画しない / 非白=描画する。"""
    def petal() -> Image.Image:
        layer = Image.new("L", (SIZE, SIZE), 0)
        draw = ImageDraw.Draw(layer)
        pw, ph = SIZE * PETAL_W, SIZE * PETAL_H
        draw.ellipse([_CENTER - pw / 2, _CENTER - ph,
                      _CENTER + pw / 2, _CENTER + SIZE * 0.03], fill=255)
        notch_w, notch_h = pw * 0.36, ph * NOTCH
        draw.polygon([(_CENTER - notch_w / 2, _CENTER - ph),
                      (_CENTER + notch_w / 2, _CENTER - ph),
                      (_CENTER, _CENTER - ph + notch_h)], fill=0)
        return layer

    flower = Image.new("L", (SIZE, SIZE), 0)
    for i in range(5):
        rotated = petal().rotate(i * 72, center=(_CENTER, _CENTER), resample=Image.BICUBIC)
        flower = ImageChops.lighter(flower, rotated)
    return 255 - np.array(flower)


# ============================================================
# 描画
# ============================================================
BACKGROUND_COLOR = "#A9276C"   # 背景（外側）
SAKURA_COLOR = "#F7B7D2"       # 桜の色（内側）
PALETTE = ["#5C3A21", "#6D4C41", "#7B4B2A", "#8B5E3C", "#A0522D", "#9C6644"]

MAX_WORDS_CAP = 130
MIN_FONT_SIZE = 12


def _color_func_factory(seed: int = 20260830):
    rng = random.Random(seed)

    def _color_func(word, **kwargs):
        return rng.choice(PALETTE)

    return _color_func


def adaptive_max_words(total_tokens: int) -> int:
    """語数に対して枠が大きすぎると桜の形が潰れるので、語数に応じて絞る。"""
    return max(20, min(MAX_WORDS_CAP, total_tokens // 3))


def render_wordcloud(freq: Counter, font_path: Optional[str],
                     mask: Optional[np.ndarray] = None,
                     total_tokens: Optional[int] = None) -> Image.Image:
    """頻度からワードクラウド画像を作る。"""
    from wordcloud import WordCloud

    if mask is None:
        mask = sakura_mask()
    if total_tokens is None:
        total_tokens = sum(freq.values())

    cloud = WordCloud(
        font_path=font_path,
        mask=mask,
        background_color=None,
        mode="RGBA",
        max_words=adaptive_max_words(total_tokens),
        min_font_size=MIN_FONT_SIZE,
        relative_scaling=0.45,
        prefer_horizontal=1.0,   # 日本語は縦回転すると読めない
        collocations=False,      # 頻度を直接渡すので連語推定は不要
        color_func=_color_func_factory(),
        random_state=42,
    ).generate_from_frequencies(freq)

    height, width = mask.shape
    base = Image.new("RGB", (width, height), BACKGROUND_COLOR)
    pink = Image.new("RGB", (width, height), SAKURA_COLOR)
    base.paste(pink, (0, 0), Image.fromarray(((mask < 128).astype("uint8")) * 255))

    final = base.convert("RGBA")
    final.alpha_composite(cloud.to_image())
    return final.convert("RGB")


# ============================================================
# 集計
# ============================================================
def analyze(comments: list[dict], video_channel_map: dict[str, str],
            tokenizer=None) -> dict:
    """コメントをチャンネル別に集計する。

    チャンネルの判定は video_id × スナップショット。
    comments.csv の Channel ID 列は自分のチャンネルIDなので使えない。

    返り値:
        {
          "channels": {name: {"comments", "chars", "tokens", "freq", "verdict"}},
          "all": {...},
          "unknown": 判定できなかった件数,
        }
    """
    if tokenizer is None:
        tokenizer = build_tokenizer()

    per_channel: dict[str, dict] = {
        name: {"comments": 0, "chars": 0, "words": []} for name in config.CHANNEL_NAMES
    }
    all_words: list[str] = []
    all_comments = all_chars = 0
    unknown = 0

    for comment in comments:
        channel = video_channel_map.get(comment.get("video_id") or "")
        if channel is None or channel not in per_channel:
            unknown += 1
            continue
        words = extract_nouns(tokenizer, comment["text"])
        bucket = per_channel[channel]
        bucket["comments"] += 1
        bucket["chars"] += len(comment["text"])
        bucket["words"].extend(words)
        all_words.extend(words)
        all_comments += 1
        all_chars += len(comment["text"])

    def _pack(comments_n: int, chars: int, words: list[str]) -> dict:
        return {
            "comments": comments_n,
            "chars": chars,
            "tokens": len(words),
            "unique": len(set(words)),
            "freq": Counter(words),
            "verdict": verdict_for(comments_n, len(words)),
        }

    return {
        "channels": {name: _pack(b["comments"], b["chars"], b["words"])
                     for name, b in per_channel.items()},
        "all": _pack(all_comments, all_chars, all_words),
        "unknown": unknown,
    }


VERDICT_EMPTY = "コメントがありません"
VERDICT_THIN = "語数不足のため参考値"
VERDICT_OK = "成立"


def verdict_for(comment_count: int, token_count: int) -> str:
    if comment_count == 0 or token_count == 0:
        return VERDICT_EMPTY
    if token_count < MIN_TOKENS:
        return VERDICT_THIN
    return VERDICT_OK
