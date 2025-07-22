# Slack Knowledge Hub - Claude Code ワークフロー

このファイルは、Slack Knowledge Hub プロジェクトの包括的な仕様書であり、Claude Code での作業時に参照されるマスター仕様書です。

## プロジェクト概要

Slack を単なるコミュニケーションツールから組織の貴重な知識資産が集積・活用される「ナレッジハブ」へと昇華させる Slack アプリです。

## タスク実行の4段階フロー

### 1. 要件定義
- `.claude_workflow/complete.md`が存在すれば参照
- 目的の明確化、現状把握、成功基準の設定
- `.claude_workflow/requirements.md`に文書化
- **必須確認**: 「要件定義フェーズが完了しました。設計フェーズに進んでよろしいですか？」

### 2. 設計
- **必ず`.claude_workflow/requirements.md`を読み込んでから開始**
- アプローチ検討、実施手順決定、問題点の特定
- `.claude_workflow/design.md`に文書化
- **必須確認**: 「設計フェーズが完了しました。タスク化フェーズに進んでよろしいですか？」

### 3. タスク化
- **必ず`.claude_workflow/design.md`を読み込んでから開始**
- タスクを実行可能な単位に分解、優先順位設定
- `.claude_workflow/tasks.md`に文書化
- **必須確認**: 「タスク化フェーズが完了しました。実行フェーズに進んでよろしいですか？」

### 4. 実行
- **必ず`.claude_workflow/tasks.md`を読み込んでから開始**
- タスクを順次実行、進捗を`.claude_workflow/tasks.md`に更新
- 各タスク完了時に報告

## 実行ルール
### ファイル操作
- 新規タスク開始時: 既存ファイルの**内容を全て削除して白紙から書き直す**
- ファイル編集前に必ず現在の内容を確認

### フェーズ管理
- 各段階開始時: 「前段階のmdファイルを読み込みました」と報告
- 各段階の最後に、期待通りの結果になっているか確認
- 要件定義なしにいきなり実装を始めない

### 実行方針
- 段階的に進める: 一度に全てを変更せず、小さな変更を積み重ねる
- 複数のタスクを同時並行で進めない
- エラーは解決してから次へ進む
- エラーを無視して次のステップに進まない
- 指示にない機能を勝手に追加しない

---

# 要件定義書

## はじめに

本ドキュメントは、Slack を単なるコミュニケーションツールから組織の貴重な知識資産が集積・活用される「ナレッジハブ」へと昇華させる Slack アプリの要件を定義します。このアプリは、従業員エンゲージメントの複数の側面に働きかけ、自律的な情報共有のサイクルを生み出すことを目的とした統合的なエコシステムです。

## 要件

### 要件 1 - シャッフル機能

**ユーザーストーリー:** 組織のメンバーとして、ランダムに選ばれた質問に答えることで、自分の知識や経験を自然に共有したい

#### 受け入れ基準

1. WHEN ボットがランダムにメンバーを選択 THEN システムは事前定義された質問をそのメンバーに送信する
2. WHEN メンバーが質問に回答 THEN システムは回答を指定された Slack チャンネルで共有する
3. WHEN 管理者がカスタム質問を追加 THEN システムは最大 50 個のオリジナル質問を保存・利用できる
4. WHEN 質問が業務関連の内容 THEN システムは技術 TIPS、ツール活用法、業務効率化などのカテゴリーに対応する

### 要件 2 - プロフィール機能

**ユーザーストーリー:** チームメンバーとして、他のメンバーの働き方やコミュニケーションスタイルを事前に知ることで、より効果的な協働を実現したい

#### 受け入れ基準

1. WHEN ユーザーが自分のプロフィールを作成 THEN システムは働き方スタイル、コミュニケーション設定、専門分野を保存する
2. WHEN 他のメンバーがプロフィールを閲覧 THEN システムは「取扱説明書」形式で情報を表示する
3. WHEN 新入社員がオンボーディング中 THEN システムはチーム内の心理的安全性向上に寄与する情報を提供する

### 要件 3 - ホットコーヒーシステム

**ユーザーストーリー:** 同僚として、他のメンバーの貢献や助けに対して感謝の気持ちを手軽に表現し、ポジティブな職場環境を作りたい

#### 受け入れ基準

1. WHEN ユーザーが他のメンバーに感謝を示したい THEN システムは仮想の「ホットコーヒー」とメッセージを送信できる
2. WHEN ホットコーヒーが送信される THEN システムは受信者のホットコーヒー数を集計・記録する
3. WHEN 月次集計が実行される THEN システムは「コーヒーアワード」としてランキングを生成・表示する
4. WHEN 望ましい行動（ナレッジ共有等）が発生 THEN システムはその行動を強化するための承認メカニズムを提供する

### 要件 4 - 日報機能

**ユーザーストーリー:** チームメンバーとして、日々のコンディションや仕事の進捗を共有することで、チームの結束力を高めたい

#### 受け入れ基準

1. WHEN ユーザーが日報を投稿 THEN システムはコンディション（天気アイコン等）と進捗情報を記録する
2. WHEN チームメンバーが日報を閲覧 THEN システムはメンバーの状況変化を把握できる形式で表示する
3. WHEN 心理的安全性の醸成が必要 THEN システムはオープンなナレッジシェアリングの土台となる環境を提供する

### 要件 5 - アンケート機能

**ユーザーストーリー:** 管理者として、構造化されたアンケートを通じて組織の意見やフィードバックを効率的に収集したい

#### 受け入れ基準

1. WHEN 管理者がアンケートを作成 THEN システムは Slack 内で完結するアンケート機能を提供する
2. WHEN アンケートテンプレートが必要 THEN システムは豊富な事前定義テンプレートを提供する
3. WHEN 回答者が参加 THEN システムは作成者と回答者双方の負担を最小限に抑える

### 要件 6 - 分析・レポート機能

**ユーザーストーリー:** 管理者として、従業員エンゲージメントの状況を定量的・定性的に把握し、施策の効果を測定したい

#### 受け入れ基準

1. WHEN データ分析が実行される THEN システムはホットコーヒーやプロフィール利用状況を可視化する
2. WHEN 利用傾向の把握が必要 THEN システムは行動データの定量的・定性的分析を提供する
3. WHEN 高度な分析が必要 THEN システムはデータエクスポート機能を提供する

### 要件 7 - AI 対話機能

**ユーザーストーリー:** ユーザーとして、自然言語でボットに質問することで、組織内の知識やスキルを持つ人を効率的に発見したい

#### 受け入れ基準

1. WHEN ユーザーが「〇〇さんの得意なことは？」と質問 THEN システムは AI を活用して適切な回答を生成する
2. WHEN ユーザーが「〇〇のスキルを持つ人はいますか？」と質問 THEN システムは該当するメンバーを特定・提示する
3. WHEN 対話型の知識発見が必要 THEN システムは OpenAI API を活用した自然言語処理を提供する
4. WHEN ナレッジディスカバリーが実行される THEN システムは蓄積された情報から関連する知識を抽出する

### 要件 8 - 管理・設定機能

**ユーザーストーリー:** 管理者として、組織の規模や部門に応じてアプリの設定をカスタマイズし、効果的な運用を実現したい

#### 受け入れ基準

1. WHEN 管理者が質問カテゴリーを設定 THEN システムは部門別・職種別の専門的な質問を管理できる
2. WHEN 組織構造が変更される THEN システムは部門やチーム設定を柔軟に更新できる
3. WHEN 運用ポリシーが必要 THEN システムは投稿頻度、対象チャンネル等の設定を提供する
4. WHEN セキュリティ要件がある THEN システムは社内ネットワーク内での安全な運用を保証する

---

# 設計書

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

---

# 実装タスク一覧

## 完了済みタスク ✅

- [x] 1. プロジェクト基盤とコア設定の構築
  - Node.js + TypeScript + Slack Bolt framework の初期設定
  - Supabase プロジェクトの作成とデータベース接続設定
  - 環境変数管理と Slack OAuth 設定

- [x] 2.1 Supabase テーブル定義とマイグレーション作成
  - User, Profile, Question, ShuffleResponse, Coffee, DailyReport, Survey, SurveyResponse テーブルの作成
  - 外部キー制約とインデックスの設定

- [x] 2.2 TypeScript インターフェースとリポジトリクラスの実装
  - データモデルの TypeScript インターフェース定義
  - 各テーブル用の Repository クラス実装（CRUD 操作）
  - Supabase クライアントとの統合

- [x] 3.1 基本的な Slack イベントハンドリング
  - SlackBotApp クラスの実装
  - EventHandler と CommandHandler の基本構造
  - Slack アプリの認証とワークスペース接続

- [x] 3.2 ユーザー管理とプロフィール同期
  - Slack ユーザー情報の取得と同期
  - 新規ユーザーの自動登録機能
  - ユーザー情報の更新処理

- [x] 4.1 質問管理システム
  - QuestionRepository の実装
  - デフォルト質問のシードデータ作成
  - カスタム質問の追加・編集・削除機能

- [x] 4.2 ランダム質問配信システム
  - ShuffleService クラスの実装
  - ランダムメンバー選択ロジック
  - 質問送信とチャンネル投稿機能

- [x] 4.3 定期実行とスケジューリング
  - ScheduleManager の実装
  - cron job または Supabase Edge Functions での定期実行
  - 実行頻度の設定機能

- [x] 5.1 プロフィール作成・編集インターフェース
  - Slack モーダルを使用したプロフィール入力フォーム
  - ProfileService クラスの実装
  - バリデーション機能

- [x] 5.2 プロフィール表示とレンダリング
  - ProfileRenderer クラスの実装
  - 「取扱説明書」形式での情報表示
  - プロフィール検索・閲覧機能

- [x] 6.1 ホットコーヒー送信機能
  - CoffeeService クラスの実装
  - Slack コマンドまたはショートカットでのコーヒー送信
  - メッセージ付きコーヒーの処理

- [x] 6.2 ランキングと集計機能
  - RankingService クラスの実装
  - 月次コーヒー集計処理
  - コーヒーアワードの生成と発表

- [x] 7.1 日報投稿システム
  - DailyService クラスの実装
  - コンディション選択（天気アイコン等）
  - 進捗とメモの入力機能

- [x] 7.2 日報表示と履歴管理
  - ConditionTracker クラスの実装
  - チームメンバーの日報一覧表示
  - 履歴データの管理

- [x] 8.1 アンケート作成システム
  - SurveyBuilder クラスの実装
  - 質問タイプ（選択肢、自由記述等）の対応
  - テンプレート機能

- [x] 8.2 アンケート配信と回答収集
  - ResponseCollector クラスの実装
  - Slack 内でのアンケート表示
  - 回答データの収集と保存

- [x] 9.1 OpenAI API 統合
  - AIDialogueService クラスの実装
  - OpenAI API クライアントの設定
  - プロンプト設計と応答処理

- [x] 9.2 ナレッジ抽出とコンテキスト構築
  - KnowledgeExtractor クラスの実装
  - ContextBuilder クラスの実装
  - 蓄積データからの関連情報抽出

- [x] 10.1 データ分析システム
  - AnalyticsService クラスの実装
  - 利用状況の可視化
  - エンゲージメント指標の計算

- [x] 10.2 レポート生成とエクスポート
  - ReportGenerator クラスの実装
  - DataExporter クラスの実装
  - CSV/JSON 形式でのデータエクスポート

## 残りのタスク 📋

### 11. 管理・設定機能の実装
- [ ] 11.1 管理者向け設定画面
  - 質問カテゴリー管理
  - 部門・チーム設定
  - 運用ポリシー設定

- [ ] 11.2 セキュリティとアクセス制御
  - 権限管理システム
  - セキュリティ設定
  - 監査ログ機能

### 12. テストとエラーハンドリングの実装
- [ ] 12.1 ユニットテストの作成
  - 各サービスクラスのテスト
  - データモデルのバリデーションテスト
  - モック機能の実装

- [ ] 12.2 統合テストと E2E テスト
  - Slack API 連携テスト
  - データベース統合テスト
  - エンドツーエンドフローテスト

### 13. デプロイメントと運用準備
- [ ] 13.1 本番環境設定
  - Vercel/Railway でのデプロイ設定
  - 環境変数とシークレット管理
  - CI/CD パイプラインの構築

- [ ] 13.2 監視とログ設定
  - アプリケーション監視
  - エラーログとパフォーマンス監視
  - アラート設定

## 現在の優先事項

1. **Socket Mode対応の完了** - ngrok不要の開発環境
2. **基本機能の安定化** - 既存機能の信頼性向上
3. **テストカバレッジの向上** - 品質保証の強化
4. **ドキュメント整備** - 運用・保守の効率化