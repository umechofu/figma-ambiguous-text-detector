import { MetricsCalculator, TimePeriod } from '../../services/analytics/MetricsCalculator';

describe('MetricsCalculator', () => {
  let metricsCalculator: MetricsCalculator;

  beforeEach(() => {
    metricsCalculator = new MetricsCalculator();
  });

  describe('calculateEngagementScore', () => {
    it('should calculate engagement score without errors', async () => {
      try {
        const score = await metricsCalculator.calculateEngagementScore();
        
        expect(score).toBeDefined();
        expect(score.overall).toBeGreaterThanOrEqual(0);
        expect(score.overall).toBeLessThanOrEqual(100);
        expect(['A', 'B', 'C', 'D', 'E']).toContain(score.grade);
        expect(['up', 'down', 'stable']).toContain(score.trend);
        
        // Check components
        expect(score.components).toBeDefined();
        expect(score.components.profiles).toBeGreaterThanOrEqual(0);
        expect(score.components.coffee).toBeGreaterThanOrEqual(0);
        expect(score.components.shuffle).toBeGreaterThanOrEqual(0);
        expect(score.components.surveys).toBeGreaterThanOrEqual(0);
        expect(score.components.ai).toBeGreaterThanOrEqual(0);
        expect(score.components.retention).toBeGreaterThanOrEqual(0);
        
        console.log('Engagement Score Test Result:', score);
      } catch (error) {
        console.error('Test failed with error:', error);
        throw error;
      }
    });
  });

  describe('calculateActiveUsers', () => {
    it('should calculate active users metrics', async () => {
      const period: TimePeriod = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        end: new Date(),
        type: '30days'
      };

      try {
        const metrics = await metricsCalculator.calculateActiveUsers(period);
        
        expect(metrics).toBeDefined();
        expect(metrics.totalUsers).toBeGreaterThanOrEqual(0);
        expect(metrics.activeUsers).toBeGreaterThanOrEqual(0);
        expect(metrics.activeUsers).toBeLessThanOrEqual(metrics.totalUsers);
        expect(metrics.engagementRate).toBeGreaterThanOrEqual(0);
        expect(metrics.engagementRate).toBeLessThanOrEqual(100);
        
        console.log('Active Users Test Result:', metrics);
      } catch (error) {
        console.error('Test failed with error:', error);
        throw error;
      }
    });
  });

  describe('calculateFeatureAdoption', () => {
    it('should calculate feature adoption metrics', async () => {
      try {
        const adoption = await metricsCalculator.calculateFeatureAdoption();
        
        expect(adoption).toBeDefined();
        expect(adoption.profiles).toBeDefined();
        expect(adoption.coffee).toBeDefined();
        expect(adoption.shuffle).toBeDefined();
        expect(adoption.surveys).toBeDefined();
        expect(adoption.ai).toBeDefined();
        
        // Check each feature has required properties
        Object.values(adoption).forEach(feature => {
          expect(feature.totalUsers).toBeGreaterThanOrEqual(0);
          expect(feature.adoptionRate).toBeGreaterThanOrEqual(0);
          expect(feature.adoptionRate).toBeLessThanOrEqual(100);
        });
        
        console.log('Feature Adoption Test Result:', adoption);
      } catch (error) {
        console.error('Test failed with error:', error);
        throw error;
      }
    });
  });
});