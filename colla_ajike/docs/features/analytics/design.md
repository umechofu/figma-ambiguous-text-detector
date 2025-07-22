# データ分析・エンゲージメント分析機能 設計書

## 概要

本ドキュメントは、requirements_analytics.md で定義された要件に基づき、データ分析・エンゲージメント分析機能の詳細設計を記述します。既存の AnalyticsService を拡張し、Slack インターフェース、レポート機能、リアルタイム監視機能を包括的に実装します。

## アーキテクチャ設計

### システム構成

```
┌─────────────────────┐    ┌─────────────────────┐
│   Slack Interface   │◄──►│  Analytics Engine   │
│  (/analytics cmd)   │    │   (AnalyticsService) │
└─────────────────────┘    └─────────────────────┘
                                      │
                                      ▼
┌─────────────────────┐    ┌─────────────────────┐
│   Report Generator  │◄──►│   Data Aggregator   │
│  (ReportService)    │    │ (MetricsCalculator)  │
└─────────────────────┘    └─────────────────────┘
                                      │
                                      ▼
┌─────────────────────┐    ┌─────────────────────┐
│   Visualization     │    │    Supabase DB      │
│   (ChartRenderer)   │    │  (Analytics Views)  │
└─────────────────────┘    └─────────────────────┘
```

### コンポーネント設計

#### 1. Slack コマンドハンドラー

**責任**: `/analytics` コマンドの処理とサブコマンドルーティング

**クラス**: `AnalyticsCommandHandler`

```typescript
interface AnalyticsCommandHandler {
  handleOverview(params: AnalyticsParams): Promise<SlackResponse>
  handleProfiles(params: AnalyticsParams): Promise<SlackResponse>
  handleCoffee(params: AnalyticsParams): Promise<SlackResponse>
  handleShuffle(params: AnalyticsParams): Promise<SlackResponse>
  handleSurveys(params: AnalyticsParams): Promise<SlackResponse>
  handleAI(params: AnalyticsParams): Promise<SlackResponse>
  handleReport(params: AnalyticsParams): Promise<SlackResponse>
  handleExport(params: AnalyticsParams): Promise<SlackResponse>
}
```

#### 2. 分析エンジン（拡張）

**責任**: データ分析とメトリクス計算

**既存クラス**: `AnalyticsService` を拡張

```typescript
interface AnalyticsService {
  // 既存機能
  getEngagementMetrics(): Promise<EngagementMetrics>
  
  // 新規追加
  getOverviewMetrics(period: TimePeriod): Promise<OverviewMetrics>
  getProfileAnalytics(period: TimePeriod): Promise<ProfileAnalytics>
  getCoffeeAnalytics(period: TimePeriod): Promise<CoffeeAnalytics>
  getShuffleAnalytics(period: TimePeriod): Promise<ShuffleAnalytics>
  getSurveyAnalytics(period: TimePeriod): Promise<SurveyAnalytics>
  getAIAnalytics(period: TimePeriod): Promise<AIAnalytics>
  calculateEngagementScore(): Promise<EngagementScore>
  generateTrendAnalysis(weeks: number): Promise<TrendData>
}
```

#### 3. メトリクス計算エンジン

**責任**: 複雑な計算処理とエンゲージメントスコア算出

**新規クラス**: `MetricsCalculator`

```typescript
interface MetricsCalculator {
  calculateEngagementScore(userId?: string): Promise<EngagementScore>
  calculateTrendMetrics(period: TimePeriod): Promise<TrendMetrics>
  calculateActiveUsers(period: TimePeriod): Promise<ActiveUserMetrics>
  calculateFeatureAdoption(): Promise<FeatureAdoptionMetrics>
  calculateRetentionRate(period: TimePeriod): Promise<RetentionMetrics>
}
```

#### 4. レポート生成サービス

**責任**: 包括的なレポート生成とエクスポート機能

**新規クラス**: `ReportService`

```typescript
interface ReportService {
  generateMonthlyReport(): Promise<MonthlyReport>
  generateExecutiveSummary(): Promise<ExecutiveSummary>
  exportToCSV(data: AnalyticsData): Promise<string>
  exportToJSON(data: AnalyticsData): Promise<string>
  exportToMarkdown(report: Report): Promise<string>
  scheduleReport(frequency: 'weekly' | 'monthly'): Promise<void>
}
```

#### 5. 可視化エンジン

**責任**: グラフ生成とデータビジュアライゼーション

**新規クラス**: `ChartRenderer`

```typescript
interface ChartRenderer {
  renderASCIIGraph(data: TimeSeriesData): string
  renderBarChart(data: CategoryData): string
  renderTrendLine(data: TrendData): string
  renderEngagementMeter(score: number): string
  renderDistributionChart(data: DistributionData): string
}
```

#### 6. アラート・監視システム

**責任**: リアルタイム監視とアラート配信

**新規クラス**: `AlertService`

```typescript
interface AlertService {
  checkEngagementThresholds(): Promise<void>
  sendEngagementAlert(alert: EngagementAlert): Promise<void>
  checkFeatureAdoption(): Promise<void>
  sendAdoptionAlert(alert: AdoptionAlert): Promise<void>
  scheduleMonitoring(): Promise<void>
}
```

## データモデル設計

### 新規データ型定義

```typescript
// 基本パラメータ
interface AnalyticsParams {
  period?: TimePeriod
  userId?: string
  channelId: string
  isAdmin: boolean
}

interface TimePeriod {
  start: Date
  end: Date
  type: '7days' | '30days' | '90days' | 'custom'
}

// メトリクス型
interface OverviewMetrics {
  totalUsers: number
  activeUsers: number
  engagementScore: EngagementScore
  featureUsage: FeatureUsageMetrics
  trends: TrendData
}

interface EngagementScore {
  overall: number        // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'E'
  components: {
    profiles: number     // 20%
    coffee: number       // 25%
    shuffle: number      // 20%
    surveys: number      // 15%
    ai: number          // 10%
    retention: number    // 10%
  }
  trend: 'up' | 'down' | 'stable'
  changePercent: number
}

interface FeatureUsageMetrics {
  profiles: {
    creationRate: number      // %
    completionRate: number    // %
    viewCount: number
  }
  coffee: {
    totalSent: number
    totalReceived: number
    activeParticipants: number
    averagePerUser: number
  }
  shuffle: {
    questionsDelivered: number
    responseRate: number      // %
    averageResponseLength: number
    popularCategories: CategoryCount[]
  }
  surveys: {
    created: number
    participationRate: number // %
    averageQuestions: number
    templateUsage: number
  }
  ai: {
    interactions: number
    uniqueUsers: number
    averageSessionLength: number
    satisfactionScore: number
  }
}

interface TrendData {
  period: TimePeriod
  dataPoints: TrendPoint[]
  direction: 'improving' | 'declining' | 'stable'
  changeRate: number
}

interface TrendPoint {
  date: Date
  value: number
  metric: string
}

// レポート型
interface MonthlyReport {
  period: TimePeriod
  executiveSummary: ExecutiveSummary
  keyMetrics: OverviewMetrics
  featureAnalysis: FeatureAnalysisReport
  recommendations: Recommendation[]
  charts: ChartData[]
}

interface ExecutiveSummary {
  highlightMetrics: HighlightMetric[]
  keyAchievements: string[]
  challenges: string[]
  nextActions: string[]
}

interface Recommendation {
  type: 'engagement' | 'adoption' | 'retention' | 'feature'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  expectedImpact: string
  actionItems: string[]
}
```

## Slack インターフェース設計

### コマンド構造

```
/analytics
├── overview [7d|30d|90d]     # 全体概況
├── profiles [7d|30d|90d]     # プロフィール分析
├── coffee [7d|30d|90d]       # コーヒー分析
├── shuffle [7d|30d|90d]      # シャッフル分析
├── surveys [7d|30d|90d]      # アンケート分析
├── ai [7d|30d|90d]           # AI対話分析
├── report [monthly|weekly]   # レポート生成
└── export [csv|json|md]      # データエクスポート
```

### Block Kit レイアウト設計

#### 1. Overview 画面

```
┌─────────────────────────────────────────┐
│ 📊 Knowledge Hub Analytics - Overview   │
├─────────────────────────────────────────┤
│ 📈 Engagement Score: 78/100 (Grade: B)  │
│ 📅 Period: Last 30 days                 │
├─────────────────────────────────────────┤
│ 👥 Users: 45 total | 32 active (71%)    │
│ 🎯 Features: 4/5 adopted                │
│ 📊 Trend: ↗️ +12% from last period      │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ Feature Usage (Last 30 days)       │ │
│ │ Profiles: ████████░░ 82%            │ │
│ │ Coffee:   ██████████ 95%            │ │
│ │ Shuffle:  ██████░░░░ 67%            │ │
│ │ Surveys:  ████░░░░░░ 43%            │ │
│ │ AI Chat:  ██████████ 89%            │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ [View Details] [Generate Report] [Help] │
└─────────────────────────────────────────┘
```

#### 2. 詳細分析画面例（Coffee）

```
┌─────────────────────────────────────────┐
│ ☕ Coffee Analytics - Last 30 days      │
├─────────────────────────────────────────┤
│ 📊 Total Sent: 156 | Received: 156      │
│ 👥 Active Participants: 28/45 (62%)     │
│ 📈 Average per User: 5.6 coffees        │
├─────────────────────────────────────────┤
│ 🏆 Top Senders:                         │
│ 1. Alice Johnson - 18 sent              │
│ 2. Bob Smith - 15 sent                  │
│ 3. Carol Davis - 12 sent                │
├─────────────────────────────────────────┤
│ 🎯 Top Recipients:                       │
│ 1. David Wilson - 22 received           │
│ 2. Eve Brown - 19 received              │
│ 3. Frank Miller - 16 received           │
├─────────────────────────────────────────┤
│ 📈 Weekly Trend:                        │
│ Week 1: ████████░░ 32 coffees           │
│ Week 2: ██████████ 45 coffees           │
│ Week 3: ████████░░ 39 coffees           │
│ Week 4: ████████░░ 40 coffees           │
├─────────────────────────────────────────┤
│ [Back to Overview] [Export Data]        │
└─────────────────────────────────────────┘
```

## データベース設計

### Analytics Views（Supabase）

#### 1. ユーザー活動集計ビュー

```sql
CREATE VIEW user_activity_summary AS
SELECT 
  u.id,
  u.name,
  u.created_at as joined_date,
  CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END as has_profile,
  COALESCE(coffee_sent.count, 0) as coffee_sent,
  COALESCE(coffee_received.count, 0) as coffee_received,
  COALESCE(shuffle_responses.count, 0) as shuffle_responses,
  COALESCE(survey_responses.count, 0) as survey_responses,
  GREATEST(
    COALESCE(coffee_sent.last_activity, '1970-01-01'),
    COALESCE(coffee_received.last_activity, '1970-01-01'),
    COALESCE(shuffle_responses.last_activity, '1970-01-01'),
    COALESCE(survey_responses.last_activity, '1970-01-01')
  ) as last_activity
FROM users u
LEFT JOIN profiles p ON u.id = p.user_id
-- サブクエリで各活動の集計
```

#### 2. 日次活動統計ビュー

```sql
CREATE VIEW daily_activity_stats AS
SELECT 
  date_trunc('day', created_at) as activity_date,
  'coffee' as activity_type,
  COUNT(*) as count
FROM coffee
GROUP BY date_trunc('day', created_at)
UNION ALL
-- 他の活動タイプも同様に集計
```

#### 3. エンゲージメントスコア計算ビュー

```sql
CREATE VIEW engagement_scores AS
SELECT 
  u.id as user_id,
  u.name,
  -- プロフィール完成度 (20%)
  CASE WHEN p.id IS NOT NULL THEN 20 ELSE 0 END as profile_score,
  -- コーヒー活動 (25%)
  LEAST(25, (coffee_activity.total * 2)) as coffee_score,
  -- その他のスコア計算...
  -- 合計スコア
  (profile_score + coffee_score + shuffle_score + survey_score + ai_score + retention_score) as total_score
FROM users u
-- 各活動の集計とスコア計算
```

## エラーハンドリング設計

### エラー分類と対応

1. **データ取得エラー**
   - データベース接続エラー
   - クエリタイムアウト
   - データ不整合

2. **計算エラー**
   - 分母ゼロエラー
   - 数値オーバーフロー
   - 無効なデータ形式

3. **Slack API エラー**
   - メッセージサイズ制限
   - レート制限
   - 権限エラー

4. **パフォーマンスエラー**
   - 処理時間超過
   - メモリ不足
   - 同時実行制限

### エラーハンドリング戦略

```typescript
class AnalyticsErrorHandler {
  async handleDataError(error: DatabaseError): Promise<SlackResponse> {
    // ログ記録、フォールバック処理、ユーザー通知
  }
  
  async handlePerformanceError(error: PerformanceError): Promise<SlackResponse> {
    // 処理の分割、キュー追加、再試行スケジュール
  }
  
  async handleSlackError(error: SlackError): Promise<SlackResponse> {
    // メッセージサイズ調整、複数メッセージ分割
  }
}
```

## セキュリティ設計

### アクセス制御

1. **管理者権限確認**
   ```typescript
   async function verifyAdminAccess(userId: string): Promise<boolean> {
     // Slack ワークスペースの管理者権限確認
     // または独自の権限管理システム
   }
   ```

2. **データプライバシー保護**
   ```typescript
   function anonymizeUserData(data: UserData[]): AnonymizedData[] {
     return data.map(user => ({
       id: hashUserId(user.id),
       metrics: user.metrics,
       // 個人識別情報は除外
     }))
   }
   ```

3. **データエクスポート制限**
   - 個人識別情報の自動除外
   - 集約データのみエクスポート
   - ダウンロードログの記録

## パフォーマンス最適化

### データベース最適化

1. **インデックス戦略**
   ```sql
   -- 時系列データ用インデックス
   CREATE INDEX idx_activity_date ON coffee (created_at DESC);
   CREATE INDEX idx_user_activity ON coffee (sender_id, created_at DESC);
   
   -- 複合インデックス
   CREATE INDEX idx_engagement_calc ON users (created_at, id) 
   WHERE created_at > NOW() - INTERVAL '90 days';
   ```

2. **クエリ最適化**
   - 事前集計されたビューの活用
   - ページネーション対応
   - 並列クエリの実行

3. **キャッシュ戦略**
   ```typescript
   class AnalyticsCache {
     private cache = new Map<string, CacheEntry>()
     
     async getCachedMetrics(key: string, ttl: number): Promise<any> {
       // TTL ベースのキャッシュ管理
     }
   }
   ```

### レスポンス時間最適化

1. **非同期処理**
   - 重い計算の バックグラウンド実行
   - ジョブキューの活用
   - プログレス表示

2. **データ分割**
   - 大量データの段階的取得
   - ストリーミング処理
   - メモリ効率の最適化

## 実装優先順位

### Phase 1: 基本機能（2週間）
1. AnalyticsCommandHandler の実装
2. 基本的な overview 機能
3. エンゲージメントスコア計算
4. シンプルな可視化

### Phase 2: 詳細分析（2週間）
1. 機能別詳細分析（profiles, coffee, shuffle）
2. トレンド分析
3. ASCII グラフ生成
4. エラーハンドリング強化

### Phase 3: レポート機能（1週間）
1. レポート生成サービス
2. エクスポート機能
3. 定期レポート配信

### Phase 4: 監視・アラート（1週間）
1. リアルタイム監視
2. アラート機能
3. パフォーマンス最適化
4. セキュリティ強化

## 運用・保守考慮事項

### 監視項目
- レスポンス時間
- エラー率
- データベース負荷
- メモリ使用量

### ログ設計
- 分析実行ログ
- パフォーマンスログ
- エラーログ
- セキュリティログ

### メンテナンス
- データの定期クリーンアップ
- インデックスの再構築
- キャッシュのクリア
- 統計情報の更新

この設計書に基づいて、段階的に実装を進めていきます。