# 自動で進める仕組み（2026-11-28 ユーザー決定、F-061）

企画の調査から、声のない仮編集（見た目の動画）までを、クラウドの定期実行の Claude が少しずつ進める。
声（ElevenLabs）・書き出し・公開は、人が仮編集を見て OK を出してから、人の会話で進める（無駄な声を作らない）。

```
 定期実行（クラウド、2時間ごと）                                     人
 research → materials → fetch → plan → script → visuals → checks → review ─OK→ 声・本番の尺・書き出し・QA・公開（人の会話）
 調査       台帳・時系列  取得・原文  構成案  台本・香盤表  画面   静止画の検査   ↑ 仮編集を見る（Windows が自動で書き出す）
```

- 1回の実行で進めるのは1つの工程（長い工程はその一部）。途中で止まっても、そこまでを push しているので次の実行が続きから
- 人の判断が要ることは「質問」（`gates`）に残す。止めるのは、権利の判断など、その工程の中心が作れないときだけ。
  問い・題・シリーズ・BGM は案を1つ選んで進め、review でまとめて見てもらう
- 自動で進むのは `episodes/<回>/state.yaml` の `mode: auto` の回だけ。002〜008 には state.yaml がなく、定期実行は触らない

## ファイル

| 何 | どこ |
| --- | --- |
| 1回の実行の手順（定期実行の Claude が最初に読む） | `automation/RUNNER.md` |
| 工程ごとの手順と終わりの条件 | `automation/stages/<工程>.md` |
| 上限（同時に進める回の数、vidIQ の月の上限、push する枝） | `automation/config.yaml` |
| 題材の候補と、外した理由 | `automation/topics.md` |
| 回ごとの進み具合と質問 | `episodes/<回>/state.yaml`（`pipeline/auto.py` が書く） |
| 実行の記録（いつ、どの回の何を、vidIQ を何クレジット） | `automation/runs.jsonl` |
| クラウドの準備 | `automation/setup.sh` |
| 素材から画面用のファイルまで（どの PC でも同じものを作る） | `pipeline/build_assets.py` |
| 声なしの仮編集を Remotion に配る | `pipeline/draft_preview.py` |
| Windows で仮編集を書き出す（Claude の使用量は使わない） | `automation/windows/draft_review.ps1`、`register_task.ps1` |

## 人がすること

いまの状態を見る：`python pipeline/auto.py status`（会話の Claude に「自動の状態は？」と聞いてもよい）

- **質問に答える**：`python pipeline/auto.py approve <回> <質問のid> --answer "決めたこと"`（会話の Claude に頼めば代わりに打って push する）
- **仮編集を見る**：Windows の `episodes\<回>\build\draft.mp4`（`register_task.ps1` で2時間ごとに自動で作る）。
  Studio で見るなら `powershell -ExecutionPolicy Bypass -File automation\windows\draft_review.ps1 -Episode <回> -NoRender` → `cd remotion; npx remotion studio`
- **OK を出す**：`python pipeline/auto.py approve <回> review --answer "OK"` → その回は `mode: manual` になり、定期実行は触らなくなる。
  ここから先（読みの確認、声、書き出し、QA、公開）は、いままでどおり会話で進める
- **直してほしい**：会話の Claude に伝える。直しは会話で行い、F-◯◯◯ に残す（同じ間違いを定期実行もしなくなる）
- **止める**：新しい題材だけ止めるなら `config.yaml` の `new_topics: false`。ある回だけなら、その回の `mode: manual`。
  全部止めるなら、claude.ai/code の定期実行（スケジュール）を止める

## 定期実行を作る（初回だけ）

**2026-11-28 に作成済み**：「Syncage 自動制作（調査〜声なしの仮編集）」、2時間ごと（日本時間の奇数時36分。初回は 2026-11-28 15:36）、自動で承認、終わったらスマホに通知。
作り直すときや設定を変えるときは、claude.ai/code の「Routines（スケジュール）」で（会話の Claude に頼んでもよい）。
作ったときは全部のコネクタが入っていた。**画面で vidIQ 以外を外す**（指示でも使わないように書いてある）。

1. リポジトリ：このリポジトリ（kazunari-kawata/youtube-channel-pipeline）
2. 環境：
   - ネットワーク：Custom にし、既定の一覧（パッケージ）に加えて、素材の取得元を許す：
     `www.justice.gov`、`commons.wikimedia.org`、`upload.wikimedia.org`、`www.loc.gov`、`earthexplorer.usgs.gov`、`planetarycomputer.microsoft.com`、
     `storage.courtlistener.com`、`archive.org`、`naciscdn.org`、`opengameart.org`、`raw.githubusercontent.com`、`storage.googleapis.com`（Remotion のブラウザ）
   - 準備のスクリプト：`bash automation/setup.sh --render`（結果は保存され、毎回は動かない）
   - 環境変数・秘密情報は入れない（ElevenLabs のキーをクラウドに置かない）
3. 間隔：2時間ごと（`7 */2 * * *`。毎時ちょうどは遅れやすいので7分）。1時間より短くはできない
4. コネクタ：vidIQ だけ残す（Gmail・Drive などは外す）
5. 指示（そのまま貼る）：

```
このリポジトリ（YouTube チャンネルの制作パイプライン）の定期実行です。
automation/RUNNER.md を最初に読み、その手順どおりに1回分だけ進めてください。ルールの正本は CLAUDE.md です。
変更は automation/config.yaml の branch（既定 main）に、pipeline/auto.py save で push してください（claude/ の枝は作らない）。
してはいけないこと：ElevenLabs で声を作る、ブラウザを開く（YouTube・YouTube Studio を含む）、公開・アップロード、
state.yaml の mode が auto でない回のファイルを変える、人に質問する（決めてほしいことは auto.py ask に残す）。
最後に日本語で3〜6行の報告を書いてください。人の確認待ちになった回があれば、1行目に「確認待ち：<回>」。
```

## 見張り（コネクタ。2026-11-28 ユーザー決定）

定期実行の設定には、作ったときに全部のコネクタ（Gmail、Google Drive など）が入り、画面から外せなかった。指示で vidIQ 以外を禁止したうえで、次の2つで確かめる。

1. **自己申告**：毎回の実行が `auto.py record --connectors` に使ったコネクタを書き、最後のメッセージにも「使ったコネクタ：…」と書く。一覧は `python pipeline/auto.py audit`
2. **毎晩の見張り**：別の定期実行「Syncage 自動制作の見張り（コネクタ）」が毎晩22時台に、自己申告に加えて、外に残る跡を確かめる。
   直近26時間の Gmail の送信済み・下書き、Google カレンダーの予定、Google Drive のファイル、Claude のアーティファクトのうち、定期実行の時間帯に作られた・変わったものを挙げる。
   見張りは読むだけで、何も送らない・作らない・push しない

限界：読むだけの使い方（メールを検索した、など）は外に跡が残らない。確かなのは各実行の記録だけ（claude.ai/code/routines でタスクを開き、History から1回ずつ開ける）。
見張りが何か挙げたら、その時間帯の実行の記録を開いて確かめる。ユーザー自身の操作と見分けられないので、挙がったものが定期実行のものとは限らない。

## 使用量（2026-11-28 に調べた。正確な値は claude.ai/settings/usage）

- 定期実行は、ふだんの会話と同じ使用量（5時間ごとの枠と週の枠）から引かれる。自動を回すほど、会話で使える量が減る
- 使用量が尽きると、そのあとの実行は枠が戻るまで断られる。間隔ごとに次の実行が来るので、**戻ったら自然に再開する**（1時間ごとに試す仕組みを別に作る必要はない）
- 「使用量のクレジット（超過分の課金）」をオンにしていると、尽きたあとも課金で動き続ける。お金を使いたくなければオフのままにする
- 1日に動ける回数の上限がある（2026年4月の発表では Pro 5回、Max 15回）。2時間ごとなら1日12回
- 実行が何もしなかった回（`idle`：人の確認待ちだけ）も、手順を読む分の使用量は使う。待ちが続くときは間隔を長くする

## 枝（branch）

定期実行は、指示がなければ `claude/` で始まる枝に push する。この仕組みは指示で main を指定している（Windows の作業フォルダが main を pull して仮編集を作るため）。
GitHub の保護ルールや自動モードの判定で main への push が止められたら、`config.yaml` の `branch` を `claude/auto` にする。
そのときは、人が会話で `claude/auto` を main に取り込む（質問への答え・OK は main に書くので、取り込みは両方向になる）。

## 限界（正直なところ）

- できるのは「人が見て直す前の第1稿」まで。これまでの指摘（F-001〜F-059）の多くは、目で見て初めて分かったもの。自動の仮編集にも直しは出る前提
- クラウドからは fbi.gov などが開けない。そこにしかない素材は、Windows の Chrome での手作業（質問の `manual_fbi`）
- クラウドには BGM と効果音の音源がない（音源は Git に入れていない）。音つきの仮編集は Windows で作る
- 全編の書き出しは Windows（GPU）。クラウドは静止画と短い区間の検査だけ
- 共有の部品（`remotion/src/lib/` など）を変えると、ほかの回の見た目が変わるおそれがある。定期実行は「足し算」の変更だけにし、迷えば止まって質問を残す
