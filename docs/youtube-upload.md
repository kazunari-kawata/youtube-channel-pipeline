# YouTubeへのアップロードと公開予約

OKが出た動画は、`episodes/<id>/metadata.yaml` の内容で YouTube Data API からアップロードし、公開予約する。
（アップロード用のスクリプトは、監査の申請を出したあとに作る）

## 先に知っておく制約

- **未監査のAPIプロジェクトからのアップロードは、強制的に「非公開」になる。** 2020年7月28日以降に作ったプロジェクトは、
  Googleの監査（YouTube API Services の審査）を通るまで、アップロードした動画を公開も公開予約もできない。
  → 早めに監査を申請する。通るまでは、APIで非公開アップロードとメタデータ入力までを行い、公開予約だけ YouTube Studio で設定する。
- 公開予約は `status.privacyStatus = private` と `status.publishAt`（日時）の組み合わせで指定する。
- 改変・合成コンテンツの開示は `status.containsSyntheticMedia` で指定する。
- アップロードは1日あたりの上限がある（`videos.insert` はプロジェクトのクォータ内で、標準で1日100本程度）。

## 必要なもの（Windows側）

1. Google Cloud でプロジェクトを作り、YouTube Data API v3 を有効にする
2. OAuth クライアント（デスクトップアプリ）を作り、JSON を `secrets/client_secret.json` に置く（Gitには入らない）
3. 初回だけブラウザでチャンネルのGoogleアカウントにログインして許可。トークンは `secrets/` に保存される

## 監査申請に必要なこと（概要）

- 何のためのAPI利用か（自社チャンネルへのアップロードの自動化）
- 利用規約・プライバシーポリシーのURL（BRIDGES合同会社のサイトに置く想定）
- 画面のデモ動画（スクリプトがどう動くか）

## 手順（予定）

1. `metadata.yaml` の title / description / tags / publish_at / contains_synthetic_media を確定
2. `python pipeline/upload_youtube.py <id>`：動画・サムネイル・メタデータを送り、プレイリストに追加
3. 概要欄の末尾に `config/attributions.yaml` の出典を自動で付ける
4. アップロード結果（動画ID・URL）を `episodes/<id>/build/upload.json` に残す
