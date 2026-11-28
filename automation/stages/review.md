# 工程 review：人の確認（定期実行は進めない）

ここで定期実行は止まる。声（ElevenLabs）を作る前に、人が映像を見て決める。

## 人がすること

1. Windows で仮編集を見る
   - 自動：`automation/windows/draft_review.ps1` をタスク スケジューラで回していれば、`episodes/<回>/build/draft.mp4`（声なし・BGM と効果音あり）ができている
   - 手で：`powershell -ExecutionPolicy Bypass -File automation\windows\draft_review.ps1 -Episode <回> -NoRender` → `cd remotion; npx remotion studio` → Main
2. `episodes/<回>/plan.md` の「確認してほしいこと（自動の回）」と、`python pipeline/auto.py status` の「?」の質問に答える
3. 直してほしい所は、Claude との会話で伝える（会話の Claude が直し、F-◯◯◯ に残す）。直しを定期実行に任せるなら、会話の Claude が
   `auto.py progress <回> visuals --note "直す所：…"` のように工程を戻す
4. OK なら：`python pipeline/auto.py approve <回> review --answer "OK（日付）"`（会話の Claude に「<回> OK」と言えば代わりに打つ）
   → mode が manual になり、ここから先（読みの確認 F-051・F-056、声、本番の尺の香盤表、書き出し、QA、公開）は人の会話で進める

## 質問に答える（関門を閉じる）

`python pipeline/auto.py approve <回> <質問のid> --answer "決めたこと"`。止めていた工程（--blocks）は、次の定期実行から進む。
