import { Profile } from '../models/Profile';
import { User } from '../models/User';

export class ProfileRenderer {
  /**
   * Render profile as Slack blocks for rich display
   */
  static renderProfileBlocks(profile: Profile, user: User): any[] {
    const blocks = [];

    // Header block
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: `👤 ${user.name}さんの取扱説明書`
      }
    });

    // Basic info section
    if (user.department || user.role) {
      const fields = [];
      if (user.department) {
        fields.push({
          type: 'mrkdwn',
          text: `*部署:*\n${user.department}`
        });
      }
      if (user.role) {
        fields.push({
          type: 'mrkdwn',
          text: `*役職:*\n${user.role}`
        });
      }

      blocks.push({
        type: 'section',
        fields
      });

      blocks.push({ type: 'divider' });
    }

    // Work style section
    if (profile.workStyle) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*⚙️ 働き方スタイル*\n${profile.workStyle}`
        }
      });
    }

    // Communication style section
    if (profile.communicationStyle) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*💬 コミュニケーションスタイル*\n${profile.communicationStyle}`
        }
      });
    }

    // Expertise section
    if (profile.expertise && profile.expertise.length > 0) {
      const expertiseText = profile.expertise.map(skill => `• ${skill}`).join('\n');
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🎯 専門分野・得意なこと*\n${expertiseText}`
        }
      });
    }

    // Availability section
    if (profile.availability) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*⏰ 対応可能時間*\n${profile.availability}`
        }
      });
    }

    // Footer with completion percentage and last updated
    const completionPercentage = this.getProfileCompletionPercentage(profile);
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `完成度: ${completionPercentage}% | 最終更新: ${profile.updatedAt.toLocaleDateString('ja-JP')}`
        }
      ]
    });

    return blocks;
  }

  /**
   * Render profile as plain text for simple display
   */
  static renderProfileText(profile: Profile, user: User): string {
    const sections = [];

    // Header
    sections.push(`👤 **${user.name}さんの取扱説明書**`);
    sections.push('');

    // Basic info
    if (user.department || user.role) {
      const info = [];
      if (user.department) info.push(`部署: ${user.department}`);
      if (user.role) info.push(`役職: ${user.role}`);
      sections.push(`📋 **基本情報**\n${info.join(' | ')}`);
      sections.push('');
    }

    // Work style
    if (profile.workStyle) {
      sections.push(`⚙️ **働き方スタイル**\n${profile.workStyle}`);
      sections.push('');
    }

    // Communication style
    if (profile.communicationStyle) {
      sections.push(`💬 **コミュニケーションスタイル**\n${profile.communicationStyle}`);
      sections.push('');
    }

    // Expertise
    if (profile.expertise && profile.expertise.length > 0) {
      const expertiseList = profile.expertise.map(skill => `• ${skill}`).join('\n');
      sections.push(`🎯 **専門分野・得意なこと**\n${expertiseList}`);
      sections.push('');
    }

    // Availability
    if (profile.availability) {
      sections.push(`⏰ **対応可能時間**\n${profile.availability}`);
      sections.push('');
    }

    // Footer
    const completionPercentage = this.getProfileCompletionPercentage(profile);
    sections.push(`_完成度: ${completionPercentage}% | 最終更新: ${profile.updatedAt.toLocaleDateString('ja-JP')}_`);

    return sections.join('\n');
  }

  /**
   * Render profile summary for lists
   */
  static renderProfileSummary(profile: Profile, user: User): string {
    const completionPercentage = this.getProfileCompletionPercentage(profile);
    const expertiseCount = profile.expertise?.length || 0;
    const topExpertise = profile.expertise?.slice(0, 3).join(', ') || '未設定';
    
    return `<@${user.slackId}> (${completionPercentage}%) - ${topExpertise}`;
  }

  /**
   * Render search result item
   */
  static renderSearchResult(profile: Profile, user: User, searchTerm: string): string {
    const matchingExpertise = profile.expertise?.filter(skill => 
      skill.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];
    
    const expertiseText = matchingExpertise.length > 0 
      ? matchingExpertise.join(', ')
      : profile.expertise?.slice(0, 3).join(', ') || '';

    return `• <@${user.slackId}> - ${expertiseText}`;
  }

  /**
   * Render profile card for team directory
   */
  static renderProfileCard(profile: Profile, user: User): any {
    const completionPercentage = this.getProfileCompletionPercentage(profile);
    const expertisePreview = profile.expertise?.slice(0, 3).join(', ') || '未設定';
    
    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*<@${user.slackId}>*\n${expertisePreview}\n_完成度: ${completionPercentage}%_`
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '詳細を見る'
        },
        action_id: `view_profile_${user.slackId}`,
        value: user.slackId
      }
    };
  }

  /**
   * Render expertise cloud for analytics
   */
  static renderExpertiseCloud(expertiseStats: Array<{ skill: string; count: number }>): string {
    if (expertiseStats.length === 0) {
      return 'データがありません';
    }

    return expertiseStats.map((item, index) => {
      const bar = '█'.repeat(Math.max(1, Math.floor(item.count / Math.max(...expertiseStats.map(s => s.count)) * 10)));
      return `${index + 1}. ${item.skill} ${bar} (${item.count}人)`;
    }).join('\n');
  }

  /**
   * Render profile completion tips
   */
  static renderCompletionTips(profile: Profile): string[] {
    const tips = [];

    if (!profile.workStyle) {
      tips.push('⚙️ 働き方スタイルを追加すると、チームメンバーがあなたとの協働方法を理解しやすくなります');
    }

    if (!profile.communicationStyle) {
      tips.push('💬 コミュニケーションスタイルを設定すると、効果的な連絡方法が分かります');
    }

    if (!profile.expertise || profile.expertise.length === 0) {
      tips.push('🎯 専門分野を登録すると、関連する質問や相談を受けやすくなります');
    }

    if (!profile.availability) {
      tips.push('⏰ 対応可能時間を設定すると、適切なタイミングで連絡を取りやすくなります');
    }

    if (profile.expertise && profile.expertise.length < 3) {
      tips.push('🎯 専門分野をもう少し追加すると、より多くの場面で頼りにされるでしょう');
    }

    return tips;
  }

  /**
   * Get profile completion percentage
   */
  private static getProfileCompletionPercentage(profile: Profile): number {
    const fields = [
      profile.workStyle,
      profile.communicationStyle,
      profile.expertise && profile.expertise.length > 0,
      profile.availability
    ];

    const completedFields = fields.filter(field => field).length;
    return Math.round((completedFields / fields.length) * 100);
  }

  /**
   * Render profile statistics dashboard
   */
  static renderProfileStatsDashboard(stats: {
    totalProfiles: number;
    totalUsers: number;
    completionRate: number;
    averageExpertiseCount: number;
    topExpertise: Array<{ skill: string; count: number }>;
  }): any[] {
    const blocks = [];

    // Header
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: '👤 プロフィール機能統計'
      }
    });

    // Main stats
    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*プロフィール作成数*\n${stats.totalProfiles}`
        },
        {
          type: 'mrkdwn',
          text: `*登録ユーザー数*\n${stats.totalUsers}`
        },
        {
          type: 'mrkdwn',
          text: `*作成率*\n${stats.completionRate}%`
        },
        {
          type: 'mrkdwn',
          text: `*平均専門分野数*\n${stats.averageExpertiseCount}`
        }
      ]
    });

    // Top expertise
    if (stats.topExpertise.length > 0) {
      blocks.push({ type: 'divider' });
      
      const expertiseText = this.renderExpertiseCloud(stats.topExpertise.slice(0, 10));
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*人気の専門分野 TOP10*\n\`\`\`\n${expertiseText}\n\`\`\``
        }
      });
    }

    return blocks;
  }
}