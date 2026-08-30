"""Google Takeout（YouTube と YouTube Music）のパーサ。

対象ファイル:
    history/watch-history.json   視聴履歴
    comments/comments*.csv       自分のコメント
    live chats/live chats*.csv   自分のライブチャット

設計上の要点（実データで確認済み）:

- **チャンネルの判定に subtitles を使わない。** 削除・非公開になった動画は
  subtitles が丸ごと欠落し、title も URL 文字列そのものになる。
  判定は video_id をスナップショット（snapshot.video_channel_map）に
  突き合わせて行う。ここで返す channel_name はあくまで参考値。
- **コミュニティ投稿（"Viewed …"）を必ず落とす。** 投稿本文が丸ごと title に
  入るため、残すと語彙にも順位にも影響する。titleUrl に v= が無いことで判別できる。
- **ロケールが環境によって変わる。** 英語なら "Watched …"、日本語なら
  "… を視聴しました"。両方を受け付ける。
- **コメントの Channel ID 列は自分のチャンネルID**であって、コメント先の
  動画のものではない。チャンネル判定には使えない。
- **Comment Text 列は runs 形式のJSON断片。** そのまま使うとJSON記法が本文に混ざる。
"""

from __future__ import annotations

import csv
import datetime
import io
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any, Iterable

from .collect import JST

# ============================================================
# 動画IDの抽出
# ============================================================
# 11文字固定。緩い正規表現だと後続パラメータを巻き込んだIDを拾う。
_VIDEO_ID_PATTERNS = [
    re.compile(r"[?&]v=([A-Za-z0-9_-]{11})"),
    re.compile(r"youtu\.be/([A-Za-z0-9_-]{11})"),
    re.compile(r"/shorts/([A-Za-z0-9_-]{11})"),
    re.compile(r"/live/([A-Za-z0-9_-]{11})"),
]


def extract_video_id(url: str | None) -> str | None:
    if not url or not isinstance(url, str):
        return None
    for pattern in _VIDEO_ID_PATTERNS:
        m = pattern.search(url)
        if m:
            return m.group(1)
    return None


# ============================================================
# タイトルのロケール差の吸収
# ============================================================
_TITLE_PREFIXES = ("Watched ", "Viewed ", "Used ")
_TITLE_SUFFIXES = (" を視聴しました", "を視聴しました", " を表示しました", "を表示しました")


def clean_watch_title(title: str | None) -> str:
    """視聴履歴の title から「視聴しました」相当の装飾を外す。

    英語ロケール: "Watched 【リズム天国】…"
    日本語ロケール: "【リズム天国】… を視聴しました"
    """
    if not title:
        return ""
    text = str(title)
    for prefix in _TITLE_PREFIXES:
        if text.startswith(prefix):
            text = text[len(prefix):]
            break
    for suffix in _TITLE_SUFFIXES:
        if text.endswith(suffix):
            text = text[: -len(suffix)]
            break
    return text.strip()


# ============================================================
# 入力ソースの正規化
# ============================================================
def _read_text(source: Any) -> str:
    """パス・ファイルオブジェクト・bytes のいずれからでも文字列を取り出す。

    Streamlit の UploadedFile をそのまま渡せるようにするためのもの。
    """
    if isinstance(source, (str, Path)):
        return Path(source).read_text(encoding="utf-8-sig")
    if isinstance(source, bytes):
        return source.decode("utf-8-sig")
    data = source.read()
    if isinstance(data, bytes):
        return data.decode("utf-8-sig")
    return data


def _as_list(sources: Any) -> list:
    if sources is None:
        return []
    if isinstance(sources, (str, Path, bytes)):
        return [sources]
    if isinstance(sources, Iterable) and not hasattr(sources, "read"):
        return list(sources)
    return [sources]


# ============================================================
# 視聴履歴
# ============================================================
def parse_watch_history(source: Any) -> list[dict]:
    """watch-history.json を解析して動画の視聴イベント一覧を返す。

    返す行: video_id / title / channel_id / channel_name / watched_at(JST) / product

    コミュニティ投稿・titleUrl なし・動画ID を取り出せないものは落とす。
    YouTube Music 経由の再生（header が "YouTube Music"）は残す。
    """
    if isinstance(source, list):
        entries = source
    else:
        entries = json.loads(_read_text(source))

    rows: list[dict] = []
    for entry in entries:
        video_id = extract_video_id(entry.get("titleUrl"))
        if not video_id:
            continue  # コミュニティ投稿・titleUrl なし

        subtitles = entry.get("subtitles") or []
        channel_id = channel_name = None
        if subtitles and isinstance(subtitles[0], dict):
            channel_name = subtitles[0].get("name")
            channel_id = (subtitles[0].get("url") or "").rsplit("/", 1)[-1] or None

        watched_at = None
        raw_time = entry.get("time")
        if raw_time:
            try:
                dt = datetime.datetime.fromisoformat(str(raw_time).replace("Z", "+00:00"))
                watched_at = dt.astimezone(JST)
            except ValueError:
                watched_at = None
        if watched_at is None:
            continue

        rows.append({
            "video_id": video_id,
            "title": clean_watch_title(entry.get("title")),
            "channel_id": channel_id,
            "channel_name": channel_name,
            "watched_at": watched_at,
            "product": entry.get("header") or "YouTube",
        })
    return rows


def history_period(rows: list[dict]) -> tuple[datetime.datetime, datetime.datetime] | None:
    """視聴履歴がカバーする期間（JST）。未視聴判定の但し書きに使う。"""
    if not rows:
        return None
    times = [r["watched_at"] for r in rows]
    return min(times), max(times)


def filter_period(rows: list[dict],
                  since: datetime.date | None = None,
                  until: datetime.date | None = None) -> list[dict]:
    """JSTの日付で期間を絞る。since / until はいずれも境界を含む。"""
    out = []
    for r in rows:
        d = r["watched_at"].date()
        if since and d < since:
            continue
        if until and d > until:
            continue
        out.append(r)
    return out


def watch_counts(rows: list[dict]) -> Counter:
    """video_id -> 視聴回数。"""
    return Counter(r["video_id"] for r in rows)


def aggregate(rows: list[dict]) -> list[dict]:
    """video_id 単位に畳んで視聴回数順に並べる。

    返す行: video_id / watch_count / first_at / last_at / title / channel_name
    同数のときは最後に見た日時が新しいものを上位にする。
    """
    counts = watch_counts(rows)
    latest: dict[str, dict] = {}
    first: dict[str, datetime.datetime] = {}
    for r in rows:
        vid = r["video_id"]
        if vid not in latest or r["watched_at"] > latest[vid]["watched_at"]:
            latest[vid] = r
        if vid not in first or r["watched_at"] < first[vid]:
            first[vid] = r["watched_at"]

    out = [{
        "video_id": vid,
        "watch_count": n,
        "first_at": first[vid],
        "last_at": latest[vid]["watched_at"],
        "title": latest[vid]["title"],
        "channel_name": latest[vid]["channel_name"],
    } for vid, n in counts.items()]

    out.sort(key=lambda r: (r["watch_count"], r["last_at"]), reverse=True)
    return out


# ============================================================
# コメント / ライブチャット
# ============================================================
def runs_to_text(raw: str | None) -> str:
    """runs 形式のJSON断片を本文へ。

    '{"text":"7:47"},{"text":"\\n"},{"text":"おいしい"}' -> "7:47\\nおいしい"
    タイムスタンプ付きコメントは videoLink を伴うが、text だけを拾えばよい。
    パースできない場合は生の文字列をそのまま返す（silent failure を作らない）。
    """
    if not raw:
        return ""
    try:
        runs = json.loads("[" + raw + "]")
    except (json.JSONDecodeError, TypeError):
        return str(raw)
    if not isinstance(runs, list):
        return str(raw)
    return "".join(r.get("text", "") for r in runs if isinstance(r, dict))


def _parse_timestamp(raw: str | None) -> datetime.datetime | None:
    if not raw:
        return None
    try:
        dt = datetime.datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    return dt.astimezone(JST)


def _read_csv_rows(source: Any) -> list[dict]:
    return list(csv.DictReader(io.StringIO(_read_text(source))))


def parse_comments(sources: Any) -> list[dict]:
    """comments*.csv を解析する。複数ファイルをまとめて渡せる。

    Takeout はコメントを comments.csv と comments(1).csv に分割して出力するため、
    Comment ID で重複を排除しながら結合する。

    返す行: comment_id / video_id / post_id / created_at(JST) / text /
            is_reply / is_super_thanks / price
    """
    rows: list[dict] = []
    seen: set[str] = set()
    for source in _as_list(sources):
        for raw in _read_csv_rows(source):
            comment_id = (raw.get("Comment ID") or "").strip()
            if comment_id and comment_id in seen:
                continue
            if comment_id:
                seen.add(comment_id)
            try:
                price = int(raw.get("Price") or 0)
            except ValueError:
                price = 0
            rows.append({
                "comment_id": comment_id,
                "video_id": (raw.get("Video ID") or "").strip() or None,
                "post_id": (raw.get("Post ID") or "").strip() or None,
                "created_at": _parse_timestamp(raw.get("Comment Create Timestamp")),
                "text": runs_to_text(raw.get("Comment Text")),
                "is_reply": bool((raw.get("Parent Comment ID") or "").strip()),
                "is_super_thanks": price > 0,
                "price": price,
            })
    return rows


def parse_live_chats(sources: Any) -> list[dict]:
    """live chats*.csv を解析する。Video ID を持つのでコメントと同じ扱いができる。"""
    rows: list[dict] = []
    seen: set[str] = set()
    for source in _as_list(sources):
        for raw in _read_csv_rows(source):
            chat_id = (raw.get("Live Chat ID") or "").strip()
            if chat_id and chat_id in seen:
                continue
            if chat_id:
                seen.add(chat_id)
            rows.append({
                "comment_id": chat_id,
                "video_id": (raw.get("Video ID") or "").strip() or None,
                "post_id": None,
                "created_at": _parse_timestamp(raw.get("Live Chat Create Timestamp")),
                "text": runs_to_text(raw.get("Live Chat Text")),
                "is_reply": False,
                "is_super_thanks": False,
                "price": 0,
            })
    return rows


# ============================================================
# スナップショットとの突合
# ============================================================
def attach_channel(rows: list[dict], video_channel_map: dict[str, str],
                   key: str = "video_id") -> tuple[list[dict], int]:
    """行に channel を付ける。返り値は (付与済みの行, 判定できなかった件数)。

    video_channel_map は snapshot.video_channel_map() の結果。
    対象チャンネル以外の動画は channel が None になる。
    """
    out: list[dict] = []
    unknown = 0
    for r in rows:
        channel = video_channel_map.get(r.get(key) or "")
        if channel is None:
            unknown += 1
        out.append({**r, "channel": channel})
    return out, unknown
