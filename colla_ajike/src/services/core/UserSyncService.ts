import { WebClient } from '@slack/web-api';
import { UserRepository } from '../../repositories/UserRepository';
import { User, CreateUserRequest } from '../../models/User';
import { logger } from '../../utils/logger';
import { config } from '../../config/environment';

export class UserSyncService {
  private slackClient: WebClient;
  private userRepository: UserRepository;

  constructor() {
    this.slackClient = new WebClient(config.slack.botToken);
    this.userRepository = new UserRepository();
  }

  /**
   * Sync a single user by Slack ID
   */
  async syncUser(slackId: string): Promise<User | null> {
    try {
      logger.info(`Syncing user: ${slackId}`);

      // Get user info from Slack
      const userInfo = await this.slackClient.users.info({
        user: slackId
      });

      if (!userInfo.ok || !userInfo.user) {
        logger.warn(`Failed to get user info from Slack: ${slackId}`);
        return null;
      }

      const slackUser = userInfo.user;

      // Skip bots and deleted users
      if (slackUser.is_bot || slackUser.deleted) {
        logger.info(`Skipping bot or deleted user: ${slackId}`);
        return null;
      }

      // Prepare user data
      const userData: CreateUserRequest = {
        slackId: slackUser.id!,
        name: slackUser.real_name || slackUser.name || 'Unknown User',
        email: slackUser.profile?.email,
        department: this.extractDepartment(slackUser),
        role: slackUser.profile?.title
      };

      // Upsert user in database
      const user = await this.userRepository.upsertBySlackId(userData);
      
      logger.info(`Successfully synced user: ${user.name} (${user.slackId})`);
      return user;
    } catch (error) {
      logger.error(`Error syncing user ${slackId}:`, error);
      return null;
    }
  }

  /**
   * Sync all users in the workspace
   */
  async syncAllUsers(): Promise<{ synced: number; errors: number }> {
    try {
      logger.info('Starting full user sync...');

      let synced = 0;
      let errors = 0;
      let cursor: string | undefined;

      do {
        // Get users from Slack API
        const response = await this.slackClient.users.list({
          cursor,
          limit: 100
        });

        if (!response.ok || !response.members) {
          logger.error('Failed to get users from Slack API');
          break;
        }

        // Process each user
        for (const slackUser of response.members) {
          try {
            // Skip bots and deleted users
            if (slackUser.is_bot || slackUser.deleted || !slackUser.id) {
              continue;
            }

            const userData: CreateUserRequest = {
              slackId: slackUser.id,
              name: slackUser.real_name || slackUser.name || 'Unknown User',
              email: slackUser.profile?.email,
              department: this.extractDepartment(slackUser),
              role: slackUser.profile?.title
            };

            await this.userRepository.upsertBySlackId(userData);
            synced++;
          } catch (error) {
            logger.error(`Error syncing user ${slackUser.id}:`, error);
            errors++;
          }
        }

        cursor = response.response_metadata?.next_cursor;
      } while (cursor);

      logger.info(`User sync completed. Synced: ${synced}, Errors: ${errors}`);
      return { synced, errors };
    } catch (error) {
      logger.error('Error during full user sync:', error);
      throw error;
    }
  }

  /**
   * Get user info from Slack and ensure they exist in database
   */
  async ensureUser(slackId: string): Promise<User | null> {
    try {
      // First check if user exists in database
      let user = await this.userRepository.findBySlackId(slackId);
      
      if (user) {
        // Check if user info needs updating (older than 24 hours)
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (user.updatedAt > dayAgo) {
          return user;
        }
      }

      // Sync user from Slack
      return await this.syncUser(slackId);
    } catch (error) {
      logger.error(`Error ensuring user ${slackId}:`, error);
      return null;
    }
  }

  /**
   * Update user's profile information
   */
  async updateUserProfile(slackId: string): Promise<User | null> {
    try {
      const user = await this.userRepository.findBySlackId(slackId);
      if (!user) {
        logger.warn(`User not found in database: ${slackId}`);
        return await this.syncUser(slackId);
      }

      // Get latest info from Slack
      const userInfo = await this.slackClient.users.info({
        user: slackId
      });

      if (!userInfo.ok || !userInfo.user) {
        logger.warn(`Failed to get updated user info from Slack: ${slackId}`);
        return user;
      }

      const slackUser = userInfo.user;

      // Update user data
      const updatedUser = await this.userRepository.update(user.id, {
        name: slackUser.real_name || slackUser.name || user.name,
        email: slackUser.profile?.email || user.email,
        department: this.extractDepartment(slackUser) || user.department,
        role: slackUser.profile?.title || user.role
      });

      logger.info(`Updated user profile: ${updatedUser.name} (${updatedUser.slackId})`);
      return updatedUser;
    } catch (error) {
      logger.error(`Error updating user profile ${slackId}:`, error);
      return null;
    }
  }

  /**
   * Get workspace members count
   */
  async getWorkspaceMembersCount(): Promise<number> {
    try {
      const response = await this.slackClient.users.list({
        limit: 1
      });

      if (!response.ok) {
        throw new Error('Failed to get workspace info');
      }

      // Get total count from response metadata or count manually
      let count = 0;
      let cursor: string | undefined;

      do {
        const listResponse = await this.slackClient.users.list({
          cursor,
          limit: 100
        });

        if (!listResponse.ok || !listResponse.members) {
          break;
        }

        // Count non-bot, non-deleted users
        count += listResponse.members.filter(user => 
          !user.is_bot && !user.deleted
        ).length;

        cursor = listResponse.response_metadata?.next_cursor;
      } while (cursor);

      return count;
    } catch (error) {
      logger.error('Error getting workspace members count:', error);
      return 0;
    }
  }

  /**
   * Extract department from Slack user profile
   */
  private extractDepartment(slackUser: any): string | undefined {
    // Try to extract department from various profile fields
    if (slackUser.profile?.fields) {
      // Look for custom fields that might contain department info
      for (const [key, field] of Object.entries(slackUser.profile.fields)) {
        if (typeof field === 'object' && field !== null) {
          const fieldObj = field as any;
          if (fieldObj.label?.toLowerCase().includes('department') ||
              fieldObj.label?.toLowerCase().includes('部署')) {
            return fieldObj.value;
          }
        }
      }
    }

    // Fallback to title if it looks like a department
    const title = slackUser.profile?.title;
    if (title && (title.includes('部') || title.includes('課') || title.includes('チーム'))) {
      return title;
    }

    return undefined;
  }

  /**
   * Validate Slack user ID format
   */
  static isValidSlackUserId(userId: string): boolean {
    return /^[UW][A-Z0-9]{8,}$/.test(userId);
  }
}