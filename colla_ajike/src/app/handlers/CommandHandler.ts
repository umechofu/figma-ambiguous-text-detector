import { App } from '@slack/bolt';
import { logger } from '../../utils/logger';
import { UserRepository } from '../../repositories/UserRepository';
import { UserSyncService } from '../../services/UserSyncService';
import { ShuffleService } from '../../services/ShuffleService';
import { QuestionService } from '../../services/QuestionService';
import { ScheduleManager } from '../../services/ScheduleManager';
import { ProfileService } from '../../services/ProfileService';
import { ProfileRenderer } from '../../services/ProfileRenderer';
import { ProfileHandler } from './ProfileHandler';
import { CoffeeService } from '../../services/CoffeeService';
import { CoffeeHandler } from './CoffeeHandler';
import { RankingService } from '../../services/RankingService';

export class CommandHandler {
  private userRepository: UserRepository;
  private userSyncService: UserSyncService;
  private shuffleService: ShuffleService;
  private questionService: QuestionService;
  private scheduleManager: ScheduleManager;
  private profileService: ProfileService;
  private profileHandler: ProfileHandler;
  private coffeeService: CoffeeService;
  private coffeeHandler: CoffeeHandler;
  private rankingService: RankingService;

  constructor(private app: App) {
    this.userRepository = new UserRepository();
    this.userSyncService = new UserSyncService();
    this.shuffleService = new ShuffleService();
    this.questionService = new QuestionService();
    this.scheduleManager = new ScheduleManager();
    this.profileService = new ProfileService();
    this.profileHandler = new ProfileHandler(app);
    this.coffeeService = new CoffeeService();
    this.coffeeHandler = new CoffeeHandler(app);
    this.rankingService = new RankingService();
  }

  register(): void {
    // Register profile handlers
    this.profileHandler.register();
    // Register coffee handlers
    this.coffeeHandler.register();
    // Profile command
    this.app.command('/profile', async ({ command, ack, respond, client }) => {
      await ack();
      
      try {
        logger.info(`Profile command received from user ${command.user_id} in channel ${command.channel_id}`);
        
        const text = command.text.trim();
        
        if (!text) {
          // No arguments - open profile modal
          await this.profileHandler.openProfileModal(client, command.trigger_id, command.user_id);
        } else if (text.startsWith('<@') && text.includes('>')) {
          // View another user's profile
          const userMentionMatch = text.match(/<@([UW][A-Z0-9]+)>/);
          if (userMentionMatch) {
            const targetUserId = userMentionMatch[1];
            const targetUser = await this.userRepository.findBySlackId(targetUserId);
            
            if (!targetUser) {
              await respond({
                text: 'ユーザーが見つかりません。',
                response_type: 'ephemeral'
              });
              return;
            }

            const profileWithUser = await this.profileService.getProfileWithUser(targetUser.id);
            
            if (!profileWithUser) {
              await respond({
                text: `${targetUser.name}さんはまだプロフィールを作成していません。`,
                response_type: 'ephemeral'
              });
              return;
            }

            const formattedProfile = ProfileRenderer.renderProfileText(
              profileWithUser.profile,
              profileWithUser.user
            );

            await respond({
              text: formattedProfile,
              response_type: 'ephemeral'
            });
          } else {
            await respond({
              text: 'ユーザーを正しくメンションしてください。\n例: `/profile @username`',
              response_type: 'ephemeral'
            });
          }
        } else if (text.startsWith('search ')) {
          // Search profiles by expertise
          const searchTerm = text.replace('search ', '').trim();
          if (!searchTerm) {
            await respond({
              text: '検索キーワードを入力してください。\n例: `/profile search JavaScript`',
              response_type: 'ephemeral'
            });
            return;
          }

          const results = await this.profileService.searchByExpertise(searchTerm);
          
          if (results.length === 0) {
            await respond({
              text: `「${searchTerm}」に関する専門知識を持つメンバーは見つかりませんでした。`,
              response_type: 'ephemeral'
            });
            return;
          }

          const resultText = results.map(({ user, profile }) => 
            ProfileRenderer.renderSearchResult(profile, user, searchTerm)
          ).join('\n');

          await respond({
            text: `🔍 **「${searchTerm}」の検索結果 (${results.length}人)**\n\n${resultText}\n\n詳細なプロフィールを見るには \`/profile @ユーザー名\` を使用してください。`,
            response_type: 'ephemeral'
          });
        } else if (text === 'list') {
          // List all profiles
          const allProfiles = await this.profileService.getAllProfilesWithUsers();
          
          if (allProfiles.length === 0) {
            await respond({
              text: 'まだプロフィールを作成したメンバーはいません。',
              response_type: 'ephemeral'
            });
            return;
          }

          const profileList = allProfiles.map(({ user, profile }) => {
            const completionPercentage = this.profileService.getProfileCompletionPercentage(profile);
            const expertiseCount = profile.expertise?.length || 0;
            return `• <@${user.slackId}> (完成度: ${completionPercentage}%, 専門分野: ${expertiseCount}個)`;
          }).join('\n');

          await respond({
            text: `👥 **プロフィール一覧 (${allProfiles.length}人)**\n\n${profileList}\n\n詳細を見るには \`/profile @ユーザー名\` を使用してください。`,
            response_type: 'ephemeral'
          });
        } else if (text === 'help') {
          await respond({
            text: '👤 **プロフィール機能の使い方**\n\n• `/profile` - 自分のプロフィールを作成・編集\n• `/profile @ユーザー名` - 他のユーザーのプロフィールを表示\n• `/profile search キーワード` - 専門分野で検索\n• `/profile list` - 全プロフィール一覧\n• `/profile help` - このヘルプを表示\n\nプロフィールは「取扱説明書」として、チームメンバーとの協働を円滑にします。',
            response_type: 'ephemeral'
          });
        } else {
          await respond({
            text: '不明なコマンドです。`/profile help` でヘルプを確認してください。',
            response_type: 'ephemeral'
          });
        }
      } catch (error) {
        logger.error('Error handling profile command:', error);
        await respond({
          text: 'エラーが発生しました。しばらく時間をおいて再度お試しください。',
          response_type: 'ephemeral'
        });
      }
    });

    // Coffee command
    this.app.command('/coffee', async ({ command, ack, respond, client }) => {
      await ack();
      
      try {
        logger.info(`Coffee command received from user ${command.user_id}: "${command.text}"`);
        
        const text = command.text.trim();
        
        if (!text) {
          // Show help message
          await respond({
            text: '☕ **ホットコーヒー機能の使い方**\n\n• `/coffee @ユーザー名 メッセージ` - ホットコーヒーを送る\n• `/coffee stats` - 自分の統計を見る\n• `/coffee ranking` - 今月のランキングを見る\n• `/coffee help` - このヘルプを表示\n\n例：`/coffee @john いつもありがとうございます！`',
            response_type: 'ephemeral'
          });
          return;
        }

        if (text === 'stats') {
          // Show user's coffee stats
          const stats = await this.coffeeService.getUserCoffeeStats(command.user_id);
          
          if (!stats) {
            await respond({
              text: 'まだホットコーヒーの記録がありません。\n\n`/coffee @ユーザー名 メッセージ` でホットコーヒーを送ってみましょう！',
              response_type: 'ephemeral'
            });
            return;
          }

          const formattedStats = this.coffeeService.formatCoffeeStats(stats);
          await respond({
            text: formattedStats,
            response_type: 'ephemeral'
          });
        } else if (text === 'ranking') {
          // Show current month ranking
          const ranking = await this.coffeeService.getCurrentMonthRanking();
          const now = new Date();
          const period = `${now.getFullYear()}年${now.getMonth() + 1}月`;
          const formattedRanking = this.coffeeService.formatRanking(ranking, period);
          
          await respond({
            text: formattedRanking,
            response_type: 'ephemeral'
          });
        } else if (text === 'help') {
          // Show help
          await respond({
            text: '☕ **ホットコーヒー機能の使い方**\n\n• `/coffee @ユーザー名 メッセージ` - ホットコーヒーを送る\n• `/coffee stats` - 自分の統計を見る\n• `/coffee ranking` - 今月のランキングを見る\n• `/coffee help` - このヘルプを表示\n\n**ホットコーヒーを送るタイミング：**\n• 質問に答えてくれた時\n• ドキュメントを整備してくれた時\n• サポートしてくれた時\n• 知識を共有してくれた時\n\n感謝の気持ちを込めてホットコーヒーを送りましょう！',
            response_type: 'ephemeral'
          });
        } else if (text.includes('@')) {
          // Send coffee to user (supports both @username and <@userid> formats)
          const parsed = this.coffeeService.parseCoffeeCommand(text);
          
          if (parsed.error) {
            await respond({
              text: parsed.error,
              response_type: 'ephemeral'
            });
            return;
          }

          let actualUserId = parsed.userId!;
          
          // If userId starts with @, it's a username that needs to be resolved
          if (actualUserId.startsWith('@')) {
            const username = actualUserId.substring(1); // Remove @ prefix
            try {
              // Try to find user by username/display name
              const users = await client.users.list();
              const foundUser = users.members?.find(user => 
                user.name === username || 
                (user as any).display_name === username ||
                user.real_name === username
              );
              
              if (foundUser) {
                actualUserId = foundUser.id!;
              } else {
                await respond({
                  text: `ユーザー「@${username}」が見つかりません。正しいユーザー名を確認してください。`,
                  response_type: 'ephemeral'
                });
                return;
              }
            } catch (error) {
              logger.error('Error resolving username:', error);
              await respond({
                text: 'ユーザー名の解決中にエラーが発生しました。',
                response_type: 'ephemeral'
              });
              return;
            }
          }

          // Validate that receiver exists in our database
          let receiver = await this.userRepository.findBySlackId(actualUserId);
          if (!receiver) {
            // Try to sync the user automatically
            logger.info(`User ${actualUserId} not found in database. Attempting to sync...`);
            try {
              receiver = await this.userSyncService.ensureUser(actualUserId);
              if (!receiver) {
                await respond({
                  text: 'ユーザーが見つかりません。ユーザー情報の同期に失敗しました。',
                  response_type: 'ephemeral'
                });
                return;
              }
              logger.info(`Successfully synced user ${receiver.name} (${actualUserId})`);
            } catch (error) {
              logger.error('Error syncing receiver user:', error);
              await respond({
                text: 'ユーザー情報の取得中にエラーが発生しました。',
                response_type: 'ephemeral'
              });
              return;
            }
          }

          // Check if trying to send to self
          if (actualUserId === command.user_id) {
            await respond({
              text: '自分にはホットコーヒーを送ることができません。',
              response_type: 'ephemeral'
            });
            return;
          }

          // Open coffee modal for message input
          await this.coffeeHandler.openCoffeeModal(
            client,
            command.trigger_id,
            command.user_id,
            actualUserId,
            command.channel_id
          );
        } else {
          await respond({
            text: '不明なコマンドです。`/coffee help` でヘルプを確認してください。',
            response_type: 'ephemeral'
          });
        }
      } catch (error) {
        logger.error('Error handling coffee command:', error);
        await respond({
          text: 'エラーが発生しました。しばらく時間をおいて再度お試しください。',
          response_type: 'ephemeral'
        });
      }
    });

    // Shuffle command
    this.app.command('/shuffle', async ({ command, ack, respond, client }) => {
      await ack();
      
      try {
        logger.info(`Shuffle command received from user ${command.user_id}: "${command.text}"`);
        
        const text = command.text.trim().toLowerCase();
        
        if (!text || text === 'help') {
          // Show help message
          await respond({
            text: '🔀 **シャッフル機能の使い方**\n\n• `/shuffle` - このヘルプを表示\n• `/shuffle stats` - 自分の回答統計を表示\n• `/shuffle history` - 最近の回答履歴を表示\n• `/shuffle about` - シャッフル機能について\n\n**シャッフル機能とは：**\nランダムに選ばれたメンバーに質問が送信され、回答が全体に共有される知識共有促進システムです。\n\n管理者による定期実行や手動実行により、組織の知識とスキルが可視化されます。',
            response_type: 'ephemeral'
          });
          return;
        }

        // Check if user exists in database
        let user = await this.userRepository.findBySlackId(command.user_id);
        if (!user) {
          // Auto-sync user if not found
          try {
            user = await this.userSyncService.ensureUser(command.user_id);
            if (!user) {
              await respond({
                text: 'ユーザー情報の取得に失敗しました。管理者にお問い合わせください。',
                response_type: 'ephemeral'
              });
              return;
            }
          } catch (error) {
            logger.error('Error syncing user for shuffle command:', error);
            await respond({
              text: 'ユーザー情報の同期中にエラーが発生しました。',
              response_type: 'ephemeral'
            });
            return;
          }
        }

        if (text === 'stats') {
          // Show user's shuffle stats
          const stats = await this.shuffleService.getUserShuffleStats(command.user_id);
          
          if (!stats || stats.totalReceived === 0) {
            await respond({
              text: '📊 **あなたのシャッフル統計**\n\nまだシャッフル機能での回答がありません。\n\n質問が送信されたら、ぜひ回答してチームと知識を共有しましょう！',
              response_type: 'ephemeral'
            });
            return;
          }

          const responseRate = stats.totalReceived > 0 ? 
            Math.round((stats.totalAnswered / stats.totalReceived) * 100) : 0;

          await respond({
            text: `📊 **あなたのシャッフル統計**\n\n• 受信した質問数: ${stats.totalReceived}問\n• 回答した質問数: ${stats.totalAnswered}問\n• 回答率: ${responseRate}%\n• 最後の回答: ${stats.lastAnswered ? new Date(stats.lastAnswered).toLocaleDateString('ja-JP') : 'なし'}\n\n継続的な知識共有、ありがとうございます！`,
            response_type: 'ephemeral'
          });
        } else if (text === 'history') {
          // Show user's recent responses
          const responses = await this.shuffleService.getUserRecentResponses(command.user_id, 5);
          
          if (responses.length === 0) {
            await respond({
              text: '📝 **最近の回答履歴**\n\nまだ回答履歴がありません。\n\n質問を受信したら回答して、あなたの知識をチームと共有しましょう！',
              response_type: 'ephemeral'
            });
            return;
          }

          const historyText = responses.map((response, index) => {
            const date = new Date(response.createdAt).toLocaleDateString('ja-JP');
            const question = response.question.content.length > 50 ? 
              response.question.content.substring(0, 50) + '...' : 
              response.question.content;
            const responseText = response.response.length > 100 ? 
              response.response.substring(0, 100) + '...' : 
              response.response;
            return `${index + 1}. **${date}**\n   質問: ${question}\n   回答: ${responseText}`;
          }).join('\n\n');

          await respond({
            text: `📝 **最近の回答履歴 (最新5件)**\n\n${historyText}\n\n引き続き積極的な知識共有をお願いします！`,
            response_type: 'ephemeral'
          });
        } else if (text === 'about') {
          // Show information about shuffle feature
          const systemStats = await this.shuffleService.getShuffleStats();
          
          await respond({
            text: `🔀 **シャッフル機能について**\n\n**目的:**\nランダムに選ばれたメンバーに質問を送信し、回答を全体で共有することで組織の知識とスキルを可視化します。\n\n**仕組み:**\n1. 管理者が定期実行を設定\n2. ランダムにメンバーが選ばれる\n3. 質問がDMで送信される\n4. 回答がチャンネルで共有される\n\n**現在の統計:**\n• 質問総数: ${systemStats.totalQuestions}問\n• アクティブ質問数: ${systemStats.activeQuestions}問\n• 回答総数: ${systemStats.totalResponses}件\n• 登録ユーザー数: ${systemStats.totalUsers}人\n• 全体回答率: ${systemStats.responseRate}%\n\n**質問カテゴリー:**\n技術Tips、仕事効率化、リモートワーク、デザイン、チーム運用、学びの共有など`,
            response_type: 'ephemeral'
          });
        } else {
          await respond({
            text: '不明なコマンドです。`/shuffle help` でヘルプを確認してください。',
            response_type: 'ephemeral'
          });
        }
      } catch (error) {
        logger.error('Error handling shuffle command:', error);
        await respond({
          text: 'エラーが発生しました。しばらく時間をおいて再度お試しください。',
          response_type: 'ephemeral'
        });
      }
    });

    // Daily report command
    this.app.command('/daily', async ({ command, ack, respond, client }) => {
      await ack();
      
      try {
        logger.info(`Daily command received from user ${command.user_id} in channel ${command.channel_id}`);
        
        // Check if user exists in database
        const user = await this.userRepository.findBySlackId(command.user_id);
        if (!user) {
          await respond({
            text: 'ユーザー情報が見つかりません。しばらく時間をおいて再度お試しください。',
            response_type: 'ephemeral'
          });
          return;
        }

        await respond({
          text: '日報機能は現在開発中です。しばらくお待ちください！\n\n今後、以下の機能が利用できるようになります：\n• コンディション（天気アイコン）の選択\n• 進捗状況の共有\n• チームメンバーの状況確認',
          response_type: 'ephemeral'
        });
      } catch (error) {
        logger.error('Error handling daily command:', error);
        await respond({
          text: 'エラーが発生しました。しばらく時間をおいて再度お試しください。',
          response_type: 'ephemeral'
        });
      }
    });

    // Survey command
    this.app.command('/survey', async ({ command, ack, respond, client }) => {
      await ack();
      
      try {
        logger.info(`Survey command received from user ${command.user_id} in channel ${command.channel_id}`);
        
        // Check if user exists in database
        const user = await this.userRepository.findBySlackId(command.user_id);
        if (!user) {
          await respond({
            text: 'ユーザー情報が見つかりません。しばらく時間をおいて再度お試しください。',
            response_type: 'ephemeral'
          });
          return;
        }

        await respond({
          text: 'アンケート機能は現在開発中です。しばらくお待ちください！\n\n今後、以下の機能が利用できるようになります：\n• アンケートの作成と配信\n• 豊富なテンプレート\n• 回答の収集と集計\n• 結果の可視化',
          response_type: 'ephemeral'
        });
      } catch (error) {
        logger.error('Error handling survey command:', error);
        await respond({
          text: 'エラーが発生しました。しばらく時間をおいて再度お試しください。',
          response_type: 'ephemeral'
        });
      }
    });

    // Admin command for managing the system
    this.app.command('/khub-admin', async ({ command, ack, respond, client }) => {
      await ack();
      
      try {
        logger.info(`Admin command received from user ${command.user_id}: "${command.text}"`);
        
        // Basic admin functionality (will be expanded)
        const text = command.text.trim().toLowerCase();
        
        if (text === 'status') {
          // Get user count
          const userCount = (await this.userRepository.findAll()).length;
          const workspaceCount = await this.userSyncService.getWorkspaceMembersCount();
          
          await respond({
            text: `🔧 **Slack Knowledge Hub - システム状態**\n\n✅ データベース接続: 正常\n✅ Slack API接続: 正常\n🚧 AI機能: 開発中\n\n📊 **統計情報:**\n• データベース内ユーザー数: ${userCount}\n• ワークスペースメンバー数: ${workspaceCount}\n\n利用可能なコマンド:\n• \`/khub-admin status\` - システム状態確認\n• \`/khub-admin sync-users\` - 全ユーザー同期\n• \`/khub-admin help\` - 管理者ヘルプ`,
            response_type: 'ephemeral'
          });
        } else if (text === 'sync-users') {
          await respond({
            text: '🔄 ユーザー同期を開始しています...',
            response_type: 'ephemeral'
          });
          
          try {
            const result = await this.userSyncService.syncAllUsers();
            await respond({
              text: `✅ **ユーザー同期完了**\n\n• 同期成功: ${result.synced}人\n• エラー: ${result.errors}人\n\n同期されたユーザーは自動的にデータベースに登録されました。`,
              response_type: 'ephemeral'
            });
          } catch (error) {
            logger.error('User sync failed:', error);
            await respond({
              text: '❌ ユーザー同期中にエラーが発生しました。ログを確認してください。',
              response_type: 'ephemeral'
            });
          }
        } else if (text === 'shuffle-stats') {
          const stats = await this.shuffleService.getShuffleStats();
          await respond({
            text: `📊 **シャッフル機能統計**\n\n• 質問総数: ${stats.totalQuestions}\n• アクティブ質問数: ${stats.activeQuestions}\n• 回答総数: ${stats.totalResponses}\n• 登録ユーザー数: ${stats.totalUsers}\n• 回答率: ${stats.responseRate}%`,
            response_type: 'ephemeral'
          });
        } else if (text.startsWith('shuffle-run')) {
          const channelId = command.channel_id;
          await respond({
            text: '🔀 シャッフルを実行しています...',
            response_type: 'ephemeral'
          });
          
          try {
            const result = await this.shuffleService.executeShuffleRound(channelId);
            if (result) {
              await respond({
                text: `✅ **シャッフル実行完了**\n\n• 選ばれたユーザー: ${result.user.name}\n• 質問カテゴリー: ${this.questionService.getCategoryDisplayName(result.question.category)}\n\nユーザーにDMで質問を送信しました。`,
                response_type: 'ephemeral'
              });
            } else {
              await respond({
                text: '❌ シャッフルの実行に失敗しました。アクティブな質問またはユーザーが不足している可能性があります。',
                response_type: 'ephemeral'
              });
            }
          } catch (error) {
            logger.error('Shuffle execution failed:', error);
            await respond({
              text: '❌ シャッフル実行中にエラーが発生しました。ログを確認してください。',
              response_type: 'ephemeral'
            });
          }
        } else if (text.startsWith('shuffle-test')) {
          const args = text.split(' ');
          const targetUser = args[1];
          
          if (!targetUser) {
            await respond({
              text: '❌ テスト対象のユーザーを指定してください。\n\n**使用方法:**\n`/khub-admin shuffle-test @username`\n\n**例:**\n`/khub-admin shuffle-test @umemoto`',
              response_type: 'ephemeral'
            });
            return;
          }
          
          const channelId = command.channel_id;
          await respond({
            text: '🧪 テスト用シャッフルを実行しています...',
            response_type: 'ephemeral'
          });
          
          try {
            // ユーザー名の解析（@username または <@USERID> 形式に対応）
            let targetUserId = targetUser;
            
            if (targetUser.startsWith('<@') && targetUser.includes('>')) {
              // <@USERID> 形式の場合
              const userMentionMatch = targetUser.match(/<@([UW][A-Z0-9]+)>/);
              if (userMentionMatch) {
                targetUserId = userMentionMatch[1];
              }
            } else if (targetUser.startsWith('@')) {
              // @username 形式の場合、実際のUserIDに変換
              const username = targetUser.substring(1);
              try {
                const users = await client.users.list();
                const foundUser = users.members?.find(user => 
                  user.name === username || 
                  (user as any).display_name === username ||
                  user.real_name === username
                );
                
                if (foundUser) {
                  targetUserId = foundUser.id!;
                } else {
                  await respond({
                    text: `❌ ユーザー「${targetUser}」が見つかりません。\n\n正しいユーザー名またはメンションを使用してください。`,
                    response_type: 'ephemeral'
                  });
                  return;
                }
              } catch (error) {
                logger.error('Error resolving username in shuffle-test:', error);
                await respond({
                  text: '❌ ユーザー名の解決中にエラーが発生しました。',
                  response_type: 'ephemeral'
                });
                return;
              }
            }
            
            // 対象ユーザーのデータベース存在確認と同期
            let targetUserRecord = await this.userRepository.findBySlackId(targetUserId);
            if (!targetUserRecord) {
              try {
                targetUserRecord = await this.userSyncService.ensureUser(targetUserId);
                if (!targetUserRecord) {
                  await respond({
                    text: '❌ 対象ユーザーの情報取得に失敗しました。',
                    response_type: 'ephemeral'
                  });
                  return;
                }
              } catch (error) {
                logger.error('Error syncing target user:', error);
                await respond({
                  text: '❌ ユーザー情報の同期中にエラーが発生しました。',
                  response_type: 'ephemeral'
                });
                return;
              }
            }
            
            // テスト用シャッフル実行
            const result = await this.shuffleService.executeTargetedShuffle(targetUserId, channelId);
            if (result) {
              await respond({
                text: `✅ **テスト用シャッフル実行完了**\n\n• 対象ユーザー: ${result.user.name}\n• 質問カテゴリー: ${this.questionService.getCategoryDisplayName(result.question.category)}\n• 質問内容: ${result.question.content.length > 100 ? result.question.content.substring(0, 100) + '...' : result.question.content}\n\n対象ユーザーのDMに質問を送信しました。`,
                response_type: 'ephemeral'
              });
            } else {
              await respond({
                text: '❌ テスト用シャッフルの実行に失敗しました。アクティブな質問が不足している可能性があります。',
                response_type: 'ephemeral'
              });
            }
          } catch (error) {
            logger.error('Test shuffle execution failed:', error);
            await respond({
              text: '❌ テスト用シャッフル実行中にエラーが発生しました。ログを確認してください。',
              response_type: 'ephemeral'
            });
          }
        } else if (text === 'questions') {
          const categories = await this.questionService.getQuestionCategories();
          const categoryText = categories.map(cat => 
            `• ${this.questionService.getCategoryDisplayName(cat.category)}: ${cat.activeCount}/${cat.count}問`
          ).join('\n');
          
          await respond({
            text: `📝 **質問管理**\n\n**カテゴリー別質問数 (アクティブ/総数):**\n${categoryText}\n\n**利用可能な質問管理コマンド:**\n• \`/khub-admin questions-list [category]\` - 質問一覧表示\n• \`/khub-admin question-add\` - 新規質問追加\n• \`/khub-admin question-toggle [ID]\` - 質問の有効/無効切り替え`,
            response_type: 'ephemeral'
          });
        } else if (text.startsWith('questions-list')) {
          const args = text.split(' ');
          const category = args[1];
          
          let questions;
          if (category) {
            questions = await this.questionService.getQuestionsByCategory(category);
          } else {
            questions = await this.questionService.getAllQuestions();
          }
          
          if (questions.length === 0) {
            await respond({
              text: category ? 
                `📝 カテゴリー「${category}」の質問は見つかりませんでした。` :
                '📝 質問が見つかりませんでした。',
              response_type: 'ephemeral'
            });
            return;
          }
          
          const questionsText = questions.slice(0, 20).map((q, index) => {
            const status = q.isActive ? '🟢' : '🔴';
            const categoryDisplay = this.questionService.getCategoryDisplayName(q.category);
            const content = q.content.length > 80 ? 
              q.content.substring(0, 80) + '...' : q.content;
            return `${index + 1}. ${status} [${categoryDisplay}] ${content}\n   ID: \`${q.id}\``;
          }).join('\n\n');
          
          const totalText = questions.length > 20 ? `\n\n※ 最初の20件のみ表示 (総数: ${questions.length}問)` : '';
          
          await respond({
            text: `📝 **質問一覧${category ? ` - ${this.questionService.getCategoryDisplayName(category)}` : ''}**\n\n${questionsText}${totalText}\n\n🟢: アクティブ / 🔴: 非アクティブ`,
            response_type: 'ephemeral'
          });
        } else if (text.startsWith('question-toggle')) {
          const args = text.split(' ');
          const questionId = args[1];
          
          if (!questionId) {
            await respond({
              text: '❌ 質問IDを指定してください。\n例: `/khub-admin question-toggle 123e4567-e89b-12d3-a456-426614174000`',
              response_type: 'ephemeral'
            });
            return;
          }
          
          try {
            const updatedQuestion = await this.questionService.toggleQuestionStatus(questionId);
            const status = updatedQuestion.isActive ? 'アクティブ' : '非アクティブ';
            const categoryDisplay = this.questionService.getCategoryDisplayName(updatedQuestion.category);
            
            await respond({
              text: `✅ **質問ステータス更新完了**\n\n**質問:** ${updatedQuestion.content.substring(0, 100)}${updatedQuestion.content.length > 100 ? '...' : ''}\n**カテゴリー:** ${categoryDisplay}\n**新しいステータス:** ${status}`,
              response_type: 'ephemeral'
            });
          } catch (error) {
            await respond({
              text: `❌ 質問ステータスの更新に失敗しました。\n\n質問IDが正しいか確認してください。`,
              response_type: 'ephemeral'
            });
          }
        } else if (text === 'schedule-status') {
          const status = this.scheduleManager.getScheduleStatus();
          const nextExec = status.shuffle.nextExecution ? 
            status.shuffle.nextExecution.toLocaleString('ja-JP') : '未設定';
          
          await respond({
            text: `⏰ **スケジュール状態**\n\n**シャッフル機能:**\n• 状態: ${status.shuffle.isRunning ? '🟢 実行中' : '🔴 停止中'}\n• Cron式: \`${status.shuffle.cronExpression}\`\n• 対象チャンネル: ${status.shuffle.channel || '未設定'}\n• 次回実行予定: ${nextExec}`,
            response_type: 'ephemeral'
          });
        } else if (text.startsWith('schedule-start')) {
          const channelId = command.channel_id;
          this.scheduleManager.setDefaultShuffleChannel(channelId);
          this.scheduleManager.startShuffleSchedule();
          
          await respond({
            text: `✅ **シャッフルスケジュール開始**\n\n現在のチャンネル (<#${channelId}>) でシャッフル機能の定期実行を開始しました。`,
            response_type: 'ephemeral'
          });
        } else if (text === 'schedule-stop') {
          this.scheduleManager.stopShuffleSchedule();
          
          await respond({
            text: '⏹️ **シャッフルスケジュール停止**\n\nシャッフル機能の定期実行を停止しました。',
            response_type: 'ephemeral'
          });
        } else if (text === 'profile-stats') {
          const stats = await this.profileService.getProfileStats();
          const topExpertiseText = stats.topExpertise.slice(0, 5).map(
            (item, index) => `${index + 1}. ${item.skill} (${item.count}人)`
          ).join('\n');
          
          await respond({
            text: `👤 **プロフィール機能統計**\n\n• プロフィール作成数: ${stats.totalProfiles}\n• 登録ユーザー数: ${stats.totalUsers}\n• 作成率: ${stats.completionRate}%\n• 平均専門分野数: ${stats.averageExpertiseCount}\n\n**人気の専門分野 TOP5:**\n${topExpertiseText || 'データなし'}`,
            response_type: 'ephemeral'
          });
        } else if (text === 'coffee-stats') {
          const stats = await this.coffeeService.getCoffeeStatsSummary();
          const ranking = await this.coffeeService.getCurrentMonthRanking();
          const now = new Date();
          const period = `${now.getFullYear()}年${now.getMonth() + 1}月`;
          
          let statsText = `☕ **ホットコーヒー機能統計**\n\n• 総コーヒー数: ${stats.totalCoffee}杯\n• 登録ユーザー数: ${stats.totalUsers}人\n• 平均コーヒー数/人: ${stats.averageCoffeePerUser}杯`;
          
          if (stats.topReceiver) {
            statsText += `\n• 今月の感謝王: ${stats.topReceiver.userName} (${stats.topReceiver.totalReceived}杯)`;
          }
          
          if (stats.topGiver) {
            statsText += `\n• 今月の感謝配り王: ${stats.topGiver.userName} (${stats.topGiver.totalSent}杯)`;
          }
          
          statsText += `\n\n**${period}のランキング TOP5:**`;
          
          if (ranking.length > 0) {
            const top5 = ranking.slice(0, 5).map((user, index) => {
              const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
              return `${medal} ${user.userName} - ${user.totalReceived}杯`;
            }).join('\n');
            statsText += `\n${top5}`;
          } else {
            statsText += '\nまだデータがありません';
          }
          
          await respond({
            text: statsText,
            response_type: 'ephemeral'
          });
        } else if (text.startsWith('coffee-awards')) {
          const channelId = command.channel_id;
          await respond({
            text: '🏆 月次コーヒーアワードを発表しています...',
            response_type: 'ephemeral'
          });
          
          try {
            const success = await this.rankingService.announceCurrentMonthAwards(channelId);
            if (success) {
              await respond({
                text: '✅ **月次コーヒーアワード発表完了**\n\n今月のランキングをチャンネルで発表しました。',
                response_type: 'ephemeral'
              });
            } else {
              await respond({
                text: '❌ コーヒーアワードの発表に失敗しました。ログを確認してください。',
                response_type: 'ephemeral'
              });
            }
          } catch (error) {
            logger.error('Coffee awards announcement failed:', error);
            await respond({
              text: '❌ コーヒーアワード発表中にエラーが発生しました。ログを確認してください。',
              response_type: 'ephemeral'
            });
          }
        } else if (text === 'help') {
          await respond({
            text: '🔧 **管理者コマンド**\n\n**システム管理:**\n• `status` - システム状態確認\n• `sync-users` - 全ユーザー同期実行\n\n**シャッフル機能:**\n• `shuffle-stats` - シャッフル機能統計\n• `shuffle-run` - 手動シャッフル実行\n• `shuffle-test @user` - 指定ユーザーにテスト用シャッフル\n• `questions` - 質問管理情報\n• `questions-list [category]` - 質問一覧表示\n• `question-toggle [ID]` - 質問の有効/無効切り替え\n\n**プロフィール機能:**\n• `profile-stats` - プロフィール機能統計\n\n**ホットコーヒー機能:**\n• `coffee-stats` - ホットコーヒー機能統計\n• `coffee-awards` - 月次コーヒーアワード発表\n\n**スケジュール管理:**\n• `schedule-status` - スケジュール状態確認\n• `schedule-start` - 定期シャッフル開始\n• `schedule-stop` - 定期シャッフル停止\n\n• `help` - このヘルプを表示',
            response_type: 'ephemeral'
          });
        } else {
          await respond({
            text: '不明なコマンドです。`/khub-admin help` でヘルプを確認してください。',
            response_type: 'ephemeral'
          });
        }
      } catch (error) {
        logger.error('Error handling admin command:', error);
        await respond({
          text: 'エラーが発生しました。しばらく時間をおいて再度お試しください。',
          response_type: 'ephemeral'
        });
      }
    });

    logger.info('Command handlers registered');
  }
}