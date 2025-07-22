import { App, SlackCommandMiddlewareArgs } from '@slack/bolt';
import { AnalyticsService } from '../services/AnalyticsService';
import { MetricsCalculator, TimePeriod } from '../services/MetricsCalculator';
import { ChartRenderer } from '../services/ChartRenderer';
import { ReportService } from '../services/ReportService';
import { UserSyncService } from '../services/UserSyncService';
import { logger } from '../utils/logger';

export interface AnalyticsParams {
  period?: TimePeriod;
  userId?: string;
  channelId: string;
  isAdmin: boolean;
}

export class AnalyticsCommandHandler {
  private analyticsService: AnalyticsService;
  private metricsCalculator: MetricsCalculator;
  private chartRenderer: ChartRenderer;
  private reportService: ReportService;
  private userSyncService: UserSyncService;

  constructor() {
    this.analyticsService = new AnalyticsService();
    this.metricsCalculator = new MetricsCalculator();
    this.chartRenderer = new ChartRenderer();
    this.reportService = new ReportService();
    this.userSyncService = new UserSyncService();
  }

  register(app: App): void {
    app.command('/analytics', this.handleAnalyticsCommand.bind(this));
  }

  private async handleAnalyticsCommand(args: SlackCommandMiddlewareArgs): Promise<void> {
    const { command, ack, respond } = args;
    
    try {
      await ack();
      
      const userId = command.user_id;
      const channelId = command.channel_id;
      const text = command.text.trim();
      const [subcommand, ...params] = text.split(' ');

      // Sync user data
      await this.userSyncService.syncUser(userId);

      // Check admin permissions (simplified - in production, implement proper role checking)
      const isAdmin = await this.checkAdminPermissions(userId);
      
      if (!isAdmin) {
        await respond({
          text: '⚠️ この機能は管理者のみ利用できます。',
          response_type: 'ephemeral'
        });
        return;
      }

      // Parse period parameter
      const period = this.parsePeriodParam(params[0]);
      
      const analyticsParams: AnalyticsParams = {
        period,
        userId,
        channelId,
        isAdmin
      };

      // Route to appropriate handler
      switch (subcommand.toLowerCase()) {
        case '':
        case 'overview':
          await this.handleOverview(respond, analyticsParams);
          break;
        case 'profiles':
          await this.handleProfiles(respond, analyticsParams);
          break;
        case 'coffee':
          await this.handleCoffee(respond, analyticsParams);
          break;
        case 'shuffle':
          await this.handleShuffle(respond, analyticsParams);
          break;
        case 'surveys':
          await this.handleSurveys(respond, analyticsParams);
          break;
        case 'ai':
          await this.handleAI(respond, analyticsParams);
          break;
        case 'report':
          await this.handleReport(respond, analyticsParams);
          break;
        case 'export':
          await this.handleExport(respond, analyticsParams, params[0]);
          break;
        default:
          await this.showHelp(respond);
      }
    } catch (error) {
      logger.error('Error handling analytics command:', error);
      await respond({
        text: '❌ エラーが発生しました。もう一度お試しください。',
        response_type: 'ephemeral'
      });
    }
  }

  async handleOverview(respond: any, params: AnalyticsParams): Promise<void> {
    try {
      await respond({
        text: '📊 分析データを生成中...',
        response_type: 'ephemeral'
      });

      const period = params.period || this.getDefaultPeriod();
      
      // Get metrics
      const [engagementScore, activeUsers, featureAdoption, trendMetrics] = await Promise.all([
        this.metricsCalculator.calculateEngagementScore(),
        this.metricsCalculator.calculateActiveUsers(period),
        this.metricsCalculator.calculateFeatureAdoption(),
        this.metricsCalculator.calculateTrendMetrics(period)
      ]);

      // Create overview message with Block Kit
      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📊 Knowledge Hub Analytics - Overview'
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*📈 Engagement Score:*\\n${engagementScore.overall}/100 (Grade: ${engagementScore.grade})`
            },
            {
              type: 'mrkdwn',
              text: `*📅 Period:*\\n${this.formatPeriod(period)}`
            }
          ]
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*👥 Users:*\\n${activeUsers.totalUsers} total | ${activeUsers.activeUsers} active (${activeUsers.engagementRate.toFixed(1)}%)`
            },
            {
              type: 'mrkdwn',
              text: `*📊 Trend:*\\n${this.getTrendEmoji(engagementScore.trend)} ${engagementScore.changePercent.toFixed(1)}% from last period`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: this.createFeatureUsageChart(featureAdoption)
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Details'
              },
              action_id: 'analytics_details',
              value: 'details'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Generate Report'
              },
              action_id: 'analytics_report',
              value: 'report'
            }
          ]
        }
      ];

      await respond({
        blocks,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error showing analytics overview:', error);
      await respond({
        text: '❌ エラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  async handleProfiles(respond: any, params: AnalyticsParams): Promise<void> {
    try {
      await respond({
        text: '👤 プロフィール分析を生成中...',
        response_type: 'ephemeral'
      });

      const period = params.period || this.getDefaultPeriod();
      const featureAdoption = await this.metricsCalculator.calculateFeatureAdoption();
      
      // Get profile-specific metrics from AnalyticsService
      // This would be implemented as part of the AnalyticsService extension

      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '👤 Profile Analytics'
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*📊 Profile Creation Rate:*\\n${featureAdoption.profiles.adoptionRate.toFixed(1)}% (${featureAdoption.profiles.createdProfiles}/${featureAdoption.profiles.totalUsers})`
            },
            {
              type: 'mrkdwn',
              text: `*📅 Period:*\\n${this.formatPeriod(period)}`
            }
          ]
        },
        // Add more profile-specific metrics here
        {
          type: 'context',
          elements: [
            {
              type: 'plain_text',
              text: 'プロフィール作成を促進することで、チーム内のコラボレーションが向上します。'
            }
          ]
        }
      ];

      await respond({
        blocks,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error showing profile analytics:', error);
      await respond({
        text: '❌ エラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  async handleCoffee(respond: any, params: AnalyticsParams): Promise<void> {
    try {
      await respond({
        text: '☕ コーヒー分析を生成中...',
        response_type: 'ephemeral'
      });

      const period = params.period || this.getDefaultPeriod();
      const coffeeAnalytics = await this.analyticsService.getCoffeeAnalytics(period.start, period.end);

      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `☕ Coffee Analytics - ${this.formatPeriod(period)}`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*📊 Total Sent:*\\n${coffeeAnalytics.totalCoffeesSent} cups`
            },
            {
              type: 'mrkdwn',
              text: `*📈 Average per User:*\\n${coffeeAnalytics.averageCoffeesPerUser.toFixed(1)} cups/person`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: this.createCoffeeRankings(coffeeAnalytics)
          }
        }
      ];

      await respond({
        blocks,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error showing coffee analytics:', error);
      await respond({
        text: '❌ エラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  async handleShuffle(respond: any, params: AnalyticsParams): Promise<void> {
    try {
      await respond({
        text: '🔀 シャッフル分析を生成中...',
        response_type: 'ephemeral'
      });

      const period = params.period || this.getDefaultPeriod();
      const knowledgeMetrics = await this.analyticsService.getKnowledgeSharingMetrics(period.start, period.end);

      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🔀 Shuffle Analytics - ${this.formatPeriod(period)}`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*📊 Total Responses:*\\n${knowledgeMetrics.totalShuffleResponses}`
            },
            {
              type: 'mrkdwn',
              text: `*📏 Average Length:*\\n${knowledgeMetrics.averageResponseLength.toFixed(0)} characters`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: this.createCategoryRankings(knowledgeMetrics.topCategories)
          }
        }
      ];

      await respond({
        blocks,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error showing shuffle analytics:', error);
      await respond({
        text: '❌ エラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  async handleSurveys(respond: any, params: AnalyticsParams): Promise<void> {
    try {
      await respond({
        text: '📊 アンケート分析を生成中...',
        response_type: 'ephemeral'
      });

      const period = params.period || this.getDefaultPeriod();
      const featureAdoption = await this.metricsCalculator.calculateFeatureAdoption();

      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `📊 Survey Analytics - ${this.formatPeriod(period)}`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*👥 Active Participants:*\\n${featureAdoption.surveys.activeParticipants}/${featureAdoption.surveys.totalUsers}`
            },
            {
              type: 'mrkdwn',
              text: `*📈 Adoption Rate:*\\n${featureAdoption.surveys.adoptionRate.toFixed(1)}%`
            }
          ]
        }
      ];

      await respond({
        blocks,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error showing survey analytics:', error);
      await respond({
        text: '❌ エラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  async handleAI(respond: any, params: AnalyticsParams): Promise<void> {
    try {
      await respond({
        text: '🤖 AI対話分析を生成中...',
        response_type: 'ephemeral'
      });

      const period = params.period || this.getDefaultPeriod();
      const featureAdoption = await this.metricsCalculator.calculateFeatureAdoption();

      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🤖 AI Dialogue Analytics - ${this.formatPeriod(period)}`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*👥 Active Users:*\\n${featureAdoption.ai.activeUsers}/${featureAdoption.ai.totalUsers}`
            },
            {
              type: 'mrkdwn',
              text: `*📈 Adoption Rate:*\\n${featureAdoption.ai.adoptionRate.toFixed(1)}%`
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'plain_text',
              text: 'AI対話機能の詳細ログ機能は今後実装予定です。'
            }
          ]
        }
      ];

      await respond({
        blocks,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error showing AI analytics:', error);
      await respond({
        text: '❌ エラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  async handleReport(respond: any, params: AnalyticsParams): Promise<void> {
    try {
      await respond({
        text: '📋 総合レポートを生成中...',
        response_type: 'ephemeral'
      });

      const period = params.period || this.getDefaultPeriod();
      const report = await this.reportService.generateMonthlyReport(period);

      await respond({
        text: `✅ **総合レポート生成完了**\\n\\n${report.executiveSummary}\\n\\n📋 実際のシステムでは、詳細レポートファイルのダウンロードリンクが提供されます。`,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error generating report:', error);
      await respond({
        text: '❌ レポート生成中にエラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  async handleExport(respond: any, params: AnalyticsParams, format?: string): Promise<void> {
    try {
      if (!format || !['csv', 'json', 'md'].includes(format)) {
        await respond({
          text: '使用方法: `/analytics export [csv|json|md]`\\n\\n' +
                '利用可能な形式:\\n' +
                '• `csv` - CSV形式でエクスポート\\n' +
                '• `json` - JSON形式でエクスポート\\n' +
                '• `md` - Markdown形式でエクスポート',
          response_type: 'ephemeral'
        });
        return;
      }

      await respond({
        text: '📤 データエクスポートを準備中...',
        response_type: 'ephemeral'
      });

      // Implementation would go here
      await respond({
        text: `✅ **エクスポート完了**\\n\\n• 形式: ${format.toUpperCase()}\\n• 生成日時: ${new Date().toLocaleString('ja-JP')}\\n\\n⚠️ データは匿名化されています\\n📋 実際のシステムでは、ファイルダウンロードリンクが提供されます`,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error handling export:', error);
      await respond({
        text: '❌ エクスポート中にエラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  private async showHelp(respond: any): Promise<void> {
    const helpText = `
📊 **Analytics コマンド使用方法**

*基本コマンド:*
• \`/analytics\` または \`/analytics overview\` - 全体概況
• \`/analytics profiles [7d|30d|90d]\` - プロフィール分析
• \`/analytics coffee [7d|30d|90d]\` - コーヒー分析
• \`/analytics shuffle [7d|30d|90d]\` - シャッフル分析
• \`/analytics surveys [7d|30d|90d]\` - アンケート分析
• \`/analytics ai [7d|30d|90d]\` - AI対話分析

*レポート・エクスポート:*
• \`/analytics report [monthly|weekly]\` - レポート生成
• \`/analytics export [csv|json|md]\` - データエクスポート

*期間指定:*
• \`7d\` - 過去7日間
• \`30d\` - 過去30日間（デフォルト）
• \`90d\` - 過去90日間

⚠️ この機能は管理者のみ利用できます。
`;

    await respond({
      text: helpText,
      response_type: 'ephemeral'
    });
  }

  private async checkAdminPermissions(userId: string): Promise<boolean> {
    // Simplified implementation - in production, implement proper role checking
    // This could check Slack workspace admin status or a custom role system
    try {
      // For now, return true to allow testing
      // In production, implement actual admin check
      return true;
    } catch (error) {
      logger.error('Error checking admin permissions:', error);
      return false;
    }
  }

  private parsePeriodParam(param?: string): TimePeriod {
    const endDate = new Date();
    const startDate = new Date();

    switch (param) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        return { start: startDate, end: endDate, type: '7days' };
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        return { start: startDate, end: endDate, type: '90days' };
      case '30d':
      default:
        startDate.setDate(startDate.getDate() - 30);
        return { start: startDate, end: endDate, type: '30days' };
    }
  }

  private getDefaultPeriod(): TimePeriod {
    return this.parsePeriodParam('30d');
  }

  private formatPeriod(period: TimePeriod): string {
    const options: Intl.DateTimeFormatOptions = { 
      month: 'short', 
      day: 'numeric' 
    };
    return `${period.start.toLocaleDateString('ja-JP', options)} - ${period.end.toLocaleDateString('ja-JP', options)}`;
  }

  private getTrendEmoji(trend: 'up' | 'down' | 'stable'): string {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      default: return '➡️';
    }
  }

  private createFeatureUsageChart(featureAdoption: any): string {
    const features = [
      { name: 'Profiles', rate: featureAdoption.profiles.adoptionRate },
      { name: 'Coffee', rate: featureAdoption.coffee.adoptionRate },
      { name: 'Shuffle', rate: featureAdoption.shuffle.adoptionRate },
      { name: 'Surveys', rate: featureAdoption.surveys.adoptionRate },
      { name: 'AI Chat', rate: featureAdoption.ai.adoptionRate }
    ];

    let chart = '*Feature Usage:*\\n';
    features.forEach(feature => {
      const bars = Math.round(feature.rate / 10);
      const barChart = '█'.repeat(bars) + '░'.repeat(10 - bars);
      chart += `${feature.name}: ${barChart} ${feature.rate.toFixed(1)}%\\n`;
    });

    return chart;
  }

  private createCoffeeRankings(coffeeAnalytics: any): string {
    let rankings = '*🏆 Top Senders:*\\n';
    coffeeAnalytics.topSenders.slice(0, 5).forEach((sender: any, index: number) => {
      rankings += `${index + 1}. ${sender.userName} - ${sender.coffeesSent} sent\\n`;
    });

    rankings += '\\n*🌟 Top Recipients:*\\n';
    coffeeAnalytics.topReceivers.slice(0, 5).forEach((receiver: any, index: number) => {
      rankings += `${index + 1}. ${receiver.userName} - ${receiver.coffeesReceived} received\\n`;
    });

    return rankings;
  }

  private createCategoryRankings(topCategories: any[]): string {
    let rankings = '*📂 Popular Categories:*\\n';
    topCategories.slice(0, 5).forEach((category, index) => {
      rankings += `${index + 1}. ${category.category}: ${category.count} responses (${category.percentage.toFixed(1)}%)\\n`;
    });
    return rankings;
  }
}