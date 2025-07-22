export interface Profile {
  id: string;
  userId: string;
  workStyle?: string;
  communicationStyle?: string;
  expertise: string[];
  availability?: string;
  preferences: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProfileRequest {
  userId: string;
  workStyle?: string;
  communicationStyle?: string;
  expertise?: string[];
  availability?: string;
  preferences?: Record<string, any>;
}

export interface UpdateProfileRequest {
  workStyle?: string;
  communicationStyle?: string;
  expertise?: string[];
  availability?: string;
  preferences?: Record<string, any>;
}