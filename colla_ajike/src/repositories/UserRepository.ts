import { BaseRepository } from './BaseRepository';
import { User, CreateUserRequest, UpdateUserRequest } from '../models/User';

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super('users');
  }

  async create(userData: CreateUserRequest): Promise<User> {
    try {
      // Use slackId as the primary key id
      const dataWithId = {
        id: userData.slackId,
        ...userData
      };

      const { data, error } = await this.client
        .from(this.tableName)
        .insert([this.transformToSnakeCase(dataWithId)])
        .select()
        .single();

      if (error) throw error;

      return this.transformDates(data);
    } catch (error) {
      return this.handleError('create', error);
    }
  }

  async update(id: string, userData: UpdateUserRequest): Promise<User> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .update(this.transformToSnakeCase(userData))
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return this.transformDates(data);
    } catch (error) {
      return this.handleError('update', error);
    }
  }

  async findBySlackId(slackId: string): Promise<User | null> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('slack_id', slackId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return data ? this.transformDates(data) : null;
    } catch (error) {
      return this.handleError('findBySlackId', error);
    }
  }

  async findByDepartment(department: string): Promise<User[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('department', department);

      if (error) throw error;

      return data ? data.map(item => this.transformDates(item)) : [];
    } catch (error) {
      return this.handleError('findByDepartment', error);
    }
  }

  async upsertBySlackId(userData: CreateUserRequest): Promise<User> {
    try {
      const existingUser = await this.findBySlackId(userData.slackId);
      
      if (existingUser) {
        return this.update(existingUser.id, userData);
      } else {
        return this.create(userData);
      }
    } catch (error) {
      return this.handleError('upsertBySlackId', error);
    }
  }
}