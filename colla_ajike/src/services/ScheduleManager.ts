import * as cron from 'node-cron';
import { ShuffleService } from './ShuffleService';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

export class ScheduleManager {
  private shuffleService: ShuffleService;
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  private defaultShuffleChannel: string = '';

  constructor() {
    this.shuffleService = new ShuffleService();
  }

  /**
   * Initialize scheduled tasks
   */
  initialize(defaultChannelId?: string): void {
    if (defaultChannelId) {
      this.defaultShuffleChannel = defaultChannelId;
    }

    this.setupShuffleSchedule();
    logger.info('Schedule manager initialized');
  }

  /**
   * Setup shuffle schedule based on configuration
   */
  private setupShuffleSchedule(): void {
    const cronExpression = config.scheduling.shuffleCronSchedule;
    
    if (!cron.validate(cronExpression)) {
      logger.error(`Invalid cron expression for shuffle: ${cronExpression}`);
      return;
    }

    const task = cron.schedule(cronExpression, async () => {
      await this.executeScheduledShuffle();
    }, {
      scheduled: false, // Don't start immediately
      timezone: 'Asia/Tokyo'
    });

    this.scheduledTasks.set('shuffle', task);
    logger.info(`Shuffle schedule configured: ${cronExpression}`);
  }

  /**
   * Execute scheduled shuffle
   */
  private async executeScheduledShuffle(): Promise<void> {
    try {
      logger.info('Executing scheduled shuffle...');

      if (!this.defaultShuffleChannel) {
        logger.warn('No default shuffle channel configured, skipping scheduled shuffle');
        return;
      }

      const result = await this.shuffleService.executeShuffleRound(this.defaultShuffleChannel);
      
      if (result) {
        logger.info(`Scheduled shuffle completed: User ${result.user.name} received question ${result.question.id}`);
      } else {
        logger.warn('Scheduled shuffle failed - no available users or questions');
      }
    } catch (error) {
      logger.error('Error executing scheduled shuffle:', error);
    }
  }

  /**
   * Start shuffle scheduling
   */
  startShuffleSchedule(): void {
    const task = this.scheduledTasks.get('shuffle');
    if (task) {
      task.start();
      logger.info('Shuffle schedule started');
    } else {
      logger.error('Shuffle schedule not found');
    }
  }

  /**
   * Stop shuffle scheduling
   */
  stopShuffleSchedule(): void {
    const task = this.scheduledTasks.get('shuffle');
    if (task) {
      task.stop();
      logger.info('Shuffle schedule stopped');
    }
  }

  /**
   * Update shuffle schedule
   */
  updateShuffleSchedule(cronExpression: string, channelId?: string): boolean {
    try {
      if (!cron.validate(cronExpression)) {
        logger.error(`Invalid cron expression: ${cronExpression}`);
        return false;
      }

      // Stop existing schedule
      this.stopShuffleSchedule();

      // Update channel if provided
      if (channelId) {
        this.defaultShuffleChannel = channelId;
      }

      // Create new schedule
      const task = cron.schedule(cronExpression, async () => {
        await this.executeScheduledShuffle();
      }, {
        scheduled: true,
        timezone: 'Asia/Tokyo'
      });

      this.scheduledTasks.set('shuffle', task);
      logger.info(`Shuffle schedule updated: ${cronExpression}`);
      return true;
    } catch (error) {
      logger.error('Error updating shuffle schedule:', error);
      return false;
    }
  }

  /**
   * Get schedule status
   */
  getScheduleStatus(): {
    shuffle: {
      isRunning: boolean;
      cronExpression: string;
      nextExecution?: Date;
      channel: string;
    };
  } {
    const shuffleTask = this.scheduledTasks.get('shuffle');
    
    return {
      shuffle: {
        isRunning: shuffleTask ? shuffleTask.getStatus() === 'scheduled' : false,
        cronExpression: config.scheduling.shuffleCronSchedule,
        nextExecution: shuffleTask ? this.getNextExecutionTime(config.scheduling.shuffleCronSchedule) : undefined,
        channel: this.defaultShuffleChannel
      }
    };
  }

  /**
   * Get next execution time for cron expression
   */
  private getNextExecutionTime(cronExpression: string): Date | undefined {
    try {
      // This is a simplified implementation
      // In a real application, you might want to use a more sophisticated cron parser
      const now = new Date();
      const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
      return nextHour;
    } catch (error) {
      logger.error('Error calculating next execution time:', error);
      return undefined;
    }
  }

  /**
   * Execute manual shuffle for specific channel
   */
  async executeManualShuffle(channelId: string): Promise<{ success: boolean; message: string }> {
    try {
      logger.info(`Executing manual shuffle for channel: ${channelId}`);

      const result = await this.shuffleService.executeShuffleRound(channelId);
      
      if (result) {
        return {
          success: true,
          message: `シャッフル実行完了: ${result.user.name}さんに質問を送信しました`
        };
      } else {
        return {
          success: false,
          message: 'シャッフルの実行に失敗しました。アクティブな質問またはユーザーが不足している可能性があります。'
        };
      }
    } catch (error) {
      logger.error('Error executing manual shuffle:', error);
      return {
        success: false,
        message: 'シャッフル実行中にエラーが発生しました。'
      };
    }
  }

  /**
   * Set default shuffle channel
   */
  setDefaultShuffleChannel(channelId: string): void {
    this.defaultShuffleChannel = channelId;
    logger.info(`Default shuffle channel set to: ${channelId}`);
  }

  /**
   * Validate cron expression
   */
  static validateCronExpression(expression: string): boolean {
    return cron.validate(expression);
  }

  /**
   * Get common cron expressions
   */
  static getCommonSchedules(): Array<{ name: string; expression: string; description: string }> {
    return [
      {
        name: 'daily_morning',
        expression: '0 9 * * 1-5',
        description: '平日の朝9時'
      },
      {
        name: 'daily_afternoon',
        expression: '0 14 * * 1-5',
        description: '平日の午後2時'
      },
      {
        name: 'twice_daily',
        expression: '0 9,15 * * 1-5',
        description: '平日の朝9時と午後3時'
      },
      {
        name: 'weekly_monday',
        expression: '0 10 * * 1',
        description: '毎週月曜日の午前10時'
      },
      {
        name: 'every_2_hours',
        expression: '0 */2 * * 1-5',
        description: '平日の2時間おき'
      }
    ];
  }

  /**
   * Cleanup all scheduled tasks
   */
  cleanup(): void {
    this.scheduledTasks.forEach((task, name) => {
      task.stop();
      task.destroy();
      logger.info(`Stopped and destroyed scheduled task: ${name}`);
    });
    
    this.scheduledTasks.clear();
    logger.info('Schedule manager cleanup completed');
  }
}