"""7チャンネルの動画マスタを1本のJSONスナップショットにまとめる。

新着一覧・未視聴チェック・コメント分析が共有する唯一のデータ源。
アプリ側から YouTube API を呼ばないようにするのが目的で、
生成は GitHub Actions が1日1回だけ行う。

取得は playlistItems.list（1 unit/50件）+ videos.list（1 unit/50件）で、
search.list（100 unit/回）は使わない。7チャンネルで 200 units/日程度に収まる。

CLI:
    python -m sixfonia_analytics.snapshot --out public/data/videos.json
"""

from __future__ import annotations

import argparse
import datetime
import json
import sys
from pathlib import Path

from . import collect, config, enrich

# スナップショットに載せるサムネイルの解像度
THUMBNAIL_QUALITY = "mqdefault"


def _to_utc_z(iso_string: str | None) -> str | None:
    """タイムゾーン付きISO文字列を UTC の 'Z' 表記へ正規化する。

    collect.fetch_video_master は JST に変換した文字列を返すが、
    スナップショットは配布物なので UTC で持つ。
    """
    if not iso_string:
        return None
    dt = datetime.datetime.fromisoformat(iso_string)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    return dt.astimezone(datetime.timezone.utc).isoformat().replace("+00:00", "Z")


def build_snapshot(youtube, channels: list[str] | None = None) -> dict:
    """7チャンネル分の動画マスタを取得してスナップショット辞書を返す。"""
    names = channels or config.CHANNEL_NAMES

    channel_entries: list[dict] = []
    videos: list[dict] = []

    for name in names:
        ch = config.CHANNEL_BY_NAME[name]
        print(f"=== {name} ({ch['display']}) ===", file=sys.stderr)
        rows = collect.fetch_video_master(youtube, ch["channel_id"])
        print(f"動画数: {len(rows)}", file=sys.stderr)

        channel_entries.append({
            "name": name,
            "display": ch["display"],
            "channelId": ch["channel_id"],
        })
        for r in rows:
            videos.append({
                "videoId": r["video_id"],
                "channel": name,
                "title": r["title"],
                "publishedAt": _to_utc_z(r["published_at"]),
                "durationSec": r["duration_seconds"],
                "isShort": r["is_short"],
                "thumbnail": enrich.thumbnail_url(r["video_id"], THUMBNAIL_QUALITY),
            })

    # 投稿日の新しい順。publishedAt が欠けたものは末尾へ。
    videos.sort(key=lambda v: v["publishedAt"] or "", reverse=True)

    now = datetime.datetime.now(collect.JST)
    return {
        "updated_at": now.isoformat(timespec="seconds"),
        "channels": channel_entries,
        "videos": videos,
    }


def save_snapshot(snap: dict, path: str | Path) -> Path:
    """スナップショットをJSONで保存する。親ディレクトリは自動で作る。"""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(snap, f, ensure_ascii=False, separators=(",", ":"))
    print(f"保存: {path}（{len(snap['videos'])}本 / {path.stat().st_size:,} bytes）",
          file=sys.stderr)
    return path


def load_snapshot(source: str | Path) -> dict:
    """ローカルパスまたはURLからスナップショットを読む。"""
    text = str(source)
    if text.startswith(("http://", "https://")):
        import requests

        res = requests.get(text, timeout=15)
        res.raise_for_status()
        return res.json()
    return json.loads(Path(source).read_text(encoding="utf-8"))


# ============================================================
# スナップショットを引くためのヘルパー
# ============================================================
def video_channel_map(snap: dict) -> dict[str, str]:
    """videoId -> channel名。視聴履歴・コメントのチャンネル判定に使う。

    視聴履歴の subtitles は削除・非公開動画で欠落するため、
    チャンネルの判定は必ずこのマップ経由で行う。
    """
    return {v["videoId"]: v["channel"] for v in snap["videos"]}


def video_map(snap: dict) -> dict[str, dict]:
    """videoId -> 動画レコード。"""
    return {v["videoId"]: v for v in snap["videos"]}


def display_names(snap: dict) -> dict[str, str]:
    """channel名 -> 表示名。"""
    return {c["name"]: c["display"] for c in snap["channels"]}


def is_stale(snap: dict, hours: int = 36) -> bool:
    """スナップショットが指定時間より古ければ True。

    Actions が失敗しても無言で古いデータを出し続けないよう、
    アプリ側がこれを見て警告を出す。
    """
    updated = datetime.datetime.fromisoformat(snap["updated_at"])
    if updated.tzinfo is None:
        updated = collect.JST.localize(updated)
    age = datetime.datetime.now(datetime.timezone.utc) - updated
    return age > datetime.timedelta(hours=hours)


# ============================================================
# CLI
# ============================================================
def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="7チャンネルの動画マスタスナップショットを生成する")
    parser.add_argument("--out", default="videos.json", help="出力先パス")
    parser.add_argument("--channels", nargs="*", default=None,
                        help="対象チャンネル名（既定: config.CHANNELS の全件）")
    args = parser.parse_args(argv)

    from . import auth

    snap = build_snapshot(auth.build_youtube(), channels=args.channels)
    save_snapshot(snap, args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
