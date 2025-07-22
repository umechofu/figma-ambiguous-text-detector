import { App, SlackCommandMiddlewareArgs, SlackEventMiddlewareArgs } from '@slack/bolt';
import { AIDialogueService, AIQuery } from '../../services/AIDialogueService';
import { UserSyncService } from '../../services/UserSyncService';
import { logger } from '../../utils/logger';

export class AIHandler {
  private aiDialogueService: AIDialogueService;
  private userSyncService: UserSyncService;

  constructor() {
    this.aiDialogueService = new AIDialogueService();
    this.userSyncService = new UserSyncService();
  }

  register(app: App): void {
    // Slash command for AI queries
    app.command('/ask', this.handleAskCommand.bind(this));
    
    // App mention events for natural conversation
    app.event('app_mention', this.handleAppMention.bind(this));
    
    // Direct message events
    app.event('message', this.handleDirectMessage.bind(this));
    
    logger.info('✅ AIHandler registered with events: app_mention, message, /ask command');
  }

  private async handleAskCommand(args: SlackCommandMiddlewareArgs): Promise<void> {
    const { command, ack, respond } = args;
    
    try {
      await ack();
      
      const userId = command.user_id;
      const query = command.text.trim();
      
      if (!query) {
        await respond({
          text: '使用方法:\n' +
                '• `/ask [質問]` - AIに質問する\n' +
                '• `/ask 〇〇さんの得意なことは？` - メンバーの専門分野を調べる\n' +
                '• `/ask 〇〇のスキルを持つ人はいますか？` - スキル保有者を探す',
          response_type: 'ephemeral'
        });
        return;
      }

      // Show typing indicator
      await respond({
        text: '🤔 考え中...',
        response_type: 'ephemeral'
      });

      // Process the query
      const aiQuery: AIQuery = {
        query,
        userId,
        channelId: command.channel_id
      };

      const response = await this.processAIQuery(aiQuery);
      
      // Send the response
      await respond({
        text: response.response,
        response_type: 'ephemeral',
        blocks: this.buildResponseBlocks(response)
      });

      logger.info('AI command processed', {
        userId,
        queryLength: query.length,
        confidence: response.confidence
      });
    } catch (error) {
      logger.error('Error handling ask command:', error);
      await respond({
        text: 'エラーが発生しました。もう一度お試しください。',
        response_type: 'ephemeral'
      });
    }
  }

  private async handleAppMention(args: SlackEventMiddlewareArgs): Promise<void> {
    const { event, client } = args;
    
    try {
      if (event.type !== 'app_mention') return;
      
      const userId = event.user;
      const channelId = event.channel;
      const text = event.text;
      
      logger.info('🎯 App mention received!', { 
        userId, 
        channelId, 
        text: text.substring(0, 100),
        eventType: event.type,
        fullEvent: JSON.stringify(event).substring(0, 200)
      });
      
      // Extract the query by removing the bot mention
      const botUserId = await this.getBotUserId(client);
      const query = text.replace(`<@${botUserId}>`, '').trim();
      
      if (!query) {
        await client.chat.postMessage({
          channel: channelId,
          text: '何かお手伝いできることはありますか？\n\n' +
                '例:\n' +
                '• 「〇〇さんの得意なことは？」\n' +
                '• 「Reactのスキルを持つ人はいますか？」\n' +
                '• 「プロジェクト管理について教えて」\n' +
                '• 「こんにちは」'
        });
        return;
      }

      // Show typing indicator
      const typingMessage = await client.chat.postMessage({
        channel: channelId,
        text: '🤔 考え中...'
      });

      try {
        // Process the query
        const aiQuery: AIQuery = {
          query,
          userId,
          channelId
        };

        const response = await this.processAIQuery(aiQuery);
        
        // Update the typing message with the response
        await client.chat.update({
          channel: channelId,
          ts: typingMessage.ts,
          text: response.response,
          blocks: this.buildResponseBlocks(response)
        });

        logger.info('AI mention processed successfully', {
          userId,
          channelId,
          queryLength: query.length,
          confidence: response.confidence
        });
      } catch (queryError) {
        logger.error('Error processing AI query:', queryError);
        
        // Update typing message with error
        await client.chat.update({
          channel: channelId,
          ts: typingMessage.ts,
          text: 'すみません、処理中にエラーが発生しました。\n\n基本的な機能は引き続き利用できます：\n• `/profile` - プロフィール確認\n• `/coffee` - 感謝を伝える\n• `/khub-admin help` - 管理機能'
        });
      }
    } catch (error) {
      logger.error('Error handling app mention:', error);
      
      if (event.type === 'app_mention') {
        try {
          await client.chat.postMessage({
            channel: event.channel,
            text: 'すみません、システムエラーが発生しました。しばらく時間をおいてから再度お試しください。'
          });
        } catch (messageError) {
          logger.error('Failed to send error message:', messageError);
        }
      }
    }
  }

  private async handleDirectMessage(args: SlackEventMiddlewareArgs): Promise<void> {
    const { event, client } = args;
    
    try {
      if (event.type !== 'message' || event.subtype || event.bot_id) return;
      
      // Only handle direct messages (channel type 'im')
      if (event.channel_type !== 'im') return;
      
      const userId = event.user;
      const query = event.text?.trim();
      
      if (!query) return;
      
      // Sync user first
      await this.userSyncService.syncUser(userId);
      
      // Show typing indicator
      await client.chat.postMessage({
        channel: event.channel,
        text: '🤔 考え中...'
      });

      // Process the query
      const aiQuery: AIQuery = {
        query,
        userId,
        channelId: event.channel
      };

      const response = await this.processAIQuery(aiQuery);
      
      // Send the response
      await client.chat.postMessage({
        channel: event.channel,
        text: response.response,
        blocks: this.buildResponseBlocks(response)
      });

      logger.info('AI DM processed', {
        userId,
        queryLength: query.length,
        confidence: response.confidence
      });
    } catch (error) {
      logger.error('Error handling direct message:', error);
      
      if (event.type === 'message' && event.channel) {
        await client.chat.postMessage({
          channel: event.channel,
          text: 'すみません、エラーが発生しました。もう一度お試しください。'
        });
      }
    }
  }

  private async processAIQuery(query: AIQuery): Promise<any> {
    try {
      // Determine query type and route to appropriate handler
      const queryLower = query.query.toLowerCase();
      
      // Handle simple greetings and basic interactions
      if (this.isSimpleGreeting(queryLower)) {
        return this.handleSimpleGreeting(queryLower);
      }
      
      // Check for user expertise queries
      if (queryLower.includes('さんの得意') || queryLower.includes('さんの専門') || queryLower.includes('さんのスキル')) {
        const userName = this.extractUserName(query.query);
        if (userName) {
          return await this.aiDialogueService.getUserExpertise(userName);
        }
      }
      
      // Check for skill search queries
      if (queryLower.includes('スキルを持つ人') || queryLower.includes('得意な人') || queryLower.includes('専門の人')) {
        const skill = this.extractSkill(query.query);
        if (skill) {
          return await this.aiDialogueService.findExpertsBySkill(skill);
        }
      }
      
      // General knowledge query (with fallback for OpenAI errors)
      try {
        return await this.aiDialogueService.getGeneralKnowledgeAnswer(query.query);
      } catch (aiError) {
        logger.warn('OpenAI service unavailable, using fallback response:', aiError);
        return this.generateFallbackResponse(query.query);
      }
    } catch (error) {
      logger.error('Error processing AI query:', error);
      throw error;
    }
  }

  private extractUserName(query: string): string | null {
    // Extract user name from queries like "田中さんの得意なことは？"
    const patterns = [
      /(.+?)さんの得意/,
      /(.+?)さんの専門/,
      /(.+?)さんのスキル/,
      /(.+?)の得意なこと/
    ];
    
    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  private extractSkill(query: string): string | null {
    // Extract skill from queries like "Reactのスキルを持つ人はいますか？"
    const patterns = [
      /(.+?)のスキルを持つ人/,
      /(.+?)が得意な人/,
      /(.+?)の専門の人/,
      /(.+?)に詳しい人/
    ];
    
    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  private buildResponseBlocks(response: any): any[] {
    const blocks: any[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: response.response
        }
      }
    ];

    // Add confidence indicator
    if (response.confidence !== undefined) {
      const confidenceEmoji = response.confidence > 0.8 ? '🟢' : 
                             response.confidence > 0.5 ? '🟡' : '🔴';
      
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `${confidenceEmoji} 信頼度: ${Math.round(response.confidence * 100)}%`
          }
        ]
      });
    }

    // Add sources if available
    if (response.sources && response.sources.length > 0) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `📚 情報源: ${response.sources.join(', ')}`
          }
        ]
      });
    }

    // Add suggested actions
    if (response.suggestedActions && response.suggestedActions.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*💡 おすすめのアクション:*'
        }
      });

      response.suggestedActions.forEach((action: string) => {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `• ${action}`
          }
        });
      });
    }

    return blocks;
  }

  private async getBotUserId(client: any): Promise<string> {
    try {
      const authTest = await client.auth.test();
      return authTest.user_id;
    } catch (error) {
      logger.error('Error getting bot user ID:', error);
      return '';
    }
  }

  private isSimpleGreeting(queryLower: string): boolean {
    const greetings = [
      'こんにちは', 'こんばんは', 'おはよう', 'hello', 'hi',
      'はじめまして', 'よろしく', 'ありがとう', 'ありがとうございます',
      'お疲れ様', 'お疲れ', 'おはようございます', 'こんにちはございます'
    ];
    
    return greetings.some(greeting => queryLower.includes(greeting));
  }

  private handleSimpleGreeting(queryLower: string): any {
    let response = '';
    
    if (queryLower.includes('おはよう')) {
      response = '🌅 おはようございます！今日も一日頑張りましょう！\n\n何かお手伝いできることがあれば、お気軽にお声がけください。';
    } else if (queryLower.includes('こんにちは')) {
      response = '👋 こんにちは！\n\n私は組織の知識共有をサポートするボットです。メンバーの専門分野を調べたり、スキルを持つ人を探すことができます。';
    } else if (queryLower.includes('こんばんは')) {
      response = '🌙 こんばんは！お疲れ様です。\n\n夜遅くまでお疲れ様です。何かお手伝いできることがあれば、お知らせください。';
    } else if (queryLower.includes('ありがとう')) {
      response = '😊 どういたしまして！\n\nいつでもお気軽にお声がけください。チームの知識共有がより活発になるよう、お手伝いします。';
    } else if (queryLower.includes('お疲れ')) {
      response = '💪 お疲れ様です！\n\n今日も一日お疲れ様でした。何かサポートが必要でしたら、いつでもお声がけください。';
    } else {
      response = '👋 こんにちは！\n\n私はSlack Knowledge Hubです。組織の知識共有をサポートします！\n\n例:\n• 「〇〇さんの得意なことは？」\n• 「Reactのスキルを持つ人はいますか？」';
    }

    return {
      response,
      confidence: 1.0,
      sources: ['定型応答'],
      suggestedActions: [
        'メンバーのスキルを検索する',
        '専門分野で人を探す',
        'プロフィール機能を試す'
      ]
    };
  }

  private generateFallbackResponse(query: string): any {
    return {
      response: '申し訳ございません。現在AI機能にアクセスできない状況ですが、以下の機能は利用できます：\n\n' +
                '• `/profile` - メンバーのプロフィール確認\n' +
                '• `/coffee @ユーザー名 メッセージ` - 感謝を伝える\n' +
                '• `/khub-admin help` - 管理機能\n\n' +
                '直接メンバーに質問するか、関連するチャンネルで相談することをお勧めします。',
      confidence: 0.8,
      sources: ['システム情報'],
      suggestedActions: [
        '直接メンバーに質問する',
        'プロフィール機能を使う',
        '関連チャンネルで相談する'
      ]
    };
  }
}