import { UserRepository } from '../../repositories/UserRepository';
import { ProfileRepository } from '../../repositories/ProfileRepository';
import { ShuffleResponseRepository } from '../../repositories/QuestionRepository';
import { CoffeeRepository } from '../../repositories/CoffeeRepository';
import { DailyReportRepository } from '../../repositories/DailyReportRepository';
import { SurveyRepository, SurveyResponseRepository } from '../../repositories/SurveyRepository';
import { logger } from '../../utils/logger';

export interface ExportConfig {
  format: 'csv' | 'json' | 'xlsx';
  includeUsers: boolean;
  includeProfiles: boolean;
  includeShuffleResponses: boolean;
  includeCoffee: boolean;
  includeDailyReports: boolean;
  includeSurveyResponses: boolean;
  startDate?: Date;
  endDate?: Date;
  anonymize: boolean;
}

export interface ExportResult {
  id: string;
  filename: string;
  content: string;
  format: string;
  size: number;
  exportedAt: Date;
  config: ExportConfig;
}

export class DataExporter {
  private userRepository: UserRepository;
  private profileRepository: ProfileRepository;
  private shuffleResponseRepository: ShuffleResponseRepository;
  private coffeeRepository: CoffeeRepository;
  private dailyReportRepository: DailyReportRepository;
  private surveyRepository: SurveyRepository;
  private surveyResponseRepository: SurveyResponseRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.profileRepository = new ProfileRepository();
    this.shuffleResponseRepository = new ShuffleResponseRepository();
    this.coffeeRepository = new CoffeeRepository();
    this.dailyReportRepository = new DailyReportRepository();
    this.surveyRepository = new SurveyRepository();
    this.surveyResponseRepository = new SurveyResponseRepository();
  }

  async exportData(config: ExportConfig): Promise<ExportResult> {
    try {
      logger.info('Starting data export', { 
        format: config.format,
        anonymize: config.anonymize
      });

      const exportId = this.generateExportId();
      
      // Collect data based on config
      const data = await this.collectExportData(config);
      
      // Generate export content based on format
      let content: string;
      let filename: string;
      
      switch (config.format) {
        case 'csv':
          content = this.generateCsvExport(data, config);
          filename = `knowledge-hub-export-${exportId}.csv`;
          break;
        case 'json':
          content = this.generateJsonExport(data, config);
          filename = `knowledge-hub-export-${exportId}.json`;
          break;
        case 'xlsx':
          // For XLSX, we'll generate a simplified CSV format
          // In a production system, you'd use a library like xlsx
          content = this.generateCsvExport(data, config);
          filename = `knowledge-hub-export-${exportId}.csv`;
          break;
        default:
          throw new Error(`Unsupported format: ${config.format}`);
      }

      const result: ExportResult = {
        id: exportId,
        filename,
        content,
        format: config.format,
        size: content.length,
        exportedAt: new Date(),
        config
      };

      logger.info('Data export completed', {
        exportId,
        format: config.format,
        size: result.size
      });

      return result;
    } catch (error) {
      logger.error('Error exporting data:', error);
      throw error;
    }
  }

  private async collectExportData(config: ExportConfig): Promise<{
    users?: any[];
    profiles?: any[];
    shuffleResponses?: any[];
    coffee?: any[];
    dailyReports?: any[];
    surveyResponses?: any[];
  }> {
    const data: any = {};

    if (config.includeUsers) {
      data.users = await this.userRepository.findAll();
    }

    if (config.includeProfiles) {
      data.profiles = await this.profileRepository.findAll();
    }

    if (config.includeShuffleResponses) {
      if (config.startDate && config.endDate) {
        const allResponses = await this.shuffleResponseRepository.findAll();
        data.shuffleResponses = allResponses.filter(r => 
          r.createdAt >= config.startDate! && r.createdAt <= config.endDate!
        );
      } else {
        data.shuffleResponses = await this.shuffleResponseRepository.findAll();
      }
    }

    if (config.includeCoffee) {
      if (config.startDate && config.endDate) {
        const allCoffee = await this.coffeeRepository.findAll();
        data.coffee = allCoffee.filter(c => 
          c.createdAt >= config.startDate! && c.createdAt <= config.endDate!
        );
      } else {
        data.coffee = await this.coffeeRepository.findAll();
      }
    }

    if (config.includeDailyReports) {
      if (config.startDate && config.endDate) {
        data.dailyReports = await this.dailyReportRepository.findByDateRange(config.startDate, config.endDate);
      } else {
        data.dailyReports = await this.dailyReportRepository.findAll();
      }
    }

    if (config.includeSurveyResponses) {
      if (config.startDate && config.endDate) {
        const allResponses = await this.surveyResponseRepository.findAll();
        data.surveyResponses = allResponses.filter(r => 
          r.createdAt >= config.startDate! && r.createdAt <= config.endDate!
        );
      } else {
        data.surveyResponses = await this.surveyResponseRepository.findAll();
      }
    }

    // Anonymize data if requested
    if (config.anonymize) {
      data = this.anonymizeData(data);
    }

    return data;
  }

  private generateCsvExport(data: any, config: ExportConfig): string {
    let csv = '';

    if (data.users) {
      csv += '=== USERS ===\n';
      csv += 'ID,Name,Email,Department,Role,Created At,Updated At\n';
      data.users.forEach((user: any) => {
        csv += `"${user.id}","${user.name}","${user.email || ''}","${user.department || ''}","${user.role || ''}","${user.createdAt}","${user.updatedAt}"\n`;
      });
      csv += '\n';
    }

    if (data.profiles) {
      csv += '=== PROFILES ===\n';
      csv += 'ID,User ID,Work Style,Communication Style,Expertise,Availability,Created At,Updated At\n';
      data.profiles.forEach((profile: any) => {
        const expertise = Array.isArray(profile.expertise) ? profile.expertise.join(';') : '';
        csv += `"${profile.id}","${profile.userId}","${profile.workStyle || ''}","${profile.communicationStyle || ''}","${expertise}","${profile.availability || ''}","${profile.createdAt}","${profile.updatedAt}"\n`;
      });
      csv += '\n';
    }

    if (data.shuffleResponses) {
      csv += '=== SHUFFLE RESPONSES ===\n';
      csv += 'ID,Question ID,User ID,Response,Channel ID,Message TS,Created At\n';
      data.shuffleResponses.forEach((response: any) => {
        const cleanResponse = response.response.replace(/"/g, '""').replace(/\n/g, ' ');
        csv += `"${response.id}","${response.questionId}","${response.userId}","${cleanResponse}","${response.channelId}","${response.messageTs || ''}","${response.createdAt}"\n`;
      });
      csv += '\n';
    }

    if (data.coffee) {
      csv += '=== COFFEE ===\n';
      csv += 'ID,Sender ID,Receiver ID,Message,Channel ID,Created At\n';
      data.coffee.forEach((coffee: any) => {
        const cleanMessage = coffee.message ? coffee.message.replace(/"/g, '""').replace(/\n/g, ' ') : '';
        csv += `"${coffee.id}","${coffee.senderId}","${coffee.receiverId}","${cleanMessage}","${coffee.channelId}","${coffee.createdAt}"\n`;
      });
      csv += '\n';
    }

    if (data.dailyReports) {
      csv += '=== DAILY REPORTS ===\n';
      csv += 'ID,User ID,Condition,Progress,Notes,Date,Created At\n';
      data.dailyReports.forEach((report: any) => {
        const cleanProgress = report.progress ? report.progress.replace(/"/g, '""').replace(/\n/g, ' ') : '';
        const cleanNotes = report.notes ? report.notes.replace(/"/g, '""').replace(/\n/g, ' ') : '';
        csv += `"${report.id}","${report.userId}","${report.condition}","${cleanProgress}","${cleanNotes}","${report.date}","${report.createdAt}"\n`;
      });
      csv += '\n';
    }

    if (data.surveyResponses) {
      csv += '=== SURVEY RESPONSES ===\n';
      csv += 'ID,Survey ID,User ID,Responses,Created At\n';
      data.surveyResponses.forEach((response: any) => {
        const responsesJson = JSON.stringify(response.responses).replace(/"/g, '""');
        csv += `"${response.id}","${response.surveyId}","${response.userId}","${responsesJson}","${response.createdAt}"\n`;
      });
      csv += '\n';
    }

    return csv;
  }

  private generateJsonExport(data: any, config: ExportConfig): string {
    const exportData = {
      exportInfo: {
        exportedAt: new Date().toISOString(),
        format: config.format,
        anonymized: config.anonymize,
        dateRange: config.startDate && config.endDate ? {
          startDate: config.startDate.toISOString(),
          endDate: config.endDate.toISOString()
        } : null
      },
      data
    };

    return JSON.stringify(exportData, null, 2);
  }

  private anonymizeData(data: any): any {
    const anonymized = JSON.parse(JSON.stringify(data)); // Deep clone

    // Anonymize users
    if (anonymized.users) {
      anonymized.users = anonymized.users.map((user: any, index: number) => ({
        ...user,
        name: `User${index + 1}`,
        email: user.email ? `user${index + 1}@example.com` : null
      }));
    }

    // Create user ID mapping for consistency
    const userIdMap = new Map<string, string>();
    if (anonymized.users) {
      anonymized.users.forEach((user: any, index: number) => {
        userIdMap.set(user.id, `user_${index + 1}`);
      });
    }

    // Apply anonymization to other data
    const anonymizeUserId = (obj: any) => {
      if (obj.userId && userIdMap.has(obj.userId)) {
        obj.userId = userIdMap.get(obj.userId);
      }
      if (obj.senderId && userIdMap.has(obj.senderId)) {
        obj.senderId = userIdMap.get(obj.senderId);
      }
      if (obj.receiverId && userIdMap.has(obj.receiverId)) {
        obj.receiverId = userIdMap.get(obj.receiverId);
      }
      if (obj.createdBy && userIdMap.has(obj.createdBy)) {
        obj.createdBy = userIdMap.get(obj.createdBy);
      }
      return obj;
    };

    if (anonymized.profiles) {
      anonymized.profiles = anonymized.profiles.map(anonymizeUserId);
    }
    if (anonymized.shuffleResponses) {
      anonymized.shuffleResponses = anonymized.shuffleResponses.map(anonymizeUserId);
    }
    if (anonymized.coffee) {
      anonymized.coffee = anonymized.coffee.map(anonymizeUserId);
    }
    if (anonymized.dailyReports) {
      anonymized.dailyReports = anonymized.dailyReports.map(anonymizeUserId);
    }
    if (anonymized.surveyResponses) {
      anonymized.surveyResponses = anonymized.surveyResponses.map(anonymizeUserId);
    }

    return anonymized;
  }

  private generateExportId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `export-${timestamp}-${random}`;
  }

  async getExportSummary(): Promise<{
    totalUsers: number;
    totalProfiles: number;
    totalShuffleResponses: number;
    totalCoffee: number;
    totalDailyReports: number;
    totalSurveyResponses: number;
    dataSize: string;
  }> {
    try {
      const [
        users,
        profiles,
        shuffleResponses,
        coffee,
        dailyReports,
        surveyResponses
      ] = await Promise.all([
        this.userRepository.findAll(),
        this.profileRepository.findAll(),
        this.shuffleResponseRepository.findAll(),
        this.coffeeRepository.findAll(),
        this.dailyReportRepository.findAll(),
        this.surveyResponseRepository.findAll()
      ]);

      // Estimate data size (rough calculation)
      const estimatedSize = 
        users.length * 200 + // ~200 bytes per user
        profiles.length * 500 + // ~500 bytes per profile
        shuffleResponses.length * 300 + // ~300 bytes per response
        coffee.length * 150 + // ~150 bytes per coffee
        dailyReports.length * 250 + // ~250 bytes per report
        surveyResponses.length * 400; // ~400 bytes per survey response

      const dataSizeFormatted = this.formatBytes(estimatedSize);

      return {
        totalUsers: users.length,
        totalProfiles: profiles.length,
        totalShuffleResponses: shuffleResponses.length,
        totalCoffee: coffee.length,
        totalDailyReports: dailyReports.length,
        totalSurveyResponses: surveyResponses.length,
        dataSize: dataSizeFormatted
      };
    } catch (error) {
      logger.error('Error getting export summary:', error);
      throw error;
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