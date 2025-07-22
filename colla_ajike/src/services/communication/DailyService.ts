import { DailyReportRepository } from '../../repositories/DailyReportRepository';
import { UserRepository } from '../../repositories/UserRepository';
import { DailyReport, CreateDailyReportRequest, UpdateDailyReportRequest, WeatherCondition } from '../models/DailyReport';
import { logger } from '../../utils/logger';

export class DailyService {
  private dailyReportRepository: DailyReportRepository;
  private userRepository: UserRepository;

  constructor() {
    this.dailyReportRepository = new DailyReportRepository();
    this.userRepository = new UserRepository();
  }

  async createDailyReport(reportData: CreateDailyReportRequest): Promise<DailyReport> {
    try {
      // Validate user exists
      const user = await this.userRepository.findById(reportData.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Validate condition
      if (!this.isValidCondition(reportData.condition)) {
        throw new Error('Invalid weather condition');
      }

      const report = await this.dailyReportRepository.upsertByUserIdAndDate(reportData);
      
      logger.info(`Daily report created/updated for user ${reportData.userId}`, {
        reportId: report.id,
        condition: report.condition,
        date: report.date
      });

      return report;
    } catch (error) {
      logger.error('Error creating daily report:', error);
      throw error;
    }
  }

  async updateDailyReport(reportId: string, reportData: UpdateDailyReportRequest): Promise<DailyReport> {
    try {
      // Validate condition if provided
      if (reportData.condition && !this.isValidCondition(reportData.condition)) {
        throw new Error('Invalid weather condition');
      }

      const report = await this.dailyReportRepository.update(reportId, reportData);
      
      logger.info(`Daily report updated: ${reportId}`, {
        condition: report.condition,
        date: report.date
      });

      return report;
    } catch (error) {
      logger.error('Error updating daily report:', error);
      throw error;
    }
  }

  async getTodayReport(userId: string): Promise<DailyReport | null> {
    try {
      const today = new Date();
      return await this.dailyReportRepository.findByUserIdAndDate(userId, today);
    } catch (error) {
      logger.error('Error getting today report:', error);
      throw error;
    }
  }

  async getUserReports(userId: string, limit?: number): Promise<DailyReport[]> {
    try {
      return await this.dailyReportRepository.findByUserId(userId, limit);
    } catch (error) {
      logger.error('Error getting user reports:', error);
      throw error;
    }
  }

  async getTodayReports(): Promise<DailyReport[]> {
    try {
      const today = new Date();
      return await this.dailyReportRepository.findByDate(today);
    } catch (error) {
      logger.error('Error getting today reports:', error);
      throw error;
    }
  }

  async getReportsByDateRange(startDate: Date, endDate: Date, userId?: string): Promise<DailyReport[]> {
    try {
      return await this.dailyReportRepository.findByDateRange(startDate, endDate, userId);
    } catch (error) {
      logger.error('Error getting reports by date range:', error);
      throw error;
    }
  }

  async getConditionStats(startDate: Date, endDate: Date): Promise<Record<string, number>> {
    try {
      return await this.dailyReportRepository.getConditionStats(startDate, endDate);
    } catch (error) {
      logger.error('Error getting condition stats:', error);
      throw error;
    }
  }

  getWeatherEmoji(condition: string): string {
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

  getConditionDescription(condition: string): string {
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

  private isValidCondition(condition: string): boolean {
    const validConditions: WeatherCondition[] = [
      'sunny', 'cloudy', 'rainy', 'stormy', 'snowy', 'foggy'
    ];
    return validConditions.includes(condition as WeatherCondition);
  }

  formatDailyReportMessage(report: DailyReport, userName: string): string {
    const emoji = this.getWeatherEmoji(report.condition);
    const description = this.getConditionDescription(report.condition);
    const date = report.date.toLocaleDateString('ja-JP');

    let message = `${emoji} **${userName}さんの日報** (${date})\n`;
    message += `**今日のコンディション:** ${description}\n`;

    if (report.progress) {
      message += `**進捗:** ${report.progress}\n`;
    }

    if (report.notes) {
      message += `**メモ:** ${report.notes}\n`;
    }

    return message;
  }

  generateDailyReportSummary(reports: DailyReport[]): string {
    if (reports.length === 0) {
      return '今日の日報はまだありません。';
    }

    const conditionCounts: Record<string, number> = {};
    reports.forEach(report => {
      conditionCounts[report.condition] = (conditionCounts[report.condition] || 0) + 1;
    });

    let summary = `📊 **今日のチーム状況** (${reports.length}名が報告)\n\n`;

    Object.entries(conditionCounts).forEach(([condition, count]) => {
      const emoji = this.getWeatherEmoji(condition);
      const description = this.getConditionDescription(condition);
      summary += `${emoji} ${description}: ${count}名\n`;
    });

    return summary;
  }
}