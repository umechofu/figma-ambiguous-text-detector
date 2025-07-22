import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './environment';
import { logger } from '../utils/logger';

export class SupabaseConfig {
  private static instance: SupabaseClient;

  static getClient(): SupabaseClient {
    if (!this.instance) {
      this.instance = createClient(
        config.supabase.url,
        config.supabase.serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );
      
      logger.info('Supabase client initialized');
    }
    
    return this.instance;
  }

  static async testConnection(): Promise<boolean> {
    try {
      const client = this.getClient();
      const { error } = await client.from('users').select('count').limit(1);
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "relation does not exist" which is expected before migration
        logger.error('Supabase connection test failed:', error);
        return false;
      }
      
      logger.info('Supabase connection test successful');
      return true;
    } catch (error) {
      logger.error('Supabase connection test error:', error);
      return false;
    }
  }
}

export const supabase = SupabaseConfig.getClient();