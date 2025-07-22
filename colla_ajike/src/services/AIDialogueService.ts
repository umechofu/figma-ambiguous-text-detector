import OpenAI from 'openai';
import { config } from '../config/environment';
import { UserRepository } from '../repositories/UserRepository';
import { ProfileRepository } from '../repositories/ProfileRepository';
import { ShuffleResponseRepository } from '../repositories/QuestionRepository';
import { KnowledgeExtractor } from './KnowledgeExtractor';
import { ContextBuilder } from './ContextBuilder';
import { logger } from '../utils/logger';

export interface AIQuery {
  query: string;
  userId: string;
  channelId?: string;
  context?: string;
}

export interface AIResponse {
  response: string;
  confidence: number;
  sources?: string[];
  suggestedActions?: string[];
}

export interface KnowledgeContext {
  profiles: any[];
  recentResponses: any[];
  users: any[];
}

export class AIDialogueService {
  private openai: OpenAI;
  private userRepository: UserRepository;
  private profileRepository: ProfileRepository;
  private shuffleResponseRepository: ShuffleResponseRepository;
  private knowledgeExtractor: KnowledgeExtractor;
  private contextBuilder: ContextBuilder;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    this.userRepository = new UserRepository();
    this.profileRepository = new ProfileRepository();
    this.shuffleResponseRepository = new ShuffleResponseRepository();
    this.knowledgeExtractor = new KnowledgeExtractor();
    this.contextBuilder = new ContextBuilder();
  }

  async processQuery(query: AIQuery): Promise<AIResponse> {
    try {
      logger.info('Processing AI query', {
        userId: query.userId,
        queryLength: query.query.length
      });

      // Build comprehensive AI context using ContextBuilder
      const aiContext = await this.contextBuilder.buildAIContext(query.userId, query.query);
      
      // Generate enhanced system prompt with rich context
      const systemPrompt = this.buildEnhancedSystemPrompt(aiContext);
      
      // Build knowledge context for the query
      const knowledgeContext = this.buildKnowledgeContextFromAI(aiContext);
      
      // Process the query with OpenAI
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: query.query
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content || 'すみません、回答を生成できませんでした。';
      
      // Extract confidence and suggestions using enhanced context
      const aiResponse = this.parseEnhancedAIResponse(response, aiContext);
      
      logger.info('AI query processed successfully', {
        userId: query.userId,
        responseLength: aiResponse.response.length,
        confidence: aiResponse.confidence,
        queryType: aiContext.conversationContext.queryType
      });

      return aiResponse;
    } catch (error) {
      logger.error('Error processing AI query:', error);
      
      return {
        response: '申し訳ございませんが、現在AIサービスに問題が発生しています。しばらく時間をおいてから再度お試しください。',
        confidence: 0,
        sources: [],
        suggestedActions: ['後でもう一度試してください', '管理者にお問い合わせください']
      };
    }
  }

  async findExpertsBySkill(skill: string): Promise<AIResponse> {
    try {
      const profiles = await this.profileRepository.findByExpertise(skill);
      
      if (profiles.length === 0) {
        return {
          response: `「${skill}」のスキルを持つメンバーは見つかりませんでした。\n\nプロフィールが未設定の可能性があります。メンバーにプロフィール作成を促してみてください。`,
          confidence: 0.8,
          suggestedActions: [
            'プロフィール作成を促す',
            '別のキーワードで検索する',
            '直接メンバーに聞いてみる'
          ]
        };
      }

      let response = `「${skill}」のスキルを持つメンバーを見つけました：\n\n`;
      
      profiles.forEach((profile: any, index: number) => {
        const user = profile.users || {};
        response += `${index + 1}. **${user.name || 'Unknown User'}**\n`;
        
        if (profile.workStyle) {
          response += `   働き方: ${profile.workStyle}\n`;
        }
        
        if (profile.communicationStyle) {
          response += `   コミュニケーション: ${profile.communicationStyle}\n`;
        }
        
        if (profile.availability) {
          response += `   対応可能時間: ${profile.availability}\n`;
        }
        
        response += '\n';
      });

      response += `💡 これらのメンバーに直接連絡を取ってみてください。`;

      return {
        response,
        confidence: 0.9,
        sources: profiles.map((p: any) => p.users?.name || 'Unknown User'),
        suggestedActions: [
          'メンバーに直接メッセージを送る',
          '関連するチャンネルで質問する'
        ]
      };
    } catch (error) {
      logger.error('Error finding experts by skill:', error);
      throw error;
    }
  }

  async getUserExpertise(userName: string): Promise<AIResponse> {
    try {
      // Find user by name (fuzzy matching)
      const users = await this.userRepository.findAll();
      const user = users.find(u => 
        u.name.toLowerCase().includes(userName.toLowerCase()) ||
        userName.toLowerCase().includes(u.name.toLowerCase())
      );

      if (!user) {
        return {
          response: `「${userName}」さんが見つかりませんでした。\n\n正確な名前で再度検索してみてください。`,
          confidence: 0.3,
          suggestedActions: [
            '正確な名前で検索する',
            'メンバー一覧を確認する'
          ]
        };
      }

      const profile = await this.profileRepository.findByUserId(user.id);
      const recentResponses = await this.shuffleResponseRepository.findByUserId(user.id, 5);

      let response = `**${user.name}さんの情報**\n\n`;

      if (profile) {
        if (profile.expertise && profile.expertise.length > 0) {
          response += `**専門分野:**\n`;
          profile.expertise.forEach(skill => {
            response += `• ${skill}\n`;
          });
          response += '\n';
        }

        if (profile.workStyle) {
          response += `**働き方スタイル:** ${profile.workStyle}\n`;
        }

        if (profile.communicationStyle) {
          response += `**コミュニケーションスタイル:** ${profile.communicationStyle}\n`;
        }

        if (profile.availability) {
          response += `**対応可能時間:** ${profile.availability}\n`;
        }
      } else {
        response += `プロフィールが設定されていません。\n`;
      }

      if (recentResponses.length > 0) {
        response += `\n**最近の知識共有:**\n`;
        recentResponses.slice(0, 3).forEach((resp: any, index: number) => {
          const question = resp.questions?.content || '質問不明';
          const answer = resp.response.length > 100 ? 
            resp.response.substring(0, 97) + '...' : resp.response;
          response += `${index + 1}. ${question}\n   → ${answer}\n\n`;
        });
      }

      const confidence = profile ? 0.9 : 0.5;
      const sources = profile ? [user.name] : [];

      return {
        response,
        confidence,
        sources,
        suggestedActions: [
          `${user.name}さんに直接連絡する`,
          profile ? '詳細なプロフィールを確認する' : 'プロフィール作成を促す'
        ]
      };
    } catch (error) {
      logger.error('Error getting user expertise:', error);
      throw error;
    }
  }

  async getGeneralKnowledgeAnswer(question: string): Promise<AIResponse> {
    try {
      // Search for relevant knowledge from shuffle responses
      const recentResponses = await this.shuffleResponseRepository.findRecentResponses(20);
      
      // Build context from existing knowledge
      const knowledgeContext = recentResponses
        .map((resp: any) => `Q: ${resp.questions?.content || '質問不明'}\nA: ${resp.response}`)
        .join('\n\n');

      const systemPrompt = `あなたは組織内のナレッジハブアシスタントです。以下の組織内の知識を参考にして、質問に答えてください。

組織内の既存知識:
${knowledgeContext}

回答の際は：
1. 組織内の既存知識を優先して活用する
2. 具体的で実用的なアドバイスを提供する
3. 日本語で自然に回答する
4. 不明な点は素直に「わからない」と答える
5. 必要に応じて関連するメンバーや情報源を提案する`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: question
          }
        ],
        max_tokens: 400,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content || 'すみません、回答を生成できませんでした。';
      
      return {
        response,
        confidence: 0.7,
        sources: ['組織内ナレッジベース'],
        suggestedActions: [
          '関連するメンバーに直接質問する',
          'より具体的な質問をする',
          '関連チャンネルで議論する'
        ]
      };
    } catch (error) {
      logger.error('Error getting general knowledge answer:', error);
      throw error;
    }
  }

  private async buildKnowledgeContext(query: AIQuery): Promise<KnowledgeContext> {
    try {
      const [profiles, recentResponses, users] = await Promise.all([
        this.profileRepository.findAll(),
        this.shuffleResponseRepository.findRecentResponses(10),
        this.userRepository.findAll()
      ]);

      return {
        profiles,
        recentResponses,
        users
      };
    } catch (error) {
      logger.error('Error building knowledge context:', error);
      return {
        profiles: [],
        recentResponses: [],
        users: []
      };
    }
  }

  private buildSystemPrompt(context: KnowledgeContext): string {
    const userCount = context.users.length;
    const profileCount = context.profiles.length;
    const responseCount = context.recentResponses.length;

    return `あなたは組織内のナレッジハブアシスタントです。以下の情報を活用して質問に答えてください。

組織情報:
- 総メンバー数: ${userCount}名
- プロフィール設定済み: ${profileCount}名
- 最近の知識共有: ${responseCount}件

あなたの役割:
1. メンバーのスキルや専門分野に関する質問に答える
2. 適切なメンバーを紹介する
3. 組織内の知識を活用して実用的なアドバイスを提供する
4. 日本語で自然かつ親しみやすく回答する

回答の際は：
- 具体的で実用的な情報を提供する
- 不明な点は素直に「わからない」と答える
- 必要に応じて関連するメンバーや情報源を提案する
- 組織内のコラボレーションを促進する
- 簡潔で読みやすい形式で回答する`;
  }

  private parseAIResponse(response: string, context: KnowledgeContext): AIResponse {
    // Simple confidence calculation based on response characteristics
    let confidence = 0.7;
    
    if (response.includes('わからない') || response.includes('不明')) {
      confidence = 0.3;
    } else if (response.includes('見つかりました') || response.includes('以下の')) {
      confidence = 0.9;
    }

    // Extract potential sources from context
    const sources: string[] = [];
    if (context.profiles.length > 0) {
      sources.push('プロフィール情報');
    }
    if (context.recentResponses.length > 0) {
      sources.push('最近の知識共有');
    }

    // Generate suggested actions
    const suggestedActions = [
      '関連するメンバーに直接連絡する',
      'より詳細な情報を求める',
      '関連チャンネルで議論する'
    ];

    return {
      response,
      confidence,
      sources,
      suggestedActions
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: 'Hello, this is a test message.'
          }
        ],
        max_tokens: 10,
      });

      return completion.choices.length > 0;
    } catch (error) {
      logger.error('OpenAI connection test failed:', error);
      return false;
    }
  }

  private buildEnhancedSystemPrompt(aiContext: any): string {
    const { userContext, organizationContext, knowledgeContext, conversationContext } = aiContext;

    return `あなたは組織内のナレッジハブアシスタントです。以下の豊富な情報を活用して質問に答えてください。

## 組織情報
- 総メンバー数: ${organizationContext.totalUsers}名
- アクティブユーザー: ${organizationContext.activeUsers}名
- 部署: ${organizationContext.departments.join(', ')}
- 主要スキル: ${organizationContext.commonSkills.slice(0, 5).join(', ')}

## 質問者情報
- 名前: ${userContext.userName}
- 部署: ${userContext.department || '未設定'}
- 役職: ${userContext.role || '未設定'}
- 専門分野: ${userContext.expertise.join(', ') || '未設定'}

## 関連知識
- 関連する知識項目: ${knowledgeContext.relevantKnowledge.length}件
- 関連ユーザー: ${knowledgeContext.relatedUsers.length}名
- 推奨エキスパート: ${knowledgeContext.suggestedExperts.length}名
- 知識ギャップ: ${knowledgeContext.knowledgeGaps.join(', ') || 'なし'}

## 会話コンテキスト
- 質問タイプ: ${conversationContext.queryType}
- 信頼度: ${Math.round(conversationContext.confidence * 100)}%

## 最近のトレンド
${organizationContext.recentTrends.slice(0, 3).map(trend => 
  `- ${trend.topic}: ${trend.trend} (${trend.frequency}回言及)`
).join('\n')}

あなたの役割:
1. 上記の豊富な情報を活用して、具体的で実用的な回答を提供する
2. 適切なメンバーを紹介し、コラボレーションを促進する
3. 知識ギャップがある場合は、それを明示し改善を提案する
4. 日本語で自然かつ親しみやすく回答する
5. 組織の知識共有文化を促進する

回答の際は：
- 関連する知識項目や専門家を具体的に紹介する
- 不明な点は素直に「わからない」と答える
- 組織内のリソースを最大限活用する提案をする
- 簡潔で読みやすい形式で回答する`;
  }

  private buildKnowledgeContextFromAI(aiContext: any): KnowledgeContext {
    const { knowledgeContext, organizationContext } = aiContext;
    
    return {
      profiles: [], // Legacy field for compatibility
      recentResponses: [], // Legacy field for compatibility
      users: [], // Legacy field for compatibility
      relevantKnowledge: knowledgeContext.relevantKnowledge,
      relatedUsers: knowledgeContext.relatedUsers,
      suggestedExperts: knowledgeContext.suggestedExperts,
      knowledgeGaps: knowledgeContext.knowledgeGaps,
      organizationTrends: organizationContext.recentTrends
    };
  }

  private parseEnhancedAIResponse(response: string, aiContext: any): AIResponse {
    const { conversationContext, knowledgeContext } = aiContext;
    
    // Use conversation context confidence as base
    let confidence = conversationContext.confidence;
    
    // Adjust confidence based on response characteristics
    if (response.includes('わからない') || response.includes('不明')) {
      confidence *= 0.5;
    } else if (response.includes('見つかりました') || response.includes('以下の')) {
      confidence = Math.min(confidence * 1.2, 1.0);
    }

    // Extract sources from knowledge context
    const sources: string[] = [];
    if (knowledgeContext.relevantKnowledge.length > 0) {
      sources.push(`関連知識 (${knowledgeContext.relevantKnowledge.length}件)`);
    }
    if (knowledgeContext.suggestedExperts.length > 0) {
      sources.push(`エキスパート情報 (${knowledgeContext.suggestedExperts.length}名)`);
    }
    if (knowledgeContext.relatedUsers.length > 0) {
      sources.push(`関連ユーザー (${knowledgeContext.relatedUsers.length}名)`);
    }

    // Use conversation context suggested follow-ups or generate new ones
    const suggestedActions = conversationContext.suggestedFollowUps.length > 0 
      ? conversationContext.suggestedFollowUps
      : this.generateContextualActions(aiContext);

    return {
      response,
      confidence,
      sources,
      suggestedActions
    };
  }

  private generateContextualActions(aiContext: any): string[] {
    const { knowledgeContext, conversationContext } = aiContext;
    const actions: string[] = [];

    // Add expert-specific actions
    if (knowledgeContext.suggestedExperts.length > 0) {
      const topExpert = knowledgeContext.suggestedExperts[0];
      actions.push(`${topExpert.userName}さんに直接相談する`);
    }

    // Add knowledge gap actions
    if (knowledgeContext.knowledgeGaps.length > 0) {
      actions.push('この分野の知識共有を促進する');
    }

    // Add related user actions
    if (knowledgeContext.relatedUsers.length > 0) {
      actions.push('関連する経験を持つメンバーと情報交換する');
    }

    // Add query-type specific actions
    switch (conversationContext.queryType) {
      case 'skill_search':
        actions.push('スキルマップを更新する');
        break;
      case 'user_inquiry':
        actions.push('プロフィール情報を充実させる');
        break;
      case 'knowledge_request':
        actions.push('ナレッジベースに情報を追加する');
        break;
    }

    return actions.slice(0, 3); // Limit to 3 actions
  }

  async extractAndIndexKnowledge(): Promise<void> {
    try {
      logger.info('Starting knowledge extraction and indexing');
      
      const extractionResult = await this.knowledgeExtractor.extractAllKnowledge();
      
      logger.info('Knowledge extraction completed', {
        totalItems: extractionResult.knowledgeItems.length,
        newItems: extractionResult.newItemsFound,
        processingTime: extractionResult.processingTime
      });
      
      // In a production system, you would store this in a vector database
      // or search index for faster retrieval
    } catch (error) {
      logger.error('Error in knowledge extraction and indexing:', error);
      throw error;
    }
  }

  async getKnowledgeInsights(): Promise<{
    totalKnowledgeItems: number;
    topSkills: string[];
    activeContributors: string[];
    knowledgeGaps: string[];
    recentTrends: any[];
  }> {
    try {
      const extractionResult = await this.knowledgeExtractor.extractAllKnowledge();
      const knowledgeGraph = await this.knowledgeExtractor.buildKnowledgeGraph(extractionResult.knowledgeItems);
      
      // Analyze skills
      const skillNodes = knowledgeGraph.nodes.filter(node => node.type === 'skill');
      const topSkills = skillNodes
        .sort((a, b) => (b.properties.mentionCount || 0) - (a.properties.mentionCount || 0))
        .slice(0, 10)
        .map(node => node.label);

      // Find active contributors
      const userContributions = new Map<string, number>();
      extractionResult.knowledgeItems.forEach(item => {
        userContributions.set(item.userName, (userContributions.get(item.userName) || 0) + 1);
      });
      
      const activeContributors = Array.from(userContributions.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([name]) => name);

      // Identify knowledge gaps (simplified)
      const knowledgeGaps = [
        '最新技術情報の不足',
        'プロセス改善の事例不足',
        'トラブルシューティング情報の不足'
      ];

      // Get recent trends
      const organizationContext = await this.contextBuilder.buildOrganizationContext();

      return {
        totalKnowledgeItems: extractionResult.knowledgeItems.length,
        topSkills,
        activeContributors,
        knowledgeGaps,
        recentTrends: organizationContext.recentTrends
      };
    } catch (error) {
      logger.error('Error getting knowledge insights:', error);
      throw error;
    }
  }
}