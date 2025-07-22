import { App, SlackCommandMiddlewareArgs, SlackActionMiddlewareArgs, SlackViewMiddlewareArgs } from '@slack/bolt';
import { SurveyService } from '../../services/SurveyService';
import { ResponseCollector } from '../../services/ResponseCollector';
import { UserSyncService } from '../../services/UserSyncService';
import { logger } from '../../utils/logger';

export class SurveyHandler {
  private surveyService: SurveyService;
  private responseCollector: ResponseCollector;
  private userSyncService: UserSyncService;

  constructor() {
    this.surveyService = new SurveyService();
    this.responseCollector = new ResponseCollector();
    this.userSyncService = new UserSyncService();
  }

  register(app: App): void {
    // Slash command for survey management
    app.command('/survey', this.handleSurveyCommand.bind(this));
    
    // Action handlers
    app.action('survey_create', this.handleSurveyCreate.bind(this));
    app.action('survey_template_select', this.handleTemplateSelect.bind(this));
    app.action(/^survey_respond_/, this.handleSurveyRespond.bind(this));
    app.action(/^survey_results_/, this.handleSurveyResults.bind(this));
    app.action(/^survey_deactivate_/, this.handleSurveyDeactivate.bind(this));
    
    // View submission handlers
    app.view('survey_create_modal', this.handleSurveyCreateModal.bind(this));
    app.view('survey_template_modal', this.handleSurveyTemplateModal.bind(this));
    app.view('survey_response_modal', this.handleSurveyResponseModal.bind(this));
    
    // Shortcut for quick survey creation
    app.shortcut('create_survey', this.handleSurveyShortcut.bind(this));
  }

  private async handleSurveyCommand(args: SlackCommandMiddlewareArgs): Promise<void> {
    const { command, ack, client, respond } = args;
    
    try {
      await ack();
      
      const userId = command.user_id;
      const subcommand = command.text.trim().toLowerCase();

      switch (subcommand) {
        case '':
        case 'list':
          await this.showSurveyList(respond, userId);
          break;
        case 'create':
          await this.showSurveyCreateModal(client, command.trigger_id, userId);
          break;
        case 'templates':
          await this.showTemplateList(respond);
          break;
        case 'my':
          await this.showMySurveys(respond, userId);
          break;
        case 'stats':
          await this.showSurveyStats(respond, userId, command.text.split(' ')[1]);
          break;
        case 'remind':
          await this.sendSurveyReminder(respond, userId, command.text.split(' ')[1]);
          break;
        case 'nonresponders':
          await this.showNonResponders(respond, userId, command.text.split(' ')[1]);
          break;
        default:
          await respond({
            text: '使用方法:\n' +
                  '• `/survey` - アクティブなアンケート一覧\n' +
                  '• `/survey create` - アンケートを作成\n' +
                  '• `/survey templates` - テンプレート一覧\n' +
                  '• `/survey my` - 自分が作成したアンケート\n' +
                  '• `/survey stats [survey_id]` - アンケート統計\n' +
                  '• `/survey remind [survey_id]` - リマインダー送信\n' +
                  '• `/survey nonresponders [survey_id]` - 未回答者一覧',
            response_type: 'ephemeral'
          });
      }
    } catch (error) {
      logger.error('Error handling survey command:', error);
      await respond({
        text: 'エラーが発生しました。もう一度お試しください。',
        response_type: 'ephemeral'
      });
    }
  }

  private async handleSurveyShortcut(args: SlackActionMiddlewareArgs): Promise<void> {
    const { shortcut, ack, client } = args;
    
    try {
      await ack();
      
      if (shortcut.type === 'shortcut') {
        await this.showSurveyCreateModal(client, shortcut.trigger_id, shortcut.user.id);
      }
    } catch (error) {
      logger.error('Error handling survey shortcut:', error);
    }
  }

  private async showSurveyList(respond: any, userId: string): Promise<void> {
    try {
      const surveys = await this.surveyService.getActiveSurveys();
      
      if (surveys.length === 0) {
        await respond({
          text: 'アクティブなアンケートはありません。',
          response_type: 'ephemeral'
        });
        return;
      }

      const blocks: any[] = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '📋 **アクティブなアンケート**'
          }
        },
        {
          type: 'divider'
        }
      ];

      for (const survey of surveys) {
        const hasResponded = await this.surveyService.hasUserResponded(survey.id, userId);
        const results = await this.surveyService.getSurveyResults(survey.id);
        
        const statusText = hasResponded ? '✅ 回答済み' : '⏳ 未回答';
        const expiryText = survey.expiresAt ? 
          `\n期限: ${survey.expiresAt.toLocaleDateString('ja-JP')}` : '';
        
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${survey.title}*\n${survey.description || ''}\n${statusText} | 回答数: ${results?.totalResponses || 0}名${expiryText}`
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: hasResponded ? '結果を見る' : '回答する'
            },
            action_id: hasResponded ? `survey_results_${survey.id}` : `survey_respond_${survey.id}`,
            style: hasResponded ? undefined : 'primary'
          }
        });
      }

      await respond({
        blocks,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error showing survey list:', error);
      await respond({
        text: 'エラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  private async showSurveyCreateModal(client: any, triggerId: string, userId: string): Promise<void> {
    try {
      await this.userSyncService.syncUser(userId);
      
      const modal = {
        type: 'modal',
        callback_id: 'survey_create_modal',
        title: {
          type: 'plain_text',
          text: 'アンケート作成'
        },
        submit: {
          type: 'plain_text',
          text: '作成'
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
              text: 'アンケートを作成するか、テンプレートから選択してください 📝'
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '📋 テンプレートから作成'
                },
                action_id: 'survey_template_select',
                style: 'primary'
              }
            ]
          },
          {
            type: 'divider'
          },
          {
            type: 'input',
            block_id: 'title_block',
            element: {
              type: 'plain_text_input',
              action_id: 'title_input',
              placeholder: {
                type: 'plain_text',
                text: 'アンケートのタイトルを入力してください'
              }
            },
            label: {
              type: 'plain_text',
              text: 'タイトル'
            }
          },
          {
            type: 'input',
            block_id: 'description_block',
            element: {
              type: 'plain_text_input',
              action_id: 'description_input',
              placeholder: {
                type: 'plain_text',
                text: 'アンケートの説明（任意）'
              },
              multiline: true
            },
            label: {
              type: 'plain_text',
              text: '説明'
            },
            optional: true
          },
          {
            type: 'input',
            block_id: 'channel_block',
            element: {
              type: 'channels_select',
              action_id: 'channel_select',
              placeholder: {
                type: 'plain_text',
                text: 'アンケートを配信するチャンネルを選択'
              }
            },
            label: {
              type: 'plain_text',
              text: '配信チャンネル'
            }
          }
        ],
        private_metadata: JSON.stringify({
          userId
        })
      };

      await client.views.open({
        trigger_id: triggerId,
        view: modal
      });
    } catch (error) {
      logger.error('Error showing survey create modal:', error);
      throw error;
    }
  }

  private async handleTemplateSelect(args: SlackActionMiddlewareArgs): Promise<void> {
    const { ack, body, client } = args;
    
    try {
      await ack();
      
      if (body.type === 'block_actions') {
        const templates = this.surveyService.getTemplates();
        
        const templateOptions = templates.map(template => ({
          text: {
            type: 'plain_text',
            text: template.name
          },
          value: template.id,
          description: {
            type: 'plain_text',
            text: template.description
          }
        }));

        const modal = {
          type: 'modal',
          callback_id: 'survey_template_modal',
          title: {
            type: 'plain_text',
            text: 'テンプレート選択'
          },
          submit: {
            type: 'plain_text',
            text: '選択'
          },
          close: {
            type: 'plain_text',
            text: '戻る'
          },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'テンプレートを選択してください'
              }
            },
            {
              type: 'input',
              block_id: 'template_block',
              element: {
                type: 'radio_buttons',
                action_id: 'template_select',
                options: templateOptions
              },
              label: {
                type: 'plain_text',
                text: 'テンプレート'
              }
            },
            {
              type: 'input',
              block_id: 'channel_block',
              element: {
                type: 'channels_select',
                action_id: 'channel_select',
                placeholder: {
                  type: 'plain_text',
                  text: 'アンケートを配信するチャンネルを選択'
                }
              },
              label: {
                type: 'plain_text',
                text: '配信チャンネル'
              }
            }
          ],
          private_metadata: body.view?.private_metadata || JSON.stringify({})
        };

        await client.views.update({
          view_id: body.view?.id,
          view: modal
        });
      }
    } catch (error) {
      logger.error('Error handling template select:', error);
    }
  }

  private async handleSurveyTemplateModal(args: SlackViewMiddlewareArgs): Promise<void> {
    const { ack, view, body, client } = args;
    
    try {
      const metadata = JSON.parse(view.private_metadata || '{}');
      const { userId } = metadata;
      
      const values = view.state.values;
      const templateId = values.template_block?.template_select?.selected_option?.value;
      const channelId = values.channel_block?.channel_select?.selected_channel;

      if (!templateId || !channelId) {
        await ack({
          response_action: 'errors',
          errors: {
            template_block: !templateId ? 'テンプレートを選択してください' : undefined,
            channel_block: !channelId ? 'チャンネルを選択してください' : undefined
          }
        });
        return;
      }

      await ack();

      // Create survey from template
      const survey = await this.surveyService.createSurveyFromTemplate(templateId, {
        channelId,
        createdBy: userId
      });

      // Post survey to channel
      await this.postSurveyToChannel(client, survey, channelId);

      // Send confirmation to creator
      await client.chat.postMessage({
        channel: userId,
        text: `✅ アンケート「${survey.title}」を作成し、<#${channelId}>に投稿しました！`
      });

      logger.info(`Survey created from template: ${survey.id}`, {
        templateId,
        createdBy: userId,
        channelId
      });
    } catch (error) {
      logger.error('Error handling survey template modal:', error);
      await ack({
        response_action: 'errors',
        errors: {
          template_block: 'エラーが発生しました。もう一度お試しください。'
        }
      });
    }
  }

  private async handleSurveyRespond(args: SlackActionMiddlewareArgs): Promise<void> {
    const { action, ack, body, client } = args;
    
    try {
      await ack();
      
      if (action.type === 'button' && body.type === 'block_actions') {
        const surveyId = action.action_id.replace('survey_respond_', '');
        const userId = body.user.id;
        
        const survey = await this.surveyService.getSurvey(surveyId);
        if (!survey) {
          return;
        }

        const hasResponded = await this.surveyService.hasUserResponded(surveyId, userId);
        const modal = this.surveyService.buildSurveyModal(survey, hasResponded);

        await client.views.open({
          trigger_id: body.trigger_id,
          view: modal
        });
      }
    } catch (error) {
      logger.error('Error handling survey respond:', error);
    }
  }

  private async handleSurveyResponseModal(args: SlackViewMiddlewareArgs): Promise<void> {
    const { ack, view, body, client } = args;
    
    try {
      const metadata = JSON.parse(view.private_metadata || '{}');
      const { surveyId } = metadata;
      const userId = body.user.id;
      
      const survey = await this.surveyService.getSurvey(surveyId);
      if (!survey) {
        await ack({
          response_action: 'errors',
          errors: {
            'question_0': 'アンケートが見つかりません'
          }
        });
        return;
      }

      // Extract responses from form
      const responses: Record<string, any> = {};
      const values = view.state.values;
      
      survey.questions.forEach(question => {
        const blockId = `question_${question.id}`;
        const value = values[blockId]?.answer;
        
        if (value) {
          switch (question.type) {
            case 'multiple_choice':
              responses[question.id] = value.selected_options?.map((opt: any) => opt.value) || [];
              break;
            case 'single_choice':
            case 'rating':
            case 'boolean':
              responses[question.id] = value.selected_option?.value;
              break;
            case 'text':
              responses[question.id] = value.value;
              break;
          }
        }
      });

      await ack();

      // Submit response
      await this.surveyService.submitSurveyResponse({
        surveyId,
        userId,
        responses
      });

      // Send confirmation
      await client.chat.postMessage({
        channel: userId,
        text: `✅ アンケート「${survey.title}」への回答を送信しました。ご協力ありがとうございました！`
      });

      logger.info(`Survey response submitted: ${surveyId}`, {
        userId,
        responseCount: Object.keys(responses).length
      });
    } catch (error) {
      logger.error('Error handling survey response modal:', error);
      await ack({
        response_action: 'errors',
        errors: {
          'question_0': 'エラーが発生しました。もう一度お試しください。'
        }
      });
    }
  }

  private async postSurveyToChannel(client: any, survey: any, channelId: string): Promise<void> {
    try {
      const expiryText = survey.expiresAt ? 
        `\n⏰ 回答期限: ${survey.expiresAt.toLocaleDateString('ja-JP')}` : '';

      await client.chat.postMessage({
        channel: channelId,
        text: `📋 新しいアンケート: ${survey.title}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `📋 **${survey.title}**\n${survey.description || ''}${expiryText}`
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '📝 回答する'
                },
                action_id: `survey_respond_${survey.id}`,
                style: 'primary'
              }
            ]
          }
        ]
      });
    } catch (error) {
      logger.error('Error posting survey to channel:', error);
      throw error;
    }
  }

  private async showTemplateList(respond: any): Promise<void> {
    try {
      const templates = this.surveyService.getTemplates();
      
      let message = '📋 **アンケートテンプレート一覧**\n\n';
      
      const categories = [...new Set(templates.map(t => t.category))];
      
      categories.forEach(category => {
        const categoryTemplates = templates.filter(t => t.category === category);
        const categoryName = this.getCategoryName(category);
        
        message += `**${categoryName}**\n`;
        categoryTemplates.forEach(template => {
          message += `• ${template.name}\n  ${template.description}\n`;
        });
        message += '\n';
      });

      message += '`/survey create` でテンプレートを使用できます。';

      await respond({
        text: message,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error showing template list:', error);
      await respond({
        text: 'エラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  private async showMySurveys(respond: any, userId: string): Promise<void> {
    try {
      const surveys = await this.surveyService.getSurveysByCreator(userId);
      
      if (surveys.length === 0) {
        await respond({
          text: 'まだアンケートを作成していません。`/survey create` で作成してみましょう！',
          response_type: 'ephemeral'
        });
        return;
      }

      let message = '📋 **あなたが作成したアンケート**\n\n';
      
      for (const survey of surveys) {
        const results = await this.surveyService.getSurveyResults(survey.id);
        const status = survey.isActive ? '🟢 アクティブ' : '🔴 非アクティブ';
        const expiryText = survey.expiresAt ? 
          `\n期限: ${survey.expiresAt.toLocaleDateString('ja-JP')}` : '';
        
        message += `**${survey.title}** ${status}\n`;
        message += `回答数: ${results?.totalResponses || 0}名${expiryText}\n`;
        message += `作成日: ${survey.createdAt.toLocaleDateString('ja-JP')}\n\n`;
      }

      await respond({
        text: message,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error showing my surveys:', error);
      await respond({
        text: 'エラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  private getCategoryName(category: string): string {
    const categoryNames: Record<string, string> = {
      'hr': '人事・組織',
      'project': 'プロジェクト',
      'training': '研修・教育',
      'event': 'イベント',
      'pulse': 'パルス調査'
    };

    return categoryNames[category] || category;
  }

  private async showSurveyStats(respond: any, userId: string, surveyId?: string): Promise<void> {
    try {
      if (!surveyId) {
        await respond({
          text: '使用方法: `/survey stats [survey_id]`\n\nアンケートIDを指定してください。',
          response_type: 'ephemeral'
        });
        return;
      }

      const survey = await this.surveyService.getSurvey(surveyId);
      if (!survey) {
        await respond({
          text: 'アンケートが見つかりません。',
          response_type: 'ephemeral'
        });
        return;
      }

      // Check if user is the creator
      if (survey.createdBy !== userId) {
        await respond({
          text: 'このアンケートの統計を表示する権限がありません。',
          response_type: 'ephemeral'
        });
        return;
      }

      const stats = await this.responseCollector.getResponseStats(surveyId);
      const message = this.responseCollector.formatResponseStats(stats);

      await respond({
        text: message,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error showing survey stats:', error);
      await respond({
        text: 'エラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  private async sendSurveyReminder(respond: any, userId: string, surveyId?: string): Promise<void> {
    try {
      if (!surveyId) {
        await respond({
          text: '使用方法: `/survey remind [survey_id]`\n\nアンケートIDを指定してください。',
          response_type: 'ephemeral'
        });
        return;
      }

      const survey = await this.surveyService.getSurvey(surveyId);
      if (!survey) {
        await respond({
          text: 'アンケートが見つかりません。',
          response_type: 'ephemeral'
        });
        return;
      }

      // Check if user is the creator
      if (survey.createdBy !== userId) {
        await respond({
          text: 'このアンケートのリマインダーを送信する権限がありません。',
          response_type: 'ephemeral'
        });
        return;
      }

      if (!survey.isActive) {
        await respond({
          text: 'このアンケートは非アクティブです。',
          response_type: 'ephemeral'
        });
        return;
      }

      const notification = await this.responseCollector.generateReminderNotification(surveyId);
      
      if (notification.targetUsers && notification.targetUsers.length > 0) {
        // Send reminder to non-responders
        const reminderCount = await this.sendReminderToUsers(notification.targetUsers, notification.message, survey);
        
        await respond({
          text: `✅ ${reminderCount}名にリマインダーを送信しました。`,
          response_type: 'ephemeral'
        });
      } else {
        await respond({
          text: '全員が既に回答済みです。リマインダーの送信は不要です。',
          response_type: 'ephemeral'
        });
      }
    } catch (error) {
      logger.error('Error sending survey reminder:', error);
      await respond({
        text: 'エラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  private async showNonResponders(respond: any, userId: string, surveyId?: string): Promise<void> {
    try {
      if (!surveyId) {
        await respond({
          text: '使用方法: `/survey nonresponders [survey_id]`\n\nアンケートIDを指定してください。',
          response_type: 'ephemeral'
        });
        return;
      }

      const survey = await this.surveyService.getSurvey(surveyId);
      if (!survey) {
        await respond({
          text: 'アンケートが見つかりません。',
          response_type: 'ephemeral'
        });
        return;
      }

      // Check if user is the creator
      if (survey.createdBy !== userId) {
        await respond({
          text: 'このアンケートの未回答者一覧を表示する権限がありません。',
          response_type: 'ephemeral'
        });
        return;
      }

      const nonResponders = await this.responseCollector.getNonResponders(surveyId);
      
      if (nonResponders.length === 0) {
        await respond({
          text: '🎉 全員が回答済みです！',
          response_type: 'ephemeral'
        });
        return;
      }

      let message = `📋 **未回答者一覧** (${survey.title})\n\n`;
      message += `**未回答者数:** ${nonResponders.length}名\n\n`;
      
      nonResponders.forEach((nonResponder, index) => {
        message += `${index + 1}. ${nonResponder.userName}\n`;
      });

      message += `\n\`/survey remind ${surveyId}\` でリマインダーを送信できます。`;

      await respond({
        text: message,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error showing non-responders:', error);
      await respond({
        text: 'エラーが発生しました。',
        response_type: 'ephemeral'
      });
    }
  }

  private async handleSurveyResults(args: SlackActionMiddlewareArgs): Promise<void> {
    const { action, ack, body, client } = args;
    
    try {
      await ack();
      
      if (action.type === 'button' && body.type === 'block_actions') {
        const surveyId = action.action_id.replace('survey_results_', '');
        const userId = body.user.id;
        
        const survey = await this.surveyService.getSurvey(surveyId);
        if (!survey) {
          return;
        }

        const results = await this.surveyService.getSurveyResults(surveyId);
        if (!results) {
          return;
        }

        const message = this.surveyService.formatSurveyResults(results);

        await client.chat.postEphemeral({
          channel: body.channel?.id || userId,
          user: userId,
          text: message
        });
      }
    } catch (error) {
      logger.error('Error handling survey results:', error);
    }
  }

  private async handleSurveyDeactivate(args: SlackActionMiddlewareArgs): Promise<void> {
    const { action, ack, body, client } = args;
    
    try {
      await ack();
      
      if (action.type === 'button' && body.type === 'block_actions') {
        const surveyId = action.action_id.replace('survey_deactivate_', '');
        const userId = body.user.id;
        
        const survey = await this.surveyService.getSurvey(surveyId);
        if (!survey) {
          return;
        }

        // Check if user is the creator
        if (survey.createdBy !== userId) {
          await client.chat.postEphemeral({
            channel: body.channel?.id || userId,
            user: userId,
            text: 'このアンケートを非アクティブにする権限がありません。'
          });
          return;
        }

        await this.surveyService.deactivateSurvey(surveyId);

        // Generate completion notification
        const notification = await this.responseCollector.generateCompletionNotification(surveyId);
        
        // Post completion notification to the original channel
        await client.chat.postMessage({
          channel: survey.channelId,
          text: notification.message
        });

        await client.chat.postEphemeral({
          channel: body.channel?.id || userId,
          user: userId,
          text: `✅ アンケート「${survey.title}」を非アクティブにしました。`
        });

        logger.info(`Survey deactivated: ${surveyId}`, {
          deactivatedBy: userId
        });
      }
    } catch (error) {
      logger.error('Error handling survey deactivate:', error);
    }
  }

  private async handleSurveyCreate(args: SlackActionMiddlewareArgs): Promise<void> {
    const { ack, body, client } = args;
    
    try {
      await ack();
      
      if (body.type === 'block_actions') {
        await this.showSurveyCreateModal(client, body.trigger_id, body.user.id);
      }
    } catch (error) {
      logger.error('Error handling survey create:', error);
    }
  }

  private async handleSurveyCreateModal(args: SlackViewMiddlewareArgs): Promise<void> {
    const { ack, view, body, client } = args;
    
    try {
      const metadata = JSON.parse(view.private_metadata || '{}');
      const { userId } = metadata;
      
      const values = view.state.values;
      const title = values.title_block?.title_input?.value;
      const description = values.description_block?.description_input?.value;
      const channelId = values.channel_block?.channel_select?.selected_channel;

      if (!title || !channelId) {
        await ack({
          response_action: 'errors',
          errors: {
            title_block: !title ? 'タイトルを入力してください' : undefined,
            channel_block: !channelId ? 'チャンネルを選択してください' : undefined
          }
        });
        return;
      }

      await ack();

      // For now, create a simple survey with basic questions
      // In a full implementation, you would have a more complex form for adding questions
      const basicQuestions = [
        {
          type: 'rating' as const,
          question: '全体的な満足度はいかがですか？',
          required: true
        },
        {
          type: 'text' as const,
          question: 'ご意見・ご感想があればお聞かせください',
          required: false
        }
      ];

      const survey = await this.surveyService.createSurvey({
        title,
        description,
        channelId,
        createdBy: userId,
        questions: basicQuestions
      });

      // Post survey to channel
      await this.postSurveyToChannel(client, survey, channelId);

      // Send confirmation to creator
      await client.chat.postMessage({
        channel: userId,
        text: `✅ アンケート「${survey.title}」を作成し、<#${channelId}>に投稿しました！`
      });

      logger.info(`Custom survey created: ${survey.id}`, {
        createdBy: userId,
        channelId
      });
    } catch (error) {
      logger.error('Error handling survey create modal:', error);
      await ack({
        response_action: 'errors',
        errors: {
          title_block: 'エラーが発生しました。もう一度お試しください。'
        }
      });
    }
  }

  private async sendReminderToUsers(userIds: string[], message: string, survey: any): Promise<number> {
    let sentCount = 0;
    
    for (const userId of userIds) {
      try {
        await this.userSyncService.syncUser(userId);
        
        // Send DM with reminder and survey link
        await this.surveyService.getSurvey(survey.id).then(async (currentSurvey) => {
          if (currentSurvey) {
            // Create a simple reminder message with action button
            const reminderBlocks = [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: message
                }
              },
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    text: {
                      type: 'plain_text',
                      text: '📝 今すぐ回答する'
                    },
                    action_id: `survey_respond_${survey.id}`,
                    style: 'primary'
                  }
                ]
              }
            ];

            // Send reminder message
            const app = require('../../app/SlackBotApp').SlackBotApp;
            if (app && app.slackApp) {
              await app.slackApp.client.chat.postMessage({
                channel: userId,
                text: message,
                blocks: reminderBlocks
              });
              sentCount++;
            }
          }
        });
      } catch (error) {
        logger.error(`Failed to send reminder to user ${userId}:`, error);
      }
    }
    
    return sentCount;
  }
}