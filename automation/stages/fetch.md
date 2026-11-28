# 工程 fetch：素材を取り、原文で確かめる

## 手順

1. 台帳の取れるものに `url`（直接の取得先）と `file` を書き、`python pipeline/fetch_materials.py <回>` で取る（`build/materials/` に入る。Git には入らない）
   - クラウドから届く取得元は RUNNER.md の一覧。届かないもの（fbi.gov など）は台帳の note に「手作業」と書き、
     `python pipeline/auto.py ask <回> manual_<id> --q "Windows の Chrome で <URL> を保存してほしい（理由）"`（--blocks なし）
2. 取った PDF は `pdftotext` で文字にし、時系列の「報道」「要確認」を原文で確かめる。合っていれば ◎ にし、食い違えば直して note に書く
3. 画面に出す資料のページを決め、`episodes/<回>/cuts.yaml` に切り出しの範囲と黒塗り（`redact`：名前を出さない人、住所、電話番号）を書く。
   書き方は `pipeline/cut_materials.py` の冒頭と 003 の cuts.yaml
4. 切り出しを試す：`python pipeline/cut_materials.py <回>` → `remotion/public/<番号>/` に画像ができる。何枚かを Read で開いて、黒塗りと読みやすさを確かめる
5. 取得から切り出しまでを1回で作り直せるようにしておく（Windows でも `python pipeline/build_assets.py <回>` で同じものができる）。
   回だけの前処理が要るときは `episodes/<回>/prepare_materials.py` に書く（build_assets.py が呼ぶ）
6. コミットして push、`auto.py done <回> fetch`

## 終わりの条件

- 使用可の素材が `build/materials/` にあり、画面に出す分は cuts.yaml で切り出せる
- 時系列の背骨になる出来事が、原文で ◎ になっている（なっていない所は plan.md の「要確認」に残す）
- 手作業の素材は ask に残っている
