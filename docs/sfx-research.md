# 効果音の入れ方：調べたこと（2026-11-25）

F-012 の根拠。基準の数字は `config/channel.yaml` の `sfx`、音の台帳は `config/sfx.yaml`。

## 結論（このチャンネルの基準）

1. **効果音は画面の動きに付ける**（資料が出たら紙、写真なら厚紙、航空写真なら映写機、日付ならタイプライター）。
   話と関係のない「飾りの音」は理解を下げる（Moreno & Mayer 2000）。画面と結びついた音だけにする。
2. **平均 6〜10 秒に1回**。6 秒より詰めない。12 秒以上の空白は香盤表の注意に出す（ただし遺族の言葉などは、わざと音なし）。
3. **強い音（章の扉、止められたかもしれない場面）は1分に約1回まで**。事件の話はもともと気持ちを揺さぶる内容なので、
   画面や音の変化を増やしすぎると処理しきれなくなる（Lang の限られた処理容量のモデル）。
4. **同じ音を続けない**。同じ刺激をくり返すと反応が弱まる（慣れ）。種類ごとに2〜4本の変化（variants）を用意して順に使う。
5. **音量は声より小さく**（声が主役）。小さな音は声より約16dB、強い音でも約8dB小さく置き、耳で確かめて直す。
   全体は YouTube の基準（約 -14 LUFS。これより大きいと下げられる）を超えない。
6. **使わない音**：銃声・悲鳴・刃物・血・心音・サイレン・警察無線の声・報道のジングル・笑いを誘う音（`config/sfx.yaml` の forbidden）。
   被害者や遺族の言葉の場面には音を付けない。

## 研究で分かっていること

- **関係のない音は理解を下げる**：ナレーションつきのアニメに背景音楽や環境音を足すと、記憶や応用の成績が下がった
  （Moreno & Mayer 2000, Journal of Educational Psychology 92(1)）。Mayer の「一貫性の原則」：余計な素材を除くほど学びがよい。
  ただし、慣れた人は関係のない情報を無視できるようになるという研究もある（Springer, Educational Psychology Review 2016）。
- **音の変化は注意を引き、記憶を助ける**：声の切り替えや効果音などが多い音声広告ほど、覚醒・記憶・態度が上がった
  （Potter & Choi 2006, Media Psychology）。声の切り替えへの注意の反応（心拍の低下）は、鳴ってから 6〜10 秒の間に測られた（Potter 2000）。
  → 6 秒より詰めると、前の音への反応が終わる前に次が来る、というのは**この研究からの私たちの解釈**（直接の実験ではない）。
- **カットの速さ**：同じ場面の中のカットが速くなるほど、覚醒と記憶は上がり、負荷はあまり増えなかった（Lang ほか 2000）。
  一方、気持ちを揺さぶる内容と速いテンポが重なると、処理しきれなくなる点があると予測されている（限られた処理容量のモデル、Lang 2000 ほか）。
- **慣れ**：同じ刺激をくり返すと、注意の反応は弱まり、やがて消える（Sokolov の定位反応と慣れ）。
- **「6秒に1回」が最適と示した研究は見つからなかった**。YouTube の維持率と効果音の頻度を直接比べた研究もない。
  ここでの基準は上の研究からの推定なので、公開後は YouTube アナリティクスの維持率で確かめて直す。

## 音量の目安（実務の指針。研究ではない）

- YouTube は約 -14 LUFS より大きい音声を下げる。小さい音声は上げない。
- 動画編集の目安として、声 -12〜-15 dB、効果音 -10〜-20 dB（ピークで -8 dB まで）、音楽 -18〜-22 dB などが紹介されている。
  声を主役にして、ほかを下に置くのが共通の考え方。

## 出典

- Moreno, R., & Mayer, R. E. (2000). A coherence effect in multimedia learning. Journal of Educational Psychology, 92(1), 117–125.
- Mayer, R. E. Multimedia Learning, Coherence Principle（Cambridge University Press）
- Potter, R. F. (2000). The effects of voice changes on orienting and immediate cognitive overload in radio listeners. Media Psychology, 2(2).
- Potter, R. F., & Choi, J. (2006). The effects of auditory structural complexity on attitudes, attention, arousal & memory. Media Psychology.
- Lang, A., Zhou, S., Schwartz, N., Bolls, P. D., & Potter, R. F. (2000). The effects of edits on arousal, attention, and memory for television messages. Journal of Broadcasting & Electronic Media, 44(1), 94–109.
- Lang, A., Bolls, P., Potter, R. F., & Kawahara, K. (1999). The effects of production pacing and arousing content on the information processing of television messages. Journal of Broadcasting & Electronic Media, 43(4).
- Journal of Cognition（auditory structural features と注意の総説、joc.43）
- Wikipedia「Orienting response」（Sokolov の慣れ）
- 各サイトの規約：YouTube ヘルプ「オーディオ ライブラリの音楽と効果音を使用する」、Pixabay FAQ・利用規約、Mixkit、Freesound FAQ、
  ZapSplat Standard License Agreement、BBC RemArc ライセンスの報道、Sonniss GDC Bundle の紹介記事
