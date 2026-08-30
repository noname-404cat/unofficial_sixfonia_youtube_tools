"""シクフォニ YouTube ツールの共通パッケージ。

- config    チャンネル定義（7ch）・語彙プリセット
- auth      APIキーの取得（Secrets / 環境変数。コードへの直書きは禁止）
- collect   YouTube Data API からの取得
- enrich    サムネURLなどのメタデータ補助
- snapshot  動画マスタのスナップショット生成・読み込み
- takeout   Google Takeout（視聴履歴・コメント・ライブチャット）のパーサ

重い依存はモジュール単位で遅延importするため、ここでは config のみ公開する。
"""

__version__ = "0.1.0"

from . import config  # noqa: F401
