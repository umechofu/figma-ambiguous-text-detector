export interface Coffee {
  id: string;
  senderId: string;
  receiverId: string;
  message?: string;
  channelId: string;
  createdAt: Date;
}

export interface CreateCoffeeRequest {
  senderId: string;
  receiverId: string;
  message?: string;
  channelId: string;
}

export interface CoffeeStats {
  userId: string;
  userName: string;
  totalReceived: number;
  totalSent: number;
  rank?: number;
}

export interface CoffeeRanking {
  period: string; // e.g., "2024-01"
  rankings: CoffeeStats[];
  generatedAt: Date;
}