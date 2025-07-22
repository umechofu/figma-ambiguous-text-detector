import { SurveyRepository } from '../../repositories/SurveyRepository';
import { UserRepository } from '../../repositories/UserRepository';
import { Survey, CreateSurveyRequest, SurveyQuestion } from '../models/Survey';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface SurveyTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  questions: Omit<SurveyQuestion, 'id'>[];
}

export interface SurveyBuilderOptions {
  title: string;
  description?: string;
  channelId: string;
  createdBy: string;
  expiresAt?: Date;
  questions: Omit<SurveyQuestion, 'id'>[];
}

export class SurveyBuilder {
  private surveyRepository: SurveyRepository;
  private userRepository: UserRepository;
  private templates: SurveyTemplate[];

  constructor() {
    this.surveyRepository = new SurveyRepository();
    this.userRepository = new UserRepository();
    this.templates = this.initializeTemplates();
  }

  async createSurvey(options: SurveyBuilderOptions): Promise<Survey> {
    try {
      // Validate user exists
      const user = await this.userRepository.findById(options.createdBy);
      if (!user) {
        throw new Error('User not found');
      }

      // Validate questions
      this.validateQuestions(options.questions);

      const surveyData: CreateSurveyRequest = {
        title: options.title,
        description: options.description,
        questions: options.questions,
        createdBy: options.createdBy,
        channelId: options.channelId,
        expiresAt: options.expiresAt
      };

      const survey = await this.surveyRepository.create(surveyData);
      
      logger.info(`Survey created: ${survey.id}`, {
        title: survey.title,
        createdBy: survey.createdBy,
        questionCount: survey.questions.length
      });

      return survey;
    } catch (error) {
      logger.error('Error creating survey:', error);
      throw error;
    }
  }

  async createSurveyFromTemplate(templateId: string, options: {
    title?: string;
    description?: string;
    channelId: string;
    createdBy: string;
    expiresAt?: Date;
  }): Promise<Survey> {
    try {
      const template = this.getTemplate(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      const surveyOptions: SurveyBuilderOptions = {
        title: options.title || template.name,
        description: options.description || template.description,
        channelId: options.channelId,
        createdBy: options.createdBy,
        expiresAt: options.expiresAt,
        questions: template.questions
      };

      return await this.createSurvey(surveyOptions);
    } catch (error) {
      logger.error('Error creating survey from template:', error);
      throw error;
    }
  }

  getTemplates(): SurveyTemplate[] {
    return this.templates;
  }

  getTemplate(templateId: string): SurveyTemplate | null {
    return this.templates.find(template => template.id === templateId) || null;
  }

  getTemplatesByCategory(category: string): SurveyTemplate[] {
    return this.templates.filter(template => template.category === category);
  }

  validateQuestions(questions: Omit<SurveyQuestion, 'id'>[]): void {
    if (questions.length === 0) {
      throw new Error('Survey must have at least one question');
    }

    if (questions.length > 20) {
      throw new Error('Survey cannot have more than 20 questions');
    }

    questions.forEach((question, index) => {
      if (!question.question || question.question.trim().length === 0) {
        throw new Error(`Question ${index + 1} cannot be empty`);
      }

      if (question.question.length > 500) {
        throw new Error(`Question ${index + 1} is too long (max 500 characters)`);
      }

      if (!['text', 'multiple_choice', 'single_choice', 'rating', 'boolean'].includes(question.type)) {
        throw new Error(`Question ${index + 1} has invalid type: ${question.type}`);
      }

      if ((question.type === 'multiple_choice' || question.type === 'single_choice') && 
          (!question.options || question.options.length < 2)) {
        throw new Error(`Question ${index + 1} must have at least 2 options for choice questions`);
      }

      if (question.options && question.options.length > 10) {
        throw new Error(`Question ${index + 1} cannot have more than 10 options`);
      }
    });
  }

  buildQuestionBlocks(questions: SurveyQuestion[]): any[] {
    const blocks: any[] = [];

    questions.forEach((question, index) => {
      const blockId = `question_${question.id}`;
      
      switch (question.type) {
        case 'text':
          blocks.push({
            type: 'input',
            block_id: blockId,
            element: {
              type: 'plain_text_input',
              action_id: 'answer',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: '回答を入力してください'
              }
            },
            label: {
              type: 'plain_text',
              text: `${index + 1}. ${question.question}${question.required ? ' *' : ''}`
            },
            optional: !question.required
          });
          break;

        case 'single_choice':
          blocks.push({
            type: 'input',
            block_id: blockId,
            element: {
              type: 'radio_buttons',
              action_id: 'answer',
              options: question.options?.map(option => ({
                text: {
                  type: 'plain_text',
                  text: option
                },
                value: option
              })) || []
            },
            label: {
              type: 'plain_text',
              text: `${index + 1}. ${question.question}${question.required ? ' *' : ''}`
            },
            optional: !question.required
          });
          break;

        case 'multiple_choice':
          blocks.push({
            type: 'input',
            block_id: blockId,
            element: {
              type: 'checkboxes',
              action_id: 'answer',
              options: question.options?.map(option => ({
                text: {
                  type: 'plain_text',
                  text: option
                },
                value: option
              })) || []
            },
            label: {
              type: 'plain_text',
              text: `${index + 1}. ${question.question}${question.required ? ' *' : ''}`
            },
            optional: !question.required
          });
          break;

        case 'rating':
          blocks.push({
            type: 'input',
            block_id: blockId,
            element: {
              type: 'radio_buttons',
              action_id: 'answer',
              options: [
                { value: '1', text: { type: 'plain_text', text: '1⭐ (とても悪い)' } },
                { value: '2', text: { type: 'plain_text', text: '2⭐ (悪い)' } },
                { value: '3', text: { type: 'plain_text', text: '3⭐ (普通)' } },
                { value: '4', text: { type: 'plain_text', text: '4⭐ (良い)' } },
                { value: '5', text: { type: 'plain_text', text: '5⭐ (とても良い)' } }
              ]
            },
            label: {
              type: 'plain_text',
              text: `${index + 1}. ${question.question}${question.required ? ' *' : ''}`
            },
            optional: !question.required
          });
          break;

        case 'boolean':
          blocks.push({
            type: 'input',
            block_id: blockId,
            element: {
              type: 'radio_buttons',
              action_id: 'answer',
              options: [
                {
                  text: {
                    type: 'plain_text',
                    text: 'はい'
                  },
                  value: 'true'
                },
                {
                  text: {
                    type: 'plain_text',
                    text: 'いいえ'
                  },
                  value: 'false'
                }
              ]
            },
            label: {
              type: 'plain_text',
              text: `${index + 1}. ${question.question}${question.required ? ' *' : ''}`
            },
            optional: !question.required
          });
          break;
      }
    });

    return blocks;
  }

  private initializeTemplates(): SurveyTemplate[] {
    return [
      {
        id: 'employee_satisfaction',
        name: '従業員満足度調査',
        description: '職場環境や業務に対する満足度を測定します',
        category: 'hr',
        questions: [
          {
            type: 'rating',
            question: '現在の職場環境に満足していますか？',
            required: true
          },
          {
            type: 'rating',
            question: '上司とのコミュニケーションはスムーズですか？',
            required: true
          },
          {
            type: 'rating',
            question: '業務量は適切だと思いますか？',
            required: true
          },
          {
            type: 'multiple_choice',
            question: '改善してほしい点はありますか？（複数選択可）',
            options: ['職場環境', 'コミュニケーション', '業務プロセス', '福利厚生', 'その他'],
            required: false
          },
          {
            type: 'text',
            question: 'その他ご意見・ご要望があればお聞かせください',
            required: false
          }
        ]
      },
      {
        id: 'project_feedback',
        name: 'プロジェクト振り返り',
        description: 'プロジェクト完了後の振り返りと改善点の収集',
        category: 'project',
        questions: [
          {
            type: 'rating',
            question: 'プロジェクトの成果に満足していますか？',
            required: true
          },
          {
            type: 'single_choice',
            question: 'プロジェクトの進行で最も困難だった点は？',
            options: ['スケジュール管理', 'リソース不足', 'コミュニケーション', '技術的課題', 'その他'],
            required: true
          },
          {
            type: 'multiple_choice',
            question: '次回改善したい点は？（複数選択可）',
            options: ['計画立案', 'チーム連携', '進捗管理', '品質管理', 'ドキュメント'],
            required: false
          },
          {
            type: 'text',
            question: '学んだことや気づきがあれば教えてください',
            required: false
          }
        ]
      },
      {
        id: 'training_evaluation',
        name: '研修評価アンケート',
        description: '研修の効果と満足度を評価します',
        category: 'training',
        questions: [
          {
            type: 'rating',
            question: '研修内容は理解しやすかったですか？',
            required: true
          },
          {
            type: 'rating',
            question: '研修は業務に役立つと思いますか？',
            required: true
          },
          {
            type: 'single_choice',
            question: '研修の難易度はいかがでしたか？',
            options: ['とても簡単', '簡単', '適切', '難しい', 'とても難しい'],
            required: true
          },
          {
            type: 'boolean',
            question: '同僚にこの研修を推薦しますか？',
            required: true
          },
          {
            type: 'text',
            question: '改善点やご意見があればお聞かせください',
            required: false
          }
        ]
      },
      {
        id: 'event_feedback',
        name: 'イベント感想アンケート',
        description: '社内イベントの感想と改善点を収集します',
        category: 'event',
        questions: [
          {
            type: 'rating',
            question: 'イベント全体の満足度はいかがでしたか？',
            required: true
          },
          {
            type: 'multiple_choice',
            question: '良かった点は？（複数選択可）',
            options: ['内容', '進行', '会場', '時間設定', '参加者との交流'],
            required: false
          },
          {
            type: 'single_choice',
            question: '今後参加したいイベントの頻度は？',
            options: ['月1回', '2-3ヶ月に1回', '半年に1回', '年1回', '参加したくない'],
            required: true
          },
          {
            type: 'text',
            question: '次回開催してほしいイベントがあれば教えてください',
            required: false
          }
        ]
      },
      {
        id: 'quick_pulse',
        name: 'クイックパルス調査',
        description: 'チームの状況を素早く把握するための簡単な調査',
        category: 'pulse',
        questions: [
          {
            type: 'rating',
            question: '今週のモチベーションはいかがですか？',
            required: true
          },
          {
            type: 'rating',
            question: 'チーム内のコミュニケーションは良好ですか？',
            required: true
          },
          {
            type: 'boolean',
            question: '現在の業務量は適切ですか？',
            required: true
          },
          {
            type: 'text',
            question: '何かサポートが必要なことはありますか？',
            required: false
          }
        ]
      }
    ];
  }
}