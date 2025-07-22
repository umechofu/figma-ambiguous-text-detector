import { AnalyticsService } from './AnalyticsService';
import { logger } from '../utils/logger';

export interface ReportConfig {
  title: string;
  startDate: Date;
  endDate: Date;
  includeEngagement: boolean;
  includeKnowledgeSharing: boolean;
  includeCoffeeAnalytics: boolean;
  includeTeamHealth: boolean;
  format: 'markdown' | 'html';
  language: 'ja' | 'en';
}

export interface GeneratedReport {
  title: string;
  format: string;
  content: string;
  summary: string;
  generatedAt: Date;
}

export class ReportGenerator {
  private analyticsService: AnalyticsService;

  constructor() {
    this.analyticsService = new AnalyticsService();
  }

  async generateReport(config: ReportConfig): Promise<GeneratedReport> {
    try {
      logger.info('Generating report', {
        title: config.title,
        format: config.format,
        startDate: config.startDate,
        endDate: config.endDate
      });

      // Collect analytics data
      const [engagement, knowledgeSharing, coffeeAnalytics, teamHealth] = await Promise.all([
        config.includeEngagement ? this.analyticsService.getEngagementMetrics(config.startDate, config.endDate) : null,
        config.includeKnowledgeSharing ? this.analyticsService.getKnowledgeSharingMetrics(config.startDate, config.endDate) : null,
        config.includeCoffeeAnalytics ? this.analyticsService.getCoffeeAnalytics(config.startDate, config.endDate) : null,
        config.includeTeamHealth ? this.analyticsService.getTeamHealthMetrics(config.startDate, config.endDate) : null
      ]);

      // Generate content based on format
      let content: string;
      if (config.format === 'markdown') {
        content = this.generateMarkdownReport(config, { engagement, knowledgeSharing, coffeeAnalytics, teamHealth });
      } else {
        content = this.generateHtmlReport(config, { engagement, knowledgeSharing, coffeeAnalytics, teamHealth });
      }

      // Generate summary
      const summary = this.generateSummary({ engagement, knowledgeSharing, coffeeAnalytics, teamHealth });

      const report: GeneratedReport = {
        title: config.title,
        format: config.format,
        content,
        summary,
        generatedAt: new Date()
      };

      logger.info('Report generated successfully', {
        title: config.title,
        contentLength: content.length
      });

      return report;
    } catch (error) {
      logger.error('Error generating report:', error);
      throw error;
    }
  }

  private generateMarkdownReport(config: ReportConfig, data: any): string {
    let markdown = `# ${config.title}\n\n`;
    markdown += `**生成日時:** ${new Date().toLocaleString('ja-JP')}\n`;
    markdown += `**期間:** ${config.startDate.toLocaleDateString('ja-JP')} - ${config.endDate.toLocaleDateString('ja-JP')}\n\n`;

    if (data.engagement) {
      markdown += this.generateEngagementMarkdown(data.engagement);
    }

    if (data.knowledgeSharing) {
      markdown += this.generateKnowledgeSharingMarkdown(data.knowledgeSharing);
    }

    if (data.coffeeAnalytics) {
      markdown += this.generateCoffeeAnalyticsMarkdown(data.coffeeAnalytics);
    }

    if (data.teamHealth) {
      markdown += this.generateTeamHealthMarkdown(data.teamHealth);
    }

    return markdown;
  }

  private generateHtmlReport(config: ReportConfig, data: any): string {
    let html = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.title}</title>
    <style>
        body { font-family: 'Hiragino Sans', 'Yu Gothic', sans-serif; margin: 40px; line-height: 1.6; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .section { margin-bottom: 40px; }
        .metric { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .highlight { color: #007cba; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${config.title}</h1>
        <p><strong>生成日時:</strong> ${new Date().toLocaleString('ja-JP')}</p>
        <p><strong>期間:</strong> ${config.startDate.toLocaleDateString('ja-JP')} - ${config.endDate.toLocaleDateString('ja-JP')}</p>
    </div>`;

    if (data.engagement) {
      html += this.generateEngagementHtml(data.engagement);
    }

    if (data.knowledgeSharing) {
      html += this.generateKnowledgeSharingHtml(data.knowledgeSharing);
    }

    if (data.coffeeAnalytics) {
      html += this.generateCoffeeAnalyticsHtml(data.coffeeAnalytics);
    }

    if (data.teamHealth) {
      html += this.generateTeamHealthHtml(data.teamHealth);
    }

    html += `</body></html>`;
    return html;
  }

  private generateEngagementMarkdown(engagement: any): string {
    let markdown = `## 🎯 エンゲージメント分析\n\n`;
    markdown += `### 全体指標\n`;
    markdown += `- **総ユーザー数:** ${engagement.totalUsers}名\n`;
    markdown += `- **アクティブユーザー:** ${engagement.activeUsers}名\n`;
    markdown += `- **参加率:** ${engagement.engagementRate.toFixed(1)}%\n`;
    markdown += `- **平均活動度:** ${engagement.averageActivityPerUser.toFixed(1)}ポイント/人\n\n`;

    if (engagement.topContributors && engagement.topContributors.length > 0) {
      markdown += `### 🏆 トップ貢献者\n`;
      engagement.topContributors.slice(0, 5).forEach((contributor: any, index: number) => {
        markdown += `${index + 1}. **${contributor.userName}:** ${contributor.totalScore.toFixed(1)}ポイント\n`;
      });
      markdown += `\n`;
    }

    return markdown;
  }

  private generateEngagementHtml(engagement: any): string {
    let html = `<div class="section">
        <h2>🎯 エンゲージメント分析</h2>
        <div class="metric">
            <h3>全体指標</h3>
            <p><strong>総ユーザー数:</strong> <span class="highlight">${engagement.totalUsers}名</span></p>
            <p><strong>アクティブユーザー:</strong> <span class="highlight">${engagement.activeUsers}名</span></p>
            <p><strong>参加率:</strong> <span class="highlight">${engagement.engagementRate.toFixed(1)}%</span></p>
            <p><strong>平均活動度:</strong> <span class="highlight">${engagement.averageActivityPerUser.toFixed(1)}ポイント/人</span></p>
        </div>`;

    if (engagement.topContributors && engagement.topContributors.length > 0) {
      html += `<div class="metric">
            <h3>🏆 トップ貢献者</h3>
            <table>
                <tr><th>順位</th><th>ユーザー名</th><th>スコア</th></tr>`;
      
      engagement.topContributors.slice(0, 5).forEach((contributor: any, index: number) => {
        html += `<tr><td>${index + 1}</td><td>${contributor.userName}</td><td>${contributor.totalScore.toFixed(1)}ポイント</td></tr>`;
      });
      
      html += `</table></div>`;
    }

    html += `</div>`;
    return html;
  }

  private generateKnowledgeSharingMarkdown(knowledgeSharing: any): string {
    let markdown = `## 📚 ナレッジ共有分析\n\n`;
    markdown += `### 全体指標\n`;
    markdown += `- **総回答数:** ${knowledgeSharing.totalShuffleResponses}件\n`;
    markdown += `- **平均回答長:** ${knowledgeSharing.averageResponseLength.toFixed(0)}文字\n\n`;

    if (knowledgeSharing.topCategories && knowledgeSharing.topCategories.length > 0) {
      markdown += `### 📂 人気カテゴリー\n`;
      knowledgeSharing.topCategories.slice(0, 5).forEach((category: any, index: number) => {
        markdown += `${index + 1}. **${category.category}:** ${category.count}件 (${category.percentage.toFixed(1)}%)\n`;
      });
      markdown += `\n`;
    }

    return markdown;
  }

  private generateKnowledgeSharingHtml(knowledgeSharing: any): string {
    let html = `<div class="section">
        <h2>📚 ナレッジ共有分析</h2>
        <div class="metric">
            <h3>全体指標</h3>
            <p><strong>総回答数:</strong> <span class="highlight">${knowledgeSharing.totalShuffleResponses}件</span></p>
            <p><strong>平均回答長:</strong> <span class="highlight">${knowledgeSharing.averageResponseLength.toFixed(0)}文字</span></p>
        </div>`;

    if (knowledgeSharing.topCategories && knowledgeSharing.topCategories.length > 0) {
      html += `<div class="metric">
            <h3>📂 人気カテゴリー</h3>
            <table>
                <tr><th>順位</th><th>カテゴリー</th><th>件数</th><th>割合</th></tr>`;
      
      knowledgeSharing.topCategories.slice(0, 5).forEach((category: any, index: number) => {
        html += `<tr><td>${index + 1}</td><td>${category.category}</td><td>${category.count}件</td><td>${category.percentage.toFixed(1)}%</td></tr>`;
      });
      
      html += `</table></div>`;
    }

    html += `</div>`;
    return html;
  }

  private generateCoffeeAnalyticsMarkdown(coffeeAnalytics: any): string {
    let markdown = `## ☕ コーヒー分析\n\n`;
    markdown += `### 全体指標\n`;
    markdown += `- **総コーヒー数:** ${coffeeAnalytics.totalCoffeesSent}杯\n`;
    markdown += `- **平均送信数:** ${coffeeAnalytics.averageCoffeesPerUser.toFixed(1)}杯/人\n\n`;

    if (coffeeAnalytics.topSenders && coffeeAnalytics.topSenders.length > 0) {
      markdown += `### 🎁 トップ送信者\n`;
      coffeeAnalytics.topSenders.slice(0, 5).forEach((sender: any, index: number) => {
        markdown += `${index + 1}. **${sender.userName}:** ${sender.coffeesSent}杯送信\n`;
      });
      markdown += `\n`;
    }

    return markdown;
  }

  private generateCoffeeAnalyticsHtml(coffeeAnalytics: any): string {
    let html = `<div class="section">
        <h2>☕ コーヒー分析</h2>
        <div class="metric">
            <h3>全体指標</h3>
            <p><strong>総コーヒー数:</strong> <span class="highlight">${coffeeAnalytics.totalCoffeesSent}杯</span></p>
            <p><strong>平均送信数:</strong> <span class="highlight">${coffeeAnalytics.averageCoffeesPerUser.toFixed(1)}杯/人</span></p>
        </div>`;

    if (coffeeAnalytics.topSenders && coffeeAnalytics.topSenders.length > 0) {
      html += `<div class="metric">
            <h3>🎁 トップ送信者</h3>
            <table>
                <tr><th>順位</th><th>ユーザー名</th><th>送信数</th></tr>`;
      
      coffeeAnalytics.topSenders.slice(0, 5).forEach((sender: any, index: number) => {
        html += `<tr><td>${index + 1}</td><td>${sender.userName}</td><td>${sender.coffeesSent}杯</td></tr>`;
      });
      
      html += `</table></div>`;
    }

    html += `</div>`;
    return html;
  }

  private generateTeamHealthMarkdown(teamHealth: any): string {
    let markdown = `## 💚 チーム健康度分析\n\n`;
    markdown += `### 全体指標\n`;
    markdown += `- **平均コンディション:** ${teamHealth.averageCondition.toFixed(1)}/5.0\n`;
    markdown += `- **日報参加率:** ${teamHealth.participationRate.toFixed(1)}%\n\n`;

    if (teamHealth.conditionDistribution) {
      markdown += `### 🌤️ コンディション分布\n`;
      const conditionEmojis: Record<string, string> = {
        'sunny': '☀️ 晴れ',
        'cloudy': '☁️ 曇り',
        'rainy': '🌧️ 雨',
        'stormy': '⛈️ 嵐',
        'snowy': '❄️ 雪',
        'foggy': '🌫️ 霧'
      };
      
      Object.entries(teamHealth.conditionDistribution)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .forEach(([condition, count]) => {
          const emoji = conditionEmojis[condition] || condition;
          const total = Object.values(teamHealth.conditionDistribution).reduce((a: number, b: number) => a + b, 0);
          const percentage = ((count as number / total) * 100).toFixed(1);
          markdown += `- **${emoji}:** ${count}回 (${percentage}%)\n`;
        });
      markdown += `\n`;
    }

    return markdown;
  }

  private generateTeamHealthHtml(teamHealth: any): string {
    let html = `<div class="section">
        <h2>💚 チーム健康度分析</h2>
        <div class="metric">
            <h3>全体指標</h3>
            <p><strong>平均コンディション:</strong> <span class="highlight">${teamHealth.averageCondition.toFixed(1)}/5.0</span></p>
            <p><strong>日報参加率:</strong> <span class="highlight">${teamHealth.participationRate.toFixed(1)}%</span></p>
        </div>`;

    if (teamHealth.conditionDistribution) {
      html += `<div class="metric">
            <h3>🌤️ コンディション分布</h3>
            <table>
                <tr><th>コンディション</th><th>回数</th><th>割合</th></tr>`;
      
      const conditionEmojis: Record<string, string> = {
        'sunny': '☀️ 晴れ',
        'cloudy': '☁️ 曇り',
        'rainy': '🌧️ 雨',
        'stormy': '⛈️ 嵐',
        'snowy': '❄️ 雪',
        'foggy': '🌫️ 霧'
      };
      
      Object.entries(teamHealth.conditionDistribution)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .forEach(([condition, count]) => {
          const emoji = conditionEmojis[condition] || condition;
          const total = Object.values(teamHealth.conditionDistribution).reduce((a: number, b: number) => a + b, 0);
          const percentage = ((count as number / total) * 100).toFixed(1);
          html += `<tr><td>${emoji}</td><td>${count}回</td><td>${percentage}%</td></tr>`;
        });
      
      html += `</table></div>`;
    }

    html += `</div>`;
    return html;
  }

  private generateSummary(data: any): string {
    let summary = '📊 **分析サマリー**\n\n';

    if (data.engagement) {
      summary += `🎯 **エンゲージメント:** 参加率${data.engagement.engagementRate.toFixed(1)}% (${data.engagement.activeUsers}/${data.engagement.totalUsers}名)\n`;
    }

    if (data.knowledgeSharing) {
      summary += `📚 **ナレッジ共有:** 総回答数${data.knowledgeSharing.totalShuffleResponses}件\n`;
    }

    if (data.coffeeAnalytics) {
      summary += `☕ **感謝の表現:** 総コーヒー数${data.coffeeAnalytics.totalCoffeesSent}杯\n`;
    }

    if (data.teamHealth) {
      summary += `💚 **チーム健康度:** 平均コンディション${data.teamHealth.averageCondition.toFixed(1)}/5.0\n`;
    }

    return summary;
  }
}