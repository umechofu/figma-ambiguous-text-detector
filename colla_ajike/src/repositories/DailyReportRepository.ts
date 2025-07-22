import { BaseRepository } from './BaseRepository';
import { DailyReport, CreateDailyReportRequest, UpdateDailyReportRequest } from '../models/DailyReport';

export class DailyReportRepository extends BaseRepository<DailyReport> {
  constructor() {
    super('daily_reports');
  }

  async create(reportData: CreateDailyReportRequest): Promise<DailyReport> {
    try {
      const data = {
        ...reportData,
        date: reportData.date || new Date()
      };

      const { data: result, error } = await this.client
        .from(this.tableName)
        .insert([this.transformToSnakeCase(data)])
        .select()
        .single();

      if (error) throw error;

      return this.transformDates(result);
    } catch (error) {
      return this.handleError('create', error);
    }
  }

  async update(id: string, reportData: UpdateDailyReportRequest): Promise<DailyReport> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .update(this.transformToSnakeCase(reportData))
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return this.transformDates(data);
    } catch (error) {
      return this.handleError('update', error);
    }
  }

  async findByUserIdAndDate(userId: string, date: Date): Promise<DailyReport | null> {
    try {
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format

      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .eq('date', dateStr)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return data ? this.transformDates(data) : null;
    } catch (error) {
      return this.handleError('findByUserIdAndDate', error);
    }
  }

  async findByUserId(userId: string, limit?: number): Promise<DailyReport[]> {
    try {
      let query = this.client
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data ? data.map(item => this.transformDates(item)) : [];
    } catch (error) {
      return this.handleError('findByUserId', error);
    }
  }

  async findByDate(date: Date): Promise<DailyReport[]> {
    try {
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format

      const { data, error } = await this.client
        .from(this.tableName)
        .select('*, users(*)')
        .eq('date', dateStr)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data ? data.map(item => this.transformDates(item)) : [];
    } catch (error) {
      return this.handleError('findByDate', error);
    }
  }

  async findByDateRange(startDate: Date, endDate: Date, userId?: string): Promise<DailyReport[]> {
    try {
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      let query = this.client
        .from(this.tableName)
        .select('*, users(*)')
        .gte('date', startDateStr)
        .lte('date', endDateStr);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.order('date', { ascending: false });

      if (error) throw error;

      return data ? data.map(item => this.transformDates(item)) : [];
    } catch (error) {
      return this.handleError('findByDateRange', error);
    }
  }

  async upsertByUserIdAndDate(reportData: CreateDailyReportRequest): Promise<DailyReport> {
    try {
      const date = reportData.date || new Date();
      const existing = await this.findByUserIdAndDate(reportData.userId, date);

      if (existing) {
        return this.update(existing.id, reportData);
      } else {
        return this.create(reportData);
      }
    } catch (error) {
      return this.handleError('upsertByUserIdAndDate', error);
    }
  }

  async getConditionStats(startDate: Date, endDate: Date): Promise<Record<string, number>> {
    try {
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const { data, error } = await this.client
        .from(this.tableName)
        .select('condition')
        .gte('date', startDateStr)
        .lte('date', endDateStr);

      if (error) throw error;

      // Count conditions
      const stats: Record<string, number> = {};
      data?.forEach(report => {
        stats[report.condition] = (stats[report.condition] || 0) + 1;
      });

      return stats;
    } catch (error) {
      return this.handleError('getConditionStats', error);
    }
  }
}