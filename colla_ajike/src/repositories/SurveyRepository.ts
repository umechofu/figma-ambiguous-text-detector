import { BaseRepository } from './BaseRepository';
import { Survey, CreateSurveyRequest, UpdateSurveyRequest, SurveyResponse, CreateSurveyResponseRequest, SurveyResults } from '../models/Survey';
import { v4 as uuidv4 } from 'uuid';

export class SurveyRepository extends BaseRepository<Survey> {
  constructor() {
    super('surveys');
  }

  async create(surveyData: CreateSurveyRequest): Promise<Survey> {
    try {
      // Add IDs to questions
      const questionsWithIds = surveyData.questions.map(q => ({
        ...q,
        id: uuidv4()
      }));

      const data = {
        ...surveyData,
        questions: questionsWithIds
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

  async update(id: string, surveyData: UpdateSurveyRequest): Promise<Survey> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .update(this.transformToSnakeCase(surveyData))
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return this.transformDates(data);
    } catch (error) {
      return this.handleError('update', error);
    }
  }

  async findActiveSurveys(): Promise<Survey[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*, creator:users!created_by(*)')
        .eq('is_active', true)
        .or('expires_at.is.null,expires_at.gt.now()')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data ? data.map(item => this.transformDates(item)) : [];
    } catch (error) {
      return this.handleError('findActiveSurveys', error);
    }
  }

  async findByCreator(creatorId: string): Promise<Survey[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('created_by', creatorId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data ? data.map(item => this.transformDates(item)) : [];
    } catch (error) {
      return this.handleError('findByCreator', error);
    }
  }

  async findByChannelId(channelId: string): Promise<Survey[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('channel_id', channelId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data ? data.map(item => this.transformDates(item)) : [];
    } catch (error) {
      return this.handleError('findByChannelId', error);
    }
  }
}

export class SurveyResponseRepository extends BaseRepository<SurveyResponse> {
  constructor() {
    super('survey_responses');
  }

  async create(responseData: CreateSurveyResponseRequest): Promise<SurveyResponse> {
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

  async findBySurveyId(surveyId: string): Promise<SurveyResponse[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*, users(*)')
        .eq('survey_id', surveyId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data ? data.map(item => this.transformDates(item)) : [];
    } catch (error) {
      return this.handleError('findBySurveyId', error);
    }
  }

  async findByUserId(userId: string): Promise<SurveyResponse[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*, surveys(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data ? data.map(item => this.transformDates(item)) : [];
    } catch (error) {
      return this.handleError('findByUserId', error);
    }
  }

  async findBySurveyIdAndUserId(surveyId: string, userId: string): Promise<SurveyResponse | null> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('survey_id', surveyId)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return data ? this.transformDates(data) : null;
    } catch (error) {
      return this.handleError('findBySurveyIdAndUserId', error);
    }
  }

  async getSurveyResults(surveyId: string): Promise<SurveyResults | null> {
    try {
      const surveyRepo = new SurveyRepository();
      const survey = await surveyRepo.findById(surveyId);
      
      if (!survey) return null;

      const responses = await this.findBySurveyId(surveyId);

      // Generate summary statistics
      const summary: Record<string, any> = {};
      
      survey.questions.forEach(question => {
        const questionResponses = responses
          .map(r => r.responses[question.id])
          .filter(r => r !== undefined && r !== null);

        if (question.type === 'multiple_choice' || question.type === 'single_choice') {
          // Count choices
          const counts: Record<string, number> = {};
          questionResponses.forEach(response => {
            if (Array.isArray(response)) {
              response.forEach(choice => {
                counts[choice] = (counts[choice] || 0) + 1;
              });
            } else {
              counts[response] = (counts[response] || 0) + 1;
            }
          });
          summary[question.id] = { type: 'choice_counts', data: counts };
        } else if (question.type === 'rating') {
          // Calculate average rating
          const ratings = questionResponses.map(r => Number(r)).filter(r => !isNaN(r));
          const average = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
          summary[question.id] = { type: 'rating_average', data: { average, count: ratings.length } };
        } else if (question.type === 'boolean') {
          // Count true/false
          const trueCount = questionResponses.filter(r => r === true || r === 'true').length;
          const falseCount = questionResponses.filter(r => r === false || r === 'false').length;
          summary[question.id] = { type: 'boolean_counts', data: { true: trueCount, false: falseCount } };
        } else {
          // Text responses
          summary[question.id] = { type: 'text_responses', data: questionResponses };
        }
      });

      return {
        survey,
        totalResponses: responses.length,
        responses,
        summary
      };
    } catch (error) {
      return this.handleError('getSurveyResults', error);
    }
  }
}