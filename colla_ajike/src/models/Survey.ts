export interface Survey {
  id: string;
  title: string;
  description?: string;
  questions: SurveyQuestion[];
  createdBy: string;
  channelId: string;
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SurveyQuestion {
  id: string;
  type: 'text' | 'multiple_choice' | 'single_choice' | 'rating' | 'boolean';
  question: string;
  options?: string[]; // for choice questions
  required?: boolean;
}

export interface CreateSurveyRequest {
  title: string;
  description?: string;
  questions: Omit<SurveyQuestion, 'id'>[];
  createdBy: string;
  channelId: string;
  expiresAt?: Date;
}

export interface UpdateSurveyRequest {
  title?: string;
  description?: string;
  questions?: SurveyQuestion[];
  isActive?: boolean;
  expiresAt?: Date;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  userId: string;
  responses: Record<string, any>; // questionId -> answer
  createdAt: Date;
}

export interface CreateSurveyResponseRequest {
  surveyId: string;
  userId: string;
  responses: Record<string, any>;
}

export interface SurveyResults {
  survey: Survey;
  totalResponses: number;
  responses: SurveyResponse[];
  summary: Record<string, any>; // question-specific summaries
}