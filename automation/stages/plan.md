# 工程 plan：構成案

形は `episodes/009-gardner/plan.md` から `011-shaffer/plan.md` を手本にする（シリーズ・状態・題材の理由・問いと結論の案・題の案・章立て・言い方の決まり・人物の設定・時代の設定・読み方・公開前に確かめること）。

## 自動の回での決め方（CLAUDE.md「自動で進める回」）

- 問いと結論は、案を2〜3つ書き、**いちばん良いと思う案で進める**。選んだ案と理由を plan.md に書き、
  `python pipeline/auto.py ask <回> question --q "問いは案A（…）で進めた。ほかの案：…"`（--blocks なし）
- 題も同じ（`ask <回> title`）。シリーズに迷うときも同じ（`ask <回> series`）
- 人物の体つき・服装は記録と写真の事実から決め、plan.md の「人物の設定」に書く。新しい人物は visuals で作り、Figure-Check の静止画を review で見てもらう
- 章立ては、見積もりの尺（話す速さ 5.55字/秒、文の間 1.1秒）で10〜15分を目安にする
- Claude Docs の構成案は作らなくてよい（定期実行ではつながらないことがある）。plan.md を正本にする。人の会話で Docs を作ったら、リンクを plan.md に足す

## 手順

1. timeline.md・materials.yaml・plan.md（research の結果）を読む
2. plan.md を書く。各章に「主な素材」（台帳の id）を書き、使用可でない素材に頼る章があれば、その旨と代わりの見せ方を書く
3. 権利の判断がないと章の中心が作れないなら `ask <回> rights_<id> --q "…" --blocks visuals`（台本までは進める）
4. コミットして push、`auto.py done <回> plan`

## 終わりの条件

- plan.md の章立てに、時間・芯・主な素材がある。問いと題は案を選んで ask に残っている
