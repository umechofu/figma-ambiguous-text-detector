import { App } from '@slack/bolt';
import { ProfileService } from '../../services/core/ProfileService';
import { ProfileRenderer } from '../../services/core/ProfileRenderer';
import { UserRepository } from '../../repositories/UserRepository';
import { logger } from '../../utils/logger';

export class ProfileHandler {
  private profileService: ProfileService;
  private userRepository: UserRepository;

  constructor(private app: App) {
    this.profileService = new ProfileService();
    this.userRepository = new UserRepository();
  }

  register(): void {
    // Handle profile modal submission
    this.app.view('profile_modal', async ({ ack, body, view, client }) => {
      await ack();

      try {
        const user = body.user;
        const values = view.state.values;

        // Extract form data
        const workStyle = values.work_style?.work_style_input?.value || '';
        const communicationStyle = values.communication_style?.communication_style_input?.value || '';
        const expertiseText = values.expertise?.expertise_input?.value || '';
        const availability = values.availability?.availability_input?.value || '';

        // Parse expertise (comma-separated)
        const expertise = expertiseText
          .split(',')
          .map(skill => skill.trim())
          .filter(skill => skill.length > 0);

        // Get user from database
        const dbUser = await this.userRepository.findBySlackId(user.id);
        if (!dbUser) {
          throw new Error('User not found in database');
        }

        // Validate profile data
        const validation = this.profileService.validateProfile({
          workStyle,
          communicationStyle,
          expertise,
          availability
        });

        if (!validation.isValid) {
          logger.warn(`Profile validation failed for user ${user.id}: ${validation.errors.join(', ')}`);
          // Send error message to user
          await client.chat.postMessage({
            channel: user.id,
            text: `❌ プロフィールの保存に失敗しました:\n${validation.errors.map(error => `• ${error}`).join('\n')}`
          });
          return;
        }

        // Save profile
        const profileData = {
          userId: dbUser.id,
          workStyle: workStyle || undefined,
          communicationStyle: communicationStyle || undefined,
          expertise,
          availability: availability || undefined,
          preferences: {}
        };

        const profile = await this.profileService.upsertProfile(profileData);

        // Send success message
        const completionPercentage = this.profileService.getProfileCompletionPercentage(profile);
        
        await client.chat.postMessage({
          channel: user.id,
          text: '✅ プロフィールを保存しました！',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `✅ **プロフィールを保存しました！**\n\n完成度: ${completionPercentage}%\n\nあなたの「取扱説明書」がチームメンバーに共有され、より良いコラボレーションに役立ちます。`
              }
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'プロフィールを確認'
                  },
                  action_id: 'view_my_profile',
                  style: 'primary'
                }
              ]
            }
          ]
        });

        logger.info(`Profile saved for user ${dbUser.name} (${user.id})`);
      } catch (error) {
        logger.error('Error handling profile modal submission:', error);
        
        await client.chat.postMessage({
          channel: body.user.id,
          text: '❌ プロフィールの保存中にエラーが発生しました。しばらく時間をおいて再度お試しください。'
        });
      }
    });

    // Handle view my profile button
    this.app.action('view_my_profile', async ({ ack, body, client }) => {
      await ack();

      try {
        const user = body.user;
        const dbUser = await this.userRepository.findBySlackId(user.id);
        
        if (!dbUser) {
          throw new Error('User not found');
        }

        const profileWithUser = await this.profileService.getProfileWithUser(dbUser.id);
        
        if (!profileWithUser) {
          await client.chat.postMessage({
            channel: user.id,
            text: 'プロフィールが見つかりません。まず `/profile` コマンドでプロフィールを作成してください。'
          });
          return;
        }

        const profileBlocks = ProfileRenderer.renderProfileBlocks(
          profileWithUser.profile,
          profileWithUser.user
        );

        // Add edit button
        profileBlocks.push({
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'プロフィールを編集'
              },
              action_id: 'edit_profile',
              style: 'primary'
            }
          ]
        });

        await client.chat.postMessage({
          channel: user.id,
          text: `👤 ${profileWithUser.user.name}さんの取扱説明書`,
          blocks: profileBlocks
        });
      } catch (error) {
        logger.error('Error viewing profile:', error);
        await client.chat.postMessage({
          channel: body.user.id,
          text: 'プロフィールの表示中にエラーが発生しました。'
        });
      }
    });

    // Handle edit profile button
    this.app.action('edit_profile', async ({ ack, body, client }) => {
      await ack();

      try {
        const user = body.user;
        await this.openProfileModal(client, (body as any).trigger_id, user.id);
      } catch (error) {
        logger.error('Error opening edit profile modal:', error);
      }
    });

    // Handle view other user's profile
    this.app.action(/^view_profile_(.+)$/, async ({ ack, body, action, client }) => {
      await ack();

      try {
        const targetUserId = (action as any).action_id.replace('view_profile_', '');
        const targetUser = await this.userRepository.findBySlackId(targetUserId);
        
        if (!targetUser) {
          await client.chat.postMessage({
            channel: body.user.id,
            text: 'ユーザーが見つかりません。'
          });
          return;
        }

        const profileWithUser = await this.profileService.getProfileWithUser(targetUser.id);
        
        if (!profileWithUser) {
          await client.chat.postMessage({
            channel: body.user.id,
            text: `${targetUser.name}さんはまだプロフィールを作成していません。`
          });
          return;
        }

        const profileBlocks = ProfileRenderer.renderProfileBlocks(
          profileWithUser.profile,
          profileWithUser.user
        );

        await client.chat.postMessage({
          channel: body.user.id,
          text: `👤 ${profileWithUser.user.name}さんの取扱説明書`,
          blocks: profileBlocks
        });
      } catch (error) {
        logger.error('Error viewing other user profile:', error);
        await client.chat.postMessage({
          channel: body.user.id,
          text: 'プロフィールの表示中にエラーが発生しました。'
        });
      }
    });

    logger.info('Profile handlers registered');
  }

  /**
   * Open profile creation/edit modal
   */
  async openProfileModal(client: any, triggerId: string, userId: string): Promise<void> {
    try {
      // Get existing profile if available
      const dbUser = await this.userRepository.findBySlackId(userId);
      let existingProfile = null;
      
      if (dbUser) {
        existingProfile = await this.profileService.getProfileByUserId(dbUser.id);
      }

      const modal = {
        type: 'modal' as const,
        callback_id: 'profile_modal',
        title: {
          type: 'plain_text' as const,
          text: existingProfile ? 'プロフィール編集' : 'プロフィール作成'
        },
        submit: {
          type: 'plain_text' as const,
          text: '保存'
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
              text: '👤 **あなたの「取扱説明書」を作成しましょう**\n\nチームメンバーがあなたとより良く協働できるよう、働き方やコミュニケーションスタイルを共有してください。'
            }
          },
          {
            type: 'divider'
          },
          {
            type: 'input',
            block_id: 'work_style',
            optional: true,
            element: {
              type: 'plain_text_input',
              action_id: 'work_style_input',
              multiline: true,
              initial_value: existingProfile?.workStyle || '',
              placeholder: {
                type: 'plain_text',
                text: '例: 朝型人間で、集中して作業することを好みます。計画を立ててから取り組むタイプです。'
              }
            },
            label: {
              type: 'plain_text',
              text: '⚙️ 働き方スタイル'
            },
            hint: {
              type: 'plain_text',
              text: 'あなたの働き方の特徴や好みを教えてください'
            }
          },
          {
            type: 'input',
            block_id: 'communication_style',
            optional: true,
            element: {
              type: 'plain_text_input',
              action_id: 'communication_style_input',
              multiline: true,
              initial_value: existingProfile?.communicationStyle || '',
              placeholder: {
                type: 'plain_text',
                text: '例: チャットでの連絡を好みます。急ぎの場合は通話でも大丈夫です。絵文字やスタンプをよく使います。'
              }
            },
            label: {
              type: 'plain_text',
              text: '💬 コミュニケーションスタイル'
            },
            hint: {
              type: 'plain_text',
              text: 'どのようなコミュニケーションを好むか教えてください'
            }
          },
          {
            type: 'input',
            block_id: 'expertise',
            optional: true,
            element: {
              type: 'plain_text_input',
              action_id: 'expertise_input',
              initial_value: existingProfile?.expertise?.join(', ') || '',
              placeholder: {
                type: 'plain_text',
                text: '例: JavaScript, React, UI/UXデザイン, プロジェクト管理'
              }
            },
            label: {
              type: 'plain_text',
              text: '🎯 専門分野・得意なこと'
            },
            hint: {
              type: 'plain_text',
              text: 'カンマ区切りで入力してください'
            }
          },
          {
            type: 'input',
            block_id: 'availability',
            optional: true,
            element: {
              type: 'plain_text_input',
              action_id: 'availability_input',
              initial_value: existingProfile?.availability || '',
              placeholder: {
                type: 'plain_text',
                text: '例: 平日 9:00-18:00、緊急時は19:00まで対応可能'
              }
            },
            label: {
              type: 'plain_text',
              text: '⏰ 対応可能時間'
            },
            hint: {
              type: 'plain_text',
              text: 'いつ連絡を取りやすいか教えてください'
            }
          }
        ]
      };

      await client.views.open({
        trigger_id: triggerId,
        view: modal
      });
    } catch (error) {
      logger.error('Error opening profile modal:', error);
      throw error;
    }
  }
}