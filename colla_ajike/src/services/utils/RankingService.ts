import { WebClient } from '@slack/web-api';
import { CoffeeRepository } from '../../repositories/CoffeeRepository';
import { CoffeeStats, CoffeeRanking } from '../models/Coffee';
import { logger } from '../../utils/logger';
import { config } from '../../config/environment';

export class RankingService {
  private slackClient: WebClient;
  private coffeeRepository: CoffeeRepository;

  constructor() {
    this.slackClient = new WebClient(config.slack.botToken);
    this.coffeeRepository = new CoffeeRepository();
  }

  /**
   * Generate monthly coffee ranking
   */
  async generateMonthlyRanking(year: number, month: number): Promise<CoffeeRanking> {
    try {
      logger.info(`Generating monthly ranking for ${year}-${month}`);

      const rankings = await this.coffeeRepository.getMonthlyRanking(year, month);
      
      const ranking: CoffeeRanking = {
        period: `${year}-${month.toString().padStart(2, '0')}`,
        rankings,
        generatedAt: new Date()
      };

      logger.info(`Monthly ranking generated: ${rankings.length} users`);
      return ranking;
    } catch (error) {
      logger.error(`Error generating monthly ranking for ${year}-${month}:`, error);
      throw error;
    }
  }

  /**
   * Generate current month ranking
   */
  async generateCurrentMonthRanking(): Promise<CoffeeRanking> {
    const now = new Date();
    return this.generateMonthlyRanking(now.getFullYear(), now.getMonth() + 1);
  }

  /**
   * Announce monthly coffee awards in channel
   */
  async announceMonthlyAwards(channelId: string, year: number, month: number): Promise<boolean> {
    try {
      logger.info(`Announcing monthly awards for ${year}-${month} in channel ${channelId}`);

      const ranking = await this.generateMonthlyRanking(year, month);
      
      if (ranking.rankings.length === 0) {
        await this.slackClient.chat.postMessage({
          channel: channelId,
          text: '🏆 今月のコーヒーアワード',
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `🏆 ${year}年${month}月のコーヒーアワード`
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '今月はまだホットコーヒーの記録がありません。\n\n感謝の気持ちを込めて、チームメンバーにホットコーヒーを送ってみましょう！'
              }
            }
          ]
        });
        return true;
      }

      const blocks = this.buildAwardAnnouncementBlocks(ranking);
      
      await this.slackClient.chat.postMessage({
        channel: channelId,
        text: `🏆 ${year}年${month}月のコーヒーアワード`,
        blocks
      });

      logger.info(`Monthly awards announced successfully in channel ${channelId}`);
      return true;
    } catch (error) {
      logger.error(`Error announcing monthly awards for ${year}-${month}:`, error);
      return false;
    }
  }

  /**
   * Announce current month awards
   */
  async announceCurrentMonthAwards(channelId: string): Promise<boolean> {
    const now = new Date();
    return this.announceMonthlyAwards(channelId, now.getFullYear(), now.getMonth() + 1);
  }

  /**
   * Build award announcement blocks
   */
  private buildAwardAnnouncementBlocks(ranking: CoffeeRanking): any[] {
    const blocks = [];
    const [year, month] = ranking.period.split('-');

    // Header
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: `🏆 ${year}年${month}月のコーヒーアワード`
      }
    });

    // Introduction
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '今月も多くの感謝の気持ちが交換されました！\nチームワークと知識共有に貢献してくれた皆さんを称えます。'
      }
    });

    blocks.push({ type: 'divider' });

    // Top 3 winners
    const top3 = ranking.rankings.slice(0, 3);
    if (top3.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*🏅 TOP 3*'
        }
      });

      top3.forEach((winner, index) => {
        const medals = ['🥇', '🥈', '🥉'];
        const medal = medals[index];
        
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${medal} *${winner.userName}* - ${winner.totalReceived}杯`
          },
          accessory: {
            type: 'image',
            image_url: 'https://via.placeholder.com/50x50/FFD700/000000?text=☕',
            alt_text: 'coffee'
          }
        });
      });

      blocks.push({ type: 'divider' });
    }

    // Full ranking (top 10)
    const top10 = ranking.rankings.slice(0, 10);
    if (top10.length > 3) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*📊 完全ランキング (TOP 10)*'
        }
      });

      const rankingText = top10.map((user, index) => {
        const position = index + 1;
        const medal = position <= 3 ? ['🥇', '🥈', '🥉'][index] : `${position}.`;
        return `${medal} ${user.userName} - ${user.totalReceived}杯 (送信: ${user.totalSent}杯)`;
      }).join('\n');

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `\`\`\`\n${rankingText}\n\`\`\``
        }
      });
    }

    // Statistics
    const totalCoffee = ranking.rankings.reduce((sum, user) => sum + user.totalReceived, 0);
    const totalParticipants = ranking.rankings.length;
    const averageCoffee = totalParticipants > 0 ? (totalCoffee / totalParticipants).toFixed(1) : '0';

    blocks.push({ type: 'divider' });
    
    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*総コーヒー数*\n${totalCoffee}杯`
        },
        {
          type: 'mrkdwn',
          text: `*参加者数*\n${totalParticipants}人`
        },
        {
          type: 'mrkdwn',
          text: `*平均受信数*\n${averageCoffee}杯`
        },
        {
          type: 'mrkdwn',
          text: `*生成日時*\n${ranking.generatedAt.toLocaleDateString('ja-JP')}`
        }
      ]
    });

    // Footer message
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '来月もチームメンバーへの感謝の気持ちを忘れずに！ `/coffee @ユーザー名 メッセージ` でホットコーヒーを送りましょう ☕'
        }
      ]
    });

    return blocks;
  }

  /**
   * Get ranking statistics
   */
  async getRankingStats(year: number, month: number): Promise<{
    totalCoffee: number;
    totalParticipants: number;
    averageCoffeeReceived: number;
    averageCoffeeSent: number;
    topReceiver: CoffeeStats | null;
    topSender: CoffeeStats | null;
  }> {
    try {
      const ranking = await this.generateMonthlyRanking(year, month);
      
      const totalCoffee = ranking.rankings.reduce((sum, user) => sum + user.totalReceived, 0);
      const totalSent = ranking.rankings.reduce((sum, user) => sum + user.totalSent, 0);
      const totalParticipants = ranking.rankings.length;
      
      const averageCoffeeReceived = totalParticipants > 0 ? totalCoffee / totalParticipants : 0;
      const averageCoffeeSent = totalParticipants > 0 ? totalSent / totalParticipants : 0;
      
      const topReceiver = ranking.rankings.length > 0 ? ranking.rankings[0] : null;
      const topSender = ranking.rankings.length > 0 
        ? ranking.rankings.reduce((prev, current) => 
            current.totalSent > prev.totalSent ? current : prev
          )
        : null;

      return {
        totalCoffee,
        totalParticipants,
        averageCoffeeReceived: Math.round(averageCoffeeReceived * 100) / 100,
        averageCoffeeSent: Math.round(averageCoffeeSent * 100) / 100,
        topReceiver,
        topSender
      };
    } catch (error) {
      logger.error(`Error getting ranking stats for ${year}-${month}:`, error);
      return {
        totalCoffee: 0,
        totalParticipants: 0,
        averageCoffeeReceived: 0,
        averageCoffeeSent: 0,
        topReceiver: null,
        topSender: null
      };
    }
  }

  /**
   * Schedule monthly award announcement
   */
  async scheduleMonthlyAwards(channelId: string): Promise<void> {
    // This would typically be implemented with a cron job or scheduled task
    // For now, we'll just log the intention
    logger.info(`Monthly awards scheduled for channel: ${channelId}`);
    
    // In a real implementation, you might use node-cron or similar:
    // cron.schedule('0 9 1 * *', async () => {
    //   const now = new Date();
    //   const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
    //   await this.announceMonthlyAwards(channelId, lastMonth.getFullYear(), lastMonth.getMonth() + 1);
    // });
  }

  /**
   * Get user's ranking position
   */
  async getUserRankingPosition(userId: string, year: number, month: number): Promise<{
    position: number | null;
    stats: CoffeeStats | null;
    totalParticipants: number;
  }> {
    try {
      const ranking = await this.generateMonthlyRanking(year, month);
      
      const userStats = ranking.rankings.find(stats => stats.userId === userId);
      const position = userStats ? userStats.rank : null;
      
      return {
        position,
        stats: userStats || null,
        totalParticipants: ranking.rankings.length
      };
    } catch (error) {
      logger.error(`Error getting user ranking position for ${userId}:`, error);
      return {
        position: null,
        stats: null,
        totalParticipants: 0
      };
    }
  }

  /**
   * Compare rankings between months
   */
  async compareMonthlyRankings(year1: number, month1: number, year2: number, month2: number): Promise<{
    period1: string;
    period2: string;
    growth: number;
    topMovers: Array<{ userName: string; change: number }>;
  }> {
    try {
      const [ranking1, ranking2] = await Promise.all([
        this.generateMonthlyRanking(year1, month1),
        this.generateMonthlyRanking(year2, month2)
      ]);

      const total1 = ranking1.rankings.reduce((sum, user) => sum + user.totalReceived, 0);
      const total2 = ranking2.rankings.reduce((sum, user) => sum + user.totalReceived, 0);
      const growth = total1 > 0 ? ((total2 - total1) / total1) * 100 : 0;

      // Calculate position changes
      const topMovers: Array<{ userName: string; change: number }> = [];
      
      ranking2.rankings.forEach(user2 => {
        const user1 = ranking1.rankings.find(u => u.userId === user2.userId);
        if (user1 && user1.rank && user2.rank) {
          const change = user1.rank - user2.rank; // Positive means moved up
          if (Math.abs(change) >= 2) { // Only significant changes
            topMovers.push({
              userName: user2.userName,
              change
            });
          }
        }
      });

      // Sort by biggest positive changes first
      topMovers.sort((a, b) => b.change - a.change);

      return {
        period1: ranking1.period,
        period2: ranking2.period,
        growth: Math.round(growth * 100) / 100,
        topMovers: topMovers.slice(0, 5)
      };
    } catch (error) {
      logger.error('Error comparing monthly rankings:', error);
      return {
        period1: `${year1}-${month1}`,
        period2: `${year2}-${month2}`,
        growth: 0,
        topMovers: []
      };
    }
  }
}