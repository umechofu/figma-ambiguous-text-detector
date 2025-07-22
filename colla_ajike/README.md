# Slack Knowledge Hub

Slack を単なるコミュニケーションツールから組織の貴重な知識資産が集積・活用される「ナレッジハブ」へと昇華させる Slack アプリです。

## 機能状況

### ✅ **完全実装・動作確認済み**

- **プロフィール機能** (`/profile`) - メンバーの「取扱説明書」を作成・共有
- **ホットコーヒーシステム** (`/coffee`) - 感謝の気持ちを表現するピアボーナス機能
- **AI対話機能** (`@knowledge_hub`) - 自然言語による知識発見（**gpt-4o-mini採用で約70%コスト削減**）
- **管理機能** (`/khub-admin`) - システム管理とメンテナンス

### ✅ **完全実装・動作確認済み**

- **シャッフル機能** (`/shuffle`) - ランダム質問システム（50個の実用的な質問を含む）

### 🚧 **開発中・部分実装**

- **アンケート機能** (`/survey`) - 構造化された意見収集（スケルトン実装）
- **データ分析機能** (`/analytics`) - エンゲージメント分析（サービス層実装済み）

### 🎯 **今すぐ使える主要コマンド**

```bash
/profile           # プロフィール作成・編集
/profile @username # 他ユーザーのプロフィール表示
/coffee @username メッセージ  # 感謝のコーヒーを送信
/shuffle           # シャッフル機能（stats, history, about）
@knowledge_hub こんにちは     # AI機能との対話
/khub-admin status # システム状態確認
```

## 技術スタック

- **フレームワーク**: Slack Bolt for JavaScript (Node.js)
- **言語**: TypeScript
- **通信方式**: Socket Mode（WebSocketベース）
- **データベース**: Supabase (PostgreSQL + リアルタイム機能)
- **AI 統合**: OpenAI API (gpt-4o-mini採用でコスト最適化)
- **認証**: Slack OAuth 2.0 + Supabase Auth

## クイックスタート

**簡単3ステップでセットアップ：**

1. **Socket Mode を有効化**
   - [Slack App設定](https://api.slack.com/apps) → Socket Mode → ON
   - App-Level Token を生成

2. **環境変数を設定**
   ```bash
   cp .env.example .env
   # SLACK_APP_TOKEN=xapp-your-token を追加
   ```

3. **アプリを起動**
   ```bash
   npm install
   npm run dev
   ```

**ngrok不要！** Socket Modeでローカル開発が簡単になりました。

詳細な設定方法は [`SOCKET_MODE_SETUP.md`](SOCKET_MODE_SETUP.md) を参照してください。

## セットアップ

### 前提条件

- Node.js 18 以上
- Slack ワークスペースの管理者権限
- Supabase プロジェクト
- OpenAI API キー

### 環境変数

`.env.example`を参考に以下の環境変数を設定してください：

- `SLACK_BOT_TOKEN`: Slack アプリの Bot User OAuth Token
- `SLACK_SIGNING_SECRET`: Slack アプリの Signing Secret
- `SLACK_APP_TOKEN`: Slack アプリの App-Level Token（**Socket Mode用**）
- `SUPABASE_URL`: Supabase プロジェクトの URL
- `SUPABASE_ANON_KEY`: Supabase の匿名キー
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase のサービスロールキー
- `OPENAI_API_KEY`: OpenAI API キー
- `OPENAI_MODEL`: 使用するAIモデル（デフォルト: gpt-4o-mini）
- `OPENAI_MAX_TOKENS`: 最大トークン数（デフォルト: 300）

## 開発

### スクリプト

- `npm run dev`: 開発サーバーを起動
- `npm run build`: TypeScript をコンパイル
- `npm run start`: 本番サーバーを起動
- `npm run test`: テストを実行
- `npm run lint`: ESLint でコードをチェック

### テスト

```bash
npm run test
```

## デプロイ

本アプリケーションは Socket Mode で動作するため、Vercel や Railway などのプラットフォームに簡単にデプロイできます。外部公開URLの設定は不要です。

## ドキュメント

### 📖 **ユーザー向け**
- **[`USER_GUIDE.md`](USER_GUIDE.md)** - 実用的な使い方ガイド（**推奨**）
- **[`AI_FEATURES.md`](AI_FEATURES.md)** - AI機能詳細とコスト最適化情報
- **[`ROADMAP.md`](ROADMAP.md)** - 機能完成度と開発計画

### 🔧 **開発者向け**
- [`SOCKET_MODE_SETUP.md`](SOCKET_MODE_SETUP.md) - Socket Mode セットアップガイド
- [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) - トラブルシューティング
- [`CLAUDE.md`](CLAUDE.md) - プロジェクト仕様書（Claude Code用）
- [`docs/archive/`](docs/archive/) - 過去のドキュメント（ngrok関連等）

## ライセンス

MIT License
