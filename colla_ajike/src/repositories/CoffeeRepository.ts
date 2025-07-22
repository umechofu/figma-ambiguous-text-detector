import { BaseRepository } from './BaseRepository';
import { Coffee, CreateCoffeeRequest, CoffeeStats } from '../models/Coffee';

export class CoffeeRepository extends BaseRepository<Coffee> {
  constructor() {
    super('coffee');
  }

  async create(coffeeData: CreateCoffeeRequest): Promise<Coffee> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .insert([this.transformToSnakeCase(coffeeData)])
        .select()
        .single();

      if (error) throw error;

      return this.transformDates(data);
    } catch (error) {
      return this.handleError('create', error);
    }
  }

  async findBySenderId(senderId: string, limit?: number): Promise<Coffee[]> {
    try {
      let query = this.client
        .from(this.tableName)
        .select('*, sender:users!sender_id(*), receiver:users!receiver_id(*)')
        .eq('sender_id', senderId)
        .order('created_at', { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data ? data.map(item => this.transformDates(item)) : [];
    } catch (error) {
      return this.handleError('findBySenderId', error);
    }
  }

  async findByReceiverId(receiverId: string, limit?: number): Promise<Coffee[]> {
    try {
      let query = this.client
        .from(this.tableName)
        .select('*, sender:users!sender_id(*), receiver:users!receiver_id(*)')
        .eq('receiver_id', receiverId)
        .order('created_at', { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data ? data.map(item => this.transformDates(item)) : [];
    } catch (error) {
      return this.handleError('findByReceiverId', error);
    }
  }

  async getCoffeeStats(userId: string, startDate?: Date, endDate?: Date): Promise<CoffeeStats> {
    try {
      let sentQuery = this.client
        .from(this.tableName)
        .select('id', { count: 'exact' })
        .eq('sender_id', userId);

      let receivedQuery = this.client
        .from(this.tableName)
        .select('id', { count: 'exact' })
        .eq('receiver_id', userId);

      if (startDate) {
        sentQuery = sentQuery.gte('created_at', startDate.toISOString());
        receivedQuery = receivedQuery.gte('created_at', startDate.toISOString());
      }

      if (endDate) {
        sentQuery = sentQuery.lte('created_at', endDate.toISOString());
        receivedQuery = receivedQuery.lte('created_at', endDate.toISOString());
      }

      const [sentResult, receivedResult, userResult] = await Promise.all([
        sentQuery,
        receivedQuery,
        this.client.from('users').select('name').eq('id', userId).single()
      ]);

      if (sentResult.error) throw sentResult.error;
      if (receivedResult.error) throw receivedResult.error;
      if (userResult.error) throw userResult.error;

      return {
        userId,
        userName: userResult.data.name,
        totalSent: sentResult.count || 0,
        totalReceived: receivedResult.count || 0
      };
    } catch (error) {
      return this.handleError('getCoffeeStats', error);
    }
  }

  async getMonthlyRanking(year: number, month: number): Promise<CoffeeStats[]> {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const { data, error } = await this.client
        .rpc('get_coffee_ranking', {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString()
        });

      if (error) throw error;

      return data ? data.map((item: any, index: number) => ({
        userId: item.user_id,
        userName: item.user_name,
        totalReceived: item.total_received,
        totalSent: item.total_sent,
        rank: index + 1
      })) : [];
    } catch (error) {
      // Fallback if RPC function doesn't exist
      return this.getManualRanking(startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1), endDate || new Date());
    }
  }

  private async getManualRanking(startDate: Date, endDate: Date): Promise<CoffeeStats[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('receiver_id, sender_id, receiver:users!receiver_id(name), sender:users!sender_id(name)')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      // Aggregate data manually
      const stats: Record<string, CoffeeStats> = {};

      data?.forEach((coffee: any) => {
        // Count received
        if (!stats[coffee.receiver_id]) {
          stats[coffee.receiver_id] = {
            userId: coffee.receiver_id,
            userName: coffee.receiver.name,
            totalReceived: 0,
            totalSent: 0
          };
        }
        stats[coffee.receiver_id].totalReceived++;

        // Count sent
        if (!stats[coffee.sender_id]) {
          stats[coffee.sender_id] = {
            userId: coffee.sender_id,
            userName: coffee.sender.name,
            totalReceived: 0,
            totalSent: 0
          };
        }
        stats[coffee.sender_id].totalSent++;
      });

      // Sort by total received and add rank
      const ranking = Object.values(stats)
        .sort((a, b) => b.totalReceived - a.totalReceived)
        .map((stat, index) => ({ ...stat, rank: index + 1 }));

      return ranking;
    } catch (error) {
      return this.handleError('getManualRanking', error);
    }
  }

  async getRecentCoffee(limit: number = 10): Promise<Coffee[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*, sender:users!sender_id(*), receiver:users!receiver_id(*)')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data ? data.map(item => this.transformDates(item)) : [];
    } catch (error) {
      return this.handleError('getRecentCoffee', error);
    }
  }
}