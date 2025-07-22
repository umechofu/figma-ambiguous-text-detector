export interface DailyReport {
  id: string;
  userId: string;
  condition: string; // weather icon or condition
  progress?: string;
  notes?: string;
  date: Date;
  createdAt: Date;
}

export interface CreateDailyReportRequest {
  userId: string;
  condition: string;
  progress?: string;
  notes?: string;
  date?: Date; // defaults to today
}

export interface UpdateDailyReportRequest {
  condition?: string;
  progress?: string;
  notes?: string;
}

export type WeatherCondition = 
  | 'sunny' 
  | 'cloudy' 
  | 'rainy' 
  | 'stormy' 
  | 'snowy' 
  | 'foggy';