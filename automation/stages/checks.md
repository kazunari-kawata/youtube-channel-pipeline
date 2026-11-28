# 工程 checks：人に見せる前の確かめ

クラウドは CPU で描く（毎秒約1フレーム）。全編は書き出さず、静止画と短い区間で確かめる。全編の仮の動画は Windows で作る（`automation/windows/draft_review.ps1`）。

## 手順

1. 準備：`python pipeline/fetch_data.py`（フォント・人物のモデル。初回だけ）、`cd remotion && npm ci`、`python pipeline/build_assets.py <回>`
2. 仮の尺で Remotion に配る：`python pipeline/draft_preview.py <回>`（声なし。BGM の曲がクラウドにないときは BGM なしで配られる）
3. 静止画：各カットの真ん中のフレームを `python pipeline/render.py <回> --stills <フレーム,…>` で書き出し（30〜60枚ずつに分けてよい）、Read で開いて見る
   - 見ること：何の場面か一目で分かるか（F-049、F-052）、主役が真ん中か（F-050）、資料の日本語の説明が重なっていないか・見出しだけでないか（F-020、F-041）、
     文字のはみ出し、人物の体（F-008、F-053）、赤い光、時代に合わない物
   - 直したら、その工程（visuals）のファイルを直してもう一度
4. チラつき：新しい場面の角度ごとに、区間の長さ分（最大10秒）を書き出して検査する。CPU で描くので1本に数分かかる。1回の実行で数本ずつでよい
   ```bash
   cd remotion && npx remotion render src/index.ts Scene-Check ../episodes/<回>/build/scene_<場面>_<角度>.mp4 \
     --props='{"scene":"<場面>","variant":"<角度>"}' --frames=0-<区間の長さ×30−1> --gl=swangle && cd ..
   python qa/check_video.py <回> --partial --video episodes/<回>/build/scene_<場面>_<角度>.mp4
   ```
   本編の区間で確かめるなら `python pipeline/render.py <回> --frames <開始>-<終了>`（build/preview.mp4）→ `python qa/check_video.py <回> --partial`
5. 人に見せるものの一覧を plan.md の「確認してほしいこと（自動の回）」に書く
   - 問いと題（ask の question・title）、新しい人物（Figure-Check の静止画を書き出したファイル名）、仮の BGM、権利の判断待ちの素材、
     手作業で取ってほしい素材、香盤表で残った注意、確かめきれなかった事実（plan.md の「要確認」）
6. コミットして push、`auto.py done <回> checks` → 回は review（人の確認待ち）に入る

## 終わりの条件

- 静止画をすべて見て、直すべき所が残っていない（残したものは「確認してほしいこと」に理由つき）
- 新しい角度のチラつきが0件
