export interface User {
  id: string;
  slackId: string;
  name: string;
  email?: string;
  department?: string;
  role?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserRequest {
  slackId: string;
  name: string;
  email?: string;
  department?: string;
  role?: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  department?: string;
  role?: string;
}