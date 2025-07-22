import { TrendPoint } from './MetricsCalculator';

export interface TimeSeriesData {
  label: string;
  dataPoints: { date: Date; value: number }[];
}

export interface CategoryData {
  categories: { name: string; value: number }[];
  total: number;
}

export interface DistributionData {
  items: { label: string; value: number; percentage: number }[];
}

export interface TrendData {
  points: TrendPoint[];
  title: string;
}

export class ChartRenderer {
  
  /**
   * Render a simple ASCII bar chart for categories
   */
  renderBarChart(data: CategoryData, maxWidth: number = 30): string {
    if (data.categories.length === 0) {
      return 'No data available';
    }

    const maxValue = Math.max(...data.categories.map(c => c.value));
    let chart = '';

    data.categories.forEach(category => {
      const percentage = data.total > 0 ? (category.value / data.total) * 100 : 0;
      const barLength = Math.round((category.value / maxValue) * maxWidth);
      const bar = '█'.repeat(barLength) + '░'.repeat(maxWidth - barLength);
      
      chart += `${category.name.padEnd(12)}: ${bar} ${percentage.toFixed(1)}% (${category.value})\n`;
    });

    return chart;
  }

  /**
   * Render a trend line chart using ASCII characters
   */
  renderTrendLine(data: TrendData, width: number = 50, height: number = 10): string {
    if (data.points.length === 0) {
      return 'No trend data available';
    }

    const values = data.points.map(p => p.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue;

    if (range === 0) {
      return `${data.title}\nValues are constant at ${values[0]}`;
    }

    // Create a grid
    const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));

    // Plot points
    data.points.forEach((point, index) => {
      const x = Math.round((index / (data.points.length - 1)) * (width - 1));
      const normalizedValue = (point.value - minValue) / range;
      const y = Math.round((1 - normalizedValue) * (height - 1));
      
      if (x >= 0 && x < width && y >= 0 && y < height) {
        grid[y][x] = '*';
      }
    });

    // Convert grid to string
    let chart = `${data.title}\n`;
    chart += `Max: ${maxValue.toFixed(1)} ┌${'─'.repeat(width)}┐\n`;
    
    grid.forEach((row, index) => {
      const yValue = maxValue - (index / (height - 1)) * range;
      const yLabel = yValue.toFixed(0).padStart(4);
      chart += `${index === 0 ? yLabel : '    '} │${row.join('')}│\n`;
    });
    
    chart += `Min: ${minValue.toFixed(1)} └${'─'.repeat(width)}┘\n`;
    chart += `     ${' '.repeat(Math.floor(width/4))}Time →`;

    return chart;
  }

  /**
   * Render an engagement meter (circular progress indicator)
   */
  renderEngagementMeter(score: number, maxScore: number = 100): string {
    const percentage = Math.min(100, (score / maxScore) * 100);
    const segments = 10;
    const filledSegments = Math.round((percentage / 100) * segments);
    
    const meter = '█'.repeat(filledSegments) + '░'.repeat(segments - filledSegments);
    const grade = this.getScoreGrade(percentage);
    
    return `Engagement: [${meter}] ${percentage.toFixed(1)}% (Grade: ${grade})`;
  }

  /**
   * Render a distribution chart (pie chart alternative)
   */
  renderDistributionChart(data: DistributionData, maxWidth: number = 40): string {
    if (data.items.length === 0) {
      return 'No distribution data available';
    }

    let chart = 'Distribution:\n';
    
    data.items.forEach(item => {
      const barLength = Math.round((item.percentage / 100) * maxWidth);
      const bar = '█'.repeat(barLength) + '░'.repeat(maxWidth - barLength);
      
      chart += `${item.label.padEnd(15)}: ${bar} ${item.percentage.toFixed(1)}% (${item.value})\n`;
    });

    return chart;
  }

  /**
   * Render a simple ASCII graph for time series data
   */
  renderASCIIGraph(data: TimeSeriesData, width: number = 60, height: number = 15): string {
    if (data.dataPoints.length === 0) {
      return `${data.label}: No data available`;
    }

    const values = data.dataPoints.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue;

    if (range === 0) {
      return `${data.label}: Constant value ${values[0]}`;
    }

    // Create a simple sparkline
    let sparkline = '';
    const sparkChars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    
    data.dataPoints.forEach(point => {
      const normalizedValue = (point.value - minValue) / range;
      const charIndex = Math.floor(normalizedValue * (sparkChars.length - 1));
      sparkline += sparkChars[charIndex];
    });

    // Create full ASCII graph
    const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));

    // Plot points and connect with lines
    for (let i = 0; i < data.dataPoints.length - 1; i++) {
      const x1 = Math.round((i / (data.dataPoints.length - 1)) * (width - 1));
      const x2 = Math.round(((i + 1) / (data.dataPoints.length - 1)) * (width - 1));
      
      const y1 = Math.round((1 - (values[i] - minValue) / range) * (height - 1));
      const y2 = Math.round((1 - (values[i + 1] - minValue) / range) * (height - 1));

      // Simple line drawing
      const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
      for (let step = 0; step <= steps; step++) {
        const x = Math.round(x1 + (x2 - x1) * (step / steps));
        const y = Math.round(y1 + (y2 - y1) * (step / steps));
        
        if (x >= 0 && x < width && y >= 0 && y < height) {
          grid[y][x] = step === steps ? '*' : '·';
        }
      }
    }

    // Build the chart
    let chart = `${data.label}\n`;
    chart += `Max: ${maxValue.toFixed(1)} ┌${'─'.repeat(width)}┐\n`;
    
    grid.forEach((row, index) => {
      const yValue = maxValue - (index / (height - 1)) * range;
      chart += `${yValue.toFixed(0).padStart(4)} │${row.join('')}│\n`;
    });
    
    chart += `Min: ${minValue.toFixed(1)} └${'─'.repeat(width)}┘\n`;
    chart += `Sparkline: ${sparkline}\n`;

    return chart;
  }

  /**
   * Create a horizontal bar chart for rankings
   */
  renderHorizontalBarChart(items: { label: string; value: number }[], maxWidth: number = 30): string {
    if (items.length === 0) {
      return 'No ranking data available';
    }

    const maxValue = Math.max(...items.map(item => item.value));
    let chart = '';

    items.forEach((item, index) => {
      const barLength = maxValue > 0 ? Math.round((item.value / maxValue) * maxWidth) : 0;
      const bar = '█'.repeat(barLength) + '░'.repeat(maxWidth - barLength);
      
      chart += `${(index + 1).toString().padStart(2)}. ${item.label.padEnd(15)}: ${bar} ${item.value}\n`;
    });

    return chart;
  }

  /**
   * Create a comparison chart between two datasets
   */
  renderComparisonChart(
    data1: { label: string; value: number },
    data2: { label: string; value: number },
    maxWidth: number = 30
  ): string {
    const maxValue = Math.max(data1.value, data2.value);
    
    const bar1Length = maxValue > 0 ? Math.round((data1.value / maxValue) * maxWidth) : 0;
    const bar2Length = maxValue > 0 ? Math.round((data2.value / maxValue) * maxWidth) : 0;
    
    const bar1 = '█'.repeat(bar1Length) + '░'.repeat(maxWidth - bar1Length);
    const bar2 = '█'.repeat(bar2Length) + '░'.repeat(maxWidth - bar2Length);
    
    let chart = 'Comparison:\n';
    chart += `${data1.label.padEnd(15)}: ${bar1} ${data1.value}\n`;
    chart += `${data2.label.padEnd(15)}: ${bar2} ${data2.value}\n`;
    
    const difference = ((data2.value - data1.value) / data1.value) * 100;
    const trend = difference > 0 ? '📈' : difference < 0 ? '📉' : '➡️';
    chart += `Change: ${trend} ${difference.toFixed(1)}%`;
    
    return chart;
  }

  /**
   * Create a gauge chart for scores
   */
  renderGaugeChart(value: number, min: number = 0, max: number = 100, label: string = ''): string {
    const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
    const segments = 20;
    const filledSegments = Math.round((percentage / 100) * segments);
    
    // Create gauge with different characters for different ranges
    let gauge = '';
    for (let i = 0; i < segments; i++) {
      if (i < filledSegments) {
        if (percentage >= 80) gauge += '█'; // Excellent
        else if (percentage >= 60) gauge += '▓'; // Good
        else if (percentage >= 40) gauge += '▒'; // Fair
        else gauge += '░'; // Poor
      } else {
        gauge += '·';
      }
    }
    
    const grade = this.getScoreGrade(percentage);
    return `${label}[${gauge}] ${value}/${max} (${percentage.toFixed(1)}% - Grade: ${grade})`;
  }

  /**
   * Create a weekly activity heatmap
   */
  renderWeeklyHeatmap(weeklyData: number[]): string {
    if (weeklyData.length !== 7) {
      return 'Invalid weekly data - needs 7 days';
    }

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const maxValue = Math.max(...weeklyData);
    
    let heatmap = 'Weekly Activity:\n';
    
    weeklyData.forEach((value, index) => {
      const intensity = maxValue > 0 ? Math.round((value / maxValue) * 4) : 0;
      const heatChar = ['·', '░', '▒', '▓', '█'][intensity];
      
      heatmap += `${days[index]}: ${heatChar.repeat(10)} ${value}\n`;
    });
    
    return heatmap;
  }

  /**
   * Get grade based on score percentage
   */
  private getScoreGrade(percentage: number): string {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'E';
  }

  /**
   * Create a multi-series trend chart
   */
  renderMultiSeriesTrend(series: { name: string; data: number[] }[], width: number = 50): string {
    if (series.length === 0) {
      return 'No series data available';
    }

    const maxLength = Math.max(...series.map(s => s.data.length));
    let chart = 'Multi-Series Trend:\n';
    
    series.forEach((serie, serieIndex) => {
      const chars = ['*', '+', 'x', 'o', '#'];
      const char = chars[serieIndex % chars.length];
      
      let sparkline = '';
      const maxValue = Math.max(...serie.data);
      const minValue = Math.min(...serie.data);
      const range = maxValue - minValue;
      
      if (range > 0) {
        serie.data.forEach(value => {
          const normalized = (value - minValue) / range;
          const level = Math.floor(normalized * 8);
          const sparkChars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
          sparkline += sparkChars[level] || '▁';
        });
      } else {
        sparkline = '▄'.repeat(serie.data.length);
      }
      
      chart += `${serie.name.padEnd(12)}: ${sparkline} (${char})\n`;
    });
    
    return chart;
  }
}