import { App, SlackCommandMiddlewareArgs, SlackActionMiddlewareArgs, SlackViewMiddlewareArgs } from '@slack/bolt';
import { DailyService } from '../../services/communication/DailyService';
import { ConditionTracker } from '../../services/communication/ConditionTracker';
import { UserSyncService } from '../../services/core/UserSyncService';
import { logger } from '../../utils/logger';
import { WeatherCondition } from '../../models/DailyReport';

export class DailyHandler {
  private dailyService: DailyService;
  private conditionTracker: ConditionTracker;
  private userSyncService: UserSyncService;

  constructor() {
    this.dailyService = new DailyService();
    this.conditionTracker = new ConditionTracker();
    this.userSyncService = new UserSyncService();
  }

  register(app: App): void {
    // Slash command for daily report
    app.command('/daily', this.handleDailyCommand.bind(this));
    
    // Action handlers
    app.action(/^daily_condition_/, this.handleConditionSelect.bind(this));
    
    // View submission handlers
    app.view('daily_report_modal', this.handleDailyReportModal.bind(this));
    
    // Shortcut for quick daily report
    app.shortcut('daily_report', this.handleDailyShortcut.bind(this));
  }

  private async handleDailyCommand(args: SlackCommandMiddlewareArgs): Promise<void> {
    const { command, ack, client, respond } = args;
    
    try {
      await ack();
      
      const userId = command.user_id;
      const subcommand = command.text.trim().toLowerCase();

      switch (subcommand) {
        case '':
        case 'create':
          await this.showDailyReportModal(client, command.trigger_id, userId);
          break;
        case 'today':
          await this.showTodayReports(respond, userId);
          break;
        case 'my':
          await this.showMyReports(respond, userId);
          break;
        case 'summary':
          await this.showDailySummary(respond);
          break;
        case 'trend':
          await this.showMyTrend(respond, userId);
          break;
        case 'team':
          await this.showTeamSummary(respond);
          break;
        case 'insights':
          await this.showInsights(respond);
          break;
        case 'weekly':
          await this.showWeeklySummary(respond);
          break;
        default:
          await respond({
            text: '使用方法:\n' +
                  '• `/daily` - 日報を作成\n' +
                  '• `/daily today` - 今日の日報一覧\n' +
                  '• `/daily my` - 自分の日報履歴\n' +
                  '• `/daily summary` - 今日のチーム状況\n' +
                  '• `/daily trend` - 自分のコンディション推移\n' +
                  '• `/daily team` - チーム詳細サマリー\n' +
                  '• `/daily weekly` - 週間サマリー\n' +
                  '• `/daily insights` - チーム分析',
            response_type: 'ephemeral'
          });
      }
    } catch (error) {
      logger.error('Error handling daily command:', error);
      await respond({
        text: 'エラーが発生しました。もう一度お試しください。',
        response_type: 'ephemeral'
      });
    }
  }

  private async handleDailyShortcut(args: SlackActionMiddlewareArgs): Promise<void> {
    const { shortcut, ack, client } = args;
    
    try {
      await ack();
      
      if (shortcut.type === 'shortcut') {
        await this.showDailyReportModal(client, shortcut.trigger_id, shortcut.user.id);
      }
    } catch (error) {
      logger.error('Error handling daily shortcut:', error);
    }
  }

  private async showDailyReportModal(client: any, triggerId: string, userId: string): Promise<void> {
    try {
      // Sync user first
      await this.userSyncService.syncUser(userId);
      
      // Get existing report for today
      const existingReport = await this.dailyService.getTodayReport(userId);
      
      const modal = {
        type: 'modal',
        callback_id: 'daily_report_modal',
        title: {
          type: 'plain_text',
          text: '日報作成'
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
              text: '今日のコンディションと進捗を教えてください 📝'
            }
          },
          {
            type: 'divider'
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*今日のコンディション* ☀️'
            }
          },
          {
            type: 'actions',
            block_id: 'condition_block',
            elements: this.createConditionButtons(existingReport?.condition)
          },
          {
            type: 'input',
            block_id: 'progress_block',
            element: {
              type: 'plain_text_input',
              action_id: 'progress_input',
              placeholder: {
                type: 'plain_text',
                text: '今日の進捗や取り組んだことを入力してください'
              },
              initial_value: existingReport?.progress || '',
              multiline: true
            },
            label: {
              type: 'plain_text',
              text: '進捗'
            },
            optional: true
          },
          {
            type: 'input',
            block_id: 'notes_block',
            element: {
              type: 'plain_text_input',
              action_id: 'notes_input',
              placeholder: {
                type: 'plain_text',
                text: '追加のメモや感想があれば入力してください'
              },
              initial_value: existingReport?.notes || '',
              multiline: true
            },
            label: {
              type: 'plain_text',
              text: 'メモ'
            },
            optional: true
          }
        ],
        private_metadata: JSON.stringify({
          userId,
          existingReportId: existingReport?.id
        })
      };

      await client.views.open({
        trigger_id: triggerId,
        view: modal
      });
    } catch (error) {
      logger.error('Error showing daily report modal:', error);
      throw error;
    }
  }

  private createConditionButtons(selectedCondition?: string): any[] {
    const conditions: { value: WeatherCondition; emoji: string; text: string }[] = [
      { value: 'sunny', emoji: '☀️', text: '晴れ' },
      { value: 'cloudy', emoji: '☁️', text: '曇り' },
      { value: 'rainy', emoji: '🌧️', text: '雨' },
      { value: 'stormy', emoji: '⛈️', text: '嵐' },
      { value: 'snowy', emoji: '❄️', text: '雪' },
      { value: 'foggy', emoji: '🌫️', text: '霧' }
    ];

    return conditions.map(condition => ({
      type: 'button',
      action_id: `daily_condition_${condition.value}`,
      text: {
        type: 'plain_text',
        text: `${condition.emoji} ${condition.text}`
      },
      value: condition.value,
      style: selectedCondition === condition.value ? 'primary' : undefined
    }));
  }

  private async handleConditionSelect(args: SlackActionMiddlewareArgs): Promise<void> {
    const { action, ack, body, client } = args;
    
    try {
      await ack();
      
      if (action.type === 'button' && body.type === 'block_actions') {
        const selectedCondition = action.value;
        
        // Update the modal with selected condition
        const view = body.view;
        if (view) {
          const updatedBlocks = view.blocks.map((block: any) => {
            if (block.block_id === 'condition_block') {
              return {
                ...block,
                elements: this.createConditionButtons(selectedCondition)
              };
            }
            return block;
          });

          await client.views.update({
            view_id: view.id,
            view: {
              ...view,
              blocks: updatedBlocks,
              private_metadata: JSON.stringify({
                ...JSON.parse(view.private_metadata || '{}'),
                selectedCondition
              })
            }
          });
        }
      }
    } catch (error) {
      logger.error('Error handling condition select:', error);
    }
  }

  private async handleDailyReportModal(args: SlackViewMiddlewareArgs): Promise<void> {
    const { ack, view, body, client } = args;
    
    try {
      const metadata = JSON.parse(view.private_metadata || '{}');
      const { userId, selectedCondition, existingReportId } = metadata;
      
      const values = view.state.values;
      const progress = values.progress_block?.progress_input?.value || '';
      const notes = values.notes_block?.notes_input?.value || '';

      if (!selectedCondition) {
        await ack({
          response_action: 'errors',
          errors: {
            condition_block: 'コンディションを選択してください'
          }
        });
        return;
      }

      await ack();

      // Create or update daily report
      const reportData = {
        userId,
        condition: selectedCondition,
        progress: progress || undefined,
        notes: notes || undefined
      };

      const report = await this.dailyService.createDailyReport(reportData);
      
      // Get user info for display
      const userInfo = await client.users.info({ user: userId });
      const userName = userInfo.user?.real_name || userInfo.user?.name || 'Unknown User';
      
      // Format and send message
      const message = this.dailyService.formatDailyReportMessage(report, userName);
      
      // Send to user as confirmation
      await client.chat.postMessage({
        channel: userId,
        text: '日報を投稿しました！',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '✅ 日報を投稿しました！'
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: message
            }
          }
        ]
      });

      logger.info(`Daily report submitted by user ${userId}`, {
        reportId: report.id,
        condition: report.condition
      });
    } catch (error) {
      logger.error('Error handling daily report modal:', error);
      await ack({
        response_action: 'errors',
        errors: {
          progress_block: 'エラーが発生しました。もう一度お試しください。'
        }
      });
    }
  }

  private async showTodayReports(respond: any, requesterId: string): Promise<void> {
    try {
      const reports = await this.dailyService.getTodayReports();
      
      if (reports.length === 0) {
        await respond({
          text: '今日の日報はまだありません。',
          response_type: 'ephemeral'
        });
        return;
      }

      const summary = this.dailyService.generateDailyReportSummary(reports);
      
      await respond({
        text: summary,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error showing today reports:', error);
      await respond({
        text: 'エラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  private async showMyReports(respond: any, userId: string): Promise<void> {
    try {
      const reports = await this.dailyService.getUserReports(userId, 7); // Last 7 reports
      
      if (reports.length === 0) {
        await respond({
          text: 'まだ日報がありません。`/daily` で日報を作成してみましょう！',
          response_type: 'ephemeral'
        });
        return;
      }

      let message = '📋 **あなたの最近の日報**\n\n';
      
      reports.forEach(report => {
        const emoji = this.dailyService.getWeatherEmoji(report.condition);
        const date = report.date.toLocaleDateString('ja-JP');
        message += `${emoji} ${date} - ${this.dailyService.getConditionDescription(report.condition)}\n`;
        
        if (report.progress) {
          message += `   📝 ${report.progress.substring(0, 100)}${report.progress.length > 100 ? '...' : ''}\n`;
        }
        message += '\n';
      });

      await respond({
        text: message,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error showing my reports:', error);
      await respond({
        text: 'エラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  private async showDailySummary(respond: any): Promise<void> {
    try {
      const reports = await this.dailyService.getTodayReports();
      const summary = this.dailyService.generateDailyReportSummary(reports);
      
      await respond({
        text: summary,
        response_type: 'in_channel'
      });
    } catch (error) {
      logger.error('Error showing daily summary:', error);
      await respond({
        text: 'エラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  private async showMyTrend(respond: any, userId: string): Promise<void> {
    try {
      const trend = await this.conditionTracker.getConditionHistory(userId, 14); // Last 14 days
      
      if (trend.conditions.length === 0) {
        await respond({
          text: 'まだ十分な日報データがありません。継続して日報を投稿してください！',
          response_type: 'ephemeral'
        });
        return;
      }

      const message = this.conditionTracker.formatConditionTrend(trend);
      
      await respond({
        text: message,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error showing my trend:', error);
      await respond({
        text: 'エラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  private async showTeamSummary(respond: any): Promise<void> {
    try {
      const today = new Date();
      const summary = await this.conditionTracker.getTeamConditionSummary(today);
      const message = this.conditionTracker.formatTeamSummary(summary);
      
      await respond({
        text: message,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error showing team summary:', error);
      await respond({
        text: 'エラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  private async showInsights(respond: any): Promise<void> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days

      const insights = await this.conditionTracker.getConditionInsights(startDate, endDate);
      
      let message = '📈 **チーム分析レポート** (過去30日間)\n\n';
      
      message += `**参加率:** ${insights.averageParticipation.toFixed(1)}%\n\n`;
      
      message += '**最も活発なメンバー:**\n';
      insights.mostActiveUsers.slice(0, 5).forEach((user, index) => {
        message += `${index + 1}. ${user.userName} (${user.reportCount}回)\n`;
      });
      
      message += '\n**コンディション分布:**\n';
      Object.entries(insights.conditionDistribution)
        .sort(([,a], [,b]) => b - a)
        .forEach(([condition, count]) => {
          const emoji = this.getConditionEmoji(condition);
          message += `${emoji} ${condition}: ${count}回\n`;
        });

      if (insights.consistentReporters.length > 0) {
        message += `\n**継続報告者 (80%以上):** ${insights.consistentReporters.slice(0, 5).join(', ')}\n`;
      }

      if (insights.improvingUsers.length > 0) {
        message += `\n📈 **改善傾向:** ${insights.improvingUsers.slice(0, 5).join(', ')}\n`;
      }

      if (insights.decliningUsers.length > 0) {
        message += `\n📉 **注意が必要:** ${insights.decliningUsers.slice(0, 3).join(', ')}\n`;
      }
      
      await respond({
        text: message,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error showing insights:', error);
      await respond({
        text: 'エラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  private async showWeeklySummary(respond: any): Promise<void> {
    try {
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay()); // Start of current week (Sunday)

      const weeklyStats = await this.conditionTracker.getWeeklyConditionStats(startOfWeek);
      
      let message = '📅 **週間サマリー**\n\n';
      
      const days = ['日', '月', '火', '水', '木', '金', '土'];
      
      Object.entries(weeklyStats).forEach(([date, summary]) => {
        const dayOfWeek = new Date(date).getDay();
        const dayName = days[dayOfWeek];
        
        message += `**${dayName}曜日 (${date}):**\n`;
        message += `  参加: ${summary.totalReports}名 (${summary.participationRate.toFixed(1)}%)\n`;
        
        if (summary.totalReports > 0) {
          const topCondition = Object.entries(summary.conditionBreakdown)
            .sort(([,a], [,b]) => b - a)[0];
          
          if (topCondition) {
            const emoji = this.getConditionEmoji(topCondition[0]);
            message += `  主な状況: ${emoji} ${topCondition[1]}名\n`;
          }
        }
        message += '\n';
      });

      await respond({
        text: message,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error showing weekly summary:', error);
      await respond({
        text: 'エラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  private getConditionEmoji(condition: string): string {
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
}