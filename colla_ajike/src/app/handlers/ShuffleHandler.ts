import { App } from '@slack/bolt';
import { ShuffleService } from '../../services/ShuffleService';
import { QuestionService } from '../../services/QuestionService';
import { logger } from '../../utils/logger';

export class ShuffleHandler {
  private shuffleService: ShuffleService;
  private questionService: QuestionService;

  constructor(private app: App) {
    this.shuffleService = new ShuffleService();
    this.questionService = new QuestionService();
  }

  register(): void {
    // Handle shuffle response button
    this.app.action('shuffle_respond', async ({ ack, body, client }) => {
      await ack();

      try {
        const user = body.user;
        const actionValue = JSON.parse((body as any).actions[0].value);
        const { questionId, channelId } = actionValue;

        logger.info(`Shuffle respond button clicked by ${user.id} for question ${questionId}`);

        // Open modal for response input
        await client.views.open({
          trigger_id: (body as any).trigger_id,
          view: {
            type: 'modal',
            callback_id: 'shuffle_response_modal',
            private_metadata: JSON.stringify({ questionId, channelId }),
            title: {
              type: 'plain_text',
              text: 'シャッフル質問に回答'
            },
            submit: {
              type: 'plain_text',
              text: '回答を投稿'
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
                  text: '質問への回答を入力してください。回答はチャンネルで共有されます。'
                }
              },
              {
                type: 'input',
                block_id: 'response_input',
                element: {
                  type: 'plain_text_input',
                  action_id: 'response_text',
                  multiline: true,
                  placeholder: {
                    type: 'plain_text',
                    text: 'あなたの回答を入力してください...'
                  }
                },
                label: {
                  type: 'plain_text',
                  text: '回答'
                }
              }
            ]
          }
        });
      } catch (error) {
        logger.error('Error handling shuffle respond button:', error);
      }
    });

    // Handle shuffle skip button
    this.app.action('shuffle_skip', async ({ ack, body, client }) => {
      await ack();

      try {
        const user = body.user;
        const actionValue = JSON.parse((body as any).actions[0].value);
        const { questionId } = actionValue;

        logger.info(`Shuffle skip button clicked by ${user.id} for question ${questionId}`);

        // Update the original message to show it was skipped
        await client.chat.update({
          channel: user.id,
          ts: (body as any).message.ts,
          text: '質問をスキップしました',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '✅ この質問をスキップしました。\n\n次回のシャッフル質問をお楽しみに！'
              }
            }
          ]
        });
      } catch (error) {
        logger.error('Error handling shuffle skip button:', error);
      }
    });

    // Handle shuffle response modal submission
    this.app.view('shuffle_response_modal', async ({ ack, body, view, client }) => {
      await ack();

      try {
        const user = body.user;
        const metadata = JSON.parse(view.private_metadata || '{}');
        const { questionId, channelId } = metadata;

        // Get response text from modal
        const responseText = view.state.values.response_input.response_text.value;

        if (!responseText || responseText.trim().length === 0) {
          await ack({
            response_action: 'errors',
            errors: {
              response_input: '回答を入力してください'
            }
          });
          return;
        }

        logger.info(`Processing shuffle response from ${user.id} for question ${questionId}`);

        // Process the response
        const shuffleResponse = await this.shuffleService.handleShuffleResponse(
          user.id,
          questionId,
          responseText.trim(),
          channelId
        );

        if (shuffleResponse) {
          // Send confirmation DM to user
          await client.chat.postMessage({
            channel: user.id,
            text: '✅ 回答を投稿しました！',
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: '✅ *回答を投稿しました！*\n\nあなたの回答がチャンネルで共有されました。ナレッジ共有にご協力いただき、ありがとうございます！'
                }
              }
            ]
          });
        } else {
          // Send error message
          await client.chat.postMessage({
            channel: user.id,
            text: '❌ 回答の投稿中にエラーが発生しました。しばらく時間をおいて再度お試しください。'
          });
        }
      } catch (error) {
        logger.error('Error handling shuffle response modal:', error);
      }
    });

    logger.info('Shuffle handlers registered');
  }
}