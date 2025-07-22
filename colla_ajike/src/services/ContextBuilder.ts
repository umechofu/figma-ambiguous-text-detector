import { KnowledgeExtractor, KnowledgeItem, KnowledgeGraph } from './KnowledgeExtractor';
import { UserRepository } from '../repositories/UserRepository';
import { ProfileRepository } from '../repositories/ProfileRepository';
import { logger } from '../utils/logger';

export interface AIContext {
  userContext: UserContext;
  organizationContext: OrganizationContext;
  knowledgeContext: KnowledgeContext;
  conversationContext: ConversationContext;
}

export interface UserContext {
  userId: string;
  userName: string;
  department?: string;
  role?: string;
  expertise: string[];
  workStyle?: string;
  communicationStyle?: string;
  recentActivity: ActivityItem[];
}

export interface OrganizationContext {
  totalUsers: number;
  activeUsers: number;
  departments: string[];
  commonSkills: string[];
  recentTrends: TrendItem[];
  knowledgeGraph: KnowledgeGraph;
}

export interface KnowledgeContext {
  relevantKnowledge: KnowledgeItem[];
  relatedUsers: RelatedUser[];
  suggestedExperts: ExpertSuggestion[];
  knowledgeGaps: string[];
}

export interface ConversationContext {
  previousQueries: string[];
  queryType: 'skill_search' | 'user_inquiry' | 'general_question' | 'knowledge_request';
  confidence: number;
  suggestedFollowUps: string[];
}

export interface ActivityItem {
  type: 'shuffle_response' | 'survey_response' | 'daily_report' | 'profile_update';
  content: string;
  timestamp: Date;
}

export interface TrendItem {
  topic: string;
  frequency: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  timeframe: string;
}

export interface RelatedUser {
  userId: string;
  userName: string;
  relevanceScore: number;
  commonSkills: string[];
  department?: string;
}

export interface ExpertSuggestion {
  userId: string;
  userName: string;
  skill: string;
  confidence: number;
  evidenceCount: number;
  lastActivity: Date;
}

export class ContextBuilder {
  private knowledgeExtractor: KnowledgeExtractor;
  private userRepository: UserRepository;
  private profileRepository: ProfileRepository;

  constructor() {
    this.knowledgeExtractor = new KnowledgeExtractor();
    this.userRepository = new UserRepository();
    this.profileRepository = new ProfileRepository();
  }

  async buildAIContext(userId: string, query: string): Promise<AIContext> {
    try {
      logger.info('Building AI context', { userId, queryLength: query.length });

      const [
        userContext,
        organizationContext,
        knowledgeContext,
        conversationContext
      ] = await Promise.all([
        this.buildUserContext(userId),
        this.buildOrganizationContext(),
        this.buildKnowledgeContext(query),
        this.buildConversationContext(query)
      ]);

      return {
        userContext,
        organizationContext,
        knowledgeContext,
        conversationContext
      };
    } catch (error) {
      logger.error('Error building AI context:', error);
      throw error;
    }
  }

  async buildUserContext(userId: string): Promise<UserContext> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const profile = await this.profileRepository.findByUserId(userId);
      
      // Get recent activity (simplified - in real implementation, you'd query multiple sources)
      const recentActivity: ActivityItem[] = [];

      return {
        userId: user.id,
        userName: user.name,
        department: user.department,
        role: user.role,
        expertise: profile?.expertise || [],
        workStyle: profile?.workStyle,
        communicationStyle: profile?.communicationStyle,
        recentActivity
      };
    } catch (error) {
      logger.error('Error building user context:', error);
      return {
        userId,
        userName: 'Unknown User',
        expertise: [],
        recentActivity: []
      };
    }
  }

  async buildOrganizationContext(): Promise<OrganizationContext> {
    try {
      const users = await this.userRepository.findAll();
      const profiles = await this.profileRepository.findAll();
      
      // Extract departments
      const departments = [...new Set(users.map(u => u.department).filter(Boolean))];
      
      // Extract common skills
      const skillCounts = new Map<string, number>();
      profiles.forEach(profile => {
        profile.expertise.forEach(skill => {
          skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);
        });
      });
      
      const commonSkills = Array.from(skillCounts.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([skill]) => skill);

      // Build knowledge graph
      const extractionResult = await this.knowledgeExtractor.extractAllKnowledge();
      const knowledgeGraph = await this.knowledgeExtractor.buildKnowledgeGraph(extractionResult.knowledgeItems);

      // Calculate recent trends (simplified)
      const recentTrends: TrendItem[] = this.calculateTrends(extractionResult.knowledgeItems);

      return {
        totalUsers: users.length,
        activeUsers: profiles.length,
        departments,
        commonSkills,
        recentTrends,
        knowledgeGraph
      };
    } catch (error) {
      logger.error('Error building organization context:', error);
      return {
        totalUsers: 0,
        activeUsers: 0,
        departments: [],
        commonSkills: [],
        recentTrends: [],
        knowledgeGraph: { nodes: [], edges: [] }
      };
    }
  }

  async buildKnowledgeContext(query: string): Promise<KnowledgeContext> {
    try {
      // Find relevant knowledge
      const relevantKnowledge = await this.knowledgeExtractor.findRelatedKnowledge(query, 10);
      
      // Find related users based on knowledge
      const relatedUsers = await this.findRelatedUsers(relevantKnowledge);
      
      // Suggest experts based on query
      const suggestedExperts = await this.suggestExperts(query);
      
      // Identify knowledge gaps
      const knowledgeGaps = this.identifyKnowledgeGaps(query, relevantKnowledge);

      return {
        relevantKnowledge,
        relatedUsers,
        suggestedExperts,
        knowledgeGaps
      };
    } catch (error) {
      logger.error('Error building knowledge context:', error);
      return {
        relevantKnowledge: [],
        relatedUsers: [],
        suggestedExperts: [],
        knowledgeGaps: []
      };
    }
  }

  async buildConversationContext(query: string): Promise<ConversationContext> {
    try {
      // Determine query type
      const queryType = this.determineQueryType(query);
      
      // Calculate confidence based on query characteristics
      const confidence = this.calculateQueryConfidence(query, queryType);
      
      // Generate suggested follow-ups
      const suggestedFollowUps = this.generateFollowUpSuggestions(query, queryType);

      return {
        previousQueries: [], // In real implementation, you'd store conversation history
        queryType,
        confidence,
        suggestedFollowUps
      };
    } catch (error) {
      logger.error('Error building conversation context:', error);
      return {
        previousQueries: [],
        queryType: 'general_question',
        confidence: 0.5,
        suggestedFollowUps: []
      };
    }
  }

  async findRelatedUsers(knowledgeItems: KnowledgeItem[]): Promise<RelatedUser[]> {
    try {
      const userScores = new Map<string, { score: number; skills: Set<string>; user: any }>();
      
      // Score users based on knowledge relevance
      knowledgeItems.forEach(item => {
        if (!userScores.has(item.userId)) {
          userScores.set(item.userId, {
            score: 0,
            skills: new Set(),
            user: { id: item.userId, name: item.userName }
          });
        }
        
        const userScore = userScores.get(item.userId)!;
        userScore.score += item.relevanceScore || item.confidence;
        
        if (item.type === 'skill') {
          userScore.skills.add(item.content);
        }
      });

      // Get user details
      const users = await this.userRepository.findAll();
      const userMap = new Map(users.map(u => [u.id, u]));

      return Array.from(userScores.entries())
        .map(([userId, data]) => {
          const user = userMap.get(userId);
          return {
            userId,
            userName: user?.name || data.user.name,
            relevanceScore: data.score,
            commonSkills: Array.from(data.skills),
            department: user?.department
          };
        })
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 5);
    } catch (error) {
      logger.error('Error finding related users:', error);
      return [];
    }
  }

  async suggestExperts(query: string): Promise<ExpertSuggestion[]> {
    try {
      const extractionResult = await this.knowledgeExtractor.extractAllKnowledge();
      const queryLower = query.toLowerCase();
      
      // Find skills mentioned in query
      const mentionedSkills = this.extractSkillsFromQuery(query);
      
      const expertScores = new Map<string, Map<string, { confidence: number; evidence: number; lastActivity: Date }>>();
      
      extractionResult.knowledgeItems.forEach(item => {
        if (item.type === 'skill' || item.tags.some(tag => mentionedSkills.includes(tag))) {
          if (!expertScores.has(item.userId)) {
            expertScores.set(item.userId, new Map());
          }
          
          const userSkills = expertScores.get(item.userId)!;
          const skill = item.type === 'skill' ? item.content : item.tags.find(tag => mentionedSkills.includes(tag)) || '';
          
          if (skill) {
            if (!userSkills.has(skill)) {
              userSkills.set(skill, { confidence: 0, evidence: 0, lastActivity: item.createdAt });
            }
            
            const skillData = userSkills.get(skill)!;
            skillData.confidence = Math.max(skillData.confidence, item.confidence);
            skillData.evidence += 1;
            skillData.lastActivity = item.createdAt > skillData.lastActivity ? item.createdAt : skillData.lastActivity;
          }
        }
      });

      const suggestions: ExpertSuggestion[] = [];
      const users = await this.userRepository.findAll();
      const userMap = new Map(users.map(u => [u.id, u]));

      expertScores.forEach((skills, userId) => {
        const user = userMap.get(userId);
        if (!user) return;

        skills.forEach((data, skill) => {
          if (data.evidence >= 2) { // Require at least 2 pieces of evidence
            suggestions.push({
              userId,
              userName: user.name,
              skill,
              confidence: data.confidence,
              evidenceCount: data.evidence,
              lastActivity: data.lastActivity
            });
          }
        });
      });

      return suggestions
        .sort((a, b) => b.confidence * b.evidenceCount - a.confidence * a.evidenceCount)
        .slice(0, 5);
    } catch (error) {
      logger.error('Error suggesting experts:', error);
      return [];
    }
  }

  private calculateTrends(knowledgeItems: KnowledgeItem[]): TrendItem[] {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const recentCounts = new Map<string, number>();
    const olderCounts = new Map<string, number>();

    knowledgeItems.forEach(item => {
      item.tags.forEach(tag => {
        if (item.createdAt > oneMonthAgo) {
          recentCounts.set(tag, (recentCounts.get(tag) || 0) + 1);
        } else if (item.createdAt > twoMonthsAgo) {
          olderCounts.set(tag, (olderCounts.get(tag) || 0) + 1);
        }
      });
    });

    const trends: TrendItem[] = [];
    const allTags = new Set([...recentCounts.keys(), ...olderCounts.keys()]);

    allTags.forEach(tag => {
      const recent = recentCounts.get(tag) || 0;
      const older = olderCounts.get(tag) || 0;
      
      if (recent + older >= 3) { // Minimum threshold
        let trend: TrendItem['trend'] = 'stable';
        
        if (recent > older * 1.5) {
          trend = 'increasing';
        } else if (older > recent * 1.5) {
          trend = 'decreasing';
        }

        trends.push({
          topic: tag,
          frequency: recent + older,
          trend,
          timeframe: '過去2ヶ月'
        });
      }
    });

    return trends
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  }

  private determineQueryType(query: string): ConversationContext['queryType'] {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('スキルを持つ人') || queryLower.includes('得意な人') || queryLower.includes('専門の人')) {
      return 'skill_search';
    }
    
    if (queryLower.includes('さんの') || queryLower.includes('について教えて')) {
      return 'user_inquiry';
    }
    
    if (queryLower.includes('どうやって') || queryLower.includes('方法') || queryLower.includes('やり方')) {
      return 'knowledge_request';
    }
    
    return 'general_question';
  }

  private calculateQueryConfidence(query: string, queryType: ConversationContext['queryType']): number {
    let confidence = 0.5;
    
    // Length-based confidence
    if (query.length > 10) confidence += 0.1;
    if (query.length > 20) confidence += 0.1;
    
    // Type-specific confidence
    switch (queryType) {
      case 'skill_search':
        confidence += 0.2;
        break;
      case 'user_inquiry':
        confidence += 0.15;
        break;
      case 'knowledge_request':
        confidence += 0.1;
        break;
    }
    
    // Specific keywords boost confidence
    const highConfidenceKeywords = ['スキル', '専門', '得意', '経験', 'について'];
    highConfidenceKeywords.forEach(keyword => {
      if (query.includes(keyword)) confidence += 0.05;
    });
    
    return Math.min(confidence, 1.0);
  }

  private generateFollowUpSuggestions(query: string, queryType: ConversationContext['queryType']): string[] {
    const suggestions: string[] = [];
    
    switch (queryType) {
      case 'skill_search':
        suggestions.push(
          '他にどんなスキルをお探しですか？',
          'そのスキルに関連する技術について聞いてみますか？',
          '具体的なプロジェクトでの活用方法を知りたいですか？'
        );
        break;
      case 'user_inquiry':
        suggestions.push(
          'その方の他の専門分野について聞いてみますか？',
          '似たような経験を持つ他のメンバーを探しますか？',
          'コラボレーションの機会について相談してみますか？'
        );
        break;
      case 'knowledge_request':
        suggestions.push(
          'より具体的な手順を知りたいですか？',
          '関連するツールやリソースについて聞いてみますか？',
          '実際の事例や経験談を探しますか？'
        );
        break;
      default:
        suggestions.push(
          'より詳しい情報が必要ですか？',
          '関連する質問はありますか？',
          '他に何かお手伝いできることはありますか？'
        );
    }
    
    return suggestions;
  }

  private identifyKnowledgeGaps(query: string, relevantKnowledge: KnowledgeItem[]): string[] {
    const gaps: string[] = [];
    
    // If no relevant knowledge found
    if (relevantKnowledge.length === 0) {
      gaps.push('この分野の情報が不足しています');
    }
    
    // If knowledge is outdated
    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
    const recentKnowledge = relevantKnowledge.filter(item => item.createdAt > sixMonthsAgo);
    
    if (recentKnowledge.length < relevantKnowledge.length * 0.5) {
      gaps.push('最新の情報が不足している可能性があります');
    }
    
    // If knowledge comes from limited sources
    const uniqueSources = new Set(relevantKnowledge.map(item => item.userId));
    if (uniqueSources.size < 3 && relevantKnowledge.length > 5) {
      gaps.push('より多くのメンバーからの情報が必要です');
    }
    
    return gaps;
  }

  private extractSkillsFromQuery(query: string): string[] {
    const skillKeywords = [
      'react', 'vue', 'angular', 'node.js', 'python', 'java', 'typescript', 'javascript',
      'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'sql', 'mongodb', 'redis',
      'graphql', 'api', 'git', 'github', 'design', 'ui', 'ux', 'figma'
    ];
    
    const queryLower = query.toLowerCase();
    return skillKeywords.filter(skill => queryLower.includes(skill));
  }
}