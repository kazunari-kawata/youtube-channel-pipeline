#!/usr/bin/env bash
# 定期実行の準備（クラウドの新しいセッションは毎回まっさらなので、最初に1回。何度実行してもよい）
#   bash automation/setup.sh          # Python の部品だけ（調査・台帳・台本の工程）
#   bash automation/setup.sh --render # Remotion・フォント・人物・地図のデータも（visuals・checks の工程）
# 声の部品（ElevenLabs、faster-whisper）は入れない（定期実行では声を作らない）
set -euo pipefail
cd "$(dirname "$0")/.."

python3 -c "import yaml, numpy, scipy, PIL, shapefile, soundfile, pyloudnorm, dotenv, rasterio" 2>/dev/null || \
  pip install -q --break-system-packages numpy scipy pillow rasterio pyshp soundfile pyloudnorm pyyaml python-dotenv

if [[ "${1:-}" == "--render" ]]; then
  [[ -d remotion/node_modules ]] || (cd remotion && npm ci --no-audit --no-fund --loglevel=error)
  python3 pipeline/fetch_data.py --light
  # Remotion は current.json の回を読めないと Scene-Check も描けない。新しいセッションには無いので、登録済みの 003 の仮の尺を置く
  [[ -f remotion/src/data/current.json ]] || python3 pipeline/draft_preview.py 003-db-cooper --scene-only
fi
echo "準備できました${1:+（$1）}"
