import { WebClient } from '@slack/web-api';
import { QuestionRepository, ShuffleResponseRepository } from '../repositories/QuestionRepository';
import { UserRepository } from '../repositories/UserRepository';
import { Question, ShuffleResponse, CreateShuffleResponseRequest } from '../models/Question';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

export class ShuffleService {
  private slackClient: WebClient;
  private questionRepository: QuestionRepository;
  private shuffleResponseRepository: ShuffleResponseRepository;
  private userRepository: UserRepository;

  constructor() {
    this.slackClient = new WebClient(config.slack.botToken);
    this.questionRepository = new QuestionRepository();
    this.shuffleResponseRepository = new ShuffleResponseRepository();
    this.userRepository = new UserRepository();
  }

  /**
   * Execute shuffle - select random user and question, send question
   */
  async executeShuffleRound(channelId: string, excludeUserIds: string[] = []): Promise<{ user: User; question: Question } | null> {
    try {
      logger.info(`Starting shuffle round for channel: ${channelId}`);

      // Get random question
      const question = await this.questionRepository.getRandomQuestion();
      if (!question) {
        logger.warn('No active questions available for shuffle');
        return null;
      }

      // Get random user
      const user = await this.selectRandomUser(excludeUserIds);
      if (!user) {
        logger.warn('No users available for shuffle');
        return null;
      }

      // Send question to user via DM
      await this.sendQuestionToUser(user, question, channelId);

      logger.info(`Shuffle round completed: User ${user.name} received question ${question.id}`);
      return { user, question };
    } catch (error) {
      logger.error('Error executing shuffle round:', error);
      return null;
    }
  }

  /**
   * Send question to user via direct message
   */
  private async sendQuestionToUser(user: User, question: Question, channelId: string): Promise<void> {
    try {
      const message = this.formatQuestionMessage(question, channelId);

      const result = await this.slackClient.chat.postMessage({
        channel: user.slackId,
        ...message
      });

      if (!result.ok) {
        throw new Error(`Failed to send message: ${result.error}`);
      }

      logger.info(`Question sent to user ${user.slackId} (${user.name})`);
    } catch (error) {
      logger.error(`Error sending question to user ${user.slackId}:`, error);
      throw error;
    }
  }

  /**
   * Format question message for Slack
   */
  private formatQuestionMessage(question: Question, channelId: string) {
    const categoryName = this.getCategoryDisplayName(question.category);
    
    return {
      text: `🔀 **シャッフル質問が届きました！**`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🔀 シャッフル質問'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*カテゴリー:* ${categoryName}\n\n*質問:*\n${question.content}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '回答は <#' + channelId + '> チャンネルで共有されます。\n\n💡 *回答のコツ:*\n• 具体的な例があると分かりやすいです\n• 失敗談や学んだことも歓迎です\n• 短くても大丈夫です！'
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '回答する'
              },
              style: 'primary',
              action_id: 'shuffle_respond',
              value: JSON.stringify({
                questionId: question.id,
                channelId: channelId
              })
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '今回はスキップ'
              },
              action_id: 'shuffle_skip',
              value: JSON.stringify({
                questionId: question.id,
                channelId: channelId
              })
            }
          ]
        }
      ]
    };
  }

  /**
   * Handle user response to shuffle question
   */
  async handleShuffleResponse(userId: string, questionId: string, response: string, channelId: string): Promise<ShuffleResponse | null> {
    try {
      logger.info(`Processing shuffle response from user ${userId} for question ${questionId}`);

      // Get user and question
      const [user, question] = await Promise.all([
        this.userRepository.findBySlackId(userId),
        this.questionRepository.findById(questionId)
      ]);

      if (!user || !question) {
        logger.error('User or question not found for shuffle response');
        return null;
      }

      // Save response to database
      const shuffleResponse = await this.shuffleResponseRepository.create({
        questionId,
        userId: user.id,
        response,
        channelId
      });

      // Post response to channel
      await this.postResponseToChannel(user, question, response, channelId);

      logger.info(`Shuffle response processed successfully: ${shuffleResponse.id}`);
      return shuffleResponse;
    } catch (error) {
      logger.error('Error handling shuffle response:', error);
      return null;
    }
  }

  /**
   * Post user response to channel
   */
  private async postResponseToChannel(user: User, question: Question, response: string, channelId: string): Promise<void> {
    try {
      const categoryName = this.getCategoryDisplayName(question.category);

      const result = await this.slackClient.chat.postMessage({
        channel: channelId,
        text: `💡 ${user.name}さんからのシャッフル回答`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `💡 *<@${user.slackId}>さんからのシャッフル回答*`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*質問 (${categoryName}):*\n${question.content}`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*回答:*\n${response}`
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: '🔀 シャッフル機能による質問でした'
              }
            ]
          }
        ]
      });

      if (result.ok && result.ts) {
        // Update response with message timestamp
        await this.shuffleResponseRepository.create({
          questionId: question.id,
          userId: user.id,
          response,
          channelId,
          messageTs: result.ts
        });
      }
    } catch (error) {
      logger.error('Error posting response to channel:', error);
      throw error;
    }
  }

  /**
   * Select random user for shuffle
   */
  private async selectRandomUser(excludeUserIds: string[] = []): Promise<User | null> {
    try {
      const allUsers = await this.userRepository.findAll();
      
      // Filter out excluded users
      const availableUsers = allUsers.filter(user => 
        !excludeUserIds.includes(user.id) && !excludeUserIds.includes(user.slackId)
      );

      if (availableUsers.length === 0) {
        return null;
      }

      // Select random user
      const randomIndex = Math.floor(Math.random() * availableUsers.length);
      return availableUsers[randomIndex];
    } catch (error) {
      logger.error('Error selecting random user:', error);
      return null;
    }
  }

  /**
   * Get recent shuffle responses
   */
  async getRecentResponses(limit: number = 10): Promise<ShuffleResponse[]> {
    try {
      return await this.shuffleResponseRepository.findRecentResponses(limit);
    } catch (error) {
      logger.error('Error getting recent responses:', error);
      return [];
    }
  }

  /**
   * Get user's shuffle history
   */
  async getUserShuffleHistory(userId: string, limit?: number): Promise<ShuffleResponse[]> {
    try {
      const user = await this.userRepository.findBySlackId(userId);
      if (!user) {
        return [];
      }

      return await this.shuffleResponseRepository.findByUserId(user.id, limit);
    } catch (error) {
      logger.error(`Error getting shuffle history for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get shuffle statistics
   */
  async getShuffleStats(): Promise<{
    totalQuestions: number;
    activeQuestions: number;
    totalResponses: number;
    totalUsers: number;
    responseRate: number;
  }> {
    try {
      const [questions, responses, users] = await Promise.all([
        this.questionRepository.findAll(),
        this.shuffleResponseRepository.findAll(),
        this.userRepository.findAll()
      ]);

      const activeQuestions = questions.filter(q => q.isActive).length;
      const responseRate = users.length > 0 ? (responses.length / users.length) * 100 : 0;

      return {
        totalQuestions: questions.length,
        activeQuestions,
        totalResponses: responses.length,
        totalUsers: users.length,
        responseRate: Math.round(responseRate * 100) / 100
      };
    } catch (error) {
      logger.error('Error getting shuffle stats:', error);
      return {
        totalQuestions: 0,
        activeQuestions: 0,
        totalResponses: 0,
        totalUsers: 0,
        responseRate: 0
      };
    }
  }

  /**
   * Get category display name
   */
  private getCategoryDisplayName(category: string): string {
    const categoryNames: Record<string, string> = {
      'technology': '技術・ツール',
      'productivity': '業務効率化',
      'learning': '学習・成長',
      'communication': 'コミュニケーション',
      'creativity': '創造性・アイデア',
      'worklife': 'ワークライフバランス',
      'general': '一般'
    };

    return categoryNames[category] || category;
  }
}