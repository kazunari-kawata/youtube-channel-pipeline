# 002 ダーマー サムネイル案（2026-11-26）

## 根拠と限界

- vidIQ の外れ値（日本語・長尺・直近6か月）を2回検索（10クレジット）。ダーマーを扱った日本語の外れ値は見つからなかった。
  見たのは日本の事件解説で伸びた8本のサムネイル（三億円事件、世田谷一家、北関東、福岡、少年の死刑確定など）。アメリカの事件にそのまま当てはまるかは推測。
- 8本に共通：太い文字（赤＋白か黄、黒フチ）、黒か夜の背景、本人の顔を大きく（白黒が多い）、大きな数字（「27年」「3億円」）。
- クリック率は予測できない。YouTube の A/B テスト（デスクトップの Studio、高度な機能が有効なチャンネル、最大3案）で比べる。判定は総再生時間の割合で、テスト中にタイトルかサムネを変えるとテストが止まる。

## 決まり（チャンネルのルールから）

- 顔は実物の逮捕時の写真（`booking_front`、1991年7月24日、身長目盛りの前）だけ。AIに顔を描かせない・補正させない（本人に似せた顔をAIで作るのと同じになる）。
  ChatGPT などに写真を渡して全体を作らせると顔が描き直されるので、顔は最後に編集ソフトで重ねる（明るさ・彩度・切り抜きまで）。
- 逮捕時の写真は素材台帳で fair_use（報道・解説の文脈）。サムネは宣伝の性格が強く、フェアユースの主張は動画の中より弱くなる。使うかはユーザー判断。
  PDの代わりは実用にならない（陸軍時代の写真は寝ている姿、卒業アルバムは17〜18歳）。
- 出さないもの：被害者（写真・名前・人数の強調）、血・赤い液体・地面に落ちる赤い光、凶器、手錠、213号室の室内写真、規制線、点灯した警光灯、Netflix のロゴやドラマの場面、ポラロイド風の枠（事件の被害者写真を連想させる）、作り物の「極秘」スタンプ。
- 文字は AI に描かせない（日本語は崩れる）。編集ソフトで入れる。右下（1080〜1280, 650〜720）は再生時間の表示に隠れるので文字を置かない。
- 文字は動画で言っていることだけ（s008「なぜ13年間、誰も彼を止められなかったのか」、s077「止められたかもしれない場面は、少なくとも2つ」、s078 1989年の司法、s079 1991年5月の警察、s056「止める機会が、すぐ目の前にあった」）。

## 案A「13年」（AIなし。実物の写真と資料だけ）

- 背景：黒。FBIファイルの表紙（`fbi1_cover`）の「Subject: Jeffrey Dahmer」と「Federal Bureau of Investigation」の部分を左に大きく、-4度傾け、明るさ35%・ぼかし2px。紋章は小さく端に（主役にしない）。左上と左下から暗い赤のにじみ。
- 顔：`booking_front` を身長目盛りごと四角で右側（x 700〜1280、上下いっぱい）。彩度 -70%、コントラスト +15。
- 文字：左上に小さく「FBIファイル」（黄色の帯に黒、36px）。左に「13年」（赤 #E8231F、高さ約300px、白フチ14px＋黒フチ6px＋影）、その下に「誰も止められなかった」（白、黒フチ、約64px）。

## 案B「2度」（AIで夜の街の背景）

AIへの指示（英語のまま）：

```
Wide 16:9 (1280x720) cinematic matte painting, clearly an illustration and not a photograph. A quiet street in a Midwestern American city in the early 1990s, at night. A three-story brown brick apartment building fills the right half of the frame; most windows dark, one second-floor window glowing warm yellow. Orange sodium-vapor street lamps, wet asphalt with soft reflections, light fog. A boxy early-1990s sedan parked at the curb, no badges. Faded 1980s film color, low saturation, teal shadows and orange highlights, visible film grain, soft bloom on the lamp bulbs only. The left 55% of the frame is deep shadow and empty street with very little detail, reserved for large text. No people, no faces, no text, letters, numbers, signs, logos or license plates. No police lights, no red light on the ground, no blood or red liquid, no tape, no weapons.
```

- 顔：`booking_front` を頭と肩で切り抜き、右側に（建物の明るい窓が頭の上か横に見える位置）。色はそのまま、少しだけオレンジ寄せ。
- 文字：左に小さく「警察と司法は」（白、48px）、大きく「2度」（赤、約260px）、「見逃した」（白、約120px、黒フチ）。

## 案C「目の前」（AIでパトカーと建物の背景）

AIへの指示（英語のまま）：

```
Wide 16:9 (1280x720) cinematic matte painting, clearly an illustration and not a photograph. Early-1990s Midwestern American city at night, seen from across the street. A three-story brick apartment building in the background; one second-floor window glowing warm yellow. In the right-center foreground, a parked boxy early-1990s police cruiser seen from the rear three-quarter view, dark navy, roof light bar switched OFF, no markings, no text, no badges. Orange sodium-vapor street lamp, wet asphalt, light fog. Keep the upper-left 40% dark and simple for large text, and keep the upper-right corner clear for a small inset photo. Faded film color, film grain, soft bloom on the lamp bulbs only. No people, no faces, no text, letters, numbers, logos or license plates. No flashing or lit police lights, no red light on the ground, no blood or red liquid, no tape, no weapons.
```

- 顔：`booking_front` を小さく（約260x320）右上に、白い細枠の四角で。明るい窓を赤い丸で囲む。
- 文字：左上に「警察は」（白、約90px）、「目の前にいた」（黄、約140px、黒フチ。「目の前」の下に赤い線）。

## タイトル（2026-11-26 午後。サムネは「FBIファイル＋本人の顔＋13年 誰も止められなかった」で確定）

サムネとタイトルの A/B テストは、サムネを固定してタイトルだけ3案を比べる。

1. 17人を殺害したシリアルキラーを、警察と司法は2度見逃していた【ジェフリー・ダーマー｜FBIファイル】
2. 終身刑15回のシリアルキラーは、有罪判決のあとも見過ごされていた【ジェフリー・ダーマー｜FBIファイル】
3. 1991年7月22日、手錠をかけられた男がパトカーを止めた【ジェフリー・ダーマー｜FBIファイル】

- 根拠：vidIQ の外れ値（日本語・長尺）で「40年逃げた連続殺人犯、正体は元警察官」（登録2.3千、13.4万回、8.8倍）、
  「【名張毒ぶどう酒事件】無罪判決の男はなぜ死刑になったのか｜33年かけて開いた再審の扉」（登録1.2千、1.2万回、16倍）。アメリカの事件の例はなし
- 検索語：「連続殺人犯」は月750回未満、「シリアルキラー」は約1.3万（全世界の推定。日本だけの数は出ていない）
- サムネと同じ「13年」「止められなかった」はタイトルに入れない。被害者（14歳の少年、11人分の遺体）と「史上最悪」は入れない
- どの文も台本にある：s077〜s079（2度）、s069（15回の終身刑）、s078（有罪判決のあと）、s001〜s002（7月22日）

## 概要欄の目次（2026-11-26、書き出し済みの 813秒の動画の時刻。声を作り直したら出し直す）

```
0:00 1991年7月22日の夜
1:09 なぜ今、この事件か
2:44 第1章 オハイオの少年
3:59 第2章 陸軍と酒
4:58 第3章 有罪判決のあとも（止められたかもしれない場面①）
6:40 第4章 1991年5月27日（止められたかもしれない場面②）
8:53 第5章 逮捕
10:08 第6章 裁判と最期
11:38 結び　なぜ13年間、誰も止められなかったのか
```

## ショート（2026-11-27）

- A「13年、誰も止められなかった」（冒頭、49秒）：QA合格。`build/short_a.mp4`。台本 `shorts/a.json`。アップロード後、スマホのアプリで1フレーム目をサムネイルに、Studio の「関連動画」に本編
- B（死刑にならなかった）・C（ドラマと記録の違い）は冒頭の一文の声が要る（ElevenLabs、ユーザーのOK待ち）。警官の免職・復職の回は保留（未成年の事件が中心）
