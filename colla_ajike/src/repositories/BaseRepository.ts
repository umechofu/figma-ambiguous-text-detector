import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

export abstract class BaseRepository<T> {
  protected client: SupabaseClient;
  protected tableName: string;

  constructor(tableName: string) {
    this.client = supabase;
    this.tableName = tableName;
  }

  protected async handleError(operation: string, error: any): Promise<never> {
    logger.error(`${this.constructor.name} ${operation} error:`, error);
    throw new Error(`Database operation failed: ${operation}`);
  }

  protected transformDates(obj: any): T {
    if (!obj) return obj;
    
    const transformed = { ...obj };
    
    // Convert snake_case to camelCase and handle dates
    Object.keys(transformed).forEach(key => {
      const camelKey = this.toCamelCase(key);
      if (camelKey !== key) {
        transformed[camelKey] = transformed[key];
        delete transformed[key];
      }
      
      // Convert date strings to Date objects
      if (typeof transformed[camelKey] === 'string' && this.isDateField(camelKey)) {
        transformed[camelKey] = new Date(transformed[camelKey]);
      }
    });
    
    return transformed as T;
  }

  protected transformToSnakeCase(obj: any): any {
    if (!obj) return obj;
    
    const transformed: any = {};
    
    Object.keys(obj).forEach(key => {
      const snakeKey = this.toSnakeCase(key);
      transformed[snakeKey] = obj[key];
    });
    
    return transformed;
  }

  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  private isDateField(field: string): boolean {
    return field.includes('At') || field.includes('Date') || field === 'date';
  }

  async findById(id: string): Promise<T | null> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return data ? this.transformDates(data) : null;
    } catch (error) {
      return this.handleError('findById', error);
    }
  }

  async findAll(): Promise<T[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*');

      if (error) throw error;

      return data ? data.map(item => this.transformDates(item)) : [];
    } catch (error) {
      return this.handleError('findAll', error);
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from(this.tableName)
        .delete()
        .eq('id', id);

      if (error) throw error;

      return true;
    } catch (error) {
      return this.handleError('delete', error);
    }
  }
}