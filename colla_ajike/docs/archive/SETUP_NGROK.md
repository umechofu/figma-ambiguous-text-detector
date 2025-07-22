# ngrokセットアップガイド

このガイドでは、Slack Knowledge Hubをローカル環境で開発・テストするためのngrokのセットアップ手順を説明します。

## ngrokとは

ngrokは、ローカルで動作しているサーバーを一時的にインターネットに公開するトンネリングツールです。Slackアプリの開発時には、Slackサーバーからローカルのアプリケーションにアクセスできるようにするためにngrokを使用します。

## インストール方法

### macOS
```bash
# Homebrewを使用
brew install ngrok
```

### Windows
1. [ngrok公式サイト](https://ngrok.com/download)からダウンロード
2. ZIPファイルを解凍
3. PATHに追加

### Linux
```bash
# snapを使用
sudo snap install ngrok

# または、直接ダウンロード
wget https://bin.equinox.io/c/4VmDzA7iaHb/ngrok-stable-linux-amd64.zip
unzip ngrok-stable-linux-amd64.zip
sudo mv ngrok /usr/local/bin/
```

## ngrokアカウントの設定（推奨）

1. [ngrok.com](https://ngrok.com/)でアカウントを
2. 作成
3. ダッシュボードからauthtokenを取得
4. authtokenを設定：
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```

## 基本的な使い方

### 1. アプリケーションを起動
```bash
npm run dev
```
アプリケーションがポート3000で起動していることを確認します。

### 2. ngrokトンネルを開始
別のターミナルウィンドウで以下を実行：
```bash
ngrok http 3000
```

### 3. 公開URLを確認
ngrokが起動すると、以下のような出力が表示されます：
```
Session Status                online
Account                       your-email@example.com (Plan: Free)
Version                       3.5.0
Region                        Japan (jp)
Latency                       10ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123def456.ngrok-free.app -> http://localhost:3000
```

`Forwarding`の行にあるHTTPS URLが公開URLです。このURLをコピーします。

## Slack Appの設定

### 1. Slack App管理画面にアクセス
[api.slack.com/apps](https://api.slack.com/apps)から対象のアプリを選択

### 2. Request URLsの更新

以下の3箇所でRequest URLを更新します：

#### a. Slash Commands
1. 左メニューから「Slash Commands」を選択
2. 各コマンド（/profile, /coffee, /ask等）をクリック
3. Request URLを以下に更新：
   ```
   https://YOUR-NGROK-URL.ngrok-free.app/slack/events
   ```

#### b. Event Subscriptions
1. 左メニューから「Event Subscriptions」を選択
2. Enable Eventsをオンにする
3. Request URLを以下に設定：
   ```
   https://YOUR-NGROK-URL.ngrok-free.app/slack/events
   ```

#### c. Interactivity & Shortcuts
1. 左メニューから「Interactivity & Shortcuts」を選択
2. Interactivityをオンにする
3. Request URLを以下に設定：
   ```
   https://YOUR-NGROK-URL.ngrok-free.app/slack/events
   ```

### 3. 設定を保存
各セクションで「Save Changes」をクリック

## 動作確認

1. Slackワークスペースで以下のコマンドを試す：
   ```
   /profile
   ```

2. 正常にモーダルが表示されれば成功

## 注意事項

- **無料版の制限**: ngrok無料版は8時間でセッションが切れます
- **URL変更**: ngrokを再起動するたびに新しいURLが生成されるため、Slack App設定の更新が必要です
- **セキュリティ**: ngrokは開発専用です。本番環境では使用しないでください

## トラブルシューティング

### URLが正しく検証されない
- アプリケーションが起動していることを確認
- ngrokが正しいポートを指定していることを確認
- Slack App設定のURLが最新のngrok URLと一致していることを確認

### タイムアウトエラー
- ローカルのファイアウォール設定を確認
- アプリケーションのログでエラーを確認

## 便利な設定

### ngrok設定ファイル
`~/.ngrok2/ngrok.yml`に以下を追加すると、カスタムサブドメインが使用できます（有料プランのみ）：
```yaml
authtoken: YOUR_AUTH_TOKEN
tunnels:
  slack-app:
    proto: http
    addr: 3000
    subdomain: your-custom-subdomain
```

起動時：
```bash
ngrok start slack-app
```