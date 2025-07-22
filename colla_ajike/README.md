# Slack Knowledge Hub

Slack を単なるコミュニケーションツールから組織の貴重な知識資産が集積・活用される「ナレッジハブ」へと昇華させる Slack アプリです。

## 機能

- **シャッフル機能**: ランダムに選ばれたメンバーに質問を送信し、知識共有を促進
- **プロフィール機能**: メンバーの「取扱説明書」を作成・共有
- **ホットコーヒーシステム**: 感謝の気持ちを表現するピアボーナス機能
- **日報機能**: 日々のコンディションと進捗を共有
- **アンケート機能**: 構造化された意見収集
- **AI 対話機能**: 自然言語による知識発見
- **データ分析機能**: エンゲージメント状況の可視化
- **管理機能**: 組織に応じたカスタマイズ

## 技術スタック

- **フレームワーク**: Slack Bolt for JavaScript (Node.js)
- **言語**: TypeScript
- **通信方式**: Socket Mode（WebSocketベース）
- **データベース**: Supabase (PostgreSQL + リアルタイム機能)
- **AI 統合**: OpenAI API
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

- [`SOCKET_MODE_SETUP.md`](SOCKET_MODE_SETUP.md) - Socket Mode セットアップガイド
- [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) - トラブルシューティング
- [`CLAUDE.md`](CLAUDE.md) - プロジェクト仕様書（Claude Code用）
- [`docs/archive/`](docs/archive/) - 過去のドキュメント（ngrok関連等）

## ライセンス

MIT License
