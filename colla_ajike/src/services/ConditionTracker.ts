import { DailyReportRepository } from '../repositories/DailyReportRepository';
import { UserRepository } from '../repositories/UserRepository';
import { DailyReport } from '../models/DailyReport';
import { User } from '../models/User';
import { logger } from '../utils/logger';

export interface ConditionTrend {
  userId: string;
  userName: string;
  conditions: {
    date: string;
    condition: string;
    emoji: string;
  }[];
  averageCondition: string;
  trendDirection: 'improving' | 'declining' | 'stable';
}

export interface TeamConditionSummary {
  date: string;
  totalReports: number;
  conditionBreakdown: Record<string, number>;
  topCondition: string;
  participationRate: number;
  trends: ConditionTrend[];
}

export class ConditionTracker {
  private dailyReportRepository: DailyReportRepository;
  private userRepository: UserRepository;

  constructor() {
    this.dailyReportRepository = new DailyReportRepository();
    this.userRepository = new UserRepository();
  }

  async getTeamConditionSummary(date: Date): Promise<TeamConditionSummary> {
    try {
      const reports = await this.dailyReportRepository.findByDate(date);
      const allUsers = await this.userRepository.findAll();
      
      const conditionBreakdown: Record<string, number> = {};
      reports.forEach(report => {
        conditionBreakdown[report.condition] = (conditionBreakdown[report.condition] || 0) + 1;
      });

      const topCondition = Object.entries(conditionBreakdown)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'unknown';

      const participationRate = allUsers.length > 0 ? (reports.length / allUsers.length) * 100 : 0;

      // Get trends for the past week
      const weekAgo = new Date(date);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const trends = await this.getUserConditionTrends(weekAgo, date);

      return {
        date: date.toISOString().split('T')[0],
        totalReports: reports.length,
        conditionBreakdown,
        topCondition,
        participationRate,
        trends
      };
    } catch (error) {
      logger.error('Error getting team condition summary:', error);
      throw error;
    }
  }

  async getUserConditionTrends(startDate: Date, endDate: Date): Promise<ConditionTrend[]> {
    try {
      const reports = await this.dailyReportRepository.findByDateRange(startDate, endDate);
      const users = await this.userRepository.findAll();
      
      const userReportsMap: Record<string, DailyReport[]> = {};
      reports.forEach(report => {
        if (!userReportsMap[report.userId]) {
          userReportsMap[report.userId] = [];
        }
        userReportsMap[report.userId].push(report);
      });

      const trends: ConditionTrend[] = [];

      for (const user of users) {
        const userReports = userReportsMap[user.id] || [];
        
        if (userReports.length === 0) continue;

        const conditions = userReports
          .sort((a, b) => a.date.getTime() - b.date.getTime())
          .map(report => ({
            date: report.date.toISOString().split('T')[0],
            condition: report.condition,
            emoji: this.getWeatherEmoji(report.condition)
          }));

        const averageCondition = this.calculateAverageCondition(userReports);
        const trendDirection = this.calculateTrendDirection(userReports);

        trends.push({
          userId: user.id,
          userName: user.name,
          conditions,
          averageCondition,
          trendDirection
        });
      }

      return trends.sort((a, b) => b.conditions.length - a.conditions.length);
    } catch (error) {
      logger.error('Error getting user condition trends:', error);
      throw error;
    }
  }

  async getConditionHistory(userId: string, days: number = 30): Promise<ConditionTrend> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const reports = await this.dailyReportRepository.findByDateRange(startDate, endDate, userId);
      const user = await this.userRepository.findById(userId);

      if (!user) {
        throw new Error('User not found');
      }

      const conditions = reports
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map(report => ({
          date: report.date.toISOString().split('T')[0],
          condition: report.condition,
          emoji: this.getWeatherEmoji(report.condition)
        }));

      const averageCondition = this.calculateAverageCondition(reports);
      const trendDirection = this.calculateTrendDirection(reports);

      return {
        userId: user.id,
        userName: user.name,
        conditions,
        averageCondition,
        trendDirection
      };
    } catch (error) {
      logger.error('Error getting condition history:', error);
      throw error;
    }
  }

  async getWeeklyConditionStats(startDate: Date): Promise<Record<string, TeamConditionSummary>> {
    try {
      const weeklyStats: Record<string, TeamConditionSummary> = {};
      
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + i);
        
        const summary = await this.getTeamConditionSummary(currentDate);
        weeklyStats[summary.date] = summary;
      }

      return weeklyStats;
    } catch (error) {
      logger.error('Error getting weekly condition stats:', error);
      throw error;
    }
  }

  async getConditionInsights(startDate: Date, endDate: Date): Promise<{
    mostActiveUsers: { userId: string; userName: string; reportCount: number }[];
    conditionDistribution: Record<string, number>;
    averageParticipation: number;
    consistentReporters: string[];
    improvingUsers: string[];
    decliningUsers: string[];
  }> {
    try {
      const reports = await this.dailyReportRepository.findByDateRange(startDate, endDate);
      const allUsers = await this.userRepository.findAll();
      
      // Most active users
      const userReportCounts: Record<string, { count: number; name: string }> = {};
      reports.forEach(report => {
        if (!userReportCounts[report.userId]) {
          const user = allUsers.find(u => u.id === report.userId);
          userReportCounts[report.userId] = { 
            count: 0, 
            name: user?.name || 'Unknown' 
          };
        }
        userReportCounts[report.userId].count++;
      });

      const mostActiveUsers = Object.entries(userReportCounts)
        .map(([userId, data]) => ({
          userId,
          userName: data.name,
          reportCount: data.count
        }))
        .sort((a, b) => b.reportCount - a.reportCount)
        .slice(0, 10);

      // Condition distribution
      const conditionDistribution: Record<string, number> = {};
      reports.forEach(report => {
        conditionDistribution[report.condition] = (conditionDistribution[report.condition] || 0) + 1;
      });

      // Calculate average participation
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const expectedReports = allUsers.length * totalDays;
      const averageParticipation = expectedReports > 0 ? (reports.length / expectedReports) * 100 : 0;

      // Get trends for insights
      const trends = await this.getUserConditionTrends(startDate, endDate);
      
      const consistentReporters = trends
        .filter(trend => trend.conditions.length >= totalDays * 0.8) // 80% participation
        .map(trend => trend.userName);

      const improvingUsers = trends
        .filter(trend => trend.trendDirection === 'improving')
        .map(trend => trend.userName);

      const decliningUsers = trends
        .filter(trend => trend.trendDirection === 'declining')
        .map(trend => trend.userName);

      return {
        mostActiveUsers,
        conditionDistribution,
        averageParticipation,
        consistentReporters,
        improvingUsers,
        decliningUsers
      };
    } catch (error) {
      logger.error('Error getting condition insights:', error);
      throw error;
    }
  }

  private calculateAverageCondition(reports: DailyReport[]): string {
    if (reports.length === 0) return 'unknown';

    const conditionScores: Record<string, number> = {
      'sunny': 5,
      'cloudy': 4,
      'foggy': 3,
      'rainy': 2,
      'stormy': 1,
      'snowy': 3
    };

    const totalScore = reports.reduce((sum, report) => {
      return sum + (conditionScores[report.condition] || 3);
    }, 0);

    const averageScore = totalScore / reports.length;

    // Convert back to condition
    if (averageScore >= 4.5) return 'sunny';
    if (averageScore >= 3.5) return 'cloudy';
    if (averageScore >= 2.5) return 'foggy';
    if (averageScore >= 1.5) return 'rainy';
    return 'stormy';
  }

  private calculateTrendDirection(reports: DailyReport[]): 'improving' | 'declining' | 'stable' {
    if (reports.length < 3) return 'stable';

    const conditionScores: Record<string, number> = {
      'sunny': 5,
      'cloudy': 4,
      'foggy': 3,
      'rainy': 2,
      'stormy': 1,
      'snowy': 3
    };

    const sortedReports = reports.sort((a, b) => a.date.getTime() - b.date.getTime());
    const recentReports = sortedReports.slice(-3);
    const earlierReports = sortedReports.slice(0, 3);

    const recentAverage = recentReports.reduce((sum, report) => {
      return sum + (conditionScores[report.condition] || 3);
    }, 0) / recentReports.length;

    const earlierAverage = earlierReports.reduce((sum, report) => {
      return sum + (conditionScores[report.condition] || 3);
    }, 0) / earlierReports.length;

    const difference = recentAverage - earlierAverage;

    if (difference > 0.5) return 'improving';
    if (difference < -0.5) return 'declining';
    return 'stable';
  }

  private getWeatherEmoji(condition: string): string {
    const emojiMap: Record<string, string> = {
      'sunny': '☀️',
      'cloudy': '☁️',
      'rainy': '🌧️',
      'stormy': '⛈️',
      'snowy': '❄️',
      'foggy': '🌫️'
    };

    return emojiMap[condition] || '🌤️';
  }

  formatConditionTrend(trend: ConditionTrend): string {
    let message = `📊 **${trend.userName}さんのコンディション履歴**\n\n`;
    
    // Show recent conditions (last 7 days)
    const recentConditions = trend.conditions.slice(-7);
    message += '**最近の状況:**\n';
    recentConditions.forEach(condition => {
      message += `${condition.emoji} ${condition.date}\n`;
    });

    message += `\n**平均コンディション:** ${this.getWeatherEmoji(trend.averageCondition)} ${this.getConditionDescription(trend.averageCondition)}\n`;
    
    const trendEmoji = trend.trendDirection === 'improving' ? '📈' : 
                      trend.trendDirection === 'declining' ? '📉' : '➡️';
    message += `**トレンド:** ${trendEmoji} ${this.getTrendDescription(trend.trendDirection)}\n`;

    return message;
  }

  formatTeamSummary(summary: TeamConditionSummary): string {
    let message = `📊 **チーム状況サマリー** (${summary.date})\n\n`;
    
    message += `**参加率:** ${summary.participationRate.toFixed(1)}% (${summary.totalReports}名が報告)\n\n`;
    
    message += '**コンディション分布:**\n';
    Object.entries(summary.conditionBreakdown)
      .sort(([,a], [,b]) => b - a)
      .forEach(([condition, count]) => {
        const emoji = this.getWeatherEmoji(condition);
        const percentage = ((count / summary.totalReports) * 100).toFixed(1);
        message += `${emoji} ${this.getConditionDescription(condition)}: ${count}名 (${percentage}%)\n`;
      });

    if (summary.trends.length > 0) {
      const improvingCount = summary.trends.filter(t => t.trendDirection === 'improving').length;
      const decliningCount = summary.trends.filter(t => t.trendDirection === 'declining').length;
      
      message += `\n**トレンド:**\n`;
      message += `📈 改善傾向: ${improvingCount}名\n`;
      message += `📉 悪化傾向: ${decliningCount}名\n`;
    }

    return message;
  }

  private getConditionDescription(condition: string): string {
    const descriptionMap: Record<string, string> = {
      'sunny': '晴れ - 絶好調！',
      'cloudy': '曇り - まあまあ',
      'rainy': '雨 - 少し憂鬱',
      'stormy': '嵐 - 大変な日',
      'snowy': '雪 - 静かな気分',
      'foggy': '霧 - ぼんやり'
    };

    return descriptionMap[condition] || '不明な天気';
  }

  private getTrendDescription(trend: 'improving' | 'declining' | 'stable'): string {
    const trendMap = {
      'improving': '改善傾向',
      'declining': '悪化傾向',
      'stable': '安定'
    };

    return trendMap[trend];
  }
}