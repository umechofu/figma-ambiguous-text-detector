import { BaseRepository } from './BaseRepository';
import { Profile, CreateProfileRequest, UpdateProfileRequest } from '../models/Profile';

export class ProfileRepository extends BaseRepository<Profile> {
  constructor() {
    super('profiles');
  }

  async create(profileData: CreateProfileRequest): Promise<Profile> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .insert([this.transformToSnakeCase(profileData)])
        .select()
        .single();

      if (error) throw error;

      return this.transformDates(data);
    } catch (error) {
      return this.handleError('create', error);
    }
  }

  async update(id: string, profileData: UpdateProfileRequest): Promise<Profile> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .update(this.transformToSnakeCase(profileData))
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return this.transformDates(data);
    } catch (error) {
      return this.handleError('update', error);
    }
  }

  async findByUserId(userId: string): Promise<Profile | null> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return data ? this.transformDates(data) : null;
    } catch (error) {
      return this.handleError('findByUserId', error);
    }
  }

  async findByExpertise(expertise: string): Promise<Profile[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*, users(*)')
        .contains('expertise', [expertise]);

      if (error) throw error;

      return data ? data.map(item => this.transformDates(item)) : [];
    } catch (error) {
      return this.handleError('findByExpertise', error);
    }
  }

  async upsertByUserId(profileData: CreateProfileRequest): Promise<Profile> {
    try {
      const existingProfile = await this.findByUserId(profileData.userId);
      
      if (existingProfile) {
        return this.update(existingProfile.id, profileData);
      } else {
        return this.create(profileData);
      }
    } catch (error) {
      return this.handleError('upsertByUserId', error);
    }
  }
}