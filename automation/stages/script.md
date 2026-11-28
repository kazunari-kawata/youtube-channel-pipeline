# 工程 script：台本と香盤表

CLAUDE.md の「制作の流れ」2 と絶対ルール（F-018 数字をひらがなにしない、F-022 最初の30秒に本人、F-023 文字カード4秒まで、F-037〜F-046 など）に従う。

## 作り方

- 台本は `episodes/<回>/make_narration.py` で作る（narration.json を手で直さない。003・006 の make_narration.py が手本）
  - 区間：`id`、`scene`（章）、`caption`（台本の文。合成にもこのまま渡す）、`read`（見積もり用の読み：数字を漢数字にしただけ）、`visual`（画面）、必要なら `chapter`・`sfx`・`cut`・`reveal`
  - `visual.kind` は 003・006 の台本で使っている種類だけ（insert、doc、photo、map、card など）。新しい種類が要るなら visuals の工程で部品を作ると note に書く
  - 資料の画面には `visual.ja`（見出し1行＋本文2〜3行。F-020、F-041）
  - イメージ映像は場面名と角度（`scene`、`var`）と、何を映すかの `note`。新しく作る場面は plan.md の「新しく作るイメージ映像」に一覧
  - 締めの一言（F-013）で終える
- 作ったら順に回す
  ```bash
  python episodes/<回>/make_narration.py episodes/<回>/narration.json
  python pipeline/estimate_timeline.py <回>
  python pipeline/shotlist.py <回>       # 注意0件にする（場面がまだない注意は、visuals で作る一覧として plan.md に残してよい）
  python pipeline/script_md.py <回>       # script.md（人が読む台本）
  ```
- 台本を読み直す：イメージ映像と資料の見出しを順に読み、時間と場所が後戻りしていないか（F-042）、前を受ける言葉が何を指すか（F-038）、
  言い方の決まり（plan.md）を守っているか

## 区切り方

台本は長いので、章ごとに progress で区切ってよい（例：「冒頭と第1章まで。第2章から」）。

## 終わりの条件

- narration.json・script.md・shotlist.md があり、香盤表の注意が0件（または、まだない場面だけ）
- 見積もりの尺が plan.md の目安から大きく外れていない（外れたら plan.md の章立ての時間を直す）
