# Slack Knowledge Hub - クイックスタート

最短3ステップで Slack Knowledge Hub を起動できます。

## 📋 事前準備

- Node.js 18以上
- Slack ワークスペースの管理者権限
- Supabase アカウント
- OpenAI API キー

## 🚀 3ステップセットアップ

### ステップ 1: Socket Mode を有効化

1. [Slack App 管理画面](https://api.slack.com/apps)にアクセス
2. 対象のアプリを選択
3. 左メニューから「**Socket Mode**」を選択
4. 「**Enable Socket Mode**」を**ON**にする
5. 「**Generate Token and Scopes**」をクリック
6. Token Name を入力（例：`socket-mode-token`）
7. スコープを選択：
   - `connections:write`
   - `authorizations:read`
8. 生成された`xapp-`で始まるトークンをコピー

### ステップ 2: 環境変数を設定

1. `.env.example` を `.env` にコピー：
   ```bash
   cp .env.example .env
   ```

2. `.env` ファイルを編集して以下を設定：
   ```bash
   # Slack設定（必須）
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_SIGNING_SECRET=your-signing-secret
   SLACK_APP_TOKEN=xapp-your-app-level-token  # ← ステップ1で取得

   # Supabase設定（必須）
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   # OpenAI設定（必須）
   OPENAI_API_KEY=sk-your-openai-api-key
   ```

### ステップ 3: アプリを起動

```bash
# 依存関係をインストール
npm install

# 開発サーバーを起動
npm run dev
```

## ✅ 動作確認

以下のログが表示されれば成功です：

```
[INFO] Slack Knowledge Hub is running in Socket Mode
[INFO] Authenticated as bot: knowledge_hub in team: your-team
```

### Slack での動作テスト

1. **プロフィール機能**
   ```
   /profile
   ```

2. **AI対話機能**
   ```
   @knowledge_hub こんにちは
   ```

3. **感謝システム**
   ```
   /coffee @user ありがとうございます！
   ```

## 🎉 完了！

ngrok不要で、すぐにローカル開発を始められます。

## 📚 次のステップ

- **詳細設定**: [`SOCKET_MODE_SETUP.md`](SOCKET_MODE_SETUP.md)
- **トラブル解決**: [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md)
- **プロジェクト仕様**: [`CLAUDE.md`](CLAUDE.md)

## ❓ よくある質問

**Q: `xapp-` トークンが見つからない**
A: Socket Mode を有効化してから、Token 生成を行ってください。

**Q: 「dispatch_failed」エラー**
A: Socket Mode が正しく設定されていれば、このエラーは解決されます。

**Q: ボットが反応しない**
A: Bot Token Scopes が正しく設定されているか確認してください。

**Q: データベース接続エラー**
A: Supabase の URL と API キーが正しいか確認してください。