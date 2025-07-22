# Vercel デプロイ手順書

## 🚀 完了済み設定

以下の設定は既に完了しています：

✅ **プロジェクト設定**
- `vercel.json` - Vercel設定ファイル作成済み
- `package.json` - ビルドスクリプト更新済み
- Socket Mode対応済み（ngrok不要）

✅ **ドキュメント作成**
- `docs/setup/vercel-deployment.md` - 詳細デプロイガイド
- `docs/setup/slack-production-setup.md` - Slack本番設定ガイド

## 📝 今すぐ実行すべき手順

### 1. Vercelアカウント準備
1. [Vercel](https://vercel.com)にサインアップ/ログイン
2. GitHubアカウントと連携

### 2. Slack本番アプリ作成
[詳細手順: docs/setup/slack-production-setup.md](docs/setup/slack-production-setup.md)

#### 重要なポイント：
- Socket Mode有効化
- 本番用トークン3つ取得：
  - `SLACK_BOT_TOKEN` (xoxb-...)
  - `SLACK_APP_TOKEN` (xapp-...)  
  - `SLACK_SIGNING_SECRET`

### 3. Vercelプロジェクト作成
1. Vercel Dashboard → "New Project"
2. このGitHubリポジトリを選択
3. プロジェクト名設定

### 4. 環境変数設定
Vercel Dashboard → Settings → Environment Variables で設定：

```bash
SLACK_BOT_TOKEN=xoxb-your-production-token
SLACK_SIGNING_SECRET=your-production-secret
SLACK_APP_TOKEN=xapp-your-production-token
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=sk-your-openai-key
NODE_ENV=production
```

### 5. デプロイ実行
```bash
git add .
git commit -m "Add Vercel deployment configuration"
git push origin main
```

### 6. 動作確認
```bash
# ヘルスチェック
curl https://your-app.vercel.app/health

# Slackで /ping コマンドテスト
```

## 🎯 期待される結果

- ✅ 24/7稼働するSlackボット
- ✅ 自動デプロイによる継続的運用
- ✅ Socket Modeによる安定した接続
- ✅ Vercelによるスケーラブルなインフラ

## 📚 詳細ガイド

全ての詳細手順は以下のドキュメントを参照：
- [Vercelデプロイメントガイド](docs/setup/vercel-deployment.md)
- [Slack本番設定ガイド](docs/setup/slack-production-setup.md)

---

**次のステップ**: 上記手順を順番に実行してください。不明な点があれば詳細ガイドを参照してください。