import { AnalyticsCommandHandler } from '../handlers/AnalyticsCommandHandler';
import { ChartRenderer } from '../services/ChartRenderer';
import { ReportService } from '../services/ReportService';

describe('Analytics Integration Tests', () => {
  let analyticsHandler: AnalyticsCommandHandler;
  let chartRenderer: ChartRenderer;
  let reportService: ReportService;

  beforeEach(() => {
    analyticsHandler = new AnalyticsCommandHandler();
    chartRenderer = new ChartRenderer();
    reportService = new ReportService();
  });

  describe('ChartRenderer', () => {
    it('should render bar chart correctly', () => {
      const data = {
        categories: [
          { name: 'Profiles', value: 85 },
          { name: 'Coffee', value: 92 },
          { name: 'Shuffle', value: 67 },
          { name: 'Surveys', value: 43 },
          { name: 'AI Chat', value: 78 }
        ],
        total: 100
      };

      const chart = chartRenderer.renderBarChart(data);
      
      expect(chart).toContain('Profiles');
      expect(chart).toContain('Coffee');
      expect(chart).toContain('%');
      expect(chart).toContain('█');
      
      console.log('Bar Chart Output:');
      console.log(chart);
    });

    it('should render engagement meter correctly', () => {
      const score = 78;
      const meter = chartRenderer.renderEngagementMeter(score);
      
      expect(meter).toContain('Engagement');
      expect(meter).toContain('78.0%');
      expect(meter).toMatch(/Grade: [ABC]/);
      expect(meter).toContain('█');
      
      console.log('Engagement Meter Output:');
      console.log(meter);
    });

    it('should render trend line correctly', () => {
      const trendData = {
        title: 'Weekly Activity Trend',
        points: [
          { date: new Date('2024-01-01'), value: 45, metric: 'activity' },
          { date: new Date('2024-01-02'), value: 52, metric: 'activity' },
          { date: new Date('2024-01-03'), value: 38, metric: 'activity' },
          { date: new Date('2024-01-04'), value: 67, metric: 'activity' },
          { date: new Date('2024-01-05'), value: 74, metric: 'activity' },
          { date: new Date('2024-01-06'), value: 61, metric: 'activity' },
          { date: new Date('2024-01-07'), value: 58, metric: 'activity' }
        ]
      };

      const chart = chartRenderer.renderTrendLine(trendData);
      
      expect(chart).toContain('Weekly Activity Trend');
      expect(chart).toContain('Max:');
      expect(chart).toContain('Min:');
      expect(chart).toContain('*');
      
      console.log('Trend Line Output:');
      console.log(chart);
    });
  });

  describe('ReportService', () => {
    it('should generate monthly report structure', async () => {
      try {
        const report = await reportService.generateMonthlyReport();
        
        expect(report).toBeDefined();
        expect(report.period).toBeDefined();
        expect(report.executiveSummary).toBeDefined();
        expect(report.keyMetrics).toBeDefined();
        expect(report.featureAnalysis).toBeDefined();
        expect(report.recommendations).toBeDefined();
        expect(report.charts).toBeDefined();
        expect(report.generatedAt).toBeInstanceOf(Date);
        
        console.log('Monthly Report Structure Test:');
        console.log('Executive Summary:', report.executiveSummary.substring(0, 200) + '...');
        console.log('Recommendations count:', report.recommendations.length);
        console.log('Charts count:', report.charts.length);
        
        // Verify executive summary contains expected elements
        expect(report.executiveSummary).toContain('エンゲージメントスコア');
        expect(report.executiveSummary).toContain('アクティブユーザー');
        
      } catch (error) {
        console.error('Report generation test failed:', error);
        throw error;
      }
    });
  });

  describe('AnalyticsCommandHandler', () => {
    it('should parse period parameters correctly', () => {
      // Test the private method via reflection (for testing purposes only)
      const handler = analyticsHandler as any;
      
      const period7d = handler.parsePeriodParam('7d');
      expect(period7d.type).toBe('7days');
      expect(period7d.start).toBeInstanceOf(Date);
      expect(period7d.end).toBeInstanceOf(Date);
      
      const period30d = handler.parsePeriodParam('30d');
      expect(period30d.type).toBe('30days');
      
      const period90d = handler.parsePeriodParam('90d');
      expect(period90d.type).toBe('90days');
      
      const defaultPeriod = handler.parsePeriodParam();
      expect(defaultPeriod.type).toBe('30days');
      
      console.log('Period parsing test passed');
    });

    it('should format periods correctly', () => {
      const handler = analyticsHandler as any;
      
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        type: '30days'
      };
      
      const formatted = handler.formatPeriod(period);
      expect(formatted).toContain('1月');
      expect(formatted).toContain('31');
      
      console.log('Formatted period:', formatted);
    });

    it('should generate trend emoji correctly', () => {
      const handler = analyticsHandler as any;
      
      expect(handler.getTrendEmoji('up')).toBe('📈');
      expect(handler.getTrendEmoji('down')).toBe('📉');
      expect(handler.getTrendEmoji('stable')).toBe('➡️');
      
      console.log('Trend emoji test passed');
    });
  });
});