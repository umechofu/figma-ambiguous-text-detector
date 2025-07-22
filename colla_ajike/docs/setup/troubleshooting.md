# トラブルシューティングガイド

Slack Knowledge Hubで発生する可能性のある問題とその解決方法を説明します。

## 一般的なエラー

### 1. dispatch_failed エラー

**症状**: スラッシュコマンドで「dispatch_failed により失敗しました」と表示される

**原因**:
- Socket Modeが正しく設定されていない
- App-Level Tokenが無効または設定されていない
- WebSocket接続が失敗している

**解決方法**:
1. **Socket Mode設定の確認**:
   - [api.slack.com/apps](https://api.slack.com/apps)でアプリ設定を開く
   - Socket Mode が **ON** になっているか確認

2. **App-Level Tokenの確認**:
   ```bash
   # 環境変数が設定されているか確認
   echo $SLACK_APP_TOKEN
   ```
   `xapp-`で始まるトークンが設定されているか確認

3. **アプリケーションの再起動**:
   ```bash
   # 開発サーバーを再起動
   npm run dev
   ```

4. **アプリケーションの確認**:
   ```bash
   # ヘルスチェック（Socket Modeでも利用可能）
   curl http://localhost:3000/health
   ```

### 2. Bot Token エラー

**症状**: 
- `Invalid token specified`
- `not_authed`
- 認証エラー

**原因**: 
- 環境変数のBot Tokenが正しくない
- Token の有効期限切れ

**解決方法**:
1. **.env ファイルの確認**:
   ```bash
   cat .env | grep SLACK_BOT_TOKEN
   ```

2. **Tokenの更新**:
   - [api.slack.com/apps](https://api.slack.com/apps)でアプリを選択
   - OAuth & Permissions → Bot User OAuth Token をコピー
   - `.env`ファイルを更新:
     ```
     SLACK_BOT_TOKEN=xoxb-your-new-token
     ```

3. **アプリケーションの再起動**:
   ```bash
   # 開発サーバーを再起動
   npm run dev
   ```

### 3. App Token エラー

**症状**: 
- `Invalid app token`
- `WebSocket connection failed`
- Socket接続エラー

**原因**: 
- SLACK_APP_TOKENが正しく設定されていない
- App-Level Tokenの権限が不足している

**解決方法**:
1. **App-Level Tokenの再生成**:
   - [api.slack.com/apps](https://api.slack.com/apps)でアプリを選択
   - Socket Mode → Generate Token and Scopes
   - 必要なスコープ: `connections:write`, `authorizations:read`

2. **環境変数の更新**:
   ```bash
   # .env ファイル
   SLACK_APP_TOKEN=xapp-your-new-app-token
   ```

3. **アプリケーションの再起動**:
   ```bash
   npm run dev
   ```

### 4. Database Connection エラー

**症状**: 
- `Supabase connection failed`
- データベース接続エラー

**原因**: 
- Supabaseの認証情報が正しくない
- ネットワーク接続の問題

**解決方法**:
1. **環境変数の確認**:
   ```bash
   # 必要な環境変数が設定されているか確認
   echo $SUPABASE_URL
   echo $SUPABASE_ANON_KEY
   ```

2. **Supabase設定の確認**:
   - [supabase.com](https://supabase.com)でプロジェクト設定を確認
   - URLとAPI Keyが正しいことを確認

3. **ネットワーク接続の確認**:
   ```bash
   # Supabaseに接続できるか確認
   curl -I $SUPABASE_URL
   ```

### 5. OpenAI API エラー

**症状**: 
- `OpenAI API error`
- AI機能が動作しない

**原因**: 
- OpenAI API Keyが正しくない
- API利用制限に達している
- APIキーの権限不足

**解決方法**:
1. **API Keyの確認**:
   ```bash
   echo $OPENAI_API_KEY
   ```

2. **API利用状況の確認**:
   - [platform.openai.com](https://platform.openai.com)でダッシュボードを確認
   - 利用制限・請求状況を確認

3. **権限の確認**:
   - API Keyにgpt-3.5-turbo/gpt-4へのアクセス権限があるか確認

## 開発環境の問題

### 1. Port Already in Use

**症状**: `Error: listen EADDRINUSE: address already in use :::3000`

**解決方法**:
```bash
# ポート3000を使用しているプロセスを確認
lsof -ti:3000

# プロセスを終了
kill -9 $(lsof -ti:3000)

# または、別のポートを使用
PORT=3001 npm run dev
```

### 2. TypeScript Compilation エラー

**症状**: TypeScriptコンパイルエラー

**解決方法**:
```bash
# TypeScript の確認
npx tsc --noEmit

# 依存関係の再インストール
rm -rf node_modules package-lock.json
npm install
```

### 3. Node.js Version エラー

**症状**: Node.jsバージョン関連のエラー

**解決方法**:
```bash
# Node.js バージョンの確認
node --version

# 推奨: Node.js 18.x以上を使用
nvm use 18  # nvmを使用している場合
```

## Socket Mode の問題

### 1. WebSocket Connection Failed

**症状**: 
- `WebSocket connection failed`
- `Connection timeout`
- Socket Mode接続エラー

**解決方法**:
1. **インターネット接続の確認**:
   ```bash
   # 外部接続テスト
   curl -I https://slack.com
   ```

2. **ファイアウォール設定の確認**:
   - WebSocket通信（WSS）が許可されているか確認
   - ポート443の送信が許可されているか確認

3. **プロキシ環境の場合**:
   - WebSocket通信がプロキシを通過できるか確認
   - 必要に応じてプロキシ設定を追加

### 2. Command Not Found

**症状**: `/profile` コマンドが「見つかりません」エラー

**原因**: 
- Socket Modeが有効になっていない
- スラッシュコマンドが正しく設定されていない
- アプリがワークスペースにインストールされていない

**解決方法**:
1. **Socket Mode設定の確認**:
   - [api.slack.com/apps](https://api.slack.com/apps)
   - Socket Mode が **ON** になっているか確認

2. **Slash Commands設定の確認**:
   - Slash Commands でコマンドが作成されているか確認
   - Socket Mode使用時はRequest URL設定は不要

3. **アプリの再インストール**:
   - Install App → Reinstall App

### 3. Permission Denied

**症状**: 「権限がありません」エラー

**原因**: 必要なOAuthスコープが不足している

**解決方法**:
1. **Bot Token Scopesの確認**:
   - OAuth & Permissions で以下が設定されているか確認:
     ```
     app_mentions:read
     channels:read
     chat:write
     commands
     im:read
     im:write
     users:read
     users:read.email
     ```

2. **App-Level Token Scopesの確認**:
   - Socket Mode で以下が設定されているか確認:
     ```
     connections:write
     authorizations:read
     ```

3. **アプリの再インストール**:
   - スコープを追加後、「Reinstall App」を実行

## パフォーマンスの問題

### 1. 応答が遅い

**症状**: コマンドの応答が3秒以上かかる

**解決方法**:
1. **データベースクエリの最適化**
2. **非同期処理の実装**
3. **キャッシュの導入**

### 2. メモリ使用量が多い

**解決方法**:
```bash
# Node.js のメモリ使用量を確認
node --max-old-space-size=4096 src/index.ts

# プロファイリングの実行
node --inspect src/index.ts
```

## ログの確認方法

### アプリケーションログ
```bash
# 開発環境
npm run dev

# ログレベルの設定
DEBUG=* npm run dev
```

### Socket Mode ログ
Socket Mode使用時は、アプリケーション内でWebSocket接続のログが確認できます：
```bash
# Socket接続状況の確認
npm run dev
# 「Socket Mode」や「WebSocket」関連のログを確認
```

### Slack App ログ
- [api.slack.com/apps](https://api.slack.com/apps)
- Socket Mode → Connection status で接続状況確認
- Slash Commands で個別テスト

## サポート情報

### 関連ドキュメント
- [`QUICK_START.md`](QUICK_START.md) - 最短セットアップ手順
- [`SOCKET_MODE_SETUP.md`](SOCKET_MODE_SETUP.md) - Socket Mode詳細設定
- [`README.md`](README.md) - 基本的な使い方
- [`CLAUDE.md`](CLAUDE.md) - プロジェクト仕様書

### 外部リソース
- [Slack API Documentation](https://api.slack.com/)
- [Socket Mode Documentation](https://api.slack.com/apis/connections/socket)
- [Supabase Documentation](https://supabase.com/docs)

### 緊急時の対応

1. **Socket Mode接続障害時**:
   - アプリケーションを再起動
   - App-Level Tokenを再生成
   - インターネット接続とファイアウォール設定を確認

2. **データ整合性の問題**:
   - Supabaseダッシュボードでデータ確認
   - 必要に応じて手動でデータ修正

3. **セキュリティインシデント**:
   - 該当のAPI Keyを即座に無効化
   - 新しいKeyを生成・設定
   - ログで不審なアクセスを確認

## Socket Mode vs HTTP Mode

Socket Modeに移行したため、以下の変更点があります：

| 項目 | Socket Mode | HTTP Mode（旧） |
|------|-------------|----------------|
| 外部URL | 不要 | 必要（ngrok等） |
| Request URL設定 | 不要 | 必要 |
| 開発の簡単さ | 簡単 | 複雑 |
| トラブルシューティング | WebSocket関連 | HTTP/URL関連 |

従来のngrok関連の問題は、Socket Mode移行により解決されています。