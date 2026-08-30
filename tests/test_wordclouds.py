"""wordclouds.py の回帰テスト。

実データでサンプルを作ったときに見つかった「そのままでは使えない」症状を固定する。
"""

from __future__ import annotations

import pytest

wordclouds = pytest.importorskip("wordclouds")
pytest.importorskip("janome", reason="janome が必要（pip install -e '.[web]'）")


@pytest.fixture(scope="module")
def tokenizer():
    return wordclouds.build_tokenizer()


# ============================================================
# ノイズ語の除去（サンプル生成で見つかった症状）
# ============================================================
@pytest.mark.parametrize("text", [
    "ｗｗｗ", "www", "WWW", "ww",
])
def test_laughter_is_dropped(tokenizer, text):
    """w の連続は名詞判定されるが内容を持たない。全体で24回・最大級に描画されていた。"""
    assert wordclouds.extract_nouns(tokenizer, text) == []


def test_symbol_runs_are_dropped(tokenizer):
    """"---" のような記号列が語として描画されていた。"""
    assert "---" not in wordclouds.extract_nouns(tokenizer, "すごい --- おわり")


@pytest.mark.parametrize("word", ["再生", "投稿", "配信", "コメント", "チャンネル", "動画"])
def test_youtube_generic_words_are_dropped(tokenizer, word):
    """どのチャンネルでも上位に来てしまい、個性を消す語。"""
    assert word not in wordclouds.extract_nouns(tokenizer, f"この{word}が好き")


def test_meaningful_words_survive(tokenizer):
    words = wordclouds.extract_nouns(tokenizer, "この替え歌が好きすぎてリピートしてる")
    assert "替え歌" in words
    assert "リピート" in words


def test_custom_words_stay_together(tokenizer):
    """メンバー名や複合語が分割されないこと。"""
    words = wordclouds.extract_nouns(tokenizer, "暇72とシクフォニの声真似が好き")
    assert "暇72" in words
    assert "シクフォニ" in words
    assert "声真似" in words


def test_urls_and_timestamps_are_stripped(tokenizer):
    words = wordclouds.extract_nouns(
        tokenizer, "7:47 https://example.com/abc の替え歌"
    )
    assert "替え歌" in words
    assert not [w for w in words if "http" in w or ":" in w]


# ============================================================
# 語数のしきい値
# ============================================================
def test_verdict_thresholds():
    assert wordclouds.verdict_for(0, 0) == wordclouds.VERDICT_EMPTY
    assert wordclouds.verdict_for(30, 0) == wordclouds.VERDICT_EMPTY
    # 1,140字あっても延べ117語しかなかった実例を落とせること
    assert wordclouds.verdict_for(30, 117) == wordclouds.VERDICT_THIN
    assert wordclouds.verdict_for(76, 421) == wordclouds.VERDICT_OK


def test_adaptive_max_words():
    """語数が少ないのに枠だけ大きいと、全語が同じ大きさで並んで情報を持たない。"""
    assert wordclouds.adaptive_max_words(117) == 39
    assert wordclouds.adaptive_max_words(10_000) == wordclouds.MAX_WORDS_CAP
    assert wordclouds.adaptive_max_words(3) == 20


# ============================================================
# 集計
# ============================================================
def test_analyze_assigns_channels_by_video_id(tokenizer):
    comments = [
        {"video_id": "vidAAAAAAAA", "text": "この替え歌が好き"},
        {"video_id": "vidBBBBBBBB", "text": "リピートが止まらない"},
        {"video_id": "vidZZZZZZZZ", "text": "対象外のチャンネル"},
        {"video_id": None, "text": "コミュニティ投稿へのコメント"},
    ]
    mapping = {"vidAAAAAAAA": "hima72", "vidBBBBBBBB": "hima72"}
    result = wordclouds.analyze(comments, mapping, tokenizer=tokenizer)

    assert result["channels"]["hima72"]["comments"] == 2
    assert result["channels"]["kosame"]["comments"] == 0
    assert result["all"]["comments"] == 2
    assert result["unknown"] == 2
    assert result["channels"]["kosame"]["verdict"] == wordclouds.VERDICT_EMPTY


def test_analyze_covers_all_seven_channels(tokenizer):
    from sixfonia_analytics import config

    result = wordclouds.analyze([], {}, tokenizer=tokenizer)
    assert set(result["channels"]) == set(config.CHANNEL_NAMES)
    assert len(result["channels"]) == 7
