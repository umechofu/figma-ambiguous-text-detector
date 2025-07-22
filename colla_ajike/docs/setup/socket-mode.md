# Socket Mode セットアップガイド

Socket Modeは、ngrokなどの外部公開URL不要でSlackアプリを開発できるSlack公式の方法です。WebSocketを使用してSlackと直接通信します。

## Socket Modeの利点

- **外部公開URL不要** - ngrokやクラウドデプロイが不要
- **セキュリティが高い** - 外部からアクセスできない
- **開発が簡単** - ローカル環境でそのまま動作
- **無料** - 追加の費用なし
- **安定性** - トンネル接続の不安定さがない

## 前提条件

1. Slack Appが作成済みであること
2. ワークスペースにアプリがインストール済みであること
3. 必要な権限（scopes）が設定済みであること

## Slack App設定

### 1. Socket Modeの有効化

1. [api.slack.com/apps](https://api.slack.com/apps)で対象のアプリを選択
2. 左メニューから「Socket Mode」を選択
3. 「Enable Socket Mode」をONにする

### 2. App-Level Tokenの生成

1. Socket Mode設定ページで「Generate Token and Scopes」をクリック
2. Token Nameを入力（例：`socket-mode-token`）
3. 必要なスコープを選択：
   ```
   connections:write    # WebSocket接続の書き込み
   authorizations:read  # 認証情報の読み取り
   ```
4. 「Generate」をクリック
5. 生成されたトークン（`xapp-`で始まる）をコピー

### 3. 環境変数の設定

`.env`ファイルに以下を追加：
```bash
# Slack設定
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-level-token

# その他の設定...
```

**重要**: `SLACK_APP_TOKEN`は必須です。

## アプリケーション設定

現在のコードは既にSocket Mode対応済みです：

```typescript
// src/app/SlackBotApp.ts
this.app = new App({
  token: config.slack.botToken,
  appToken: config.slack.appToken,    // App-Level Token
  socketMode: true,                   // Socket Modeを有効化
  logLevel: LogLevel.DEBUG,
});
```

## Event Subscriptions設定（不要）

Socket Mode使用時は、以下の設定は**不要**です：
- ❌ Event Subscriptions の Request URL設定
- ❌ Slash Commands の Request URL設定  
- ❌ Interactivity & Shortcuts の Request URL設定

これらは自動的にSocket経由で処理されます。

## 必要な権限（Bot Token Scopes）

以下のスコープが設定されていることを確認：

```
app_mentions:read    # @botへのメンション
channels:read        # チャンネル情報
chat:write          # メッセージ送信
commands            # スラッシュコマンド
im:read             # DM読み取り
im:write            # DM送信
users:read          # ユーザー情報
users:read.email    # メールアドレス
im:history          # DM履歴
```

## 起動と動作確認

### 1. アプリケーション起動
```bash
npm run dev
```

以下のログが表示されれば正常：
```
[INFO] Supabase client initialized
[INFO] Starting Slack Knowledge Hub...
[INFO] Authenticated as bot: knowledge_hub in team: your-team
[INFO] Slack Knowledge Hub is running in Socket Mode
[INFO] Health check available at: http://localhost:3000/health
```

### 2. 動作テスト

Slackワークスペースで以下をテスト：

#### プロフィール機能
```
/profile
```
プロフィール作成モーダルが表示される

#### AI機能
```
@knowledge_hub こんにちは
```
AIが返答する

#### 感謝機能
```
/coffee @user ありがとう！
```
感謝メッセージが送信される

## トラブルシューティング

### App Token関連エラー

**症状**: `Invalid app token`、`WebSocket connection failed`

**解決方法**:
1. App-Level Tokenが正しく生成されているか確認
2. 環境変数`SLACK_APP_TOKEN`が正しく設定されているか確認
3. Tokenに必要なスコープ（`connections:write`, `authorizations:read`）があるか確認

### Socket接続エラー

**症状**: WebSocket接続が失敗する

**解決方法**:
1. インターネット接続を確認
2. ファイアウォール設定を確認
3. プロキシ環境の場合、WebSocket通信が許可されているか確認

### 権限エラー

**症状**: `Missing scope`、`not_authed`

**解決方法**:
1. Bot Token Scopesを確認・追加
2. アプリを再インストール：
   - OAuth & Permissions → Reinstall App

### Token検証エラー

**症状**: Token関連のエラーが続く

**解決方法**:
```bash
# 環境変数が正しく読み込まれているか確認
node -e "
require('dotenv').config();
console.log('BOT_TOKEN:', process.env.SLACK_BOT_TOKEN?.substring(0, 10) + '...');
console.log('APP_TOKEN:', process.env.SLACK_APP_TOKEN?.substring(0, 10) + '...');
"
```

## Socket Mode vs HTTP Mode比較

| 項目 | Socket Mode | HTTP Mode |
|------|-------------|-----------|
| 外部URL | 不要 | 必要（ngrok等） |
| セキュリティ | 高い | 中程度 |
| 開発の簡単さ | 簡単 | 複雑 |
| 本番運用 | 可能 | 推奨 |
| スケーラビリティ | 制限あり | 高い |

## 本番環境での注意点

Socket Modeは本番環境でも使用可能ですが、以下を考慮：

1. **接続の冗長性**: 単一のSocket接続に依存
2. **スケーリング**: 複数インスタンス間での調整が困難
3. **監視**: WebSocket接続の監視が必要

大規模な本番環境では、HTTP Modeの検討も推奨します。

## 設定チェックリスト

- [ ] Socket Modeが有効化されている
- [ ] App-Level Tokenが生成・設定されている
- [ ] 環境変数SLACK_APP_TOKENが設定されている
- [ ] 必要なBot Token Scopesが設定されている
- [ ] アプリが正常に起動している
- [ ] Slackコマンドが動作している

## よくある質問

**Q: ngrokは完全に不要になりますか？**
A: はい。Socket Modeでは外部公開URLが一切不要です。

**Q: Event SubscriptionsのRequest URLはどうしますか？**
A: 空欄のままで構いません。Socket経由で自動処理されます。

**Q: 本番環境で使用できますか？**
A: 可能ですが、高可用性が必要な場合はHTTP Modeも検討してください。

**Q: 複数の開発者で同時開発できますか？**
A: それぞれが個別のApp-Level Tokenを使用すれば可能です。