import { SurveyRepository, SurveyResponseRepository } from '../repositories/SurveyRepository';
import { UserRepository } from '../repositories/UserRepository';
import { Survey, UpdateSurveyRequest, SurveyResponse, CreateSurveyResponseRequest, SurveyResults } from '../models/Survey';
import { SurveyBuilder, SurveyBuilderOptions } from './SurveyBuilder';
import { logger } from '../utils/logger';

export class SurveyService {
  private surveyRepository: SurveyRepository;
  private surveyResponseRepository: SurveyResponseRepository;
  private userRepository: UserRepository;
  private surveyBuilder: SurveyBuilder;

  constructor() {
    this.surveyRepository = new SurveyRepository();
    this.surveyResponseRepository = new SurveyResponseRepository();
    this.userRepository = new UserRepository();
    this.surveyBuilder = new SurveyBuilder();
  }

  async createSurvey(options: SurveyBuilderOptions): Promise<Survey> {
    try {
      return await this.surveyBuilder.createSurvey(options);
    } catch (error) {
      logger.error('Error creating survey:', error);
      throw error;
    }
  }

  async createSurveyFromTemplate(templateId: string, options: {
    title?: string;
    description?: string;
    channelId: string;
    createdBy: string;
    expiresAt?: Date;
  }): Promise<Survey> {
    try {
      return await this.surveyBuilder.createSurveyFromTemplate(templateId, options);
    } catch (error) {
      logger.error('Error creating survey from template:', error);
      throw error;
    }
  }

  async getSurvey(surveyId: string): Promise<Survey | null> {
    try {
      return await this.surveyRepository.findById(surveyId);
    } catch (error) {
      logger.error('Error getting survey:', error);
      throw error;
    }
  }

  async updateSurvey(surveyId: string, updateData: UpdateSurveyRequest): Promise<Survey> {
    try {
      const survey = await this.surveyRepository.update(surveyId, updateData);
      
      logger.info(`Survey updated: ${surveyId}`, {
        title: survey.title,
        isActive: survey.isActive
      });

      return survey;
    } catch (error) {
      logger.error('Error updating survey:', error);
      throw error;
    }
  }

  async deactivateSurvey(surveyId: string): Promise<Survey> {
    try {
      return await this.updateSurvey(surveyId, { isActive: false });
    } catch (error) {
      logger.error('Error deactivating survey:', error);
      throw error;
    }
  }

  async getActiveSurveys(): Promise<Survey[]> {
    try {
      return await this.surveyRepository.findActiveSurveys();
    } catch (error) {
      logger.error('Error getting active surveys:', error);
      throw error;
    }
  }

  async getSurveysByCreator(creatorId: string): Promise<Survey[]> {
    try {
      return await this.surveyRepository.findByCreator(creatorId);
    } catch (error) {
      logger.error('Error getting surveys by creator:', error);
      throw error;
    }
  }

  async getSurveysByChannel(channelId: string): Promise<Survey[]> {
    try {
      return await this.surveyRepository.findByChannelId(channelId);
    } catch (error) {
      logger.error('Error getting surveys by channel:', error);
      throw error;
    }
  }

  async submitSurveyResponse(responseData: CreateSurveyResponseRequest): Promise<SurveyResponse> {
    try {
      // Validate survey exists and is active
      const survey = await this.surveyRepository.findById(responseData.surveyId);
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
      const existingResponse = await this.surveyResponseRepository.findBySurveyIdAndUserId(
        responseData.surveyId,
        responseData.userId
      );

      if (existingResponse) {
        throw new Error('User has already responded to this survey');
      }

      // Validate user exists
      const user = await this.userRepository.findById(responseData.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Validate responses
      this.validateSurveyResponses(survey, responseData.responses);

      const response = await this.surveyResponseRepository.create(responseData);
      
      logger.info(`Survey response submitted: ${response.id}`, {
        surveyId: responseData.surveyId,
        userId: responseData.userId
      });

      return response;
    } catch (error) {
      logger.error('Error submitting survey response:', error);
      throw error;
    }
  }

  async getSurveyResults(surveyId: string): Promise<SurveyResults | null> {
    try {
      return await this.surveyResponseRepository.getSurveyResults(surveyId);
    } catch (error) {
      logger.error('Error getting survey results:', error);
      throw error;
    }
  }

  async getUserSurveyResponses(userId: string): Promise<SurveyResponse[]> {
    try {
      return await this.surveyResponseRepository.findByUserId(userId);
    } catch (error) {
      logger.error('Error getting user survey responses:', error);
      throw error;
    }
  }

  async hasUserResponded(surveyId: string, userId: string): Promise<boolean> {
    try {
      const response = await this.surveyResponseRepository.findBySurveyIdAndUserId(surveyId, userId);
      return response !== null;
    } catch (error) {
      logger.error('Error checking if user responded:', error);
      throw error;
    }
  }

  getTemplates() {
    return this.surveyBuilder.getTemplates();
  }

  getTemplate(templateId: string) {
    return this.surveyBuilder.getTemplate(templateId);
  }

  getTemplatesByCategory(category: string) {
    return this.surveyBuilder.getTemplatesByCategory(category);
  }

  buildSurveyModal(survey: Survey, hasResponded: boolean = false): any {
    if (hasResponded) {
      return {
        type: 'modal',
        title: {
          type: 'plain_text',
          text: 'アンケート'
        },
        close: {
          type: 'plain_text',
          text: '閉じる'
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${survey.title}*\n\n✅ このアンケートには既に回答済みです。`
            }
          }
        ]
      };
    }

    const questionBlocks = this.surveyBuilder.buildQuestionBlocks(survey.questions);

    return {
      type: 'modal',
      callback_id: 'survey_response_modal',
      title: {
        type: 'plain_text',
        text: survey.title.length > 24 ? survey.title.substring(0, 21) + '...' : survey.title
      },
      submit: {
        type: 'plain_text',
        text: '送信'
      },
      close: {
        type: 'plain_text',
        text: 'キャンセル'
      },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${survey.title}*${survey.description ? `\n${survey.description}` : ''}`
          }
        },
        {
          type: 'divider'
        },
        ...questionBlocks
      ],
      private_metadata: JSON.stringify({
        surveyId: survey.id
      })
    };
  }

  formatSurveyResults(results: SurveyResults): string {
    let message = `📊 **アンケート結果: ${results.survey.title}**\n\n`;
    message += `**📝 総回答数:** ${results.totalResponses}名\n`;
    
    // Calculate response rate if possible
    const responseRate = this.calculateResponseRate(results);
    if (responseRate > 0) {
      message += `**📈 回答率:** ${responseRate.toFixed(1)}%\n`;
    }
    message += '\n';

    results.survey.questions.forEach((question, index) => {
      message += `**${index + 1}. ${question.question}**\n`;
      
      const summary = results.summary[question.id];
      if (!summary) {
        message += '❌ 回答なし\n\n';
        return;
      }

      switch (summary.type) {
        case 'choice_counts':
          const sortedChoices = Object.entries(summary.data)
            .sort(([,a], [,b]) => (b as number) - (a as number));
          
          sortedChoices.forEach(([choice, count], idx) => {
            const percentage = ((count as number / results.totalResponses) * 100).toFixed(1);
            const bar = this.createProgressBar(count as number, results.totalResponses);
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '•';
            message += `${medal} ${choice}: **${count}名** (${percentage}%) ${bar}\n`;
          });
          break;

        case 'rating_average':
          const avgData = summary.data as { average: number; count: number };
          const stars = this.createStarRating(avgData.average);
          message += `${stars} **平均: ${avgData.average.toFixed(1)}点** (${avgData.count}名回答)\n`;
          
          // Show rating distribution if available
          if ((summary.data as any).distribution) {
            message += `\n📊 評価分布:\n`;
            const dist = (summary.data as any).distribution;
            for (let i = 5; i >= 1; i--) {
              const count = dist[i] || 0;
              const percentage = avgData.count > 0 ? ((count / avgData.count) * 100).toFixed(0) : '0';
              const bar = this.createProgressBar(count, avgData.count, 10);
              message += `${i}⭐: ${count}名 (${percentage}%) ${bar}\n`;
            }
          }
          break;

        case 'boolean_counts':
          const boolData = summary.data as { true: number; false: number };
          const truePercentage = ((boolData.true / results.totalResponses) * 100).toFixed(1);
          const falsePercentage = ((boolData.false / results.totalResponses) * 100).toFixed(1);
          const yesBar = this.createProgressBar(boolData.true, results.totalResponses);
          const noBar = this.createProgressBar(boolData.false, results.totalResponses);
          
          message += `✅ はい: **${boolData.true}名** (${truePercentage}%) ${yesBar}\n`;
          message += `❌ いいえ: **${boolData.false}名** (${falsePercentage}%) ${noBar}\n`;
          break;

        case 'text_responses':
          const textResponses = summary.data as string[];
          if (textResponses.length > 0) {
            message += `💬 **${textResponses.length}件の自由記述回答**\n\n`;
            
            // Show first few responses as examples with better formatting
            textResponses.slice(0, 3).forEach((response, idx) => {
              const truncated = response.length > 120 ? response.substring(0, 117) + '...' : response;
              message += `${idx + 1}. 「${truncated}」\n`;
            });
            
            if (textResponses.length > 3) {
              message += `\n... 他${textResponses.length - 3}件の回答があります\n`;
            }
          } else {
            message += '💭 自由記述の回答はありませんでした\n';
          }
          break;
      }
      
      message += '\n';
    });

    message += `\n📅 **集計完了日時:** ${new Date().toLocaleString('ja-JP')}\n`;
    return message;
  }

  private createProgressBar(value: number, total: number, length: number = 15): string {
    if (total === 0) return '';
    
    const percentage = value / total;
    const filledLength = Math.round(percentage * length);
    const emptyLength = length - filledLength;
    
    return '█'.repeat(filledLength) + '░'.repeat(emptyLength);
  }

  private createStarRating(rating: number): string {
    const fullStars = Math.floor(rating);
    const halfStar = rating - fullStars >= 0.5 ? 1 : 0;
    const emptyStars = 5 - fullStars - halfStar;
    
    return '⭐'.repeat(fullStars) + '⭐'.repeat(halfStar) + '☆'.repeat(emptyStars);
  }

  private calculateResponseRate(results: SurveyResults): number {
    // This is a placeholder - in a real implementation, you'd need to know the target audience size
    // For now, we'll return 0 to indicate we don't have this data
    return 0;
  }

  private validateSurveyResponses(survey: Survey, responses: Record<string, any>): void {
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