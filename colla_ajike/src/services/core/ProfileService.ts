import { ProfileRepository } from '../../repositories/ProfileRepository';
import { UserRepository } from '../../repositories/UserRepository';
import { Profile, CreateProfileRequest, UpdateProfileRequest } from '../models/Profile';
import { User } from '../models/User';
import { logger } from '../../utils/logger';

export class ProfileService {
  private profileRepository: ProfileRepository;
  private userRepository: UserRepository;

  constructor() {
    this.profileRepository = new ProfileRepository();
    this.userRepository = new UserRepository();
  }

  /**
   * Create a new profile
   */
  async createProfile(profileData: CreateProfileRequest): Promise<Profile> {
    try {
      logger.info(`Creating profile for user: ${profileData.userId}`);
      
      // Validate user exists
      const user = await this.userRepository.findById(profileData.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if profile already exists
      const existingProfile = await this.profileRepository.findByUserId(profileData.userId);
      if (existingProfile) {
        throw new Error('Profile already exists for this user');
      }

      const profile = await this.profileRepository.create(profileData);
      
      logger.info(`Successfully created profile: ${profile.id} for user ${user.name}`);
      return profile;
    } catch (error) {
      logger.error('Error creating profile:', error);
      throw error;
    }
  }

  /**
   * Update an existing profile
   */
  async updateProfile(userId: string, profileData: UpdateProfileRequest): Promise<Profile> {
    try {
      logger.info(`Updating profile for user: ${userId}`);
      
      const existingProfile = await this.profileRepository.findByUserId(userId);
      if (!existingProfile) {
        throw new Error('Profile not found');
      }

      const updatedProfile = await this.profileRepository.update(existingProfile.id, profileData);
      
      logger.info(`Successfully updated profile: ${updatedProfile.id}`);
      return updatedProfile;
    } catch (error) {
      logger.error(`Error updating profile for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get or create profile for user
   */
  async upsertProfile(profileData: CreateProfileRequest): Promise<Profile> {
    try {
      const existingProfile = await this.profileRepository.findByUserId(profileData.userId);
      
      if (existingProfile) {
        return await this.updateProfile(profileData.userId, profileData);
      } else {
        return await this.createProfile(profileData);
      }
    } catch (error) {
      logger.error('Error upserting profile:', error);
      throw error;
    }
  }

  /**
   * Get profile by user ID
   */
  async getProfileByUserId(userId: string): Promise<Profile | null> {
    try {
      return await this.profileRepository.findByUserId(userId);
    } catch (error) {
      logger.error(`Error getting profile for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get profile by Slack user ID
   */
  async getProfileBySlackId(slackId: string): Promise<Profile | null> {
    try {
      const user = await this.userRepository.findBySlackId(slackId);
      if (!user) {
        return null;
      }

      return await this.profileRepository.findByUserId(user.id);
    } catch (error) {
      logger.error(`Error getting profile for Slack user ${slackId}:`, error);
      return null;
    }
  }

  /**
   * Get profile with user information
   */
  async getProfileWithUser(userId: string): Promise<{ profile: Profile; user: User } | null> {
    try {
      const [profile, user] = await Promise.all([
        this.profileRepository.findByUserId(userId),
        this.userRepository.findById(userId)
      ]);

      if (!profile || !user) {
        return null;
      }

      return { profile, user };
    } catch (error) {
      logger.error(`Error getting profile with user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Search profiles by expertise
   */
  async searchByExpertise(expertise: string): Promise<Array<{ profile: Profile; user: User }>> {
    try {
      const profiles = await this.profileRepository.findByExpertise(expertise);
      
      const results = [];
      for (const profile of profiles) {
        const user = await this.userRepository.findById(profile.userId);
        if (user) {
          results.push({ profile, user });
        }
      }

      return results;
    } catch (error) {
      logger.error(`Error searching profiles by expertise ${expertise}:`, error);
      return [];
    }
  }

  /**
   * Get all profiles with user information
   */
  async getAllProfilesWithUsers(): Promise<Array<{ profile: Profile; user: User }>> {
    try {
      const profiles = await this.profileRepository.findAll();
      
      const results = [];
      for (const profile of profiles) {
        const user = await this.userRepository.findById(profile.userId);
        if (user) {
          results.push({ profile, user });
        }
      }

      return results;
    } catch (error) {
      logger.error('Error getting all profiles with users:', error);
      return [];
    }
  }

  /**
   * Delete profile
   */
  async deleteProfile(userId: string): Promise<boolean> {
    try {
      logger.info(`Deleting profile for user: ${userId}`);
      
      const profile = await this.profileRepository.findByUserId(userId);
      if (!profile) {
        return false;
      }

      const result = await this.profileRepository.delete(profile.id);
      
      if (result) {
        logger.info(`Successfully deleted profile: ${profile.id}`);
      }
      
      return result;
    } catch (error) {
      logger.error(`Error deleting profile for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Validate profile data
   */
  validateProfile(profileData: Partial<CreateProfileRequest>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate work style
    if (profileData.workStyle && profileData.workStyle.length > 500) {
      errors.push('働き方スタイルは500文字以内で入力してください');
    }

    // Validate communication style
    if (profileData.communicationStyle && profileData.communicationStyle.length > 500) {
      errors.push('コミュニケーションスタイルは500文字以内で入力してください');
    }

    // Validate expertise
    if (profileData.expertise) {
      if (profileData.expertise.length > 20) {
        errors.push('専門分野は20個以内で入力してください');
      }
      
      for (const skill of profileData.expertise) {
        if (skill.length > 50) {
          errors.push('各専門分野は50文字以内で入力してください');
        }
      }
    }

    // Validate availability
    if (profileData.availability && profileData.availability.length > 200) {
      errors.push('対応可能時間は200文字以内で入力してください');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get default work styles
   */
  getDefaultWorkStyles(): string[] {
    return [
      '朝型人間',
      '夜型人間',
      '集中型',
      'マルチタスク型',
      '計画重視',
      '柔軟対応重視',
      'チームワーク重視',
      '個人作業重視'
    ];
  }

  /**
   * Get default communication styles
   */
  getDefaultCommunicationStyles(): string[] {
    return [
      'チャット中心',
      '通話中心',
      '対面重視',
      'メール重視',
      '即レス派',
      'じっくり考えて返信派',
      '絵文字・スタンプ多用',
      'シンプル・簡潔'
    ];
  }

  /**
   * Format profile for display
   */
  formatProfileForDisplay(profile: Profile, user: User): string {
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
    sections.push(`_最終更新: ${profile.updatedAt.toLocaleDateString('ja-JP')}_`);

    return sections.join('\n');
  }

  /**
   * Get profile completion percentage
   */
  getProfileCompletionPercentage(profile: Profile): number {
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
   * Get profile statistics
   */
  async getProfileStats(): Promise<{
    totalProfiles: number;
    totalUsers: number;
    completionRate: number;
    averageExpertiseCount: number;
    topExpertise: Array<{ skill: string; count: number }>;
  }> {
    try {
      const [profiles, users] = await Promise.all([
        this.profileRepository.findAll(),
        this.userRepository.findAll()
      ]);

      const completionRate = users.length > 0 ? (profiles.length / users.length) * 100 : 0;

      // Calculate average expertise count
      const totalExpertise = profiles.reduce((sum, profile) => sum + (profile.expertise?.length || 0), 0);
      const averageExpertiseCount = profiles.length > 0 ? totalExpertise / profiles.length : 0;

      // Count expertise occurrences
      const expertiseCount = new Map<string, number>();
      profiles.forEach(profile => {
        profile.expertise?.forEach(skill => {
          expertiseCount.set(skill, (expertiseCount.get(skill) || 0) + 1);
        });
      });

      // Get top expertise
      const topExpertise = Array.from(expertiseCount.entries())
        .map(([skill, count]) => ({ skill, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalProfiles: profiles.length,
        totalUsers: users.length,
        completionRate: Math.round(completionRate * 100) / 100,
        averageExpertiseCount: Math.round(averageExpertiseCount * 100) / 100,
        topExpertise
      };
    } catch (error) {
      logger.error('Error getting profile stats:', error);
      return {
        totalProfiles: 0,
        totalUsers: 0,
        completionRate: 0,
        averageExpertiseCount: 0,
        topExpertise: []
      };
    }
  }
}