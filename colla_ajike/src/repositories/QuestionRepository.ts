import { BaseRepository } from './BaseRepository';
import { Question, CreateQuestionRequest, UpdateQuestionRequest, ShuffleResponse, CreateShuffleResponseRequest } from '../models/Question';

export class QuestionRepository extends BaseRepository<Question> {
  constructor() {
    super('questions');
  }

  async create(questionData: CreateQuestionRequest): Promise<Question> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .insert([this.transformToSnakeCase(questionData)])
        .select()
        .single();

      if (error) throw error;

      return this.transformDates(data);
    } catch (error) {
      return this.handleError('create', error);
    }
  }

  async update(id: string, questionData: UpdateQuestionRequest): Promise<Question> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .update(this.transformToSnakeCase(questionData))
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return this.transformDates(data);
    } catch (error) {
      return this.handleError('update', error);
    }
  }

  async findActiveQuestions(): Promise<Question[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data ? data.map(item => this.transformDates(item)) : [];
    } catch (error) {
      return this.handleError('findActiveQuestions', error);
    }
  }

  async findByCategory(category: string): Promise<Question[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('category', category)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data ? data.map(item => this.transformDates(item)) : [];
    } catch (error) {
      return this.handleError('findByCategory', error);
    }
  }

  async getRandomQuestion(excludeIds: string[] = []): Promise<Question | null> {
    try {
      let query = this.client
        .from(this.tableName)
        .select('*')
        .eq('is_active', true);

      if (excludeIds.length > 0) {
        query = query.not('id', 'in', `(${excludeIds.join(',')})`);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (!data || data.length === 0) return null;

      // Select random question
      const randomIndex = Math.floor(Math.random() * data.length);
      return this.transformDates(data[randomIndex]);
    } catch (error) {
      return this.handleError('getRandomQuestion', error);
    }
  }
}

export class ShuffleResponseRepository extends BaseRepository<ShuffleResponse> {
  constructor() {
    super('shuffle_responses');
  }

  async create(responseData: CreateShuffleResponseRequest): Promise<ShuffleResponse> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .insert([this.transformToSnakeCase(responseData)])
        .select()
        .single();

      if (error) throw error;

      return this.transformDates(data);
    } catch (error) {
      return this.handleError('create', error);
    }
  }

  async findByUserId(userId: string, limit?: number): Promise<ShuffleResponse[]> {
    try {
      let query = this.client
        .from(this.tableName)
        .select('*, questions(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

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

  async findByQuestionId(questionId: string): Promise<ShuffleResponse[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*, users(*)')
        .eq('question_id', questionId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data ? data.map(item => this.transformDates(item)) : [];
    } catch (error) {
      return this.handleError('findByQuestionId', error);
    }
  }

  async findRecentResponses(limit: number = 10): Promise<ShuffleResponse[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*, users(*), questions(*)')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data ? data.map(item => this.transformDates(item)) : [];
    } catch (error) {
      return this.handleError('findRecentResponses', error);
    }
  }
}