"""takeout.py の回帰テスト。

実データ（個人の視聴履歴）はコミットできないので、
実データで確認した挙動を再現する匿名フィクスチャで固定する。
"""

from __future__ import annotations

import datetime
from pathlib import Path

import pytest

from sixfonia_analytics import takeout

FIXTURES = Path(__file__).parent / "fixtures"
HISTORY = FIXTURES / "watch-history.sample.json"
COMMENTS = FIXTURES / "comments.sample.csv"


@pytest.fixture(scope="module")
def history():
    return takeout.parse_watch_history(HISTORY)


# ============================================================
# 動画IDの抽出
# ============================================================
@pytest.mark.parametrize("url,expected", [
    ("https://www.youtube.com/watch?v=vidAAAAAAAA", "vidAAAAAAAA"),
    ("https://www.youtube.com/watch?v=vidGGGGGGGG&t=120s", "vidGGGGGGGG"),
    ("https://youtu.be/vidEEEEEEEE", "vidEEEEEEEE"),
    ("https://www.youtube.com/shorts/vidFFFFFFFF", "vidFFFFFFFF"),
    ("https://www.youtube.com/live/vidFFFFFFFF", "vidFFFFFFFF"),
    ("https://www.youtube.com/post/UgkxTESTTESTTESTTESTTESTTEST", None),
    ("", None),
    (None, None),
])
def test_extract_video_id(url, expected):
    assert takeout.extract_video_id(url) == expected


def test_video_id_is_exactly_eleven_chars():
    """緩い正規表現だと後続パラメータを巻き込む。11文字で切れることを固定する。"""
    got = takeout.extract_video_id("https://www.youtube.com/watch?v=vidGGGGGGGG&pp=ABCDEFG")
    assert got == "vidGGGGGGGG"
    assert len(got) == 11


# ============================================================
# タイトルのロケール差
# ============================================================
@pytest.mark.parametrize("raw,expected", [
    ("Watched 【テスト】タイトル", "【テスト】タイトル"),
    ("【テスト】タイトル を視聴しました", "【テスト】タイトル"),
    ("【テスト】タイトル", "【テスト】タイトル"),
    ("", ""),
    (None, ""),
])
def test_clean_watch_title(raw, expected):
    assert takeout.clean_watch_title(raw) == expected


def test_no_locale_decoration_survives(history):
    assert not [r for r in history if r["title"].startswith(("Watched", "Viewed"))]
    assert not [r for r in history if r["title"].endswith("を視聴しました")]


# ============================================================
# 視聴履歴の絞り込み
# ============================================================
def test_drops_posts_and_entries_without_url_or_time(history):
    # 11エントリ中、コミュニティ投稿1・titleUrlなし1・timeなし1 が落ちる
    assert len(history) == 8
    assert len({r["video_id"] for r in history}) == 7


def test_keeps_youtube_music(history):
    music = [r for r in history if r["product"] == "YouTube Music"]
    assert len(music) == 1
    assert music[0]["video_id"] == "vidCCCCCCCC"


def test_keeps_entries_without_subtitles(history):
    """削除・非公開動画は subtitles が欠落する。落とさず video_id で拾う。"""
    orphan = [r for r in history if r["channel_id"] is None]
    assert len(orphan) == 1
    assert orphan[0]["video_id"] == "vidDDDDDDDD"


def test_watched_at_is_jst(history):
    row = next(r for r in history if r["video_id"] == "vidBBBBBBBB")
    # 2026-06-01T10:00:00Z -> JST 19:00
    assert row["watched_at"].hour == 19
    assert row["watched_at"].utcoffset() == datetime.timedelta(hours=9)


# ============================================================
# 集計
# ============================================================
def test_aggregate_counts_and_order(history):
    agg = takeout.aggregate(history)
    assert agg[0]["video_id"] == "vidAAAAAAAA"
    assert agg[0]["watch_count"] == 2
    assert all(a["watch_count"] == 1 for a in agg[1:])
    assert len(agg) == 7


def test_history_period(history):
    start, end = takeout.history_period(history)
    assert start.date() == datetime.date(2026, 6, 1)
    assert end.date() == datetime.date(2026, 7, 10)


def test_filter_period(history):
    rows = takeout.filter_period(history, since=datetime.date(2026, 7, 1))
    assert {r["video_id"] for r in rows} == {"vidAAAAAAAA"}


# ============================================================
# コメント
# ============================================================
def test_comments_dedupe_by_comment_id():
    rows = takeout.parse_comments(COMMENTS)
    assert len(rows) == 4  # 5行のうち Comment ID 重複が1件


def test_runs_are_joined_into_plain_text():
    rows = takeout.parse_comments(COMMENTS)
    row = next(r for r in rows if r["comment_id"] == "UgTESTcomment0002")
    assert row["text"] == "7:47\nおいしい"
    assert '{"text"' not in row["text"]


def test_comment_flags():
    rows = takeout.parse_comments(COMMENTS)
    by_id = {r["comment_id"]: r for r in rows}
    assert by_id["UgTESTcomment0003"]["is_reply"] is True
    assert by_id["UgTESTcomment0003"]["is_super_thanks"] is True
    assert by_id["UgTESTcomment0001"]["is_reply"] is False
    # コミュニティ投稿へのコメントは video_id を持たない
    assert by_id["UgTESTcomment0004"]["video_id"] is None
    assert by_id["UgTESTcomment0004"]["post_id"] == "UgkxTESTPOST"


def test_runs_to_text_falls_back_on_broken_input():
    """パースできなくても例外にせず、生の文字列を返す。"""
    assert takeout.runs_to_text('壊れた入力') == "壊れた入力"
    assert takeout.runs_to_text("") == ""
    assert takeout.runs_to_text(None) == ""


def test_accepts_file_like_objects():
    """Streamlit の UploadedFile をそのまま渡せること。"""
    import io

    raw = COMMENTS.read_bytes()
    rows = takeout.parse_comments(io.BytesIO(raw))
    assert len(rows) == 4


# ============================================================
# スナップショットとの突合
# ============================================================
def test_attach_channel(history):
    mapping = {"vidAAAAAAAA": "hima72", "vidDDDDDDDD": "kosame"}
    rows, unknown = takeout.attach_channel(history, mapping)
    assert unknown == 5  # 8行中3行だけ解決できる（vidAAA×2 + vidDDD）
    assert {r["channel"] for r in rows if r["channel"]} == {"hima72", "kosame"}
    # subtitles が欠けていた動画もチャンネルを回復できる
    orphan = next(r for r in rows if r["video_id"] == "vidDDDDDDDD")
    assert orphan["channel"] == "kosame"
