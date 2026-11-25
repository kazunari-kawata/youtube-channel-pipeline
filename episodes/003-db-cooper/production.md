# 003 D.B.クーパー：映像づくりの進み具合

ユーザーの指示（2026-11-25 夜）：台本に沿って映像（アニメーションと素材の組み合わせ）だけを先に作る。
**ElevenLabs でのナレーションの生成はまだしない。** BGM と効果音は入れてよい。
作業はこのPC（Windows、`C:\Users\busin\My project\youtube-channel-pipeline`）で見られる形にする。
夜のあいだに止まったら、このファイルの「進み具合」を読んで、終わっていない所から続ける。

## 決まりごと（この作業で守ること）

- 触ってよいのは `episodes/003-db-cooper/` と、003 用に新しく作るファイルだけ。002 のファイルは触らない
- 共有のファイルに足すのは次の行だけ（どれも足すだけ。既存の行は変えない）
  - `remotion/src/inserts/registry.ts`：003 の場面8つ
  - `remotion/src/episodes/index.ts`：`"003-db-cooper": Ep003`
  - `config/sfx_sources.yaml`：003 の環境音8本
  - 足す前に `npx tsc --noEmit` と場面の静止画で確かめる（書き間違いがあると 002 の Studio も止まる）
- 声は作らない。尺は `build/timeline.json`（見積もり。`pipeline/estimate_timeline.py`）
- 人物（COOPER_71）は Figure-Check の静止画でユーザーのOKをもらう（F-008、F-010）。OKまでは仮

## 進み具合

- [x] 1. 道具：`npm ci`、フォント・人物のモデル・Natural Earth を取得
- [x] 2. 地図：`make_maps.py 003-db-cooper`（pnw、puget、flight、dropzone、columbia）→ `maps_rivers.py`（USGS NHD の川の線）。描くのは `ep003-map.tsx`
- [x] 3. 資料の切り出し：FBI Vault の PDF（13分冊）からページを選び、`prepare_materials.py` → `cuts.yaml` → `cut_materials.py`。ページを画像で確かめた（25点）
- [ ] 4. 写真：DOCUMERICA 3点、国立公文書館の表紙、FAA の規則。FBI公式ページの写真（似顔絵以外）は取得方法を確かめる
- [x] 5. 動画の定義：`remotion/src/episodes/ep003-db-cooper.tsx`（素材がまだ無い所は「素材待ち」の仮の画面）
- [ ] 6. イメージ映像の場面（`remotion/src/inserts/Scenes003*.tsx`）
  - [ ] airport_walk（a、b、gate）
  - [ ] airport_wait（a、b、c、ticket、check、empty）
  - [ ] rain_window（airport、b、c、d、e、g）
  - [ ] cabin_seat（a、b、c、d、ash、ash2、tray、empty）
  - [ ] plane_clouds（a、b、c、d、e）
  - [ ] rain_forest（a、b、c、d、e）
  - [ ] river_bank（a、b、c、d）
  - [ ] field_office（a、b、c、d、e、f、g、h、i、j）
- [ ] 7. 人物 COOPER_71 と Figure-Check の静止画
- [ ] 8. 登録（registry.ts、episodes/index.ts）と `tsc --noEmit`（index.ts は済み。registry.ts は場面ができてから）
- [x] 9. 効果音：003 の環境音8本を選んで取得（耳で確認待ち）。声なしの仮編集でも効果音とBGMが鳴る準備（`episodes/003-db-cooper/stage_draft.py`。BGM は 002 の曲を仮で）
- [ ] 10. 確認：場面ごとの静止画、冒頭と各章の頭の短い書き出し
- [ ] 11. push。Windows へ `remotion/public/003/` などを写す（フォルダの許可が要る）
- [ ] 12. 報告：できたもの、仮のままのもの、ユーザーに決めてほしいこと

## メモ（作業しながら足す）

- 2026-11-25 20:55：Windows のフォルダの許可の確認が、返事のないまま閉じた。クラウドで作って push する形で進める
- FBI Vault の PDF は、台帳の `ref_ocr_text` と同じ作者の GitHub リポジトリ（noops888/db-cooper-files-text の download_script/pdfs）から取った。
  vault.fbi.gov はクラウドから開けない（403）。ページ番号は文字起こしと同じ（`cooper_d_b_partNNN.pdf#page=N`）
- fbi.gov のページと写真（ネクタイ、紙幣、パラシュート、2007年の地図、2016年の発表）はクラウドから取れない
- 2026-11-26 01:30〜：共有の `lib/shots.tsx`（MapShot）に川の線を足そうとしたら、自動の安全確認で止められた。共有の部品は変えず、003 用の `ep003-map.tsx` に写して足した
- 取れていない素材（「素材待ち」の画面になる）：fbi.gov の写真7点（ネクタイ、紙幣、パラシュート2点、2007年の地図、2007年の記事、2016年の発表）、
  FAA の規則（403）、DOCUMERICA 3点（Wikimedia の 429。時間をおいて取り直す）、USGS の1970年代の航空写真、連邦検事局のファイル（cuts.yaml に未登録）
