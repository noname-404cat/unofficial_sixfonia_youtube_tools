import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# パッケージを未インストールでもテストできるようにする
sys.path.insert(0, str(ROOT))
# apps/streamlit のモジュール（tiles / wordclouds）を import できるようにする
sys.path.insert(0, str(ROOT / "apps" / "streamlit"))
