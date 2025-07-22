# Vercel デプロイメントガイド

## 概要

このガイドでは、Slack Knowledge HubをVercelで本番運用するための手順を説明します。Socket Mode使用により、Webhook URL設定は不要で、Vercelでの継続的デプロイが可能です。

## 前提条件

- [Vercel](https://vercel.com)アカウント
- GitHubリポジトリ
- Slack アプリの基本設定完了（Socket Mode有効化済み）

## 🚀 デプロイ手順

### ステップ 1: Vercelプロジェクト作成

1. [Vercel Dashboard](https://vercel.com/dashboard)にログイン
2. 「New Project」をクリック
3. GitHubリポジトリを選択
4. プロジェクト名を設定（例: `slack-knowledge-hub`）

### ステップ 2: 環境変数の設定

Vercel Dashboard → Settings → Environment Variables で以下を設定：

#### 🔑 必須環境変数

```bash
# Slack App設定
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_APP_TOKEN=xapp-your-app-token-here

# Supabase設定
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# OpenAI設定
OPENAI_API_KEY=sk-your-openai-api-key-here

# アプリケーション設定
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# スケジューリング設定（任意）
SHUFFLE_CRON_SCHEDULE=0 10 * * 1-5
RANKING_CRON_SCHEDULE=0 9 1 * *
```

#### ⚠️ セキュリティ注意事項

- 全ての環境変数は「Production」環境に設定
- 開発用と本番用で異なるトークンを使用
- サービスロールキーの権限を最小限に制限

### ステップ 3: デプロイ設定

#### 自動設定済み項目

以下の設定は既にプロジェクトで完了済み：

- ✅ `vercel.json` - Vercel設定ファイル
- ✅ `package.json` - ビルドスクリプト
- ✅ TypeScript設定
- ✅ Socket Mode対応

#### デプロイ実行

```bash
# プロジェクトをVercelにデプロイ
git push origin main
```

Vercelが自動的に：
1. ソースコードを取得
2. 依存関係をインストール
3. TypeScriptコンパイル
4. デプロイメント完了

### ステップ 4: デプロイ後の確認

#### ヘルスチェック

```bash
# デプロイしたURLでヘルスチェック
curl https://your-app.vercel.app/health
```

期待されるレスポンス：
```json
{
  "status": "ok",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "service": "slack-knowledge-hub"
}
```

#### ログの確認

Vercel Dashboard → Functions → View Function Logs でアプリケーションログを確認：

```
[INFO] Starting Slack Knowledge Hub...
[INFO] Authenticated as bot: your-bot in team: your-team
[INFO] Slack Knowledge Hub is running in Socket Mode
```

## 🔧 Slack アプリの本番設定

### Socket Mode設定の確認

1. [Slack API Dashboard](https://api.slack.com/apps)で対象アプリを選択
2. 「Socket Mode」→ 「Enable Socket Mode」が**ON**であることを確認
3. App-Level Tokenが正しく設定されていることを確認

### スコープの確認

「OAuth & Permissions」で以下のスコープが設定されていることを確認：

#### Bot Token Scopes
- `app_mentions:read`
- `channels:history`
- `channels:read`
- `chat:write`
- `commands`
- `im:history`
- `im:read`
- `users:read`

### イベント購読の確認

「Event Subscriptions」で以下が設定されていることを確認：

#### Subscribe to bot events
- `app_mention`
- `message.channels`
- `message.im`

## 🏃‍♂️ 継続的デプロイ設定

### 自動デプロイ

GitHubへのpushで自動デプロイが実行されます：

```bash
# 変更をプッシュ
git add .
git commit -m "Update feature"
git push origin main
# → Vercelが自動的にデプロイ
```

### プレビューデプロイ

プルリクエスト作成時にプレビュー環境が自動作成：

1. ブランチを作成して変更
2. プルリクエストを作成
3. VercelがプレビューURLを生成
4. テスト完了後にメインブランチにマージ

## 📊 監視とメンテナンス

### ログ監視

```bash
# Vercel CLI でリアルタイムログ確認
npx vercel logs
```

### パフォーマンス監視

- Vercel Analytics で応答時間を監視
- Function実行時間の最適化
- メモリ使用量の確認

### アップデート手順

1. 依存関係の更新
```bash
npm update
npm audit fix
```

2. テスト実行
```bash
npm test
```

3. デプロイ
```bash
git push origin main
```

## 🚨 トラブルシューティング

### よくある問題

#### 1. 環境変数エラー
```
Error: Missing required environment variables: SLACK_BOT_TOKEN
```

**解決方法**: Vercel Dashboardで環境変数が正しく設定されているか確認

#### 2. Socket Mode接続エラー
```
Error: Failed to connect to Slack via Socket Mode
```

**解決方法**: 
- SLACK_APP_TOKENの確認
- Socket Modeが有効化されているか確認

#### 3. Supabase接続エラー
```
Error: Failed to connect to Supabase
```

**解決方法**:
- SUPABASE_URLとキーの確認
- Supabaseプロジェクトがアクティブか確認

### デバッグ方法

```bash
# Vercel Function ログの確認
npx vercel logs --follow

# 特定の関数のログ
npx vercel logs [function-name]
```

## 📚 参考リンク

- [Vercel Documentation](https://vercel.com/docs)
- [Slack Socket Mode Documentation](https://api.slack.com/apis/connections/socket)
- [Node.js on Vercel](https://vercel.com/docs/runtimes/node-js)

---

## ✅ チェックリスト

デプロイ前の最終確認：

- [ ] 全ての環境変数が設定済み
- [ ] Socket Modeが有効化済み
- [ ] Slackアプリのスコープが正しく設定
- [ ] ヘルスチェックが応答
- [ ] ログにエラーがない
- [ ] Slack上でボットが応答

これで、Slack Knowledge HubがVercelで24/7稼働する本番環境が完成です！