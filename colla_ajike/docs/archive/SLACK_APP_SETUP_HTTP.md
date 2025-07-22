# Slack App設定詳細ガイド

このガイドでは、Slack Knowledge Hubアプリの設定を詳細に説明します。

## 前提条件

1. Slack Appが作成済みであること
2. ワークスペースにアプリがインストール済みであること
3. ngrokまたは公開URL設定が完了していること（`SETUP_NGROK.md`参照）

## 必要な設定項目

### 1. Basic Information
- **App Name**: Slack Knowledge Hub
- **Description**: チームの知識共有とエンゲージメントを促進するSlackアプリ
- **App Icon**: 適切なアイコンをアップロード

### 2. OAuth & Permissions

#### Bot Token Scopes（必須）
以下のスコープが必要です：

```
app_mentions:read    # @botへのメンションを読み取り
channels:read        # チャンネル情報の読み取り
chat:write          # メッセージの送信
commands            # スラッシュコマンドの使用
im:read             # DMの読み取り
im:write            # DMの送信
users:read          # ユーザー情報の読み取り
users:read.email    # ユーザーのメールアドレス読み取り
im:history          # DM履歴の読み取り
```

#### User Token Scopes（任意）
現在は使用していませんが、今後の機能拡張に備えて以下を設定することを推奨：
```
users:read
users:read.email
```

### 3. Slash Commands

以下のスラッシュコマンドを設定：

#### `/profile`
- **Command**: `/profile`
- **Request URL**: `https://YOUR-DOMAIN.com/slack/events`
- **Short Description**: プロフィール管理
- **Usage Hint**: `[@user] [search keyword] [list] [help]`
- **Escape channels, users, and links sent to your app**: ✓

#### `/coffee`
- **Command**: `/coffee`
- **Request URL**: `https://YOUR-DOMAIN.com/slack/events`
- **Short Description**: ホットコーヒー（感謝）システム
- **Usage Hint**: `[@user message] [stats] [ranking] [help]`
- **Escape channels, users, and links sent to your app**: ✓

#### `/daily`
- **Command**: `/daily`
- **Request URL**: `https://YOUR-DOMAIN.com/slack/events`
- **Short Description**: 日報システム
- **Usage Hint**: `[create] [today] [my] [summary] [trend] [team] [weekly] [insights]`
- **Escape channels, users, and links sent to your app**: ✓

#### `/survey`
- **Command**: `/survey`
- **Request URL**: `https://YOUR-DOMAIN.com/slack/events`
- **Short Description**: アンケート管理
- **Usage Hint**: `[list] [create] [templates] [my] [stats] [remind]`
- **Escape channels, users, and links sent to your app**: ✓

#### `/ask`
- **Command**: `/ask`
- **Request URL**: `https://YOUR-DOMAIN.com/slack/events`
- **Short Description**: AI質問システム
- **Usage Hint**: `[your question]`
- **Escape channels, users, and links sent to your app**: ✓

#### `/analytics`
- **Command**: `/analytics`
- **Request URL**: `https://YOUR-DOMAIN.com/slack/events`
- **Short Description**: 分析・レポート機能
- **Usage Hint**: `[overview] [engagement] [knowledge] [coffee] [health] [report] [export]`
- **Escape channels, users, and links sent to your app**: ✓

#### `/khub-admin`
- **Command**: `/khub-admin`
- **Request URL**: `https://YOUR-DOMAIN.com/slack/events`
- **Short Description**: 管理者コマンド
- **Usage Hint**: `[status] [sync-users] [shuffle-stats] [help]`
- **Escape channels, users, and links sent to your app**: ✓

### 4. Event Subscriptions

#### Enable Events
- **ON**に設定

#### Request URL
```
https://YOUR-DOMAIN.com/slack/events
```

#### Subscribe to bot events
以下のイベントを追加：

```
app_mention         # @botへのメンション
message.im          # DMメッセージ
user_change         # ユーザー情報の変更
```

#### Subscribe to events on behalf of users
現在は使用していませんが、今後の拡張に備えて設定可能：
```
message.channels    # チャンネルメッセージ（必要に応じて）
```

### 5. Interactivity & Shortcuts

#### Interactivity
- **ON**に設定

#### Request URL
```
https://YOUR-DOMAIN.com/slack/events
```

#### Shortcuts
以下のショートカットを追加：

#### daily_report
- **Name**: 日報作成
- **Short Description**: 今日の日報を作成する
- **Callback ID**: `daily_report`

#### create_survey
- **Name**: アンケート作成
- **Short Description**: 新しいアンケートを作成する
- **Callback ID**: `create_survey`

### 6. App Home

#### Home Tab
- **ON**に設定（将来の機能拡張用）

#### Messages Tab
- **ON**に設定
- **Allow users to send Slash commands and messages from the messages tab**: ✓

### 7. Install App

#### Install to Workspace
1. 「Install to Workspace」をクリック
2. 権限を確認してインストール

### 8. Signing Secret の設定

アプリケーションの環境変数に以下を設定：

```bash
# .env ファイル
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token  # Socket Mode使用時のみ
```

## 設定確認チェックリスト

- [ ] OAuth & Permissionsで必要なスコープが設定済み
- [ ] すべてのSlash Commandsが作成済み
- [ ] Event Subscriptionsが有効化済み
- [ ] Interactivity & Shortcutsが有効化済み
- [ ] Request URLsがすべて同じURL（`/slack/events`）に設定済み
- [ ] アプリがワークスペースにインストール済み
- [ ] 環境変数が正しく設定済み

## 動作テスト手順

1. **基本的な動作確認**
   ```
   /profile
   ```
   プロフィール作成モーダルが表示される

2. **AIメンション機能**
   ```
   @knowledge_hub こんにちは
   ```
   AIが返答する

3. **感謝システム**
   ```
   /coffee @user ありがとうございます！
   ```
   感謝メッセージが送信される

4. **日報機能**
   ```
   /daily
   ```
   日報作成モーダルが表示される

## よくある設定ミス

1. **Request URLの不一致**: すべて`/slack/events`で統一
2. **スコープ不足**: 必要なBot Token Scopesが不足
3. **Event Subscriptionが無効**: イベント受信に必要
4. **Interactivityが無効**: モーダル・ボタン操作に必要

## セキュリティ設定

### 環境変数の保護
- `.env`ファイルを`.gitignore`に追加
- 本番環境ではシークレット管理サービスを使用

### IP制限（オプション）
Slack Appの設定で特定のIPアドレスからのアクセスのみを許可することも可能です。

## 本番環境への移行

1. **ドメインの設定**: ngrokではなく独自ドメインを使用
2. **HTTPS証明書**: SSL証明書の設定
3. **環境変数**: 本番用の値に更新
4. **監視**: ログ監視・エラー通知の設定