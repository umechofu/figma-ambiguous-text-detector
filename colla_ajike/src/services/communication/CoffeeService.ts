import { WebClient } from '@slack/web-api';
import { CoffeeRepository } from '../../repositories/CoffeeRepository';
import { UserRepository } from '../../repositories/UserRepository';
import { Coffee, CreateCoffeeRequest, CoffeeStats } from '../models/Coffee';
import { User } from '../models/User';
import { logger } from '../../utils/logger';
import { config } from '../../config/environment';

export class CoffeeService {
  private slackClient: WebClient;
  private coffeeRepository: CoffeeRepository;
  private userRepository: UserRepository;

  constructor() {
    this.slackClient = new WebClient(config.slack.botToken);
    this.coffeeRepository = new CoffeeRepository();
    this.userRepository = new UserRepository();
  }

  /**
   * Send coffee to a user
   */
  async sendCoffee(senderId: string, receiverId: string, message: string, channelId: string): Promise<Coffee | null> {
    try {
      logger.info(`Sending coffee from ${senderId} to ${receiverId}`);

      // Validate users exist
      const [sender, receiver] = await Promise.all([
        this.userRepository.findBySlackId(senderId),
        this.userRepository.findBySlackId(receiverId)
      ]);

      if (!sender) {
        throw new Error('Sender not found');
      }

      if (!receiver) {
        throw new Error('Receiver not found');
      }

      // Prevent self-sending
      if (sender.id === receiver.id) {
        throw new Error('Cannot send coffee to yourself');
      }

      // Create coffee record
      const coffeeData: CreateCoffeeRequest = {
        senderId: sender.id,
        receiverId: receiver.id,
        message: message.trim(),
        channelId
      };

      const coffee = await this.coffeeRepository.create(coffeeData);

      // Send notification to receiver
      await this.notifyReceiver(sender, receiver, message);

      // Post to channel
      await this.postCoffeeToChannel(sender, receiver, message, channelId);

      logger.info(`Coffee sent successfully: ${coffee.id}`);
      return coffee;
    } catch (error) {
      logger.error('Error sending coffee:', error);
      return null;
    }
  }

  /**
   * Send coffee notification to receiver via DM
   */
  private async notifyReceiver(sender: User, receiver: User, message: string): Promise<void> {
    try {
      await this.slackClient.chat.postMessage({
        channel: receiver.slackId,
        text: `☕ ${sender.name}さんからホットコーヒーが届きました！`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `☕ **<@${sender.slackId}>さんからホットコーヒーが届きました！**`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `💬 *メッセージ:*\n${message}`
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: '感謝の気持ちを込めて ☕'
              }
            ]
          }
        ]
      });
    } catch (error) {
      logger.error('Error sending coffee notification:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Post coffee to channel
   */
  private async postCoffeeToChannel(sender: User, receiver: User, message: string, channelId: string): Promise<void> {
    try {
      await this.slackClient.chat.postMessage({
        channel: channelId,
        text: `☕ ${sender.name}さんが${receiver.name}さんにホットコーヒーを送りました`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `☕ **<@${sender.slackId}>さんが<@${receiver.slackId}>さんにホットコーヒーを送りました**`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `💬 *メッセージ:*\n${message}`
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: 'ナレッジ共有と協力に感謝 ☕'
              }
            ]
          }
        ]
      });
    } catch (error) {
      logger.error('Error posting coffee to channel:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Get coffee statistics for a user
   */
  async getUserCoffeeStats(userId: string, startDate?: Date, endDate?: Date): Promise<CoffeeStats | null> {
    try {
      const user = await this.userRepository.findBySlackId(userId);
      if (!user) {
        return null;
      }

      return await this.coffeeRepository.getCoffeeStats(user.id, startDate, endDate);
    } catch (error) {
      logger.error(`Error getting coffee stats for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get recent coffee activity
   */
  async getRecentCoffee(limit: number = 10): Promise<Coffee[]> {
    try {
      return await this.coffeeRepository.getRecentCoffee(limit);
    } catch (error) {
      logger.error('Error getting recent coffee:', error);
      return [];
    }
  }

  /**
   * Get coffee sent by user
   */
  async getCoffeeSentByUser(userId: string, limit?: number): Promise<Coffee[]> {
    try {
      const user = await this.userRepository.findBySlackId(userId);
      if (!user) {
        return [];
      }

      return await this.coffeeRepository.findBySenderId(user.id, limit);
    } catch (error) {
      logger.error(`Error getting coffee sent by user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get coffee received by user
   */
  async getCoffeeReceivedByUser(userId: string, limit?: number): Promise<Coffee[]> {
    try {
      const user = await this.userRepository.findBySlackId(userId);
      if (!user) {
        return [];
      }

      return await this.coffeeRepository.findByReceiverId(user.id, limit);
    } catch (error) {
      logger.error(`Error getting coffee received by user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get monthly coffee ranking
   */
  async getMonthlyRanking(year: number, month: number): Promise<CoffeeStats[]> {
    try {
      return await this.coffeeRepository.getMonthlyRanking(year, month);
    } catch (error) {
      logger.error(`Error getting monthly ranking for ${year}-${month}:`, error);
      return [];
    }
  }

  /**
   * Get current month ranking
   */
  async getCurrentMonthRanking(): Promise<CoffeeStats[]> {
    const now = new Date();
    return this.getMonthlyRanking(now.getFullYear(), now.getMonth() + 1);
  }

  /**
   * Validate coffee message
   */
  validateCoffeeMessage(message: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!message || message.trim().length === 0) {
      errors.push('メッセージは必須です');
    }

    if (message.length > 500) {
      errors.push('メッセージは500文字以内で入力してください');
    }

    // Check for inappropriate content (basic check)
    const inappropriateWords = ['バカ', 'アホ', '死ね', 'クソ'];
    const hasInappropriate = inappropriateWords.some(word => 
      message.toLowerCase().includes(word.toLowerCase())
    );

    if (hasInappropriate) {
      errors.push('不適切な内容が含まれています');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Parse coffee command text
   */
  parseCoffeeCommand(text: string): { userId: string | null; message: string; error?: string } {
    const trimmedText = text.trim();
    
    if (!trimmedText) {
      return {
        userId: null,
        message: '',
        error: 'ユーザーをメンションしてメッセージを入力してください。\n例: `/coffee @john いつもありがとうございます！`'
      };
    }

    // Try to extract user mention (Slack ID format: <@U12345678>)
    let userMentionMatch = trimmedText.match(/<@([UW][A-Z0-9]+)(\|[^>]+)?>/);
    let userId: string | null = null;
    let remainingText = trimmedText;
    
    if (userMentionMatch) {
      // Found Slack ID format
      userId = userMentionMatch[1];
      remainingText = trimmedText.replace(userMentionMatch[0], '').trim();
    } else {
      // Try to find username format (@username)
      const usernameMatch = trimmedText.match(/@(\w+)/);
      if (usernameMatch) {
        // Return special marker for username that needs resolution
        userId = `@${usernameMatch[1]}`;
        remainingText = trimmedText.replace(usernameMatch[0], '').trim();
      } else {
        return {
          userId: null,
          message: '',
          error: 'ユーザーをメンションしてください。\n例: `/coffee @john いつもありがとうございます！`'
        };
      }
    }

    if (!remainingText) {
      return {
        userId,
        message: '',
        error: 'メッセージを入力してください。\n例: `/coffee @john いつもありがとうございます！`'
      };
    }

    return {
      userId,
      message: remainingText
    };
  }

  /**
   * Format coffee stats for display
   */
  formatCoffeeStats(stats: CoffeeStats): string {
    return `☕ **${stats.userName}さんのホットコーヒー統計**\n\n• 受け取ったコーヒー: ${stats.totalReceived}杯\n• 送ったコーヒー: ${stats.totalSent}杯\n• 感謝度ランキング: ${stats.rank ? `${stats.rank}位` : '未ランク'}`;
  }

  /**
   * Format ranking for display
   */
  formatRanking(ranking: CoffeeStats[], period: string): string {
    if (ranking.length === 0) {
      return `🏆 **${period}のコーヒーアワード**\n\nまだデータがありません。`;
    }

    const rankingText = ranking.slice(0, 10).map((stats, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      return `${medal} ${stats.userName} - ${stats.totalReceived}杯`;
    }).join('\n');

    return `🏆 **${period}のコーヒーアワード**\n\n${rankingText}\n\n_感謝の気持ちを表現してくれた皆さん、ありがとうございます！_`;
  }

  /**
   * Get coffee giving suggestions
   */
  getCoffeeGivingSuggestions(): string[] {
    return [
      '質問に丁寧に答えてくれた時',
      'ドキュメントを整備してくれた時',
      'バグを見つけて報告してくれた時',
      'チームの雰囲気を良くしてくれた時',
      '新しいアイデアを提案してくれた時',
      'サポートやヘルプをしてくれた時',
      '知識やスキルを共有してくれた時',
      'プロジェクトを成功に導いてくれた時'
    ];
  }

  /**
   * Get coffee statistics summary
   */
  async getCoffeeStatsSummary(): Promise<{
    totalCoffee: number;
    totalUsers: number;
    averageCoffeePerUser: number;
    topGiver: CoffeeStats | null;
    topReceiver: CoffeeStats | null;
  }> {
    try {
      const [allCoffee, currentRanking] = await Promise.all([
        this.coffeeRepository.findAll(),
        this.getCurrentMonthRanking()
      ]);

      const totalUsers = await this.userRepository.findAll();
      const averageCoffeePerUser = totalUsers.length > 0 ? allCoffee.length / totalUsers.length : 0;

      // Find top giver and receiver from current month
      const topReceiver = currentRanking.length > 0 ? currentRanking[0] : null;
      const topGiver = currentRanking.length > 0 
        ? currentRanking.reduce((prev, current) => 
            current.totalSent > prev.totalSent ? current : prev
          )
        : null;

      return {
        totalCoffee: allCoffee.length,
        totalUsers: totalUsers.length,
        averageCoffeePerUser: Math.round(averageCoffeePerUser * 100) / 100,
        topGiver,
        topReceiver
      };
    } catch (error) {
      logger.error('Error getting coffee stats summary:', error);
      return {
        totalCoffee: 0,
        totalUsers: 0,
        averageCoffeePerUser: 0,
        topGiver: null,
        topReceiver: null
      };
    }
  }
}