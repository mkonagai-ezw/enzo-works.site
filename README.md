# enzo-works.site

Vercel本番（`https://www.enzo-works.com`）と連携しているリポジトリです。`main`へのpushで自動デプロイされます。

## チャットの運用

- Vercelの `CHATBOT_GEMINI_API_KEY` にGemini APIキーを設定します。`CHATBOT_GEMINI_MODEL` は任意で、未設定時は `gemini-2.5-flash` を使います。
- Google AI Studioで、キーが属するプロジェクトの請求設定・前払い残高を確認してください。HTTP 402（`AI_BILLING_REQUIRED`）は前払い残高などの課金設定の問題で、コードや再デプロイだけでは解消しません。
- Vercelの `/api/chat` 実行ログには、APIキーや質問本文を含めず、AIサービスのHTTPステータスとエラー種別を記録します。
- 送信回数は回答を取得できた場合のみ加算します。失敗した質問は入力欄に残り、再送できます。
- `npm test` でAPIの入力チェック・正常応答・課金エラー・通信失敗などを検証できます。

株価予想の表示は `index.html` の `#ai-market-prediction` に付けた `hidden` で一時停止しています。再表示する際はこの属性を外します。予想データの生成スケジュールは変更していません。

## ⚠️ hp-service/ ディレクトリについて（重要）

`hp-service/` フォルダは、EnzoWorksのホームページ制作サービス紹介LP＋業種別デモサイト集です。
**このフォルダの「開発用ソース」は別リポジトリ `mkonagai-ezw/website_system` にあります。**

- 新しいデモサイトの追加・仕様検討・デザイン検討は `website_system` 側で行う（spec-writer/designer等のエージェント・Skillsフロー、`docs/specs`・`docs/design`が整備されている）
- `website_system` での作業がまとまったら、変更分（新規デモサイトのフォルダ、ルート`index.html`、`assets/img/`の差分など）を **手動で** この `hp-service/` にコピーしてコミット・pushする
- `hp-service/` を直接編集した場合は、`website_system` 側にも変更を反映し忘れないよう注意する（現状、自動同期の仕組みはない）

`hp-service/` 以外（`ai_predictor.py`・`api/`・`audio/`等）はこのデモサイト集とは無関係な別機能なので、混同しないこと。
