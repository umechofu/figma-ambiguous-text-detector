import { SurveyRepository, SurveyResponseRepository } from '../repositories/SurveyRepository';
import { UserRepository } from '../repositories/UserRepository';
import { Survey, SurveyResponse, SurveyResults } from '../models/Survey';
import { logger } from '../utils/logger';

export interface ResponseStats {
  surveyId: string;
  surveyTitle: string;
  totalResponses: number;
  responseRate: number;
  completionRate: number;
  averageCompletionTime?: number;
  lastResponseAt?: Date;
  topResponders: {
    userId: string;
    userName: string;
    responseTime: Date;
  }[];
}

export interface ResponseNotification {
  type: 'reminder' | 'deadline' | 'completion';
  surveyId: string;
  message: string;
  targetUsers?: string[];
}

export class ResponseCollector {
  private surveyRepository: SurveyRepository;
  private surveyResponseRepository: SurveyResponseRepository;
  private userRepository: UserRepository;

  constructor() {
    this.surveyRepository = new SurveyRepository();
    this.surveyResponseRepository = new SurveyResponseRepository();
    this.userRepository = new UserRepository();
  }

  async collectResponse(surveyId: string, userId: string, responses: Record<string, any>): Promise<SurveyResponse> {
    try {
      // Validate survey exists and is active
      const survey = await this.surveyRepository.findById(surveyId);
      if (!survey) {
        throw new Error('Survey not found');
      }

      if (!survey.isActive) {
        throw new Error('Survey is not active');
      }

      if (survey.expiresAt && survey.expiresAt < new Date()) {
        throw new Error('Survey has expired');
      }

      // Check if user already responded
      const existingResponse = await this.surveyResponseRepository.findBySurveyIdAndUserId(surveyId, userId);
      if (existingResponse) {
        throw new Error('User has already responded to this survey');
      }

      // Validate user exists
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Validate responses against survey questions
      this.validateResponses(survey, responses);

      // Create response
      const response = await this.surveyResponseRepository.create({
        surveyId,
        userId,
        responses
      });

      logger.info(`Survey response collected: ${response.id}`, {
        surveyId,
        userId,
        responseCount: Object.keys(responses).length
      });

      return response;
    } catch (error) {
      logger.error('Error collecting response:', error);
      throw error;
    }
  }

  async getResponseStats(surveyId: string): Promise<ResponseStats> {
    try {
      const survey = await this.surveyRepository.findById(surveyId);
      if (!survey) {
        throw new Error('Survey not found');
      }

      const responses = await this.surveyResponseRepository.findBySurveyId(surveyId);
      const allUsers = await this.userRepository.findAll();
      
      const totalResponses = responses.length;
      const responseRate = allUsers.length > 0 ? (totalResponses / allUsers.length) * 100 : 0;
      
      // Calculate completion rate (responses with all required questions answered)
      const requiredQuestions = survey.questions.filter(q => q.required);
      const completeResponses = responses.filter(response => {
        return requiredQuestions.every(question => {
          const answer = response.responses[question.id];
          return answer !== undefined && answer !== null && answer !== '';
        });
      });
      
      const completionRate = totalResponses > 0 ? (completeResponses.length / totalResponses) * 100 : 0;
      
      // Get top responders (first 5 to respond)
      const topResponders = responses
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(0, 5)
        .map(response => ({
          userId: response.userId,
          userName: (response as any).users?.name || 'Unknown User',
          responseTime: response.createdAt
        }));

      const lastResponseAt = responses.length > 0 ? 
        responses.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt : 
        undefined;

      return {
        surveyId,
        surveyTitle: survey.title,
        totalResponses,
        responseRate,
        completionRate,
        lastResponseAt,
        topResponders
      };
    } catch (error) {
      logger.error('Error getting response stats:', error);
      throw error;
    }
  }

  async getNonResponders(surveyId: string): Promise<{ userId: string; userName: string }[]> {
    try {
      const responses = await this.surveyResponseRepository.findBySurveyId(surveyId);
      const allUsers = await this.userRepository.findAll();
      
      const responderIds = new Set(responses.map(r => r.userId));
      
      return allUsers
        .filter(user => !responderIds.has(user.id))
        .map(user => ({
          userId: user.id,
          userName: user.name
        }));
    } catch (error) {
      logger.error('Error getting non-responders:', error);
      throw error;
    }
  }

  async generateReminderNotification(surveyId: string): Promise<ResponseNotification> {
    try {
      const survey = await this.surveyRepository.findById(surveyId);
      if (!survey) {
        throw new Error('Survey not found');
      }

      const nonResponders = await this.getNonResponders(surveyId);
      const stats = await this.getResponseStats(surveyId);
      
      const expiryText = survey.expiresAt ? 
        `\n⏰ 回答期限: ${survey.expiresAt.toLocaleDateString('ja-JP')}` : '';

      const message = `📋 **アンケートリマインダー**\n\n` +
        `「${survey.title}」への回答をお待ちしています。\n` +
        `現在の回答率: ${stats.responseRate.toFixed(1)}% (${stats.totalResponses}名が回答済み)${expiryText}\n\n` +
        `まだ回答されていない方は、ぜひご協力をお願いします！`;

      return {
        type: 'reminder',
        surveyId,
        message,
        targetUsers: nonResponders.map(nr => nr.userId)
      };
    } catch (error) {
      logger.error('Error generating reminder notification:', error);
      throw error;
    }
  }

  async generateDeadlineNotification(surveyId: string): Promise<ResponseNotification> {
    try {
      const survey = await this.surveyRepository.findById(surveyId);
      if (!survey) {
        throw new Error('Survey not found');
      }

      const nonResponders = await this.getNonResponders(surveyId);
      const stats = await this.getResponseStats(surveyId);
      
      const message = `⚠️ **アンケート回答期限間近**\n\n` +
        `「${survey.title}」の回答期限が近づいています。\n` +
        `期限: ${survey.expiresAt?.toLocaleDateString('ja-JP')}\n` +
        `現在の回答率: ${stats.responseRate.toFixed(1)}%\n\n` +
        `まだ回答されていない方は、お早めにご回答ください。`;

      return {
        type: 'deadline',
        surveyId,
        message,
        targetUsers: nonResponders.map(nr => nr.userId)
      };
    } catch (error) {
      logger.error('Error generating deadline notification:', error);
      throw error;
    }
  }

  async generateCompletionNotification(surveyId: string): Promise<ResponseNotification> {
    try {
      const survey = await this.surveyRepository.findById(surveyId);
      if (!survey) {
        throw new Error('Survey not found');
      }

      const stats = await this.getResponseStats(surveyId);
      const results = await this.surveyResponseRepository.getSurveyResults(surveyId);
      
      let message = `✅ **アンケート完了通知**\n\n` +
        `「${survey.title}」が終了しました。\n` +
        `最終回答率: ${stats.responseRate.toFixed(1)}% (${stats.totalResponses}名が回答)\n\n`;

      if (results && results.summary) {
        message += `**主な結果:**\n`;
        
        // Show summary for first few questions
        const summaryQuestions = survey.questions.slice(0, 3);
        summaryQuestions.forEach((question, index) => {
          const summary = results.summary[question.id];
          if (summary) {
            message += `${index + 1}. ${question.question}\n`;
            
            switch (summary.type) {
              case 'rating_average':
                const avgData = summary.data as { average: number };
                message += `   平均: ${avgData.average.toFixed(1)}点\n`;
                break;
              case 'choice_counts':
                const topChoice = Object.entries(summary.data)
                  .sort(([,a], [,b]) => (b as number) - (a as number))[0];
                if (topChoice) {
                  message += `   最多回答: ${topChoice[0]} (${topChoice[1]}名)\n`;
                }
                break;
              case 'boolean_counts':
                const boolData = summary.data as { true: number; false: number };
                const yesPercentage = ((boolData.true / stats.totalResponses) * 100).toFixed(1);
                message += `   はい: ${yesPercentage}%\n`;
                break;
            }
          }
        });
      }

      message += `\n詳細な結果は管理者にお問い合わせください。`;

      return {
        type: 'completion',
        surveyId,
        message
      };
    } catch (error) {
      logger.error('Error generating completion notification:', error);
      throw error;
    }
  }

  async getExpiringSurveys(hoursBeforeExpiry: number = 24): Promise<Survey[]> {
    try {
      const surveys = await this.surveyRepository.findActiveSurveys();
      const now = new Date();
      const cutoffTime = new Date(now.getTime() + (hoursBeforeExpiry * 60 * 60 * 1000));

      return surveys.filter(survey => 
        survey.expiresAt && 
        survey.expiresAt > now && 
        survey.expiresAt <= cutoffTime
      );
    } catch (error) {
      logger.error('Error getting expiring surveys:', error);
      throw error;
    }
  }

  async getExpiredSurveys(): Promise<Survey[]> {
    try {
      const surveys = await this.surveyRepository.findActiveSurveys();
      const now = new Date();

      return surveys.filter(survey => 
        survey.expiresAt && survey.expiresAt < now
      );
    } catch (error) {
      logger.error('Error getting expired surveys:', error);
      throw error;
    }
  }

  async autoDeactivateExpiredSurveys(): Promise<Survey[]> {
    try {
      const expiredSurveys = await this.getExpiredSurveys();
      const deactivatedSurveys: Survey[] = [];

      for (const survey of expiredSurveys) {
        const updated = await this.surveyRepository.update(survey.id, { isActive: false });
        deactivatedSurveys.push(updated);
        
        logger.info(`Survey auto-deactivated due to expiry: ${survey.id}`, {
          title: survey.title,
          expiresAt: survey.expiresAt
        });
      }

      return deactivatedSurveys;
    } catch (error) {
      logger.error('Error auto-deactivating expired surveys:', error);
      throw error;
    }
  }

  formatResponseStats(stats: ResponseStats): string {
    let message = `📊 **アンケート回答状況**\n\n`;
    message += `**タイトル:** ${stats.surveyTitle}\n`;
    message += `**回答数:** ${stats.totalResponses}名\n`;
    message += `**回答率:** ${stats.responseRate.toFixed(1)}%\n`;
    message += `**完了率:** ${stats.completionRate.toFixed(1)}%\n`;

    if (stats.lastResponseAt) {
      message += `**最新回答:** ${stats.lastResponseAt.toLocaleString('ja-JP')}\n`;
    }

    if (stats.topResponders.length > 0) {
      message += `\n**早期回答者:**\n`;
      stats.topResponders.forEach((responder, index) => {
        message += `${index + 1}. ${responder.userName} (${responder.responseTime.toLocaleString('ja-JP')})\n`;
      });
    }

    return message;
  }

  private validateResponses(survey: Survey, responses: Record<string, any>): void {
    survey.questions.forEach(question => {
      const response = responses[question.id];
      
      if (question.required && (response === undefined || response === null || response === '')) {
        throw new Error(`Question "${question.question}" is required`);
      }

      if (response !== undefined && response !== null && response !== '') {
        switch (question.type) {
          case 'single_choice':
            if (!question.options?.includes(response)) {
              throw new Error(`Invalid option for question "${question.question}"`);
            }
            break;

          case 'multiple_choice':
            if (!Array.isArray(response) || 
                !response.every(option => question.options?.includes(option))) {
              throw new Error(`Invalid options for question "${question.question}"`);
            }
            break;

          case 'rating':
            const rating = Number(response);
            if (isNaN(rating) || rating < 1 || rating > 5) {
              throw new Error(`Rating must be between 1 and 5 for question "${question.question}"`);
            }
            break;

          case 'boolean':
            if (response !== 'true' && response !== 'false') {
              throw new Error(`Boolean response must be true or false for question "${question.question}"`);
            }
            break;

          case 'text':
            if (typeof response !== 'string') {
              throw new Error(`Text response must be a string for question "${question.question}"`);
            }
            if (response.length > 1000) {
              throw new Error(`Text response is too long for question "${question.question}"`);
            }
            break;
        }
      }
    });
  }
}