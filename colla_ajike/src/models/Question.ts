export interface Question {
  id: string;
  content: string;
  category: string;
  isCustom: boolean;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateQuestionRequest {
  content: string;
  category: string;
  isCustom?: boolean;
  isActive?: boolean;
  createdBy?: string;
}

export interface UpdateQuestionRequest {
  content?: string;
  category?: string;
  isActive?: boolean;
}

export interface ShuffleResponse {
  id: string;
  questionId: string;
  userId: string;
  response: string;
  channelId: string;
  messageTs?: string;
  createdAt: Date;
}

export interface CreateShuffleResponseRequest {
  questionId: string;
  userId: string;
  response: string;
  channelId: string;
  messageTs?: string;
}