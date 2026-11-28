# 定期実行の手順（毎回この順番。人はいない前提）

定期実行の Claude は、このファイルを最初に読み、書いてある順に **1回の実行で1つの工程（またはその続き）** だけ進める。
ルールの正本は CLAUDE.md。ここに書いていないことは CLAUDE.md に従う。自動の回だけの決まりは CLAUDE.md の「自動で進める回」。

## してはいけないこと

- ElevenLabs で声を作らない（`tts_elevenlabs.py`、`tts_voice_samples.py`、回の `reading_test.py` を動かさない）。声は人の確認のあと、人が始める
- ブラウザを開かない（YouTube、YouTube Studio、fbi.gov を含む）。公開・アップロードをしない
- `state.yaml` の `mode` が `auto` でない回のファイルを変えない（002〜008 は人の会話で進めている）
- 人に質問しない（だれも答えない）。決めてほしいことは `auto.py ask` で残し、案を1つ選んで進める（止めるのは下の「止める判断」だけ）
- 素材台帳で使用可でない素材（check・reference・unusable）を、画面に出す区間に使わない

## 手順

1. 準備
   ```bash
   cd <リポジトリ>   # クローンしたフォルダ
   bash automation/setup.sh          # Python の部品（visuals・checks の工程では --render を付けて、あとから実行してよい）
   RUN=$(date -u +%Y%m%dT%H%MZ)
   python pipeline/auto.py lock --run $RUN     # 終了コード 3 なら、ほかの実行が作業中。何もせずに終える
   python pipeline/auto.py status
   python pipeline/auto.py next                # JSON。action が work / new_topic / idle
   ```
2. `action` ごとに
   - `idle`：`auto.py record --run $RUN --summary "待ち：…"` → 6 へ（何も作らない）
   - `new_topic`：`automation/stages/research.md` の「新しい題材」をする。回のフォルダは `auto.py new` で作る
   - `work`：`python pipeline/auto.py start <回> <工程> --run $RUN` → `doc` に書いてある工程の手順書を読む →
     その回の `state.yaml`（前の実行の `note`）、`plan.md`、`materials.yaml`、`timeline.md` を読んでから作業する
3. 作業中は、区切りのよい所ごとにコミットして push する（使える量が尽きて途中で止まっても、そこまでが残る）
   ```bash
   python pipeline/auto.py save -m "auto: <回> <工程> …" episodes/<回> <ほかに変えたファイル>
   ```
   push する枝は `automation/config.yaml` の `branch`。save が「衝突しました」で止まったら、衝突したファイルを確かめ、
   ほかの人の変更を残して自分の変更を足し直してから、もう一度 save する（人の変更を上書きしない）
4. 終わり方（どれか1つ）
   - 工程が終わった：`python pipeline/auto.py done <回> <工程> --note "何をしたか、次の工程への申し送り"`
   - 途中まで：`python pipeline/auto.py progress <回> <工程> --note "どこまでやったか、残り"`（次の実行が続きから）
   - 人の判断がないと先へ進めない：`python pipeline/auto.py ask <回> <id> --q "決めてほしいこと（案と、案を選んだ理由）" --blocks <工程>`
5. 記録：`python pipeline/auto.py record --run $RUN --episode <回> --stage <工程> --credits <vidIQで使った数> --summary "1行"`
6. 片付け：`python pipeline/auto.py unlock --run $RUN` → `python pipeline/auto.py save -m "auto: 終了 $RUN"`（ロックを外したことと記録も含めて push）
7. 最後のメッセージ（このセッションを開いた人が読む）：日本語で3〜6行。何を進めたか、次に何が待っているか、人に決めてほしいこと。
   回が review（人の確認待ち）に入ったら、1行目に「確認待ち：<回>」と書く

## 止める判断（ask に --blocks を付けるとき）

- 素材の権利の判断（`check` の素材）がないと、その工程の中心が作れない（例：010 の事情聴取の録画）
- 事実の食い違いが台本の背骨に関わり、一次資料で決められない
- 共有のファイル（`remotion/src/lib/`、`remotion/src/inserts/registry.ts`、`remotion/src/episodes/index.ts`、`pipeline/`、`qa/`）の変更が、
  ほかの回の書き出しを壊すおそれがあり、型の検査（`npx tsc --noEmit`）か香盤表で確かめられない
- 止めないもの：問いと結論の選択、題、人物の体つき、BGM の選曲。案を1つ選んで進め、`ask`（--blocks なし）で残す。review でまとめて見てもらう

## 量の目安

- 1回の実行は、1つの工程か、その一部まで。長い工程（台本、画面づくり）は数回に分けてよい
- vidIQ は `next` の `vidiq_credits` まで（月の上限は `automation/config.yaml`）。使った数を `record --credits` に書く
- WebFetch は許可が要ることがあり、定期実行では通らないことがある。通らなければ WebSearch と、シェルから届く取得元（下）を使う

## クラウドのシェルから届く取得元（2026-11-28 に確かめた）

- 届く：commons.wikimedia.org、upload.wikimedia.org、www.justice.gov、www.loc.gov、earthexplorer.usgs.gov、planetarycomputer.microsoft.com、
  storage.courtlistener.com、archive.org、raw.githubusercontent.com、opengameart.org
- 届かない：www.fbi.gov（403）、www.courtlistener.com（403）。fbi.gov の素材は `auto.py ask <回> manual_fbi --q "..."`（--blocks なし）で、
  Windows の Chrome での取得をユーザーに頼む。取れるまでは、その素材を使わない区間で組む
