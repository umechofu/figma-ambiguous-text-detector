# Slack アプリ本番環境設定ガイド

## 概要

このガイドでは、開発環境（NPAブランチ）で動作しているSlackアプリを本番環境用に設定する手順を説明します。

## 🔧 本番環境への移行手順

### ステップ 1: 本番用Slackアプリの作成（推奨）

#### オプション A: 新しいSlackアプリを作成
1. [Slack API Dashboard](https://api.slack.com/apps)にアクセス
2. 「Create New App」→ 「From scratch」
3. App Name: `Knowledge Hub Production`
4. Workspace: 本番運用するワークスペースを選択

#### オプション B: 既存アプリの複製
1. 既存のアプリ設定画面で「Settings」→ 「Basic Information」
2. 「App Manifest」をコピー
3. 新しいアプリ作成時にManifestを使用

### ステップ 2: Socket Mode設定

#### Socket Modeの有効化
1. 左メニューから「Socket Mode」を選択
2. 「Enable Socket Mode」を**ON**に設定
3. 設定保存

#### App-Level Token生成
1. Socket Mode設定画面で「Generate Token and Scopes」
2. Token Name: `production-app-token`
3. Scopes: `connections:write` を選択
4. 「Generate」をクリック
5. 🔑 **重要**: 生成されたトークン（`xapp-`で始まる）をコピーして安全に保存

### ステップ 3: Bot Token設定

#### Bot User OAuth Token取得
1. 左メニューから「OAuth & Permissions」を選択
2. 「Bot Token Scopes」で以下のスコープを設定：

```
app_mentions:read       # @ボット名 でのメンション
channels:history        # チャンネル履歴の読み取り
channels:read          # チャンネル情報の読み取り
chat:write             # メッセージ送信
commands               # スラッシュコマンド
im:history             # DMの履歴読み取り
im:read                # DM情報の読み取り
users:read             # ユーザー情報の読み取り
```

3. 「Install to Workspace」をクリック
4. 🔑 **重要**: Bot User OAuth Token（`xoxb-`で始まる）をコピーして保存

#### Signing Secret取得
1. 左メニューから「Basic Information」を選択
2. 「App Credentials」セクションで「Signing Secret」の「Show」をクリック
3. 🔑 **重要**: Signing Secretをコピーして保存

### ステップ 4: イベント購読設定

#### Event Subscriptionsの設定
1. 左メニューから「Event Subscriptions」を選択
2. 「Enable Events」を**ON**に設定

#### Subscribe to bot events
以下のイベントを購読：
```
app_mention           # @ボット名でのメンション
message.channels      # パブリックチャンネルでのメッセージ
message.im           # DMでのメッセージ
```

#### ⚠️ Socket Mode使用時の注意
- Request URL設定は**不要**
- Socket Modeでは全てWebSocket経由で処理

### ステップ 5: スラッシュコマンド設定

#### コマンドの登録
1. 左メニューから「Slash Commands」を選択
2. 「Create New Command」で以下を設定：

```bash
# 基本コマンド
/ping              # 接続テスト
/profile           # プロフィール管理
/shuffle           # シャッフル機能
/ai                # AI対話
/survey            # アンケート
/analytics         # 分析レポート
/admin             # 管理機能
```

3. 各コマンドの設定：
   - Request URL: 空白（Socket Mode使用時）
   - Short Description: 適切な説明を入力
   - Usage Hint: 使用例を入力

### ステップ 6: App Home設定（任意）

#### App Homeタブの有効化
1. 左メニューから「App Home」を選択
2. 「Home Tab」を有効化
3. 「Messages Tab」を有効化
4. 「Allow users to send Slash commands and messages from the messages tab」を有効化

### ステップ 7: 本番環境変数の設定

#### 取得した認証情報をまとめ
以下の情報を整理してVercelの環境変数に設定：

```bash
# 本番用Slack設定
SLACK_BOT_TOKEN=xoxb-本番環境で生成されたトークン
SLACK_SIGNING_SECRET=本番環境のSigningSecret
SLACK_APP_TOKEN=xapp-本番環境で生成されたAppToken

# その他の設定は開発環境と同じ
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=sk-your-openai-api-key

# 本番環境設定
NODE_ENV=production
LOG_LEVEL=info
```

## 🔍 設定確認手順

### ステップ 1: 基本接続テスト

#### Slackワークスペースでの確認
1. ボットがワークスペースに表示されているか確認
2. DMでボットにメッセージ送信をテスト
3. `/ping` コマンドで応答確認

```bash
# 期待される応答
🏓 Pong! ボットは正常に動作しています。
• ユーザーID: U1234567890
• チャンネルID: D1234567890
• タイムスタンプ: 2024-01-20T10:30:00.000Z
```

### ステップ 2: 機能別テスト

#### プロフィール機能
```bash
/profile show          # プロフィール表示
/profile edit          # プロフィール編集
```

#### シャッフル機能
```bash
/shuffle start         # シャッフル開始
/shuffle status        # 状況確認
```

#### AI対話機能
```bash
/ai 今日の天気は？      # AI応答テスト
```

### ステップ 3: 管理機能テスト

#### 管理者権限の確認
```bash
/admin status          # システム状況確認
/admin users           # ユーザー一覧
```

## 🚨 トラブルシューティング

### よくある問題と解決策

#### 1. Bot Token エラー
```
Error: An API error occurred: invalid_auth
```

**原因**: Bot Tokenが無効または期限切れ
**解決方法**: 
- OAuth & Permissionsでトークンを再生成
- Vercelの環境変数を更新

#### 2. App Token エラー
```
Error: Socket Mode connection failed
```

**原因**: App Tokenが無効またはSocket Modeが無効
**解決方法**:
- Socket Modeが有効化されているか確認
- App-Level Tokenを再生成

#### 3. 権限エラー
```
Error: Missing scope: chat:write
```

**解決方法**:
- OAuth & Permissionsで必要なスコープを追加
- ワークスペースに再インストール

#### 4. イベントが受信されない
**確認ポイント**:
- Event Subscriptionsが有効か
- 必要なイベントが購読されているか
- Socket Modeが正しく動作しているか

### デバッグ用ログ確認

```bash
# Vercelでのログ確認
npx vercel logs --follow

# 期待されるログメッセージ
[INFO] Starting Slack Knowledge Hub...
[INFO] Authenticated as bot: knowledge-hub-prod in team: your-team
[INFO] Slack Knowledge Hub is running in Socket Mode
[INFO] 👋 Hello event received from Slack
```

## 📚 本番運用のベストプラクティス

### セキュリティ
- 🔒 開発用と本番用で異なるトークンを使用
- 🔒 定期的なトークンローテーション
- 🔒 最小権限の原則に従ったスコープ設定

### 監視
- 📊 定期的なヘルスチェック
- 📊 エラーレートの監視
- 📊 レスポンス時間の監視

### メンテナンス
- 🔄 定期的な依存関係アップデート
- 🔄 セキュリティパッチの適用
- 🔄 機能テストの実行

## ✅ 本番環境チェックリスト

### Socket Mode設定
- [ ] Socket Modeが有効化されている
- [ ] App-Level Token (`xapp-`) が生成済み
- [ ] 必要なスコープ (`connections:write`) が設定済み

### OAuth & Permissions
- [ ] Bot User OAuth Token (`xoxb-`) が生成済み
- [ ] 必要なBot Token Scopesが全て設定済み
- [ ] ワークスペースにインストール済み

### Event Subscriptions
- [ ] Event Subscriptionsが有効化されている
- [ ] 必要なBot Eventsが購読済み
- [ ] Request URL設定は空白（Socket Mode使用）

### Slash Commands
- [ ] 必要なスラッシュコマンドが全て登録済み
- [ ] 各コマンドの説明が適切に設定済み

### 環境変数
- [ ] SLACK_BOT_TOKEN が設定済み
- [ ] SLACK_SIGNING_SECRET が設定済み
- [ ] SLACK_APP_TOKEN が設定済み
- [ ] その他の必要な環境変数が設定済み

### テスト
- [ ] `/ping` コマンドが正常に応答
- [ ] DMでのメッセージ送受信が正常
- [ ] 各機能のスラッシュコマンドが正常
- [ ] ヘルスチェックエンドポイントが正常

---

本番環境設定が完了したら、[Vercelデプロイメントガイド](./vercel-deployment.md)を参照してデプロイを実行してください。