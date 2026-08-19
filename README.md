# enzo-works.site

Vercel本番（`https://www.enzo-works.com`）と連携しているリポジトリです。`main`へのpushで自動デプロイされます。

## ⚠️ hp-service/ ディレクトリについて（重要）

`hp-service/` フォルダは、EnzoWorksのホームページ制作サービス紹介LP＋業種別デモサイト集です。
**このフォルダの「開発用ソース」は別リポジトリ `mkonagai-ezw/website_system` にあります。**

- 新しいデモサイトの追加・仕様検討・デザイン検討は `website_system` 側で行う（spec-writer/designer等のエージェント・Skillsフロー、`docs/specs`・`docs/design`が整備されている）
- `website_system` での作業がまとまったら、変更分（新規デモサイトのフォルダ、ルート`index.html`、`assets/img/`の差分など）を **手動で** この `hp-service/` にコピーしてコミット・pushする
- `hp-service/` を直接編集した場合は、`website_system` 側にも変更を反映し忘れないよう注意する（現状、自動同期の仕組みはない）

`hp-service/` 以外（`ai_predictor.py`・`api/`・`audio/`等）はこのデモサイト集とは無関係な別機能なので、混同しないこと。