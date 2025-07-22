import { App } from '@slack/bolt';
import { CoffeeService } from '../../services/communication/CoffeeService';
import { UserRepository } from '../../repositories/UserRepository';
import { logger } from '../../utils/logger';

export class CoffeeHandler {
  private coffeeService: CoffeeService;
  private userRepository: UserRepository;

  constructor(private app: App) {
    this.coffeeService = new CoffeeService();
    this.userRepository = new UserRepository();
  }

  register(): void {
    // Handle coffee modal submission
    this.app.view('coffee_modal', async ({ ack, body, view, client }) => {
      await ack();

      try {
        const user = body.user;
        const metadata = JSON.parse(view.private_metadata || '{}');
        const { receiverId, channelId } = metadata;

        // Get message from modal
        const message = view.state.values.message_input.message_text.value;

        if (!message || message.trim().length === 0) {
          await client.chat.postMessage({
            channel: user.id,
            text: '❌ メッセージを入力してください。'
          });
          return;
        }

        // Validate message
        const validation = this.coffeeService.validateCoffeeMessage(message);
        if (!validation.isValid) {
          await client.chat.postMessage({
            channel: user.id,
            text: `❌ メッセージの送信に失敗しました:\n${validation.errors.map(error => `• ${error}`).join('\n')}`
          });
          return;
        }

        logger.info(`Processing coffee from ${user.id} to ${receiverId}`);

        // Send coffee
        const coffee = await this.coffeeService.sendCoffee(
          user.id,
          receiverId,
          message.trim(),
          channelId
        );

        if (coffee) {
          // Send success message to sender
          await client.chat.postMessage({
            channel: user.id,
            text: '✅ ホットコーヒーを送信しました！',
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: '✅ **ホットコーヒーを送信しました！**\n\n感謝の気持ちが相手に届きました。素晴らしいチームワークですね！'
                }
              },
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    text: {
                      type: 'plain_text',
                      text: '自分の統計を見る'
                    },
                    action_id: 'view_my_coffee_stats'
                  }
                ]
              }
            ]
          });
        } else {
          await client.chat.postMessage({
            channel: user.id,
            text: '❌ ホットコーヒーの送信中にエラーが発生しました。しばらく時間をおいて再度お試しください。'
          });
        }
      } catch (error) {
        logger.error('Error handling coffee modal submission:', error);
        
        await client.chat.postMessage({
          channel: body.user.id,
          text: '❌ ホットコーヒーの送信中にエラーが発生しました。しばらく時間をおいて再度お試しください。'
        });
      }
    });

    // Handle view my coffee stats button
    this.app.action('view_my_coffee_stats', async ({ ack, body, client }) => {
      await ack();

      try {
        const user = body.user;
        const stats = await this.coffeeService.getUserCoffeeStats(user.id);
        
        if (!stats) {
          await client.chat.postMessage({
            channel: user.id,
            text: 'まだホットコーヒーの記録がありません。'
          });
          return;
        }

        const formattedStats = this.coffeeService.formatCoffeeStats(stats);
        
        await client.chat.postMessage({
          channel: user.id,
          text: formattedStats,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: formattedStats
              }
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: '今月のランキングを見る'
                  },
                  action_id: 'view_coffee_ranking'
                }
              ]
            }
          ]
        });
      } catch (error) {
        logger.error('Error viewing coffee stats:', error);
        await client.chat.postMessage({
          channel: body.user.id,
          text: 'ホットコーヒー統計の表示中にエラーが発生しました。'
        });
      }
    });

    // Handle view coffee ranking button
    this.app.action('view_coffee_ranking', async ({ ack, body, client }) => {
      await ack();

      try {
        const user = body.user;
        const ranking = await this.coffeeService.getCurrentMonthRanking();
        
        const now = new Date();
        const period = `${now.getFullYear()}年${now.getMonth() + 1}月`;
        const formattedRanking = this.coffeeService.formatRanking(ranking, period);
        
        await client.chat.postMessage({
          channel: user.id,
          text: formattedRanking
        });
      } catch (error) {
        logger.error('Error viewing coffee ranking:', error);
        await client.chat.postMessage({
          channel: body.user.id,
          text: 'ランキングの表示中にエラーが発生しました。'
        });
      }
    });

    // Handle coffee reaction (automatic coffee sending)
    this.app.event('reaction_added', async ({ event, client }) => {
      try {
        // Only handle coffee reactions
        if (event.reaction !== 'coffee' && event.reaction !== '☕') {
          return;
        }

        // Skip if reaction is on bot's message
        if (event.item.type !== 'message') {
          return;
        }

        // Get message info
        const messageResult = await client.conversations.history({
          channel: event.item.channel,
          latest: event.item.ts,
          limit: 1,
          inclusive: true
        });

        if (!messageResult.ok || !messageResult.messages || messageResult.messages.length === 0) {
          return;
        }

        const message = messageResult.messages[0];
        const messageUserId = message.user;

        // Skip if reacting to own message
        if (event.user === messageUserId) {
          return;
        }

        // Skip if message is from bot
        if (message.bot_id) {
          return;
        }

        logger.info(`Coffee reaction added by ${event.user} to message from ${messageUserId}`);

        // Send automatic coffee
        const coffee = await this.coffeeService.sendCoffee(
          event.user,
          messageUserId,
          'ホットコーヒーリアクションをありがとうございます！ ☕',
          event.item.channel
        );

        if (coffee) {
          logger.info(`Automatic coffee sent via reaction: ${coffee.id}`);
        }
      } catch (error) {
        logger.error('Error handling coffee reaction:', error);
        // Don't throw - this is not critical
      }
    });

    logger.info('Coffee handlers registered');
  }

  /**
   * Open coffee sending modal
   */
  async openCoffeeModal(client: any, triggerId: string, senderId: string, receiverId: string, channelId: string): Promise<void> {
    try {
      // Get receiver info
      const receiver = await this.userRepository.findBySlackId(receiverId);
      if (!receiver) {
        throw new Error('Receiver not found');
      }

      const modal = {
        type: 'modal' as const,
        callback_id: 'coffee_modal',
        private_metadata: JSON.stringify({ receiverId, channelId }),
        title: {
          type: 'plain_text' as const,
          text: 'ホットコーヒーを送る'
        },
        submit: {
          type: 'plain_text' as const,
          text: '送信'
        },
        close: {
          type: 'plain_text' as const,
          text: 'キャンセル'
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `☕ **<@${receiverId}>さんにホットコーヒーを送りましょう**\n\n感謝の気持ちを込めてメッセージを添えてください。`
            }
          },
          {
            type: 'divider'
          },
          {
            type: 'input',
            block_id: 'message_input',
            element: {
              type: 'plain_text_input',
              action_id: 'message_text',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: '例: いつも丁寧に質問に答えてくれてありがとうございます！'
              }
            },
            label: {
              type: 'plain_text',
              text: '💬 メッセージ'
            },
            hint: {
              type: 'plain_text',
              text: '感謝の気持ちを込めてメッセージを書いてください'
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: '💡 *ホットコーヒーを送るタイミング:*\n• 質問に答えてくれた時\n• ドキュメントを整備してくれた時\n• サポートしてくれた時\n• 知識を共有してくれた時'
              }
            ]
          }
        ]
      };

      await client.views.open({
        trigger_id: triggerId,
        view: modal
      });
    } catch (error) {
      logger.error('Error opening coffee modal:', error);
      throw error;
    }
  }
}