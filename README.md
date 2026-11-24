# youtube-channel-pipeline

ビジネス・経済・地理の教養動画を作るパイプライン。実データの3D地形と夜の衛星写真（Remotion + three.js）に、
ElevenLabs のナレーションとYouTubeオーディオライブラリのBGMを合わせて書き出し、自動の品質チェックを通す。

作業ルールは [CLAUDE.md](CLAUDE.md)、これまでの指摘と対策は [docs/feedback.md](docs/feedback.md)。

## 初回のセットアップ（Windows）

PowerShell で：

```powershell
winget install Git.Git GitHub.cli OpenJS.NodeJS.LTS Python.Python.3.12 Gyan.FFmpeg
gh auth login
gh repo clone kazunari-kawata/youtube-channel-pipeline
cd youtube-channel-pipeline

py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

cd remotion; npm ci; cd ..

Copy-Item .env.example .env   # .env をメモ帳で開き、ELEVENLABS_API_KEY= の後ろにキーを貼る

python pipeline/fetch_data.py  # 元データ 約700MB（初回だけ）
python pipeline/process_geo.py # 地形・夜景のテクスチャを作る（1分ほど）
```

- NVIDIA のドライバーは最新にしておく（書き出しはGPUで描く）
- 長い書き出しの間にスリープしないよう、電源設定でスリープを「なし」にする

## 1話を作る

```powershell
python pipeline/run.py 001-plains
```

途中から：`--from stage`（台本は同じで映像だけ直した）、1工程だけ：`--only qa`。
できあがり：`episodes/001-plains/build/video.mp4`、QA結果：`build/qa_report.json`。

### 個別のコマンド

| 工程 | コマンド |
| --- | --- |
| 声を探す・聞き比べる | `python pipeline/tts_voice_samples.py --library` / `--sample <voice_id>` |
| ナレーション | `python pipeline/tts_elevenlabs.py <id>`（`--only n05` で1区間だけ、`--dry-run` で文字数と概算費用） |
| 読み間違いチェック | `python pipeline/asr_check.py <id>` |
| 書き出しの準備 | `python pipeline/stage.py <id>` |
| 静止画で確認 | `python pipeline/render.py <id> --stills 0,900,1800` |
| 一部だけ書き出し | `python pipeline/render.py <id> --frames 0-299` → `python qa/check_video.py <id> --partial` |
| 書き出し | `python pipeline/render.py <id>` |
| 品質チェック | `python qa/check_video.py <id>` |
| 画面で調整 | `cd remotion; npm run studio` |

## 費用の目安（ElevenLabs）

20分の回で台本は約8,000〜10,000文字（作り直しを含む）。Starter（月$6、約75,000文字）で月に7本前後。
同じ文はキャッシュするので、一部を直しても直した区間の分しか消費しない。商用利用は有料プランが必要。

## データとライセンス

| データ | 用途 | ライセンス・表示 |
| --- | --- | --- |
| Copernicus DEM GLO-30 / GLO-90 | 地形 | 加工して使う場合の定型表示が必要（`config/attributions.yaml`） |
| NASA Black Marble 2016（GIBS） | 夜の光 | NASAのデータ。出典を表示 |
| Natural Earth 10m | 国境（日本の陸地の切り出し） | パブリックドメイン |
| Noto Sans JP | 画面の文字 | SIL Open Font License |
| YouTubeオーディオライブラリ | BGM | 帰属表示不要の曲のみ（`assets/bgm/LICENSES.md`） |
