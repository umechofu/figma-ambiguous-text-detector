# Slack Knowledge Hub - 設計書

## 概要

Slack Knowledge Hub は、Slack をナレッジハブに変革するための包括的な Slack アプリです。Node.js と TypeScript を使用し、Slack Bolt framework を基盤として構築します。データベースには Supabase を使用し、AI 機能には OpenAI API を統合します。

## アーキテクチャ

### システム構成

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Slack Client  │◄──►│  Slack API      │◄──►│ Knowledge Hub   │
│                 │    │                 │    │ Application     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   OpenAI API    │◄──►│    Supabase     │
                       │                 │    │   Database      │
                       └─────────────────┘    └─────────────────┘
```

### 技術スタック

- **フレームワーク**: Slack Bolt for JavaScript (Node.js)
- **言語**: TypeScript
- **データベース**: Supabase (PostgreSQL + リアルタイム機能)
- **AI 統合**: OpenAI API
- **認証**: Slack OAuth 2.0 + Supabase Auth
- **通信方式**: Socket Mode (WebSocketベース)
- **デプロイメント**: Vercel または Railway (推奨)

## コンポーネントと インターフェース

### 1. Slack ボット コア

**責任**: Slack イベントの処理、コマンド実行、メッセージ送信

**主要クラス**:

- `SlackBotApp`: メインアプリケーションクラス
- `EventHandler`: Slack イベントの処理
- `CommandHandler`: スラッシュコマンドの処理

### 2. シャッフル機能モジュール

**責任**: ランダム質問の管理と配信

**主要クラス**:

- `ShuffleService`: 質問選択とメンバー選択のロジック
- `QuestionRepository`: 質問データの管理
- `ScheduleManager`: 定期実行の管理

### 3. プロフィール管理モジュール

**責任**: ユーザープロフィール（取扱説明書）の管理

**主要クラス**:

- `ProfileService`: プロフィール作成・更新・取得
- `ProfileRepository`: プロフィールデータの永続化
- `ProfileRenderer`: プロフィール表示の整形

### 4. ホットコーヒーシステムモジュール

**責任**: 感謝表現とランキング機能

**主要クラス**:

- `CoffeeService`: ホットコーヒー送信・受信の処理
- `RankingService`: 月次ランキングの生成
- `CoffeeRepository`: ホットコーヒーデータの管理

### 5. 日報機能モジュール

**責任**: 日次チェックインとコンディション共有

**主要クラス**:

- `DailyService`: 日報投稿・取得の処理
- `ConditionTracker`: コンディション履歴の管理
- `DailyRepository`: 日報データの永続化

### 6. アンケート機能モジュール

**責任**: アンケート作成・実行・集計

**主要クラス**:

- `SurveyService`: アンケートのライフサイクル管理
- `SurveyBuilder`: アンケート作成支援
- `ResponseCollector`: 回答収集と集計

### 7. AI 対話モジュール

**責任**: 自然言語による知識発見

**主要クラス**:

- `AIDialogueService`: OpenAI API との統合
- `KnowledgeExtractor`: 蓄積データからの知識抽出
- `ContextBuilder`: AI 用コンテキスト構築

### 8. 分析・レポートモジュール

**責任**: データ分析とレポート生成

**主要クラス**:

- `AnalyticsService`: 利用状況分析
- `ReportGenerator`: レポート生成
- `DataExporter`: データエクスポート機能

## データモデル

### User（ユーザー）

```typescript
interface User {
  id: string; // Slack User ID
  slackId: string; // Slack User ID (重複)
  name: string; // 表示名
  email: string; // メールアドレス
  department: string; // 部署
  role: string; // 役職
  createdAt: Date;
  updatedAt: Date;
}
```

### Profile（プロフィール）

```typescript
interface Profile {
  id: string;
  userId: string; // User.id への外部キー
  workStyle: string; // 働き方スタイル
  communicationStyle: string; // コミュニケーション設定
  expertise: string[]; // 専門分野（配列）
  availability: string; // 対応可能時間
  preferences: object; // その他の設定（JSON）
  createdAt: Date;
  updatedAt: Date;
}
```

### Question（質問）

```typescript
interface Question {
  id: string;
  content: string; // 質問内容
  category: string; // カテゴリー（技術、業務効率化等）
  isCustom: boolean; // カスタム質問かどうか
  isActive: boolean; // アクティブかどうか
  createdBy: string; // 作成者のUser ID
  createdAt: Date;
  updatedAt: Date;
}
```

### Coffee（ホットコーヒー）

```typescript
interface Coffee {
  id: string;
  senderId: string; // 送信者のUser ID
  receiverId: string; // 受信者のUser ID
  message: string; // 添付メッセージ
  channelId: string; // 送信されたチャンネル
  createdAt: Date;
}
```

### DailyReport（日報）

```typescript
interface DailyReport {
  id: string;
  userId: string; // User.id への外部キー
  condition: string; // コンディション（天気アイコン等）
  progress: string; // 進捗内容
  notes: string; // 追加メモ
  date: Date; // 報告日
  createdAt: Date;
}
```

### Survey（アンケート）

```typescript
interface Survey {
  id: string;
  title: string; // アンケートタイトル
  description: string; // 説明
  questions: object[]; // 質問リスト（JSON配列）
  createdBy: string; // 作成者のUser ID
  channelId: string; // 配信チャンネル
  isActive: boolean; // アクティブかどうか
  expiresAt: Date; // 有効期限
  createdAt: Date;
  updatedAt: Date;
}
```

### SurveyResponse（アンケート回答）

```typescript
interface SurveyResponse {
  id: string;
  surveyId: string; // Survey.id への外部キー
  userId: string; // User.id への外部キー
  responses: object; // 回答内容（JSON）
  createdAt: Date;
}
```

## エラーハンドリング

### エラー分類

1. **Slack API エラー**
   - 認証エラー
   - レート制限エラー
   - ネットワークエラー

2. **データベースエラー**
   - 接続エラー
   - 制約違反エラー
   - トランザクションエラー

3. **OpenAI API エラー**
   - 認証エラー
   - クォータ超過エラー
   - レスポンス解析エラー

4. **ビジネスロジックエラー**
   - バリデーションエラー
   - 権限エラー
   - データ不整合エラー

### エラーハンドリング戦略

- **ログ記録**: 全てのエラーを構造化ログで記録
- **リトライ機構**: 一時的なエラーに対する自動リトライ
- **フォールバック**: 外部 API 障害時の代替処理
- **ユーザー通知**: 適切なエラーメッセージの表示

## 関連ドキュメント

- [プロジェクトセットアップ](setup-guide.md)
- [開発ガイド](../development/guide.md)
- [機能別要件](../features/)