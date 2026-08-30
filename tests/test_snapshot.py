"""snapshot.py の回帰テスト。

YouTube API は叩かず、必要な3エンドポイントだけを模したダミーで
スナップショットのスキーマと変換を固定する。
"""

from __future__ import annotations

import datetime
import json

import pytest

from sixfonia_analytics import config, snapshot


# ============================================================
# YouTube API のダミー
# ============================================================
class _Request:
    def __init__(self, payload):
        self._payload = payload

    def execute(self):
        return self._payload


class _Channels:
    def list(self, part, id=None, **kwargs):
        return _Request({"items": [{"contentDetails": {
            "relatedPlaylists": {"uploads": f"UU{id[2:]}"}
        }}]})


class _PlaylistItems:
    def __init__(self, videos_by_playlist):
        self._videos = videos_by_playlist

    def list(self, part, playlistId, maxResults=50, pageToken=None, **kwargs):
        return _Request({"items": self._videos.get(playlistId, [])})


class _Videos:
    """videos.list のダミー。contentDetails / snippet / status を返す。"""

    def __init__(self, details):
        self._details = details

    def list(self, part, id, **kwargs):
        items = []
        for vid in id.split(","):
            d = self._details.get(vid, {})
            items.append({
                "id": vid,
                "contentDetails": {"duration": d.get("duration", "PT1M")},
                "snippet": {"title": d.get("title", ""), "tags": d.get("tags", [])},
                "status": {
                    "privacyStatus": "private" if d.get("private") else "public",
                    "uploadStatus": "processed",
                },
            })
        return _Request({"items": items})


class FakeYouTube:
    def __init__(self, videos_by_playlist, details):
        self._playlist_items = _PlaylistItems(videos_by_playlist)
        self._videos = _Videos(details)

    def channels(self):
        return _Channels()

    def playlistItems(self):
        return self._playlist_items

    def videos(self):
        return self._videos


HIMA = config.CHANNEL_BY_NAME["hima72"]["channel_id"]
KOSAME = config.CHANNEL_BY_NAME["kosame"]["channel_id"]


def _item(video_id: str, title: str, published: str) -> dict:
    return {
        "snippet": {"title": title},
        "contentDetails": {"videoId": video_id, "videoPublishedAt": published},
    }


@pytest.fixture
def youtube():
    return FakeYouTube(
        videos_by_playlist={
            f"UU{HIMA[2:]}": [
                _item("vidAAAAAAAA", "【テスト】長尺", "2026-08-20T11:00:00Z"),
                _item("vidFFFFFFFF", "【テスト】ショート", "2026-08-25T09:00:00Z"),
            ],
            f"UU{KOSAME[2:]}": [
                _item("vidBBBBBBBB", "【テスト】こさめの動画", "2026-08-22T15:00:00Z"),
            ],
        },
        details={
            "vidAAAAAAAA": {
                "duration": "PT21M24S",
                "title": "【テスト】長尺 #シクフォニ #テスト",
                "tags": ["シクフォニ", "歌ってみた"],
            },
            "vidFFFFFFFF": {"duration": "PT48S", "title": "【テスト】ショート #shorts"},
            # 非公開になった動画。一覧には残るが available=False になる
            "vidBBBBBBBB": {"duration": "PT4M2S", "title": "【テスト】こさめの動画",
                            "private": True},
        },
    )


@pytest.fixture
def snap(youtube):
    return snapshot.build_snapshot(youtube, channels=["hima72", "kosame"])


# ============================================================
# スキーマ
# ============================================================
def test_top_level_keys(snap):
    assert set(snap) == {"updated_at", "channels", "videos"}


def test_channel_entries(snap):
    assert snap["channels"] == [
        {"name": "hima72", "display": "暇72", "channelId": HIMA},
        {"name": "kosame", "display": "雨乃こさめ", "channelId": KOSAME},
    ]


def test_video_fields(snap):
    video = next(v for v in snap["videos"] if v["videoId"] == "vidAAAAAAAA")
    assert video == {
        "videoId": "vidAAAAAAAA",
        "channel": "hima72",
        "title": "【テスト】長尺",
        "publishedAt": "2026-08-20T11:00:00Z",
        "durationSec": 21 * 60 + 24,
        "isShort": False,
        "thumbnail": "https://img.youtube.com/vi/vidAAAAAAAA/mqdefault.jpg",
        "tags": ["シクフォニ", "歌ってみた", "テスト"],
        "available": True,
    }


def test_published_at_is_utc_z(snap):
    """JST に変換された値を UTC の Z 表記へ戻していること。"""
    for video in snap["videos"]:
        assert video["publishedAt"].endswith("Z")
    kosame = next(v for v in snap["videos"] if v["channel"] == "kosame")
    assert kosame["publishedAt"] == "2026-08-22T15:00:00Z"


def test_short_detection(snap):
    shorts = {v["videoId"]: v["isShort"] for v in snap["videos"]}
    assert shorts["vidFFFFFFFF"] is True   # 48秒
    assert shorts["vidAAAAAAAA"] is False  # 21分


def test_sorted_newest_first(snap):
    published = [v["publishedAt"] for v in snap["videos"]]
    assert published == sorted(published, reverse=True)


# ============================================================
# 読み書きとヘルパー
# ============================================================
def test_save_and_load_roundtrip(snap, tmp_path):
    path = snapshot.save_snapshot(snap, tmp_path / "nested" / "videos.json")
    assert path.exists()
    assert snapshot.load_snapshot(path) == snap


def test_json_is_utf8_not_escaped(snap, tmp_path):
    """日本語をエスケープしない。ファイルサイズを不必要に増やさないため。"""
    path = snapshot.save_snapshot(snap, tmp_path / "videos.json")
    text = path.read_text(encoding="utf-8")
    assert "暇72" in text
    assert "\\u" not in text


def test_video_channel_map(snap):
    mapping = snapshot.video_channel_map(snap)
    assert mapping == {
        "vidAAAAAAAA": "hima72",
        "vidFFFFFFFF": "hima72",
        "vidBBBBBBBB": "kosame",
    }


def test_display_names(snap):
    assert snapshot.display_names(snap) == {"hima72": "暇72", "kosame": "雨乃こさめ"}


def test_is_stale():
    fresh = {"updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}
    old = {"updated_at": (datetime.datetime.now(datetime.timezone.utc)
                          - datetime.timedelta(hours=48)).isoformat()}
    assert snapshot.is_stale(fresh) is False
    assert snapshot.is_stale(old) is True
    # しきい値は変えられる
    assert snapshot.is_stale(old, hours=72) is False


# ============================================================
# タグ・公開状態（B のタグ絞り込みと削除バッジのため）
# ============================================================
def test_tags_merge_api_and_hashtags(snap):
    """videos.list のタグとタイトルのハッシュタグを、順序を保って重複なく統合する。"""
    video = next(v for v in snap["videos"] if v["videoId"] == "vidAAAAAAAA")
    assert video["tags"] == ["シクフォニ", "歌ってみた", "テスト"]


def test_hashtag_only_video_still_gets_tags(snap):
    """API 側にタグが無くても、タイトルのハッシュタグは拾う。"""
    video = next(v for v in snap["videos"] if v["videoId"] == "vidFFFFFFFF")
    assert video["tags"] == ["shorts"]


def test_every_video_has_tags_list(snap):
    """タグが無い動画でも None ではなく空リストにする（呼び出し側の分岐を減らす）。"""
    assert all(isinstance(v["tags"], list) for v in snap["videos"])


def test_available_flag(snap):
    by_id = {v["videoId"]: v["available"] for v in snap["videos"]}
    assert by_id["vidBBBBBBBB"] is False  # 非公開
    assert by_id["vidAAAAAAAA"] is True


def test_view_count_is_not_included(snap):
    """再生数は BigQuery 側から配る。毎日変わる値をここに入れない。"""
    assert all("viewCount" not in v for v in snap["videos"])
