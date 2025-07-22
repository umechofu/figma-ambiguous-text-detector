import { App } from '@slack/bolt';
import { logger } from '../../utils/logger';
import { UserRepository } from '../../repositories/UserRepository';
import { UserSyncService } from '../../services/core/UserSyncService';

export class EventHandler {
  private userRepository: UserRepository;
  private userSyncService: UserSyncService;

  constructor(private app: App) {
    this.userRepository = new UserRepository();
    this.userSyncService = new UserSyncService();
  }

  register(): void {
    // Note: app_mention is now handled by AIHandler for advanced AI capabilities

    // Handle team join events for new user registration
    this.app.event('team_join', async ({ event, client }) => {
      try {
        logger.info(`New user joined: ${event.user.id}`);
        
        // Sync user using UserSyncService
        const user = await this.userSyncService.syncUser(event.user.id);
        
        if (user) {
          // Send welcome message
          try {
            await client.chat.postMessage({
              channel: event.user.id,
              text: this.getWelcomeMessage(event.user.id)
            });
          } catch (dmError) {
            logger.warn(`Could not send DM to new user ${event.user.id}:`, dmError);
          }

          logger.info(`Successfully registered new user: ${user.name} (${user.slackId})`);
        } else {
          logger.warn(`Failed to sync new user: ${event.user.id}`);
        }
      } catch (error) {
        logger.error('Error handling team join:', error);
      }
    });

    // Handle user profile changes
    this.app.event('user_change', async ({ event }) => {
      try {
        logger.info(`User profile changed: ${event.user.id}`);
        
        // Update user profile using UserSyncService
        const updatedUser = await this.userSyncService.updateUserProfile(event.user.id);
        
        if (updatedUser) {
          logger.info(`Successfully updated user profile: ${updatedUser.name} (${updatedUser.slackId})`);
        } else {
          logger.warn(`Failed to update user profile: ${event.user.id}`);
        }
      } catch (error) {
        logger.error('Error handling user change:', error);
      }
    });

    // Handle direct messages for AI dialogue
    this.app.message(async ({ message, say, context }) => {
      try {
        // Only respond to direct messages without subtype
        if (message.subtype || !message.text || message.channel_type !== 'im') {
          return;
        }

        logger.info(`Received DM from user ${message.user}: ${message.text}`);
        
        // Simple keyword responses for now
        const text = message.text.toLowerCase();
        
        if (text.includes('help') || text.includes('ヘルプ')) {
          await say(this.getHelpText(message.user));
        } else if (text.includes('profile') || text.includes('プロフィール')) {
          await say('プロフィール機能を使用するには `/profile` コマンドを使用してください。');
        } else if (text.includes('coffee') || text.includes('コーヒー')) {
          await say('ホットコーヒー機能を使用するには `/coffee @ユーザー名 メッセージ` コマンドを使用してください。');
        } else if (text.includes('daily') || text.includes('日報')) {
          await say('日報機能を使用するには `/daily` コマンドを使用してください。');
        } else if (text.includes('survey') || text.includes('アンケート')) {
          await say('アンケート機能を使用するには `/survey` コマンドを使用してください。');
        } else {
          // AI dialogue placeholder
          await say('AI対話機能は現在開発中です。\n\n利用可能なコマンドについては「help」と入力してください。');
        }
      } catch (error) {
        logger.error('Error handling direct message:', error);
        await say('すみません、エラーが発生しました。しばらく時間をおいて再度お試しください。');
      }
    });

    // Handle reaction events (for future coffee reactions)
    this.app.event('reaction_added', async ({ event }) => {
      try {
        // Log reaction for future coffee feature
        if (event.reaction === 'coffee' || event.reaction === '☕') {
          logger.info(`Coffee reaction added by ${event.user} to message in ${event.item.channel}`);
          // TODO: Implement automatic coffee sending on coffee reaction
        }
      } catch (error) {
        logger.error('Error handling reaction added:', error);
      }
    });

    logger.info('Event handlers registered');
  }

  private getHelpText(userId: string): string {
    return `こんにちは！<@${userId}> さん！

私はSlack Knowledge Hubです。組織の知識共有を促進するためのボットです。

**利用可能なコマンド：**
• \`/profile\` - プロフィール（取扱説明書）を作成・編集
• \`/coffee @ユーザー名 メッセージ\` - ホットコーヒーを送って感謝を表現
• \`/daily\` - 日報を投稿してコンディションを共有
• \`/survey\` - アンケートを作成して意見を収集

**主な機能：**
🔀 **シャッフル機能** - ランダムに選ばれた質問で知識共有
👤 **プロフィール機能** - メンバーの「取扱説明書」
☕ **ホットコーヒー** - 感謝の気持ちを表現
📝 **日報機能** - 日々のコンディション共有
📊 **アンケート機能** - 構造化された意見収集
🤖 **AI対話機能** - 自然言語での知識発見（開発中）

何かご質問があれば、お気軽にお声がけください！`;
  }

  private getWelcomeMessage(userId: string): string {
    return `🎉 Slack Knowledge Hubへようこそ！<@${userId}> さん

私は組織の知識共有を促進するボットです。

まずは \`/profile\` コマンドでプロフィール（取扱説明書）を作成してみませんか？
チームメンバーがあなたのことをより理解できるようになります。

詳しい使い方は「help」と入力するか、私にメンションしてください！`;
  }
}