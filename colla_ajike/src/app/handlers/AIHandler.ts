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
                '• 「プロジェクト管理について教えて」'
        });
        return;
      }

      // Show typing indicator
      await client.chat.postMessage({
        channel: channelId,
        text: '🤔 考え中...'
      });

      // Process the query
      const aiQuery: AIQuery = {
        query,
        userId,
        channelId
      };

      const response = await this.processAIQuery(aiQuery);
      
      // Send the response
      await client.chat.postMessage({
        channel: channelId,
        text: response.response,
        blocks: this.buildResponseBlocks(response)
      });

      logger.info('AI mention processed', {
        userId,
        channelId,
        queryLength: query.length,
        confidence: response.confidence
      });
    } catch (error) {
      logger.error('Error handling app mention:', error);
      
      if (event.type === 'app_mention') {
        await client.chat.postMessage({
          channel: event.channel,
          text: 'すみません、エラーが発生しました。もう一度お試しください。'
        });
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
      
      // General knowledge query
      return await this.aiDialogueService.getGeneralKnowledgeAnswer(query.query);
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
}