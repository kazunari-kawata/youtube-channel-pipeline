# 工程 materials：素材台帳と時系列

CLAUDE.md の「制作の流れ」0 と「犯罪・事件の回のルール」に従う。形は `episodes/009-gardner/` から `011-shaffer/` を手本にする。

## 作るもの

- `episodes/<回>/materials.yaml`：1素材＝1項目。`id`、`title`、`file`（build/materials/ の中の置き場所）、`url`（直接取れるもの）か `original`（出どころのページ）、`status`、`note`
  - status は事実で決める。連邦の機関が作ったものだけ `pd_federal`。州・市・郡は `check`（ボディカメラのシリーズのフロリダ州は `pd_other`）。
    Commons の名画は、ファイルページで PD-Art を確かめてから `pd_other`。分からないものは `check`
  - 映像は、撮った機関・公開した機関・入手先を note に書く。ニュース局・ほかのチャンネルの写しは使わない（中身の確認だけ `reference`）
  - 使わないもの（局の映像、家族の写真、けがの写真など）も `unusable` で載せる（次の工程で拾わないように）
- `episodes/<回>/timeline.md`：日付・出来事・出典（台帳の id）・状態（◎ 一次資料／報道／要確認）。最後に「まだ分かっていないこと」
- `episodes/<回>/episode.yaml`：`id`、`series`、`bgm.tracks`（決まっていなければ 002 の曲で仮。plan.md に「仮」と書く）、`person_photos`

## 手順

1. WebSearch で一次資料（連邦検事局・FBI・裁判所・州の公式）を探す。報道は事実確認の補助
2. 台帳と時系列を書く。名前を出さない人（未解決の事件で疑われた人、被害者の家族など）は、台帳の冒頭の「この回の注意」に書く
3. 検査：`python pipeline/fetch_materials.py <回> --list` が通る（YAML の誤りがない）
4. コミットして push、`auto.py done <回> materials`

## 終わりの条件

- 台帳に、画面に出す予定の素材の候補がそろい、それぞれ status がある
- 時系列の大事な出来事に出典がある。◎ にしたのは一次資料で確かめたものだけ
