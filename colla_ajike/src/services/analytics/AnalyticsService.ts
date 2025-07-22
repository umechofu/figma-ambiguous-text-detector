import { UserRepository } from '../../repositories/UserRepository';
import { ProfileRepository } from '../../repositories/ProfileRepository';
import { ShuffleResponseRepository } from '../../repositories/QuestionRepository';
import { CoffeeRepository } from '../../repositories/CoffeeRepository';
import { DailyReportRepository } from '../../repositories/DailyReportRepository';
import { SurveyRepository, SurveyResponseRepository } from '../../repositories/SurveyRepository';
import { logger } from '../../utils/logger';

export interface EngagementMetrics {
  totalUsers: number;
  activeUsers: number;
  engagementRate: number;
  averageActivityPerUser: number;
  topContributors: UserContribution[];
  activityTrends: ActivityTrend[];
}

export interface UserContribution {
  userId: string;
  userName: string;
  shuffleResponses: number;
  coffeesSent: number;
  coffeesReceived: number;
  dailyReports: number;
  surveyResponses: number;
  totalScore: number;
}

export interface ActivityTrend {
  date: string;
  shuffleResponses: number;
  coffeesSent: number;
  dailyReports: number;
  surveyResponses: number;
  totalActivity: number;
}

export interface KnowledgeSharingMetrics {
  totalShuffleResponses: number;
  averageResponseLength: number;
  topCategories: CategoryMetric[];
  responseQuality: QualityMetric[];
  knowledgeGrowth: GrowthMetric[];
}

export interface CategoryMetric {
  category: string;
  count: number;
  percentage: number;
  averageLength: number;
}

export interface QualityMetric {
  userId: string;
  userName: string;
  averageLength: number;
  responseCount: number;
  qualityScore: number;
}

export interface GrowthMetric {
  period: string;
  newResponses: number;
  newUsers: number;
  growthRate: number;
}

export interface CoffeeAnalytics {
  totalCoffeesSent: number;
  averageCoffeesPerUser: number;
  topSenders: CoffeeSender[];
  topReceivers: CoffeeReceiver[];
  coffeeNetwork: NetworkMetric[];
  monthlyTrends: CoffeeTrend[];
}

export interface CoffeeSender {
  userId: string;
  userName: string;
  coffeesSent: number;
  uniqueRecipients: number;
  generosityScore: number;
}

export interface CoffeeReceiver {
  userId: string;
  userName: string;
  coffeesReceived: number;
  uniqueSenders: number;
  popularityScore: number;
}

export interface NetworkMetric {
  userId: string;
  userName: string;
  connections: number;
  centralityScore: number;
}

export interface CoffeeTrend {
  month: string;
  totalCoffees: number;
  activeUsers: number;
  averagePerUser: number;
}

export interface TeamHealthMetrics {
  averageCondition: number;
  conditionDistribution: Record<string, number>;
  participationRate: number;
  consistentReporters: string[];
  concerningTrends: HealthConcern[];
  teamMorale: MoraleMetric[];
}

export interface HealthConcern {
  userId: string;
  userName: string;
  trend: 'declining' | 'consistently_low';
  severity: 'low' | 'medium' | 'high';
  duration: number; // days
}

export interface MoraleMetric {
  period: string;
  averageCondition: number;
  participationRate: number;
  trend: 'improving' | 'declining' | 'stable';
}

export class AnalyticsService {
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

  async getEngagementMetrics(startDate: Date, endDate: Date): Promise<EngagementMetrics> {
    try {
      logger.info('Calculating engagement metrics', { startDate, endDate });

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
        this.dailyReportRepository.findByDateRange(startDate, endDate),
        this.surveyResponseRepository.findAll()
      ]);

      // Filter data by date range
      const filteredShuffleResponses = shuffleResponses.filter(r => 
        r.createdAt >= startDate && r.createdAt <= endDate
      );
      const filteredCoffees = coffees.filter(c => 
        c.createdAt >= startDate && c.createdAt <= endDate
      );
      const filteredSurveyResponses = surveyResponses.filter(r => 
        r.createdAt >= startDate && r.createdAt <= endDate
      );

      // Calculate user contributions
      const userContributions = this.calculateUserContributions(
        users,
        filteredShuffleResponses,
        filteredCoffees,
        dailyReports,
        filteredSurveyResponses
      );

      // Calculate active users (users with any activity)
      const activeUsers = userContributions.filter(u => u.totalScore > 0).length;
      const engagementRate = users.length > 0 ? (activeUsers / users.length) * 100 : 0;

      // Calculate average activity per user
      const totalActivity = userContributions.reduce((sum, u) => sum + u.totalScore, 0);
      const averageActivityPerUser = users.length > 0 ? totalActivity / users.length : 0;

      // Get top contributors
      const topContributors = userContributions
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 10);

      // Calculate activity trends
      const activityTrends = this.calculateActivityTrends(
        filteredShuffleResponses,
        filteredCoffees,
        dailyReports,
        filteredSurveyResponses,
        startDate,
        endDate
      );

      return {
        totalUsers: users.length,
        activeUsers,
        engagementRate,
        averageActivityPerUser,
        topContributors,
        activityTrends
      };
    } catch (error) {
      logger.error('Error calculating engagement metrics:', error);
      throw error;
    }
  }

  async getKnowledgeSharingMetrics(startDate: Date, endDate: Date): Promise<KnowledgeSharingMetrics> {
    try {
      logger.info('Calculating knowledge sharing metrics', { startDate, endDate });

      const shuffleResponses = await this.shuffleResponseRepository.findAll();
      const filteredResponses = shuffleResponses.filter(r => 
        r.createdAt >= startDate && r.createdAt <= endDate
      );

      const totalShuffleResponses = filteredResponses.length;
      const averageResponseLength = totalShuffleResponses > 0 
        ? filteredResponses.reduce((sum, r) => sum + r.response.length, 0) / totalShuffleResponses
        : 0;

      // Calculate category metrics
      const categoryMap = new Map<string, { count: number; totalLength: number }>();
      filteredResponses.forEach(response => {
        const category = (response as any).questions?.category || 'unknown';
        if (!categoryMap.has(category)) {
          categoryMap.set(category, { count: 0, totalLength: 0 });
        }
        const categoryData = categoryMap.get(category)!;
        categoryData.count++;
        categoryData.totalLength += response.response.length;
      });

      const topCategories: CategoryMetric[] = Array.from(categoryMap.entries())
        .map(([category, data]) => ({
          category,
          count: data.count,
          percentage: (data.count / totalShuffleResponses) * 100,
          averageLength: data.totalLength / data.count
        }))
        .sort((a, b) => b.count - a.count);

      // Calculate response quality metrics
      const userResponseMap = new Map<string, { responses: any[]; totalLength: number }>();
      filteredResponses.forEach(response => {
        const userId = response.userId;
        if (!userResponseMap.has(userId)) {
          userResponseMap.set(userId, { responses: [], totalLength: 0 });
        }
        const userData = userResponseMap.get(userId)!;
        userData.responses.push(response);
        userData.totalLength += response.response.length;
      });

      const users = await this.userRepository.findAll();
      const userMap = new Map(users.map(u => [u.id, u]));

      const responseQuality: QualityMetric[] = Array.from(userResponseMap.entries())
        .map(([userId, data]) => {
          const user = userMap.get(userId);
          const averageLength = data.totalLength / data.responses.length;
          const qualityScore = this.calculateQualityScore(data.responses, averageLength);
          
          return {
            userId,
            userName: user?.name || 'Unknown User',
            averageLength,
            responseCount: data.responses.length,
            qualityScore
          };
        })
        .sort((a, b) => b.qualityScore - a.qualityScore)
        .slice(0, 10);

      // Calculate knowledge growth
      const knowledgeGrowth = this.calculateKnowledgeGrowth(shuffleResponses, startDate, endDate);

      return {
        totalShuffleResponses,
        averageResponseLength,
        topCategories,
        responseQuality,
        knowledgeGrowth
      };
    } catch (error) {
      logger.error('Error calculating knowledge sharing metrics:', error);
      throw error;
    }
  }

  async getCoffeeAnalytics(startDate: Date, endDate: Date): Promise<CoffeeAnalytics> {
    try {
      logger.info('Calculating coffee analytics', { startDate, endDate });

      const coffees = await this.coffeeRepository.findAll();
      const filteredCoffees = coffees.filter(c => 
        c.createdAt >= startDate && c.createdAt <= endDate
      );

      const totalCoffeesSent = filteredCoffees.length;
      
      // Calculate user coffee metrics
      const senderMap = new Map<string, { sent: number; recipients: Set<string> }>();
      const receiverMap = new Map<string, { received: number; senders: Set<string> }>();

      filteredCoffees.forEach(coffee => {
        // Sender metrics
        if (!senderMap.has(coffee.senderId)) {
          senderMap.set(coffee.senderId, { sent: 0, recipients: new Set() });
        }
        const senderData = senderMap.get(coffee.senderId)!;
        senderData.sent++;
        senderData.recipients.add(coffee.receiverId);

        // Receiver metrics
        if (!receiverMap.has(coffee.receiverId)) {
          receiverMap.set(coffee.receiverId, { received: 0, senders: new Set() });
        }
        const receiverData = receiverMap.get(coffee.receiverId)!;
        receiverData.received++;
        receiverData.senders.add(coffee.senderId);
      });

      const users = await this.userRepository.findAll();
      const userMap = new Map(users.map(u => [u.id, u]));

      // Calculate top senders
      const topSenders: CoffeeSender[] = Array.from(senderMap.entries())
        .map(([userId, data]) => {
          const user = userMap.get(userId);
          const generosityScore = data.sent * 0.7 + data.recipients.size * 0.3;
          
          return {
            userId,
            userName: user?.name || 'Unknown User',
            coffeesSent: data.sent,
            uniqueRecipients: data.recipients.size,
            generosityScore
          };
        })
        .sort((a, b) => b.generosityScore - a.generosityScore)
        .slice(0, 10);

      // Calculate top receivers
      const topReceivers: CoffeeReceiver[] = Array.from(receiverMap.entries())
        .map(([userId, data]) => {
          const user = userMap.get(userId);
          const popularityScore = data.received * 0.7 + data.senders.size * 0.3;
          
          return {
            userId,
            userName: user?.name || 'Unknown User',
            coffeesReceived: data.received,
            uniqueSenders: data.senders.size,
            popularityScore
          };
        })
        .sort((a, b) => b.popularityScore - a.popularityScore)
        .slice(0, 10);

      // Calculate network metrics
      const coffeeNetwork = this.calculateCoffeeNetwork(filteredCoffees, userMap);

      // Calculate monthly trends
      const monthlyTrends = this.calculateCoffeeMonthlyTrends(coffees, startDate, endDate);

      const activeUsers = new Set([...senderMap.keys(), ...receiverMap.keys()]).size;
      const averageCoffeesPerUser = activeUsers > 0 ? totalCoffeesSent / activeUsers : 0;

      return {
        totalCoffeesSent,
        averageCoffeesPerUser,
        topSenders,
        topReceivers,
        coffeeNetwork,
        monthlyTrends
      };
    } catch (error) {
      logger.error('Error calculating coffee analytics:', error);
      throw error;
    }
  }

  async getTeamHealthMetrics(startDate: Date, endDate: Date): Promise<TeamHealthMetrics> {
    try {
      logger.info('Calculating team health metrics', { startDate, endDate });

      const dailyReports = await this.dailyReportRepository.findByDateRange(startDate, endDate);
      const users = await this.userRepository.findAll();

      if (dailyReports.length === 0) {
        return {
          averageCondition: 0,
          conditionDistribution: {},
          participationRate: 0,
          consistentReporters: [],
          concerningTrends: [],
          teamMorale: []
        };
      }

      // Calculate condition scores
      const conditionScores: Record<string, number> = {
        'sunny': 5,
        'cloudy': 4,
        'foggy': 3,
        'rainy': 2,
        'stormy': 1,
        'snowy': 3
      };

      // Calculate average condition
      const totalScore = dailyReports.reduce((sum, report) => {
        return sum + (conditionScores[report.condition] || 3);
      }, 0);
      const averageCondition = totalScore / dailyReports.length;

      // Calculate condition distribution
      const conditionDistribution: Record<string, number> = {};
      dailyReports.forEach(report => {
        conditionDistribution[report.condition] = (conditionDistribution[report.condition] || 0) + 1;
      });

      // Calculate participation rate
      const uniqueReporters = new Set(dailyReports.map(r => r.userId));
      const participationRate = (uniqueReporters.size / users.length) * 100;

      // Find consistent reporters (reported at least 80% of days)
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const userReportCounts = new Map<string, number>();
      dailyReports.forEach(report => {
        userReportCounts.set(report.userId, (userReportCounts.get(report.userId) || 0) + 1);
      });

      const userMap = new Map(users.map(u => [u.id, u]));
      const consistentReporters = Array.from(userReportCounts.entries())
        .filter(([, count]) => count >= totalDays * 0.8)
        .map(([userId]) => userMap.get(userId)?.name || 'Unknown User');

      // Identify concerning trends
      const concerningTrends = this.identifyConcerningTrends(dailyReports, userMap, conditionScores);

      // Calculate team morale trends
      const teamMorale = this.calculateTeamMoraleTrends(dailyReports, conditionScores, startDate, endDate);

      return {
        averageCondition,
        conditionDistribution,
        participationRate,
        consistentReporters,
        concerningTrends,
        teamMorale
      };
    } catch (error) {
      logger.error('Error calculating team health metrics:', error);
      throw error;
    }
  }

  async generateAnalyticsReport(startDate: Date, endDate: Date): Promise<{
    engagement: EngagementMetrics;
    knowledgeSharing: KnowledgeSharingMetrics;
    coffeeAnalytics: CoffeeAnalytics;
    teamHealth: TeamHealthMetrics;
    summary: string;
  }> {
    try {
      logger.info('Generating comprehensive analytics report', { startDate, endDate });

      const [engagement, knowledgeSharing, coffeeAnalytics, teamHealth] = await Promise.all([
        this.getEngagementMetrics(startDate, endDate),
        this.getKnowledgeSharingMetrics(startDate, endDate),
        this.getCoffeeAnalytics(startDate, endDate),
        this.getTeamHealthMetrics(startDate, endDate)
      ]);

      const summary = this.generateReportSummary(engagement, knowledgeSharing, coffeeAnalytics, teamHealth);

      return {
        engagement,
        knowledgeSharing,
        coffeeAnalytics,
        teamHealth,
        summary
      };
    } catch (error) {
      logger.error('Error generating analytics report:', error);
      throw error;
    }
  }

  private calculateUserContributions(
    users: any[],
    shuffleResponses: any[],
    coffees: any[],
    dailyReports: any[],
    surveyResponses: any[]
  ): UserContribution[] {
    const userMap = new Map(users.map(u => [u.id, u]));
    const contributions = new Map<string, UserContribution>();

    // Initialize all users
    users.forEach(user => {
      contributions.set(user.id, {
        userId: user.id,
        userName: user.name,
        shuffleResponses: 0,
        coffeesSent: 0,
        coffeesReceived: 0,
        dailyReports: 0,
        surveyResponses: 0,
        totalScore: 0
      });
    });

    // Count shuffle responses
    shuffleResponses.forEach(response => {
      const contribution = contributions.get(response.userId);
      if (contribution) {
        contribution.shuffleResponses++;
      }
    });

    // Count coffees sent and received
    coffees.forEach(coffee => {
      const senderContribution = contributions.get(coffee.senderId);
      const receiverContribution = contributions.get(coffee.receiverId);
      
      if (senderContribution) {
        senderContribution.coffeesSent++;
      }
      if (receiverContribution) {
        receiverContribution.coffeesReceived++;
      }
    });

    // Count daily reports
    dailyReports.forEach(report => {
      const contribution = contributions.get(report.userId);
      if (contribution) {
        contribution.dailyReports++;
      }
    });

    // Count survey responses
    surveyResponses.forEach(response => {
      const contribution = contributions.get(response.userId);
      if (contribution) {
        contribution.surveyResponses++;
      }
    });

    // Calculate total scores
    contributions.forEach(contribution => {
      contribution.totalScore = 
        contribution.shuffleResponses * 3 +
        contribution.coffeesSent * 1 +
        contribution.coffeesReceived * 0.5 +
        contribution.dailyReports * 1 +
        contribution.surveyResponses * 2;
    });

    return Array.from(contributions.values());
  }

  private calculateActivityTrends(
    shuffleResponses: any[],
    coffees: any[],
    dailyReports: any[],
    surveyResponses: any[],
    startDate: Date,
    endDate: Date
  ): ActivityTrend[] {
    const trends: ActivityTrend[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayShuffleResponses = shuffleResponses.filter(r => 
        r.createdAt >= currentDate && r.createdAt < nextDate
      ).length;

      const dayCoffees = coffees.filter(c => 
        c.createdAt >= currentDate && c.createdAt < nextDate
      ).length;

      const dayDailyReports = dailyReports.filter(r => 
        r.date >= currentDate && r.date < nextDate
      ).length;

      const daySurveyResponses = surveyResponses.filter(r => 
        r.createdAt >= currentDate && r.createdAt < nextDate
      ).length;

      trends.push({
        date: dateStr,
        shuffleResponses: dayShuffleResponses,
        coffeesSent: dayCoffees,
        dailyReports: dayDailyReports,
        surveyResponses: daySurveyResponses,
        totalActivity: dayShuffleResponses + dayCoffees + dayDailyReports + daySurveyResponses
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return trends;
  }

  private calculateQualityScore(responses: any[], averageLength: number): number {
    // Simple quality scoring based on length and consistency
    let score = 0;
    
    // Length score (normalized)
    const lengthScore = Math.min(averageLength / 100, 1) * 40;
    score += lengthScore;
    
    // Consistency score
    const lengths = responses.map(r => r.response.length);
    const variance = this.calculateVariance(lengths);
    const consistencyScore = Math.max(0, 30 - variance / 100);
    score += consistencyScore;
    
    // Frequency score
    const frequencyScore = Math.min(responses.length / 10, 1) * 30;
    score += frequencyScore;
    
    return Math.round(score);
  }

  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
  }

  private calculateKnowledgeGrowth(allResponses: any[], startDate: Date, endDate: Date): GrowthMetric[] {
    const growth: GrowthMetric[] = [];
    const monthsBack = 6; // Look at last 6 months
    
    for (let i = monthsBack; i >= 0; i--) {
      const periodStart = new Date(startDate);
      periodStart.setMonth(periodStart.getMonth() - i - 1);
      const periodEnd = new Date(startDate);
      periodEnd.setMonth(periodEnd.getMonth() - i);
      
      const periodResponses = allResponses.filter(r => 
        r.createdAt >= periodStart && r.createdAt < periodEnd
      );
      
      const uniqueUsers = new Set(periodResponses.map(r => r.userId));
      
      // Calculate growth rate compared to previous period
      const prevPeriodStart = new Date(periodStart);
      prevPeriodStart.setMonth(prevPeriodStart.getMonth() - 1);
      const prevPeriodResponses = allResponses.filter(r => 
        r.createdAt >= prevPeriodStart && r.createdAt < periodStart
      );
      
      const growthRate = prevPeriodResponses.length > 0 
        ? ((periodResponses.length - prevPeriodResponses.length) / prevPeriodResponses.length) * 100
        : 0;
      
      growth.push({
        period: `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}`,
        newResponses: periodResponses.length,
        newUsers: uniqueUsers.size,
        growthRate
      });
    }
    
    return growth;
  }

  private calculateCoffeeNetwork(coffees: any[], userMap: Map<string, any>): NetworkMetric[] {
    const connections = new Map<string, Set<string>>();
    
    coffees.forEach(coffee => {
      if (!connections.has(coffee.senderId)) {
        connections.set(coffee.senderId, new Set());
      }
      if (!connections.has(coffee.receiverId)) {
        connections.set(coffee.receiverId, new Set());
      }
      
      connections.get(coffee.senderId)!.add(coffee.receiverId);
      connections.get(coffee.receiverId)!.add(coffee.senderId);
    });
    
    return Array.from(connections.entries())
      .map(([userId, userConnections]) => {
        const user = userMap.get(userId);
        const centralityScore = userConnections.size; // Simplified centrality
        
        return {
          userId,
          userName: user?.name || 'Unknown User',
          connections: userConnections.size,
          centralityScore
        };
      })
      .sort((a, b) => b.centralityScore - a.centralityScore)
      .slice(0, 10);
  }

  private calculateCoffeeMonthlyTrends(allCoffees: any[], startDate: Date, endDate: Date): CoffeeTrend[] {
    const trends: CoffeeTrend[] = [];
    const currentDate = new Date(startDate);
    currentDate.setDate(1); // Start of month
    
    while (currentDate <= endDate) {
      const monthStart = new Date(currentDate);
      const monthEnd = new Date(currentDate);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      
      const monthCoffees = allCoffees.filter(c => 
        c.createdAt >= monthStart && c.createdAt < monthEnd
      );
      
      const activeUsers = new Set([
        ...monthCoffees.map(c => c.senderId),
        ...monthCoffees.map(c => c.receiverId)
      ]).size;
      
      trends.push({
        month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
        totalCoffees: monthCoffees.length,
        activeUsers,
        averagePerUser: activeUsers > 0 ? monthCoffees.length / activeUsers : 0
      });
      
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    return trends;
  }

  private identifyConcerningTrends(
    dailyReports: any[],
    userMap: Map<string, any>,
    conditionScores: Record<string, number>
  ): HealthConcern[] {
    const concerns: HealthConcern[] = [];
    const userReports = new Map<string, any[]>();
    
    // Group reports by user
    dailyReports.forEach(report => {
      if (!userReports.has(report.userId)) {
        userReports.set(report.userId, []);
      }
      userReports.get(report.userId)!.push(report);
    });
    
    userReports.forEach((reports, userId) => {
      const user = userMap.get(userId);
      if (!user || reports.length < 5) return; // Need at least 5 reports
      
      // Sort by date
      reports.sort((a, b) => a.date.getTime() - b.date.getTime());
      
      // Check for declining trend
      const recentReports = reports.slice(-7); // Last 7 reports
      const olderReports = reports.slice(-14, -7); // Previous 7 reports
      
      if (recentReports.length >= 3 && olderReports.length >= 3) {
        const recentAvg = recentReports.reduce((sum, r) => sum + (conditionScores[r.condition] || 3), 0) / recentReports.length;
        const olderAvg = olderReports.reduce((sum, r) => sum + (conditionScores[r.condition] || 3), 0) / olderReports.length;
        
        if (recentAvg < olderAvg - 0.5) {
          concerns.push({
            userId,
            userName: user.name,
            trend: 'declining',
            severity: recentAvg < 2 ? 'high' : recentAvg < 3 ? 'medium' : 'low',
            duration: recentReports.length
          });
        }
      }
      
      // Check for consistently low conditions
      const lowConditionReports = reports.filter(r => (conditionScores[r.condition] || 3) <= 2);
      if (lowConditionReports.length >= reports.length * 0.7) {
        concerns.push({
          userId,
          userName: user.name,
          trend: 'consistently_low',
          severity: 'medium',
          duration: reports.length
        });
      }
    });
    
    return concerns;
  }

  private calculateTeamMoraleTrends(
    dailyReports: any[],
    conditionScores: Record<string, number>,
    startDate: Date,
    endDate: Date
  ): MoraleMetric[] {
    const trends: MoraleMetric[] = [];
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    let currentWeekStart = new Date(startDate);
    
    while (currentWeekStart < endDate) {
      const weekEnd = new Date(currentWeekStart.getTime() + weekMs);
      const weekReports = dailyReports.filter(r => 
        r.date >= currentWeekStart && r.date < weekEnd
      );
      
      if (weekReports.length > 0) {
        const averageCondition = weekReports.reduce((sum, r) => 
          sum + (conditionScores[r.condition] || 3), 0
        ) / weekReports.length;
        
        const uniqueReporters = new Set(weekReports.map(r => r.userId)).size;
        const participationRate = uniqueReporters; // Simplified
        
        trends.push({
          period: `${currentWeekStart.getFullYear()}-W${Math.ceil(currentWeekStart.getDate() / 7)}`,
          averageCondition,
          participationRate,
          trend: 'stable' // Simplified - would need more complex calculation
        });
      }
      
      currentWeekStart = new Date(currentWeekStart.getTime() + weekMs);
    }
    
    return trends;
  }

  private generateReportSummary(
    engagement: EngagementMetrics,
    knowledgeSharing: KnowledgeSharingMetrics,
    coffeeAnalytics: CoffeeAnalytics,
    teamHealth: TeamHealthMetrics
  ): string {
    let summary = '📊 **分析レポートサマリー**\n\n';
    
    // Engagement summary
    summary += `**エンゲージメント:**\n`;
    summary += `• 参加率: ${engagement.engagementRate.toFixed(1)}% (${engagement.activeUsers}/${engagement.totalUsers}名)\n`;
    summary += `• 平均活動度: ${engagement.averageActivityPerUser.toFixed(1)}ポイント/人\n`;
    if (engagement.topContributors.length > 0) {
      summary += `• トップ貢献者: ${engagement.topContributors[0].userName}さん\n`;
    }
    summary += '\n';
    
    // Knowledge sharing summary
    summary += `**ナレッジ共有:**\n`;
    summary += `• 総回答数: ${knowledgeSharing.totalShuffleResponses}件\n`;
    summary += `• 平均回答長: ${knowledgeSharing.averageResponseLength.toFixed(0)}文字\n`;
    if (knowledgeSharing.topCategories.length > 0) {
      summary += `• 人気カテゴリー: ${knowledgeSharing.topCategories[0].category}\n`;
    }
    summary += '\n';
    
    // Coffee analytics summary
    summary += `**感謝の表現:**\n`;
    summary += `• 総コーヒー数: ${coffeeAnalytics.totalCoffeesSent}杯\n`;
    summary += `• 平均送信数: ${coffeeAnalytics.averageCoffeesPerUser.toFixed(1)}杯/人\n`;
    if (coffeeAnalytics.topSenders.length > 0) {
      summary += `• 最多送信者: ${coffeeAnalytics.topSenders[0].userName}さん\n`;
    }
    summary += '\n';
    
    // Team health summary
    summary += `**チーム健康度:**\n`;
    summary += `• 平均コンディション: ${teamHealth.averageCondition.toFixed(1)}/5.0\n`;
    summary += `• 日報参加率: ${teamHealth.participationRate.toFixed(1)}%\n`;
    if (teamHealth.concerningTrends.length > 0) {
      summary += `• 要注意: ${teamHealth.concerningTrends.length}名\n`;
    }
    
    return summary;
  }
}