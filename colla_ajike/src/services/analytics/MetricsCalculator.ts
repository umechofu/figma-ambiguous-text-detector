import { UserRepository } from '../../repositories/UserRepository';
import { ProfileRepository } from '../../repositories/ProfileRepository';
import { ShuffleResponseRepository } from '../../repositories/QuestionRepository';
import { CoffeeRepository } from '../../repositories/CoffeeRepository';
import { DailyReportRepository } from '../../repositories/DailyReportRepository';
import { SurveyRepository, SurveyResponseRepository } from '../../repositories/SurveyRepository';
import { logger } from '../../utils/logger';

export interface TimePeriod {
  start: Date;
  end: Date;
  type: '7days' | '30days' | '90days' | 'custom';
}

export interface EngagementScore {
  overall: number;        // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
  components: {
    profiles: number;     // 20%
    coffee: number;       // 25%
    shuffle: number;      // 20%
    surveys: number;      // 15%
    ai: number;          // 10%
    retention: number;    // 10%
  };
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
}

export interface ActiveUserMetrics {
  totalUsers: number;
  activeUsers: number;
  activePeriodUsers: number;
  engagementRate: number;
  retentionRate: number;
}

export interface FeatureAdoptionMetrics {
  profiles: {
    totalUsers: number;
    createdProfiles: number;
    adoptionRate: number;
  };
  coffee: {
    totalUsers: number;
    activeSenders: number;
    adoptionRate: number;
  };
  shuffle: {
    totalUsers: number;
    activeParticipants: number;
    adoptionRate: number;
  };
  surveys: {
    totalUsers: number;
    activeParticipants: number;
    adoptionRate: number;
  };
  ai: {
    totalUsers: number;
    activeUsers: number;
    adoptionRate: number;
  };
}

export interface TrendMetrics {
  period: TimePeriod;
  dataPoints: TrendPoint[];
  direction: 'improving' | 'declining' | 'stable';
  changeRate: number;
}

export interface TrendPoint {
  date: Date;
  value: number;
  metric: string;
}

export interface RetentionMetrics {
  newUsersCount: number;
  returningUsersCount: number;
  churnedUsersCount: number;
  retentionRate: number;
  churnRate: number;
}

export class MetricsCalculator {
  private userRepository: UserRepository;
  private profileRepository: ProfileRepository;
  private shuffleResponseRepository: ShuffleResponseRepository;
  private coffeeRepository: CoffeeRepository;
  private dailyReportRepository: DailyReportRepository;
  private surveyRepository: SurveyRepository;
  private surveyResponseRepository: SurveyResponseRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.profileRepository = new ProfileRepository();
    this.shuffleResponseRepository = new ShuffleResponseRepository();
    this.coffeeRepository = new CoffeeRepository();
    this.dailyReportRepository = new DailyReportRepository();
    this.surveyRepository = new SurveyRepository();
    this.surveyResponseRepository = new SurveyResponseRepository();
  }

  async calculateEngagementScore(userId?: string): Promise<EngagementScore> {
    try {
      logger.info('Calculating engagement score', { userId });

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days

      // Get previous period for trend calculation
      const prevEndDate = new Date(startDate);
      const prevStartDate = new Date(prevEndDate);
      prevStartDate.setDate(prevStartDate.getDate() - 30);

      const [currentScore, previousScore] = await Promise.all([
        this.calculateScoreForPeriod(startDate, endDate, userId),
        this.calculateScoreForPeriod(prevStartDate, prevEndDate, userId)
      ]);

      // Calculate trend
      const changePercent = previousScore.overall > 0 ? 
        ((currentScore.overall - previousScore.overall) / previousScore.overall) * 100 : 0;
      
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (Math.abs(changePercent) > 5) {
        trend = changePercent > 0 ? 'up' : 'down';
      }

      // Calculate grade
      const grade = this.calculateGrade(currentScore.overall);

      return {
        overall: currentScore.overall,
        grade,
        components: currentScore.components,
        trend,
        changePercent
      };
    } catch (error) {
      logger.error('Error calculating engagement score:', error);
      throw error;
    }
  }

  private async calculateScoreForPeriod(startDate: Date, endDate: Date, userId?: string): Promise<EngagementScore> {
    const [
      users,
      profiles,
      shuffleResponses,
      coffees,
      dailyReports,
      surveyResponses
    ] = await Promise.all([
      userId ? [await this.userRepository.findById(userId)].filter(Boolean) : this.userRepository.findAll(),
      this.profileRepository.findAll(),
      this.shuffleResponseRepository.findAll(),
      this.coffeeRepository.findAll(),
      this.dailyReportRepository.findByDateRange(startDate, endDate),
      this.surveyResponseRepository.findAll()
    ]);

    // Filter data by date range and user if specified
    const filteredShuffleResponses = shuffleResponses.filter(r => 
      r.createdAt >= startDate && r.createdAt <= endDate &&
      (!userId || r.userId === userId)
    );
    
    const filteredCoffees = coffees.filter(c => 
      c.createdAt >= startDate && c.createdAt <= endDate &&
      (!userId || c.senderId === userId || c.receiverId === userId)
    );
    
    const filteredSurveyResponses = surveyResponses.filter(r => 
      r.createdAt >= startDate && r.createdAt <= endDate &&
      (!userId || r.userId === userId)
    );

    const filteredDailyReports = dailyReports.filter(r => 
      (!userId || r.userId === userId)
    );

    // Calculate component scores
    const components = {
      profiles: this.calculateProfileScore(users, profiles, userId),
      coffee: this.calculateCoffeeScore(users, filteredCoffees, userId),
      shuffle: this.calculateShuffleScore(users, filteredShuffleResponses, userId),
      surveys: this.calculateSurveyScore(users, filteredSurveyResponses, userId),
      ai: this.calculateAIScore(users, userId), // Placeholder - will implement when AI logging is available
      retention: this.calculateRetentionScore(users, filteredDailyReports, userId)
    };

    // Calculate overall score with weights
    const overall = Math.round(
      components.profiles * 0.20 +
      components.coffee * 0.25 +
      components.shuffle * 0.20 +
      components.surveys * 0.15 +
      components.ai * 0.10 +
      components.retention * 0.10
    );

    return {
      overall,
      grade: this.calculateGrade(overall),
      components,
      trend: 'stable',
      changePercent: 0
    };
  }

  private calculateProfileScore(users: any[], profiles: any[], userId?: string): number {
    if (userId) {
      // Individual user score
      const userProfile = profiles.find(p => p.userId === userId);
      return userProfile ? 100 : 0;
    }

    // Organization score
    if (users.length === 0) return 0;
    const profiledUsers = profiles.length;
    return Math.min(100, (profiledUsers / users.length) * 100);
  }

  private calculateCoffeeScore(users: any[], coffees: any[], userId?: string): number {
    if (userId) {
      // Individual user score based on coffee activity
      const userCoffees = coffees.filter(c => c.senderId === userId || c.receiverId === userId);
      return Math.min(100, userCoffees.length * 5); // 5 points per coffee, max 100
    }

    // Organization score based on participation rate
    if (users.length === 0) return 0;
    const activeCoffeeUsers = new Set([
      ...coffees.map(c => c.senderId),
      ...coffees.map(c => c.receiverId)
    ]);
    return Math.min(100, (activeCoffeeUsers.size / users.length) * 100);
  }

  private calculateShuffleScore(users: any[], shuffleResponses: any[], userId?: string): number {
    if (userId) {
      // Individual user score
      const userResponses = shuffleResponses.filter(r => r.userId === userId);
      return Math.min(100, userResponses.length * 10); // 10 points per response, max 100
    }

    // Organization score
    if (users.length === 0) return 0;
    const activeShuffleUsers = new Set(shuffleResponses.map(r => r.userId));
    return Math.min(100, (activeShuffleUsers.size / users.length) * 100);
  }

  private calculateSurveyScore(users: any[], surveyResponses: any[], userId?: string): number {
    if (userId) {
      // Individual user score
      const userResponses = surveyResponses.filter(r => r.userId === userId);
      return Math.min(100, userResponses.length * 15); // 15 points per survey response, max 100
    }

    // Organization score
    if (users.length === 0) return 0;
    const activeSurveyUsers = new Set(surveyResponses.map(r => r.userId));
    return Math.min(100, (activeSurveyUsers.size / users.length) * 100);
  }

  private calculateAIScore(users: any[], userId?: string): number {
    // Placeholder implementation - will implement when AI interaction logging is available
    // For now, return a default score
    return 50;
  }

  private calculateRetentionScore(users: any[], dailyReports: any[], userId?: string): number {
    if (userId) {
      // Individual user score based on consistency
      const userReports = dailyReports.filter(r => r.userId === userId);
      const dayCount = userReports.length;
      return Math.min(100, dayCount * 3.33); // 3.33 points per day to reach 100 in 30 days
    }

    // Organization score based on daily participation
    if (users.length === 0) return 0;
    const activeDailyUsers = new Set(dailyReports.map(r => r.userId));
    return Math.min(100, (activeDailyUsers.size / users.length) * 100);
  }

  private calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'E' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'E';
  }

  async calculateTrendMetrics(period: TimePeriod): Promise<TrendMetrics> {
    try {
      logger.info('Calculating trend metrics', { period });

      const dataPoints: TrendPoint[] = [];
      const daysDiff = Math.ceil((period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24));
      
      // Generate data points for each day in the period
      for (let i = 0; i < daysDiff; i++) {
        const date = new Date(period.start);
        date.setDate(date.getDate() + i);
        
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        // Get daily activity count
        const [shuffleResponses, coffees, dailyReports, surveyResponses] = await Promise.all([
          this.shuffleResponseRepository.findAll(),
          this.coffeeRepository.findAll(),
          this.dailyReportRepository.findByDateRange(dayStart, dayEnd),
          this.surveyResponseRepository.findAll()
        ]);

        const dailyActivity = 
          shuffleResponses.filter(r => r.createdAt >= dayStart && r.createdAt <= dayEnd).length +
          coffees.filter(c => c.createdAt >= dayStart && c.createdAt <= dayEnd).length +
          dailyReports.length +
          surveyResponses.filter(r => r.createdAt >= dayStart && r.createdAt <= dayEnd).length;

        dataPoints.push({
          date,
          value: dailyActivity,
          metric: 'daily_activity'
        });
      }

      // Calculate trend direction and change rate
      const firstWeek = dataPoints.slice(0, 7);
      const lastWeek = dataPoints.slice(-7);
      
      const firstWeekAvg = firstWeek.reduce((sum, point) => sum + point.value, 0) / firstWeek.length;
      const lastWeekAvg = lastWeek.reduce((sum, point) => sum + point.value, 0) / lastWeek.length;
      
      const changeRate = firstWeekAvg > 0 ? ((lastWeekAvg - firstWeekAvg) / firstWeekAvg) * 100 : 0;
      
      let direction: 'improving' | 'declining' | 'stable' = 'stable';
      if (Math.abs(changeRate) > 10) {
        direction = changeRate > 0 ? 'improving' : 'declining';
      }

      return {
        period,
        dataPoints,
        direction,
        changeRate
      };
    } catch (error) {
      logger.error('Error calculating trend metrics:', error);
      throw error;
    }
  }

  async calculateActiveUsers(period: TimePeriod): Promise<ActiveUserMetrics> {
    try {
      logger.info('Calculating active user metrics', { period });

      const [
        users,
        shuffleResponses,
        coffees,
        dailyReports,
        surveyResponses
      ] = await Promise.all([
        this.userRepository.findAll(),
        this.shuffleResponseRepository.findAll(),
        this.coffeeRepository.findAll(),
        this.dailyReportRepository.findByDateRange(period.start, period.end),
        this.surveyResponseRepository.findAll()
      ]);

      // Filter data by period
      const periodShuffleResponses = shuffleResponses.filter(r => 
        r.createdAt >= period.start && r.createdAt <= period.end
      );
      const periodCoffees = coffees.filter(c => 
        c.createdAt >= period.start && c.createdAt <= period.end
      );
      const periodSurveyResponses = surveyResponses.filter(r => 
        r.createdAt >= period.start && r.createdAt <= period.end
      );

      // Calculate active users (users with any activity)
      const activeUserIds = new Set([
        ...periodShuffleResponses.map(r => r.userId),
        ...periodCoffees.map(c => c.senderId),
        ...periodCoffees.map(c => c.receiverId),
        ...dailyReports.map(r => r.userId),
        ...periodSurveyResponses.map(r => r.userId)
      ]);

      const totalUsers = users.length;
      const activeUsers = activeUserIds.size;
      const engagementRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;

      // Calculate retention rate (users active in both current and previous period)
      const prevPeriodStart = new Date(period.start);
      prevPeriodStart.setDate(prevPeriodStart.getDate() - (period.end.getDate() - period.start.getDate()));
      const prevPeriodEnd = new Date(period.start);

      const prevPeriodShuffleResponses = shuffleResponses.filter(r => 
        r.createdAt >= prevPeriodStart && r.createdAt <= prevPeriodEnd
      );
      const prevPeriodCoffees = coffees.filter(c => 
        c.createdAt >= prevPeriodStart && c.createdAt <= prevPeriodEnd
      );
      const prevPeriodDailyReports = await this.dailyReportRepository.findByDateRange(prevPeriodStart, prevPeriodEnd);
      const prevPeriodSurveyResponses = surveyResponses.filter(r => 
        r.createdAt >= prevPeriodStart && r.createdAt <= prevPeriodEnd
      );

      const prevActiveUserIds = new Set([
        ...prevPeriodShuffleResponses.map(r => r.userId),
        ...prevPeriodCoffees.map(c => c.senderId),
        ...prevPeriodCoffees.map(c => c.receiverId),
        ...prevPeriodDailyReports.map(r => r.userId),
        ...prevPeriodSurveyResponses.map(r => r.userId)
      ]);

      const returningUsers = [...activeUserIds].filter(id => prevActiveUserIds.has(id)).length;
      const retentionRate = prevActiveUserIds.size > 0 ? (returningUsers / prevActiveUserIds.size) * 100 : 0;

      return {
        totalUsers,
        activeUsers,
        activePeriodUsers: activeUsers,
        engagementRate,
        retentionRate
      };
    } catch (error) {
      logger.error('Error calculating active user metrics:', error);
      throw error;
    }
  }

  async calculateFeatureAdoption(): Promise<FeatureAdoptionMetrics> {
    try {
      logger.info('Calculating feature adoption metrics');

      const [
        users,
        profiles,
        shuffleResponses,
        coffees,
        surveyResponses
      ] = await Promise.all([
        this.userRepository.findAll(),
        this.profileRepository.findAll(),
        this.shuffleResponseRepository.findAll(),
        this.coffeeRepository.findAll(),
        this.surveyResponseRepository.findAll()
      ]);

      const totalUsers = users.length;

      // Profile adoption
      const profileUsers = new Set(profiles.map(p => p.userId));
      const profileAdoption = totalUsers > 0 ? (profileUsers.size / totalUsers) * 100 : 0;

      // Coffee adoption
      const coffeeUsers = new Set([
        ...coffees.map(c => c.senderId),
        ...coffees.map(c => c.receiverId)
      ]);
      const coffeeAdoption = totalUsers > 0 ? (coffeeUsers.size / totalUsers) * 100 : 0;

      // Shuffle adoption
      const shuffleUsers = new Set(shuffleResponses.map(r => r.userId));
      const shuffleAdoption = totalUsers > 0 ? (shuffleUsers.size / totalUsers) * 100 : 0;

      // Survey adoption
      const surveyUsers = new Set(surveyResponses.map(r => r.userId));
      const surveyAdoption = totalUsers > 0 ? (surveyUsers.size / totalUsers) * 100 : 0;

      // AI adoption (placeholder)
      const aiAdoption = 50; // Will implement when AI logging is available

      return {
        profiles: {
          totalUsers,
          createdProfiles: profileUsers.size,
          adoptionRate: profileAdoption
        },
        coffee: {
          totalUsers,
          activeSenders: coffeeUsers.size,
          adoptionRate: coffeeAdoption
        },
        shuffle: {
          totalUsers,
          activeParticipants: shuffleUsers.size,
          adoptionRate: shuffleAdoption
        },
        surveys: {
          totalUsers,
          activeParticipants: surveyUsers.size,
          adoptionRate: surveyAdoption
        },
        ai: {
          totalUsers,
          activeUsers: Math.floor(totalUsers * 0.5), // Placeholder
          adoptionRate: aiAdoption
        }
      };
    } catch (error) {
      logger.error('Error calculating feature adoption metrics:', error);
      throw error;
    }
  }

  async calculateRetentionRate(period: TimePeriod): Promise<RetentionMetrics> {
    try {
      logger.info('Calculating retention metrics', { period });

      const users = await this.userRepository.findAll();

      // Get previous period
      const periodLength = period.end.getTime() - period.start.getTime();
      const prevPeriodStart = new Date(period.start.getTime() - periodLength);
      const prevPeriodEnd = new Date(period.start);

      // Get active users in both periods
      const currentPeriodUsers = await this.getActiveUsersInPeriod(period.start, period.end);
      const previousPeriodUsers = await this.getActiveUsersInPeriod(prevPeriodStart, prevPeriodEnd);

      // Calculate metrics
      const newUsers = currentPeriodUsers.filter(id => !previousPeriodUsers.includes(id));
      const returningUsers = currentPeriodUsers.filter(id => previousPeriodUsers.includes(id));
      const churnedUsers = previousPeriodUsers.filter(id => !currentPeriodUsers.includes(id));

      const retentionRate = previousPeriodUsers.length > 0 ? 
        (returningUsers.length / previousPeriodUsers.length) * 100 : 0;
      const churnRate = previousPeriodUsers.length > 0 ? 
        (churnedUsers.length / previousPeriodUsers.length) * 100 : 0;

      return {
        newUsersCount: newUsers.length,
        returningUsersCount: returningUsers.length,
        churnedUsersCount: churnedUsers.length,
        retentionRate,
        churnRate
      };
    } catch (error) {
      logger.error('Error calculating retention metrics:', error);
      throw error;
    }
  }

  private async getActiveUsersInPeriod(startDate: Date, endDate: Date): Promise<string[]> {
    const [
      shuffleResponses,
      coffees,
      dailyReports,
      surveyResponses
    ] = await Promise.all([
      this.shuffleResponseRepository.findAll(),
      this.coffeeRepository.findAll(),
      this.dailyReportRepository.findByDateRange(startDate, endDate),
      this.surveyResponseRepository.findAll()
    ]);

    const periodShuffleResponses = shuffleResponses.filter(r => 
      r.createdAt >= startDate && r.createdAt <= endDate
    );
    const periodCoffees = coffees.filter(c => 
      c.createdAt >= startDate && c.createdAt <= endDate
    );
    const periodSurveyResponses = surveyResponses.filter(r => 
      r.createdAt >= startDate && r.createdAt <= endDate
    );

    const activeUserIds = new Set([
      ...periodShuffleResponses.map(r => r.userId),
      ...periodCoffees.map(c => c.senderId),
      ...periodCoffees.map(c => c.receiverId),
      ...dailyReports.map(r => r.userId),
      ...periodSurveyResponses.map(r => r.userId)
    ]);

    return Array.from(activeUserIds);
  }
}