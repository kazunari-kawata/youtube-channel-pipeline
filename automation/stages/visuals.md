# 工程 visuals：画面を作る（地図・資料・イメージ映像・動画の定義）

CLAUDE.md の「イメージ映像のルール」「時代とアメリカらしさ」と、チラつきの例をすべて守る。手本は 003（`remotion/src/episodes/ep003-db-cooper.tsx`、`remotion/src/inserts/Scenes003*.tsx`）。

## 作るもの

1. 地図：`episodes/<回>/maps.yaml` → `python pipeline/make_maps.py <回>`（実データだけ。範囲は面で：F-055、地点は赤く：F-026）
2. 資料：fetch の工程の cuts.yaml の切り出し（足りなければ足す）
3. イメージ映像：回の場面は `remotion/src/inserts/Scenes<番号>*.tsx` に新しく作る。人物の設定は plan.md のとおり、前の回の体つきを流用しない（F-010）
   - 場面の登録は共有の `remotion/src/inserts/registry.ts` に1行ずつ足す（ほかの回の行は変えない）
   - 新しい角度は、静止画（`cd remotion && node scene_stills.mjs <出力> 場面:角度,… [フレーム]`。回を登録する前でも、setup.sh が置いた 003 の仮の尺で描ける）と、区間の長さ分の短い動画でチラつきを確かめる（checks の工程でまとめてもよい）
4. 動画の定義：`remotion/src/episodes/ep<回>.tsx`（資料の日本語の説明 `JA` を含む）。`remotion/src/episodes/index.ts` への登録は、
   `cd remotion && npx tsc --noEmit` が通ってから（書き間違いがあると、ほかの回の Studio と書き出しも止まる）
5. 素材から画面用のファイルまでを `python pipeline/build_assets.py <回>` で作り直せるようにする（Windows で同じものを作るため）

## 区切り方

量が多いので、数回に分けてよい。progress の note に、できた場面・残りの場面・登録の状態を書く。
例：「地図3枚と資料12枚まで。イメージ映像は 6場面のうち2つ（gallery a・b）。ep009 は未作成」

## 止める判断

- 共有の部品（`remotion/src/lib/`）を変えないと作れない → 変えてよいのは、指定したときだけ効く足し算（003 の `suit` のように、ほかの回の見た目が変わらないもの）。
  それ以外は `ask <回> shared_<名前> --q "…" --blocks visuals`
- 権利の判断待ちの素材が章の中心 → その章は代わりの絵で組み、ask に残す（止めるのは中心が作れないときだけ）

## 終わりの条件

- `cd remotion && npx tsc --noEmit` が通る
- `python pipeline/build_assets.py <回>` が通り、`python pipeline/shotlist.py <回>` の注意が0件
- index.ts に登録済み
