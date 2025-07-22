import { App, SlackCommandMiddlewareArgs } from '@slack/bolt';
import { AnalyticsService } from '../../services/analytics/AnalyticsService';
import { ReportGenerator, ReportConfig } from '../../services/utils/ReportGenerator';
import { DataExporter, ExportConfig } from '../../services/utils/DataExporter';
import { UserSyncService } from '../../services/core/UserSyncService';
import { logger } from '../../utils/logger';

export class AnalyticsHandler {
  private analyticsService: AnalyticsService;
  private reportGenerator: ReportGenerator;
  private dataExporter: DataExporter;
  private userSyncService: UserSyncService;

  constructor() {
    this.analyticsService = new AnalyticsService();
    this.reportGenerator = new ReportGenerator();
    this.dataExporter = new DataExporter();
    this.userSyncService = new UserSyncService();
  }

  register(app: App): void {
    // Slash command for analytics
    app.command('/analytics', this.handleAnalyticsCommand.bind(this));
  }

  private async handleAnalyticsCommand(args: SlackCommandMiddlewareArgs): Promise<void> {
    const { command, ack, respond } = args;
    
    try {
      await ack();
      
      const userId = command.user_id;
      const subcommand = command.text.trim().toLowerCase();
      
      // Check if user has analytics permissions (simplified - in production, implement proper role checking)
      await this.userSyncService.syncUser(userId);

      switch (subcommand) {
        case '':
        case 'overview':
          await this.showAnalyticsOverview(respond);
          break;
        case 'engagement':
          await this.showEngagementMetrics(respond);
          break;
        case 'knowledge':
          await this.showKnowledgeMetrics(respond);
          break;
        case 'coffee':
          await this.showCoffeeAnalytics(respond);
          break;
        case 'health':
          await this.showTeamHealthMetrics(respond);
          break;
        case 'report':
          await this.generateFullReport(respond);
          break;
        case 'export':
          await this.handleDataExport(respond, command.text.split(' ')[1]);
          break;
        case 'generate':
          await this.handleReportGeneration(respond, command.text.split(' ')[1]);
          break;
        default:
          await respond({
            text: '使用方法:\n' +
                  '• `/analytics` - 分析概要\n' +
                  '• `/analytics engagement` - エンゲージメント指標\n' +
                  '• `/analytics knowledge` - ナレッジ共有分析\n' +
                  '• `/analytics coffee` - コーヒー分析\n' +
                  '• `/analytics health` - チーム健康度\n' +
                  '• `/analytics report` - 総合レポート\n' +
                  '• `/analytics export [csv|json]` - データエクスポート\n' +
                  '• `/analytics generate [markdown|html]` - レポート生成',
            response_type: 'ephemeral'
          });
      }
    } catch (error) {
      logger.error('Error handling analytics command:', error);
      await respond({
        text: 'エラーが発生しました。もう一度お試しください。',
        response_type: 'ephemeral'
      });
    }
  }

  private async showAnalyticsOverview(respond: any): Promise<void> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days

      await respond({
        text: '📊 分析データを生成中...',
        response_type: 'ephemeral'
      });

      const [engagement, knowledgeSharing, coffeeAnalytics, teamHealth] = await Promise.all([
        this.analyticsService.getEngagementMetrics(startDate, endDate),
        this.analyticsService.getKnowledgeSharingMetrics(startDate, endDate),
        this.analyticsService.getCoffeeAnalytics(startDate, endDate),
        this.analyticsService.getTeamHealthMetrics(startDate, endDate)
      ]);

      let message = '📊 **分析概要** (過去30日間)\n\n';
      
      message += `**🎯 エンゲージメント**\n`;
      message += `• 参加率: ${engagement.engagementRate.toFixed(1)}% (${engagement.activeUsers}/${engagement.totalUsers}名)\n`;
      message += `• 平均活動度: ${engagement.averageActivityPerUser.toFixed(1)}ポイント/人\n\n`;
      
      message += `**📚 ナレッジ共有**\n`;
      message += `• 総回答数: ${knowledgeSharing.totalShuffleResponses}件\n`;
      message += `• 平均回答長: ${knowledgeSharing.averageResponseLength.toFixed(0)}文字\n\n`;
      
      message += `**☕ 感謝の表現**\n`;
      message += `• 総コーヒー数: ${coffeeAnalytics.totalCoffeesSent}杯\n`;
      message += `• 平均送信数: ${coffeeAnalytics.averageCoffeesPerUser.toFixed(1)}杯/人\n\n`;
      
      message += `**💚 チーム健康度**\n`;
      message += `• 平均コンディション: ${teamHealth.averageCondition.toFixed(1)}/5.0\n`;
      message += `• 日報参加率: ${teamHealth.participationRate.toFixed(1)}%\n`;
      
      if (teamHealth.concerningTrends.length > 0) {
        message += `• ⚠️ 要注意: ${teamHealth.concerningTrends.length}名\n`;
      }

      await respond({
        text: message,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error showing analytics overview:', error);
      await respond({
        text: 'エラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  private async showEngagementMetrics(respond: any): Promise<void> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      await respond({
        text: '🎯 エンゲージメント分析を生成中...',
        response_type: 'ephemeral'
      });

      const engagement = await this.analyticsService.getEngagementMetrics(startDate, endDate);

      let message = '🎯 **エンゲージメント分析** (過去30日間)\n\n';
      
      message += `**📊 全体指標**\n`;
      message += `• 総ユーザー数: ${engagement.totalUsers}名\n`;
      message += `• アクティブユーザー: ${engagement.activeUsers}名\n`;
      message += `• 参加率: ${engagement.engagementRate.toFixed(1)}%\n`;
      message += `• 平均活動度: ${engagement.averageActivityPerUser.toFixed(1)}ポイント/人\n\n`;
      
      message += `**🏆 トップ貢献者**\n`;
      engagement.topContributors.slice(0, 5).forEach((contributor, index) => {
        message += `${index + 1}. ${contributor.userName}: ${contributor.totalScore.toFixed(1)}ポイント\n`;
        message += `   📝 ${contributor.shuffleResponses}回答 | ☕ ${contributor.coffeesSent}送信 | 📊 ${contributor.dailyReports}日報\n`;
      });

      if (engagement.activityTrends.length > 0) {
        message += `\n**📈 最近の活動トレンド**\n`;
        const recentTrends = engagement.activityTrends.slice(-7);
        const totalRecentActivity = recentTrends.reduce((sum, trend) => sum + trend.totalActivity, 0);
        message += `• 週間平均活動: ${(totalRecentActivity / 7).toFixed(1)}件/日\n`;
        
        const maxActivity = Math.max(...recentTrends.map(t => t.totalActivity));
        const maxDay = recentTrends.find(t => t.totalActivity === maxActivity);
        if (maxDay) {
          message += `• 最も活発な日: ${maxDay.date} (${maxDay.totalActivity}件)\n`;
        }
      }

      await respond({
        text: message,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error showing engagement metrics:', error);
      await respond({
        text: 'エラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  private async showKnowledgeMetrics(respond: any): Promise<void> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      await respond({
        text: '📚 ナレッジ共有分析を生成中...',
        response_type: 'ephemeral'
      });

      const knowledgeSharing = await this.analyticsService.getKnowledgeSharingMetrics(startDate, endDate);

      let message = '📚 **ナレッジ共有分析** (過去30日間)\n\n';
      
      message += `**📊 全体指標**\n`;
      message += `• 総回答数: ${knowledgeSharing.totalShuffleResponses}件\n`;
      message += `• 平均回答長: ${knowledgeSharing.averageResponseLength.toFixed(0)}文字\n\n`;
      
      message += `**📂 人気カテゴリー**\n`;
      knowledgeSharing.topCategories.slice(0, 5).forEach((category, index) => {
        message += `${index + 1}. ${category.category}: ${category.count}件 (${category.percentage.toFixed(1)}%)\n`;
        message += `   平均回答長: ${category.averageLength.toFixed(0)}文字\n`;
      });

      message += `\n**⭐ 高品質回答者**\n`;
      knowledgeSharing.responseQuality.slice(0, 5).forEach((quality, index) => {
        message += `${index + 1}. ${quality.userName}: ${quality.qualityScore}点\n`;
        message += `   ${quality.responseCount}回答 | 平均${quality.averageLength.toFixed(0)}文字\n`;
      });

      if (knowledgeSharing.knowledgeGrowth.length > 0) {
        message += `\n**📈 成長トレンド**\n`;
        const recentGrowth = knowledgeSharing.knowledgeGrowth.slice(-3);
        recentGrowth.forEach(growth => {
          const trendEmoji = growth.growthRate > 0 ? '📈' : growth.growthRate < 0 ? '📉' : '➡️';
          message += `• ${growth.period}: ${growth.newResponses}件 ${trendEmoji} ${growth.growthRate.toFixed(1)}%\n`;
        });
      }

      await respond({
        text: message,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error showing knowledge metrics:', error);
      await respond({
        text: 'エラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  private async showCoffeeAnalytics(respond: any): Promise<void> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      await respond({
        text: '☕ コーヒー分析を生成中...',
        response_type: 'ephemeral'
      });

      const coffeeAnalytics = await this.analyticsService.getCoffeeAnalytics(startDate, endDate);

      let message = '☕ **コーヒー分析** (過去30日間)\n\n';
      
      message += `**📊 全体指標**\n`;
      message += `• 総コーヒー数: ${coffeeAnalytics.totalCoffeesSent}杯\n`;
      message += `• 平均送信数: ${coffeeAnalytics.averageCoffeesPerUser.toFixed(1)}杯/人\n\n`;
      
      message += `**🎁 トップ送信者**\n`;
      coffeeAnalytics.topSenders.slice(0, 5).forEach((sender, index) => {
        message += `${index + 1}. ${sender.userName}: ${sender.coffeesSent}杯送信\n`;
        message += `   ${sender.uniqueRecipients}名に送信 | 寛大度: ${sender.generosityScore.toFixed(1)}\n`;
      });

      message += `\n**🌟 トップ受信者**\n`;
      coffeeAnalytics.topReceivers.slice(0, 5).forEach((receiver, index) => {
        message += `${index + 1}. ${receiver.userName}: ${receiver.coffeesReceived}杯受信\n`;
        message += `   ${receiver.uniqueSenders}名から受信 | 人気度: ${receiver.popularityScore.toFixed(1)}\n`;
      });

      if (coffeeAnalytics.coffeeNetwork.length > 0) {
        message += `\n**🕸️ ネットワーク中心人物**\n`;
        coffeeAnalytics.coffeeNetwork.slice(0, 3).forEach((network, index) => {
          message += `${index + 1}. ${network.userName}: ${network.connections}つながり\n`;
        });
      }

      if (coffeeAnalytics.monthlyTrends.length > 0) {
        message += `\n**📈 月次トレンド**\n`;
        const recentTrends = coffeeAnalytics.monthlyTrends.slice(-3);
        recentTrends.forEach(trend => {
          message += `• ${trend.month}: ${trend.totalCoffees}杯 (${trend.activeUsers}名参加)\n`;
        });
      }

      await respond({
        text: message,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error showing coffee analytics:', error);
      await respond({
        text: 'エラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  private async showTeamHealthMetrics(respond: any): Promise<void> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      await respond({
        text: '💚 チーム健康度分析を生成中...',
        response_type: 'ephemeral'
      });

      const teamHealth = await this.analyticsService.getTeamHealthMetrics(startDate, endDate);

      let message = '💚 **チーム健康度分析** (過去30日間)\n\n';
      
      message += `**📊 全体指標**\n`;
      message += `• 平均コンディション: ${teamHealth.averageCondition.toFixed(1)}/5.0\n`;
      message += `• 日報参加率: ${teamHealth.participationRate.toFixed(1)}%\n\n`;
      
      message += `**🌤️ コンディション分布**\n`;
      const conditionEmojis: Record<string, string> = {
        'sunny': '☀️ 晴れ',
        'cloudy': '☁️ 曇り',
        'rainy': '🌧️ 雨',
        'stormy': '⛈️ 嵐',
        'snowy': '❄️ 雪',
        'foggy': '🌫️ 霧'
      };
      
      Object.entries(teamHealth.conditionDistribution)
        .sort(([,a], [,b]) => b - a)
        .forEach(([condition, count]) => {
          const emoji = conditionEmojis[condition] || condition;
          const percentage = ((count / Object.values(teamHealth.conditionDistribution).reduce((a, b) => a + b, 0)) * 100).toFixed(1);
          message += `• ${emoji}: ${count}回 (${percentage}%)\n`;
        });

      if (teamHealth.consistentReporters.length > 0) {
        message += `\n**🏆 継続報告者**\n`;
        teamHealth.consistentReporters.slice(0, 5).forEach((reporter, index) => {
          message += `${index + 1}. ${reporter}\n`;
        });
      }

      if (teamHealth.concerningTrends.length > 0) {
        message += `\n**⚠️ 要注意メンバー**\n`;
        teamHealth.concerningTrends.forEach(concern => {
          const severityEmoji = concern.severity === 'high' ? '🔴' : concern.severity === 'medium' ? '🟡' : '🟢';
          const trendText = concern.trend === 'declining' ? '悪化傾向' : '継続的に低調';
          message += `• ${severityEmoji} ${concern.userName}: ${trendText} (${concern.duration}日間)\n`;
        });
      }

      if (teamHealth.teamMorale.length > 0) {
        message += `\n**📈 チーム士気トレンド**\n`;
        const recentMorale = teamHealth.teamMorale.slice(-4);
        recentMorale.forEach(morale => {
          const trendEmoji = morale.trend === 'improving' ? '📈' : morale.trend === 'declining' ? '📉' : '➡️';
          message += `• ${morale.period}: ${morale.averageCondition.toFixed(1)}/5.0 ${trendEmoji}\n`;
        });
      }

      await respond({
        text: message,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error showing team health metrics:', error);
      await respond({
        text: 'エラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  private async generateFullReport(respond: any): Promise<void> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      await respond({
        text: '📋 総合レポートを生成中... (少々お待ちください)',
        response_type: 'ephemeral'
      });

      const report = await this.analyticsService.generateAnalyticsReport(startDate, endDate);

      // Send summary first
      await respond({
        text: report.summary,
        response_type: 'ephemeral'
      });

      // Send detailed sections
      setTimeout(async () => {
        let detailedMessage = '📊 **詳細分析**\n\n';
        
        detailedMessage += `**🎯 エンゲージメント詳細**\n`;
        detailedMessage += `• トップ3貢献者:\n`;
        report.engagement.topContributors.slice(0, 3).forEach((contributor, index) => {
          detailedMessage += `  ${index + 1}. ${contributor.userName} (${contributor.totalScore.toFixed(1)}pt)\n`;
        });
        
        detailedMessage += `\n**📚 ナレッジ共有詳細**\n`;
        detailedMessage += `• 人気カテゴリー:\n`;
        report.knowledgeSharing.topCategories.slice(0, 3).forEach((category, index) => {
          detailedMessage += `  ${index + 1}. ${category.category} (${category.count}件)\n`;
        });
        
        detailedMessage += `\n**☕ コーヒー詳細**\n`;
        detailedMessage += `• トップ送信者:\n`;
        report.coffeeAnalytics.topSenders.slice(0, 3).forEach((sender, index) => {
          detailedMessage += `  ${index + 1}. ${sender.userName} (${sender.coffeesSent}杯)\n`;
        });
        
        if (report.teamHealth.concerningTrends.length > 0) {
          detailedMessage += `\n**⚠️ 健康度の懸念**\n`;
          report.teamHealth.concerningTrends.slice(0, 3).forEach(concern => {
            detailedMessage += `• ${concern.userName}: ${concern.trend === 'declining' ? '悪化傾向' : '継続的に低調'}\n`;
          });
        }

        await respond({
          text: detailedMessage,
          response_type: 'ephemeral'
        });
      }, 2000);

    } catch (error) {
      logger.error('Error generating full report:', error);
      await respond({
        text: 'エラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  private async handleDataExport(respond: any, format?: string): Promise<void> {
    try {
      if (!format || !['csv', 'json'].includes(format)) {
        await respond({
          text: '使用方法: `/analytics export [csv|json]`\n\n' +
                '利用可能な形式:\n' +
                '• `csv` - CSV形式でエクスポート\n' +
                '• `json` - JSON形式でエクスポート',
          response_type: 'ephemeral'
        });
        return;
      }

      await respond({
        text: '📤 データエクスポートを準備中...',
        response_type: 'ephemeral'
      });

      // Get export summary first
      const summary = await this.dataExporter.getExportSummary();

      let summaryMessage = '📊 **エクスポート可能データ**\n\n';
      summaryMessage += `• ユーザー: ${summary.totalUsers}名\n`;
      summaryMessage += `• プロフィール: ${summary.totalProfiles}件\n`;
      summaryMessage += `• シャッフル回答: ${summary.totalShuffleResponses}件\n`;
      summaryMessage += `• コーヒー: ${summary.totalCoffee}杯\n`;
      summaryMessage += `• 日報: ${summary.totalDailyReports}件\n`;
      summaryMessage += `• アンケート回答: ${summary.totalSurveyResponses}件\n`;
      summaryMessage += `• 推定サイズ: ${summary.dataSize}\n\n`;

      await respond({
        text: summaryMessage,
        response_type: 'ephemeral'
      });

      // Configure export (last 30 days, anonymized)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const exportConfig: ExportConfig = {
        format: format as 'csv' | 'json',
        includeUsers: true,
        includeProfiles: true,
        includeShuffleResponses: true,
        includeCoffee: true,
        includeDailyReports: true,
        includeSurveyResponses: true,
        startDate,
        endDate,
        anonymize: true // Always anonymize for security
      };

      // Generate export
      const exportResult = await this.dataExporter.exportData(exportConfig);

      // Send export result (in a real system, you'd upload to a file service)
      let exportMessage = `✅ **エクスポート完了**\n\n`;
      exportMessage += `• ファイル名: ${exportResult.filename}\n`;
      exportMessage += `• 形式: ${exportResult.format.toUpperCase()}\n`;
      exportMessage += `• サイズ: ${this.formatBytes(exportResult.size)}\n`;
      exportMessage += `• 生成日時: ${exportResult.exportedAt.toLocaleString('ja-JP')}\n\n`;
      exportMessage += `⚠️ データは匿名化されています\n`;
      exportMessage += `📋 実際のシステムでは、ファイルダウンロードリンクが提供されます`;

      await respond({
        text: exportMessage,
        response_type: 'ephemeral'
      });

    } catch (error) {
      logger.error('Error handling data export:', error);
      await respond({
        text: 'エクスポート中にエラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  private async handleReportGeneration(respond: any, format?: string): Promise<void> {
    try {
      if (!format || !['markdown', 'html'].includes(format)) {
        await respond({
          text: '使用方法: `/analytics generate [markdown|html]`\n\n' +
                '利用可能な形式:\n' +
                '• `markdown` - Markdown形式のレポート\n' +
                '• `html` - HTML形式のレポート',
          response_type: 'ephemeral'
        });
        return;
      }

      await respond({
        text: '📋 レポートを生成中...',
        response_type: 'ephemeral'
      });

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const reportConfig: ReportConfig = {
        title: 'Slack Knowledge Hub 分析レポート',
        startDate,
        endDate,
        includeEngagement: true,
        includeKnowledgeSharing: true,
        includeCoffeeAnalytics: true,
        includeTeamHealth: true,
        format: format as 'markdown' | 'html',
        language: 'ja'
      };

      const report = await this.reportGenerator.generateReport(reportConfig);

      let reportMessage = `✅ **レポート生成完了**\n\n`;
      reportMessage += `• タイトル: ${report.title}\n`;
      reportMessage += `• 形式: ${report.format.toUpperCase()}\n`;
      reportMessage += `• サイズ: ${this.formatBytes(report.content.length)}\n`;
      reportMessage += `• 生成日時: ${report.generatedAt.toLocaleString('ja-JP')}\n\n`;
      reportMessage += `**サマリー:**\n${report.summary}\n\n`;
      reportMessage += `📋 実際のシステムでは、レポートファイルのダウンロードリンクが提供されます`;

      await respond({
        text: reportMessage,
        response_type: 'ephemeral'
      });

      // In a real system, you would:
      // 1. Upload the report content to a file storage service (S3, etc.)
      // 2. Generate a secure download link
      // 3. Send the download link to the user
      // 4. Set up automatic cleanup of old reports

    } catch (error) {
      logger.error('Error handling report generation:', error);
      await respond({
        text: 'レポート生成中にエラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}