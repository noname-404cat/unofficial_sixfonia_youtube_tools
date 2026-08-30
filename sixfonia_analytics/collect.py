"""YouTube Data API からの収集とCSV保存。

- fetch_channel_stats:  チャンネル全動画の統計（日次収集の本体）
- fetch_video_master :  動画一覧+メタデータ（投稿日時JST・動画長・Shorts判定）
- save_stats_csv     :  MASTER_COLUMNS スキーマで保存（デュアルライト対応）
"""

from __future__ import annotations

import csv
import datetime
import re
import time
from pathlib import Path

import pytz

from . import config

JST = pytz.timezone("Asia/Tokyo")


def today_str() -> str:
    return datetime.datetime.now(JST).strftime("%Y%m%d")


# ============================================================
# 取得系
# ============================================================
def get_uploads_playlist_id(youtube, channel_id: str) -> str:
    res = youtube.channels().list(part="contentDetails", id=channel_id).execute()
    if not res.get("items"):
        raise ValueError(f"チャンネルが見つかりません: {channel_id}")
    return res["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]


def resolve_channel_by_handle(youtube, handle: str) -> tuple[str, str]:
    """@handle から (channel_id, channel_title) を返す。"""
    res = youtube.channels().list(part="snippet", forHandle=handle).execute()
    item = res["items"][0]
    return item["id"], item["snippet"]["title"]


def iter_playlist_items(youtube, playlist_id: str, part: str = "contentDetails"):
    """プレイリストの全アイテムをページングしながら yield する。"""
    page_token = None
    while True:
        res = youtube.playlistItems().list(
            part=part, playlistId=playlist_id, maxResults=50, pageToken=page_token
        ).execute()
        yield from res.get("items", [])
        page_token = res.get("nextPageToken")
        if not page_token:
            break
        time.sleep(0.1)  # API制限対策


def fetch_channel_stats(youtube, channel_id: str, view_date: str) -> list[dict]:
    """チャンネル全動画の統計を MASTER_COLUMNS 形式の行リストで返す。"""
    playlist_id = get_uploads_playlist_id(youtube, channel_id)
    video_ids = [
        it["contentDetails"]["videoId"] for it in iter_playlist_items(youtube, playlist_id)
    ]

    rows: list[dict] = []
    for i in range(0, len(video_ids), 50):
        res = youtube.videos().list(
            part="statistics", id=",".join(video_ids[i : i + 50])
        ).execute()
        for item in res.get("items", []):
            st = item.get("statistics", {})
            rows.append({
                "videoId": item["id"],
                "viewCount": st.get("viewCount", "0"),
                "likeCount": st.get("likeCount", "0"),
                "commentCount": st.get("commentCount", "0"),
                "videoURL": f"https://www.youtube.com/watch?v={item['id']}",
                "view_date": view_date,
            })
        time.sleep(0.1)
    return rows


_DUR_H = re.compile(r"(\d+)H")
_DUR_M = re.compile(r"(\d+)M")
_DUR_S = re.compile(r"(\d+)S")


def parse_duration_seconds(iso_duration: str | None) -> int | None:
    """ISO 8601 duration (PT1H30M15S) を秒数へ。"""
    if not iso_duration:
        return None
    h = _DUR_H.search(iso_duration)
    m = _DUR_M.search(iso_duration)
    s = _DUR_S.search(iso_duration)
    return (
        (int(h.group(1)) if h else 0) * 3600
        + (int(m.group(1)) if m else 0) * 60
        + (int(s.group(1)) if s else 0)
    )


# タイトル中のハッシュタグ。日本語ハッシュタグも拾う。
_HASHTAG_RE = re.compile(
    r"#([0-9A-Za-z_぀-ゟ゠-ヿ一-龯㐀-䶿＀-ﾟ]+)"
)


def merge_tags(api_tags, title: str | None) -> list[str]:
    """videos.list のタグと、タイトルのハッシュタグをまとめる。

    先頭の # は落とし、出現順を保ったまま重複を除く。
    """
    merged: list[str] = []
    seen: set[str] = set()
    for tag in list(api_tags or []) + _HASHTAG_RE.findall(title or ""):
        tag = str(tag).lstrip("#").strip()
        key = tag.casefold()
        if tag and key not in seen:
            seen.add(key)
            merged.append(tag)
    return merged


def fetch_video_master(youtube, channel_id: str) -> list[dict]:
    """動画一覧+メタデータを返す。

    返す項目: video_id / title / published_at(JST) / duration_seconds /
              is_short / tags / available

    videos.list は1リクエスト1 unit で、取得する part を増やしても変わらない。
    そのため contentDetails に snippet（タグ）と status（公開状態）を足しても
    クォータは増えない。
    """
    playlist_id = get_uploads_playlist_id(youtube, channel_id)
    rows: list[dict] = []
    for it in iter_playlist_items(youtube, playlist_id, part="snippet,contentDetails"):
        published = it["contentDetails"].get("videoPublishedAt")
        published_jst = None
        if published:
            dt = datetime.datetime.fromisoformat(published.replace("Z", "+00:00"))
            published_jst = dt.astimezone(JST).isoformat()
        rows.append({
            "video_id": it["contentDetails"]["videoId"],
            "title": it["snippet"]["title"],
            "published_at": published_jst,
        })

    # 動画長・タグ・公開状態を videos.list で50件ずつ取得
    details: dict[str, dict] = {}
    ids = [r["video_id"] for r in rows]
    for i in range(0, len(ids), 50):
        res = youtube.videos().list(
            part="contentDetails,snippet,status", id=",".join(ids[i : i + 50])
        ).execute()
        for item in res.get("items", []):
            snippet = item.get("snippet") or {}
            status = item.get("status") or {}
            details[item["id"]] = {
                "duration_seconds": parse_duration_seconds(
                    (item.get("contentDetails") or {}).get("duration")
                ),
                "tags": merge_tags(snippet.get("tags"), snippet.get("title")),
                # 非公開・削除された動画は一覧に残ることがあるので印を付ける
                "available": (
                    status.get("privacyStatus") != "private"
                    and status.get("uploadStatus") not in ("deleted", "failed")
                ),
            }
        time.sleep(0.1)

    for r in rows:
        d = details.get(r["video_id"], {})
        secs = d.get("duration_seconds")
        r["duration_seconds"] = secs
        r["is_short"] = (secs is not None and secs <= 60)
        r["tags"] = d.get("tags", [])
        r["available"] = d.get("available", True)
    return rows


# ============================================================
# 保存系
# ============================================================
def save_stats_csv(rows: list[dict], channel_name: str, date_str: str,
                   dual_write: bool | None = None) -> list[Path]:
    """統計を保存。正: sixfonia_yt_analytics/<ch>/、移行期は YouTube_Data/ にも。"""
    if dual_write is None:
        dual_write = config.LEGACY_WRITE

    targets = [config.channel_dir(channel_name)]
    if dual_write:
        targets.append(config.LEGACY_DATA_DIR)

    saved = []
    fname = config.stats_filename(channel_name, date_str)
    for folder in targets:
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / fname
        with path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=config.MASTER_COLUMNS)
            writer.writeheader()
            writer.writerows(rows)
        saved.append(path)
        print(f"保存: {path}")
    return saved


def save_master_csv(rows: list[dict], channel_name: str) -> Path:
    folder = config.channel_dir(channel_name)
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{channel_name}_video_master.csv"
    fieldnames = ["video_id", "title", "published_at", "duration_seconds", "is_short"]
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"保存: {path}")
    return path


def collect_all_channels(youtube, date_str: str | None = None,
                         channels: list[str] | None = None) -> None:
    """全チャンネルの日次収集を実行する（daily_video_stats の本体）。"""
    date_str = date_str or today_str()
    for name in channels or config.CHANNEL_NAMES:
        ch = config.CHANNEL_BY_NAME[name]
        print(f"\n=== {name} ({ch['display']}) ===")
        rows = fetch_channel_stats(youtube, ch["channel_id"], date_str)
        print(f"動画数: {len(rows)}")
        save_stats_csv(rows, name, date_str)
