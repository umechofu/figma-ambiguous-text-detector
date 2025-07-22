import { UserRepository } from '../../repositories/UserRepository';
import { ProfileRepository } from '../../repositories/ProfileRepository';
import { ShuffleResponseRepository } from '../../repositories/QuestionRepository';
import { SurveyResponseRepository } from '../../repositories/SurveyRepository';
import { DailyReportRepository } from '../../repositories/DailyReportRepository';
import { logger } from '../../utils/logger';

export interface KnowledgeItem {
  id: string;
  type: 'skill' | 'experience' | 'tip' | 'insight' | 'preference';
  content: string;
  source: string;
  userId: string;
  userName: string;
  confidence: number;
  tags: string[];
  createdAt: Date;
  relevanceScore?: number;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export interface KnowledgeNode {
  id: string;
  type: 'user' | 'skill' | 'topic' | 'tool';
  label: string;
  properties: Record<string, any>;
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  type: 'has_skill' | 'mentioned' | 'collaborated' | 'similar_to';
  weight: number;
}

export interface ExtractionResult {
  knowledgeItems: KnowledgeItem[];
  totalProcessed: number;
  newItemsFound: number;
  processingTime: number;
}

export class KnowledgeExtractor {
  private userRepository: UserRepository;
  private profileRepository: ProfileRepository;
  private shuffleResponseRepository: ShuffleResponseRepository;
  private surveyResponseRepository: SurveyResponseRepository;
  private dailyReportRepository: DailyReportRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.profileRepository = new ProfileRepository();
    this.shuffleResponseRepository = new ShuffleResponseRepository();
    this.surveyResponseRepository = new SurveyResponseRepository();
    this.dailyReportRepository = new DailyReportRepository();
  }

  async extractAllKnowledge(): Promise<ExtractionResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting knowledge extraction process');

      const [
        profileKnowledge,
        shuffleKnowledge,
        surveyKnowledge,
        dailyKnowledge
      ] = await Promise.all([
        this.extractFromProfiles(),
        this.extractFromShuffleResponses(),
        this.extractFromSurveyResponses(),
        this.extractFromDailyReports()
      ]);

      const allKnowledge = [
        ...profileKnowledge,
        ...shuffleKnowledge,
        ...surveyKnowledge,
        ...dailyKnowledge
      ];

      // Remove duplicates and enhance with relevance scores
      const uniqueKnowledge = this.deduplicateKnowledge(allKnowledge);
      const enhancedKnowledge = await this.enhanceWithRelevanceScores(uniqueKnowledge);

      const processingTime = Date.now() - startTime;

      logger.info('Knowledge extraction completed', {
        totalItems: enhancedKnowledge.length,
        processingTime
      });

      return {
        knowledgeItems: enhancedKnowledge,
        totalProcessed: allKnowledge.length,
        newItemsFound: enhancedKnowledge.length,
        processingTime
      };
    } catch (error) {
      logger.error('Error in knowledge extraction:', error);
      throw error;
    }
  }

  async extractFromProfiles(): Promise<KnowledgeItem[]> {
    try {
      const profiles = await this.profileRepository.findAll();
      const users = await this.userRepository.findAll();
      const userMap = new Map(users.map(u => [u.id, u]));

      const knowledgeItems: KnowledgeItem[] = [];

      profiles.forEach(profile => {
        const user = userMap.get(profile.userId);
        if (!user) return;

        // Extract skills from expertise
        if (profile.expertise && profile.expertise.length > 0) {
          profile.expertise.forEach(skill => {
            knowledgeItems.push({
              id: `profile_skill_${profile.id}_${skill}`,
              type: 'skill',
              content: skill,
              source: 'profile',
              userId: user.id,
              userName: user.name,
              confidence: 0.9,
              tags: ['skill', 'expertise'],
              createdAt: profile.createdAt
            });
          });
        }

        // Extract work style preferences
        if (profile.workStyle) {
          knowledgeItems.push({
            id: `profile_workstyle_${profile.id}`,
            type: 'preference',
            content: `働き方スタイル: ${profile.workStyle}`,
            source: 'profile',
            userId: user.id,
            userName: user.name,
            confidence: 0.8,
            tags: ['workstyle', 'preference'],
            createdAt: profile.createdAt
          });
        }

        // Extract communication style
        if (profile.communicationStyle) {
          knowledgeItems.push({
            id: `profile_communication_${profile.id}`,
            type: 'preference',
            content: `コミュニケーションスタイル: ${profile.communicationStyle}`,
            source: 'profile',
            userId: user.id,
            userName: user.name,
            confidence: 0.8,
            tags: ['communication', 'preference'],
            createdAt: profile.createdAt
          });
        }
      });

      return knowledgeItems;
    } catch (error) {
      logger.error('Error extracting from profiles:', error);
      return [];
    }
  }

  async extractFromShuffleResponses(): Promise<KnowledgeItem[]> {
    try {
      const responses = await this.shuffleResponseRepository.findRecentResponses(100);
      const knowledgeItems: KnowledgeItem[] = [];

      responses.forEach((response: any) => {
        const user = response.users;
        const question = response.questions;
        
        if (!user || !question) return;

        // Extract knowledge based on question category
        const tags = [question.category, 'shuffle_response'];
        let type: KnowledgeItem['type'] = 'experience';
        
        if (question.category === 'technology') {
          type = 'tip';
          tags.push('technology', 'tools');
        } else if (question.category === 'productivity') {
          type = 'tip';
          tags.push('productivity', 'efficiency');
        } else if (question.category === 'learning') {
          type = 'insight';
          tags.push('learning', 'growth');
        }

        // Extract skills and tools mentioned in the response
        const extractedSkills = this.extractSkillsFromText(response.response);
        const extractedTools = this.extractToolsFromText(response.response);

        knowledgeItems.push({
          id: `shuffle_${response.id}`,
          type,
          content: `${question.content}\n回答: ${response.response}`,
          source: 'shuffle_response',
          userId: user.id,
          userName: user.name,
          confidence: 0.7,
          tags: [...tags, ...extractedSkills, ...extractedTools],
          createdAt: response.createdAt
        });

        // Create separate knowledge items for extracted skills
        extractedSkills.forEach(skill => {
          knowledgeItems.push({
            id: `shuffle_skill_${response.id}_${skill}`,
            type: 'skill',
            content: skill,
            source: 'shuffle_response',
            userId: user.id,
            userName: user.name,
            confidence: 0.6,
            tags: ['skill', 'extracted'],
            createdAt: response.createdAt
          });
        });
      });

      return knowledgeItems;
    } catch (error) {
      logger.error('Error extracting from shuffle responses:', error);
      return [];
    }
  }

  async extractFromSurveyResponses(): Promise<KnowledgeItem[]> {
    try {
      const responses = await this.surveyResponseRepository.findAll();
      const knowledgeItems: KnowledgeItem[] = [];

      responses.forEach((response: any) => {
        const user = response.users;
        const survey = response.surveys;
        
        if (!user || !survey) return;

        // Extract insights from survey responses
        Object.entries(response.responses).forEach(([questionId, answer]) => {
          const question = survey.questions.find((q: any) => q.id === questionId);
          if (!question || !answer) return;

          let type: KnowledgeItem['type'] = 'insight';
          const tags = ['survey_response', survey.title.toLowerCase().replace(/\s+/g, '_')];

          if (question.type === 'text' && typeof answer === 'string' && answer.length > 10) {
            knowledgeItems.push({
              id: `survey_${response.id}_${questionId}`,
              type,
              content: `${question.question}\n回答: ${answer}`,
              source: 'survey_response',
              userId: user.id,
              userName: user.name,
              confidence: 0.6,
              tags,
              createdAt: response.createdAt
            });
          }
        });
      });

      return knowledgeItems;
    } catch (error) {
      logger.error('Error extracting from survey responses:', error);
      return [];
    }
  }

  async extractFromDailyReports(): Promise<KnowledgeItem[]> {
    try {
      const reports = await this.dailyReportRepository.findAll();
      const knowledgeItems: KnowledgeItem[] = [];

      reports.forEach((report: any) => {
        const user = report.users;
        if (!user) return;

        // Extract insights from progress and notes
        if (report.progress && report.progress.length > 20) {
          const extractedSkills = this.extractSkillsFromText(report.progress);
          const extractedTools = this.extractToolsFromText(report.progress);

          knowledgeItems.push({
            id: `daily_progress_${report.id}`,
            type: 'experience',
            content: `進捗: ${report.progress}`,
            source: 'daily_report',
            userId: user.id,
            userName: user.name,
            confidence: 0.5,
            tags: ['daily_report', 'progress', ...extractedSkills, ...extractedTools],
            createdAt: report.createdAt
          });
        }

        if (report.notes && report.notes.length > 20) {
          knowledgeItems.push({
            id: `daily_notes_${report.id}`,
            type: 'insight',
            content: `メモ: ${report.notes}`,
            source: 'daily_report',
            userId: user.id,
            userName: user.name,
            confidence: 0.4,
            tags: ['daily_report', 'notes'],
            createdAt: report.createdAt
          });
        }
      });

      return knowledgeItems;
    } catch (error) {
      logger.error('Error extracting from daily reports:', error);
      return [];
    }
  }

  async buildKnowledgeGraph(knowledgeItems: KnowledgeItem[]): Promise<KnowledgeGraph> {
    try {
      const nodes: KnowledgeNode[] = [];
      const edges: KnowledgeEdge[] = [];
      const nodeMap = new Map<string, KnowledgeNode>();

      // Create user nodes
      const users = await this.userRepository.findAll();
      users.forEach(user => {
        const node: KnowledgeNode = {
          id: `user_${user.id}`,
          type: 'user',
          label: user.name,
          properties: {
            department: user.department,
            role: user.role
          }
        };
        nodes.push(node);
        nodeMap.set(node.id, node);
      });

      // Extract skills and topics from knowledge items
      const skillMap = new Map<string, number>();
      const topicMap = new Map<string, number>();

      knowledgeItems.forEach(item => {
        item.tags.forEach(tag => {
          if (this.isSkillTag(tag)) {
            skillMap.set(tag, (skillMap.get(tag) || 0) + 1);
          } else if (this.isTopicTag(tag)) {
            topicMap.set(tag, (topicMap.get(tag) || 0) + 1);
          }
        });
      });

      // Create skill nodes
      skillMap.forEach((count, skill) => {
        const node: KnowledgeNode = {
          id: `skill_${skill}`,
          type: 'skill',
          label: skill,
          properties: {
            mentionCount: count
          }
        };
        nodes.push(node);
        nodeMap.set(node.id, node);
      });

      // Create topic nodes
      topicMap.forEach((count, topic) => {
        const node: KnowledgeNode = {
          id: `topic_${topic}`,
          type: 'topic',
          label: topic,
          properties: {
            mentionCount: count
          }
        };
        nodes.push(node);
        nodeMap.set(node.id, node);
      });

      // Create edges based on knowledge items
      knowledgeItems.forEach(item => {
        const userNodeId = `user_${item.userId}`;
        
        item.tags.forEach(tag => {
          let targetNodeId: string;
          let edgeType: KnowledgeEdge['type'];

          if (this.isSkillTag(tag)) {
            targetNodeId = `skill_${tag}`;
            edgeType = 'has_skill';
          } else if (this.isTopicTag(tag)) {
            targetNodeId = `topic_${tag}`;
            edgeType = 'mentioned';
          } else {
            return;
          }

          if (nodeMap.has(targetNodeId)) {
            edges.push({
              source: userNodeId,
              target: targetNodeId,
              type: edgeType,
              weight: item.confidence
            });
          }
        });
      });

      return { nodes, edges };
    } catch (error) {
      logger.error('Error building knowledge graph:', error);
      return { nodes: [], edges: [] };
    }
  }

  async findRelatedKnowledge(query: string, limit: number = 10): Promise<KnowledgeItem[]> {
    try {
      const allKnowledge = await this.extractAllKnowledge();
      const queryLower = query.toLowerCase();
      
      // Score knowledge items based on relevance to query
      const scoredItems = allKnowledge.knowledgeItems.map(item => {
        let score = 0;
        
        // Content matching
        if (item.content.toLowerCase().includes(queryLower)) {
          score += 3;
        }
        
        // Tag matching
        item.tags.forEach(tag => {
          if (tag.toLowerCase().includes(queryLower) || queryLower.includes(tag.toLowerCase())) {
            score += 2;
          }
        });
        
        // Type relevance
        if (queryLower.includes('スキル') && item.type === 'skill') {
          score += 1;
        }
        if (queryLower.includes('経験') && item.type === 'experience') {
          score += 1;
        }
        if (queryLower.includes('コツ') && item.type === 'tip') {
          score += 1;
        }
        
        return { ...item, relevanceScore: score * item.confidence };
      });

      // Sort by relevance score and return top results
      return scoredItems
        .filter(item => item.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);
    } catch (error) {
      logger.error('Error finding related knowledge:', error);
      return [];
    }
  }

  private extractSkillsFromText(text: string): string[] {
    const skillPatterns = [
      /React/gi,
      /Vue/gi,
      /Angular/gi,
      /Node\.js/gi,
      /Python/gi,
      /Java/gi,
      /TypeScript/gi,
      /JavaScript/gi,
      /Docker/gi,
      /Kubernetes/gi,
      /AWS/gi,
      /Azure/gi,
      /GCP/gi,
      /SQL/gi,
      /MongoDB/gi,
      /Redis/gi,
      /GraphQL/gi,
      /REST API/gi,
      /Git/gi,
      /GitHub/gi,
      /CI\/CD/gi,
      /Slack/gi,
      /Figma/gi,
      /Photoshop/gi,
      /Illustrator/gi
    ];

    const skills: string[] = [];
    skillPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          if (!skills.includes(match.toLowerCase())) {
            skills.push(match.toLowerCase());
          }
        });
      }
    });

    return skills;
  }

  private extractToolsFromText(text: string): string[] {
    const toolPatterns = [
      /VSCode/gi,
      /IntelliJ/gi,
      /Slack/gi,
      /Zoom/gi,
      /Teams/gi,
      /Notion/gi,
      /Trello/gi,
      /Jira/gi,
      /Confluence/gi,
      /Figma/gi,
      /Miro/gi,
      /Postman/gi,
      /Chrome/gi,
      /Firefox/gi
    ];

    const tools: string[] = [];
    toolPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          if (!tools.includes(match.toLowerCase())) {
            tools.push(match.toLowerCase());
          }
        });
      }
    });

    return tools;
  }

  private deduplicateKnowledge(items: KnowledgeItem[]): KnowledgeItem[] {
    const seen = new Set<string>();
    return items.filter(item => {
      const key = `${item.userId}_${item.type}_${item.content.substring(0, 50)}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private async enhanceWithRelevanceScores(items: KnowledgeItem[]): Promise<KnowledgeItem[]> {
    // Simple relevance scoring based on recency and confidence
    const now = Date.now();
    
    return items.map(item => {
      const ageInDays = (now - item.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, 1 - (ageInDays / 365)); // Decay over a year
      const relevanceScore = item.confidence * 0.7 + recencyScore * 0.3;
      
      return {
        ...item,
        relevanceScore
      };
    });
  }

  private isSkillTag(tag: string): boolean {
    const skillTags = [
      'react', 'vue', 'angular', 'node.js', 'python', 'java', 'typescript', 'javascript',
      'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'sql', 'mongodb', 'redis',
      'graphql', 'rest api', 'git', 'github', 'ci/cd', 'skill', 'technology'
    ];
    return skillTags.includes(tag.toLowerCase());
  }

  private isTopicTag(tag: string): boolean {
    const topicTags = [
      'productivity', 'communication', 'learning', 'creativity', 'worklife',
      'technology', 'management', 'design', 'marketing', 'general'
    ];
    return topicTags.includes(tag.toLowerCase());
  }
}