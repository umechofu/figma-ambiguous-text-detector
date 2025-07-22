import { QuestionRepository } from '../../repositories/QuestionRepository';
import { Question, CreateQuestionRequest, UpdateQuestionRequest } from '../models/Question';
import { logger } from '../../utils/logger';

export class QuestionService {
  private questionRepository: QuestionRepository;

  constructor() {
    this.questionRepository = new QuestionRepository();
  }

  /**
   * Create a new question
   */
  async createQuestion(questionData: CreateQuestionRequest): Promise<Question> {
    try {
      logger.info(`Creating new question: ${questionData.content.substring(0, 50)}...`);
      
      const question = await this.questionRepository.create(questionData);
      
      logger.info(`Successfully created question: ${question.id}`);
      return question;
    } catch (error) {
      logger.error('Error creating question:', error);
      throw new Error('Failed to create question');
    }
  }

  /**
   * Update an existing question
   */
  async updateQuestion(id: string, questionData: UpdateQuestionRequest): Promise<Question> {
    try {
      logger.info(`Updating question: ${id}`);
      
      const question = await this.questionRepository.update(id, questionData);
      
      logger.info(`Successfully updated question: ${question.id}`);
      return question;
    } catch (error) {
      logger.error(`Error updating question ${id}:`, error);
      throw new Error('Failed to update question');
    }
  }

  /**
   * Get question by ID
   */
  async getQuestion(id: string): Promise<Question | null> {
    try {
      return await this.questionRepository.findById(id);
    } catch (error) {
      logger.error(`Error getting question ${id}:`, error);
      return null;
    }
  }

  /**
   * Get all active questions
   */
  async getActiveQuestions(): Promise<Question[]> {
    try {
      return await this.questionRepository.findActiveQuestions();
    } catch (error) {
      logger.error('Error getting active questions:', error);
      return [];
    }
  }

  /**
   * Get questions by category
   */
  async getQuestionsByCategory(category: string): Promise<Question[]> {
    try {
      return await this.questionRepository.findByCategory(category);
    } catch (error) {
      logger.error(`Error getting questions by category ${category}:`, error);
      return [];
    }
  }

  /**
   * Get all questions (including inactive)
   */
  async getAllQuestions(): Promise<Question[]> {
    try {
      return await this.questionRepository.findAll();
    } catch (error) {
      logger.error('Error getting all questions:', error);
      return [];
    }
  }

  /**
   * Delete a question
   */
  async deleteQuestion(id: string): Promise<boolean> {
    try {
      logger.info(`Deleting question: ${id}`);
      
      const result = await this.questionRepository.delete(id);
      
      if (result) {
        logger.info(`Successfully deleted question: ${id}`);
      }
      
      return result;
    } catch (error) {
      logger.error(`Error deleting question ${id}:`, error);
      throw new Error('Failed to delete question');
    }
  }

  /**
   * Activate/deactivate a question
   */
  async toggleQuestionStatus(id: string): Promise<Question> {
    try {
      const question = await this.questionRepository.findById(id);
      if (!question) {
        throw new Error('Question not found');
      }

      const updatedQuestion = await this.questionRepository.update(id, {
        isActive: !question.isActive
      });

      logger.info(`Toggled question status: ${id} -> ${updatedQuestion.isActive ? 'active' : 'inactive'}`);
      return updatedQuestion;
    } catch (error) {
      logger.error(`Error toggling question status ${id}:`, error);
      throw new Error('Failed to toggle question status');
    }
  }

  /**
   * Get random question for shuffle feature
   */
  async getRandomQuestion(excludeIds: string[] = []): Promise<Question | null> {
    try {
      return await this.questionRepository.getRandomQuestion(excludeIds);
    } catch (error) {
      logger.error('Error getting random question:', error);
      return null;
    }
  }

  /**
   * Get question categories with counts
   */
  async getQuestionCategories(): Promise<Array<{ category: string; count: number; activeCount: number }>> {
    try {
      const questions = await this.questionRepository.findAll();
      
      const categoryMap = new Map<string, { total: number; active: number }>();
      
      questions.forEach(question => {
        const current = categoryMap.get(question.category) || { total: 0, active: 0 };
        current.total++;
        if (question.isActive) {
          current.active++;
        }
        categoryMap.set(question.category, current);
      });

      return Array.from(categoryMap.entries()).map(([category, counts]) => ({
        category,
        count: counts.total,
        activeCount: counts.active
      })).sort((a, b) => a.category.localeCompare(b.category));
    } catch (error) {
      logger.error('Error getting question categories:', error);
      return [];
    }
  }

  /**
   * Validate question content
   */
  validateQuestion(content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!content || content.trim().length === 0) {
      errors.push('質問内容は必須です');
    }

    if (content.length < 10) {
      errors.push('質問内容は10文字以上で入力してください');
    }

    if (content.length > 500) {
      errors.push('質問内容は500文字以内で入力してください');
    }

    // Check for inappropriate content (basic check)
    const inappropriateWords = ['バカ', 'アホ', '死ね', 'クソ'];
    const hasInappropriate = inappropriateWords.some(word => 
      content.toLowerCase().includes(word.toLowerCase())
    );

    if (hasInappropriate) {
      errors.push('不適切な内容が含まれています');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get default question categories
   */
  getDefaultCategories(): string[] {
    return [
      'technology',      // 技術系
      'productivity',    // 業務効率化系
      'learning',        // 学習・成長系
      'communication',   // コミュニケーション系
      'creativity',      // 創造性・アイデア系
      'worklife',        // ワークライフバランス系
      'general'          // 一般的な質問
    ];
  }

  /**
   * Get category display name in Japanese
   */
  getCategoryDisplayName(category: string): string {
    const categoryNames: Record<string, string> = {
      'technology': '技術・ツール',
      'productivity': '業務効率化',
      'learning': '学習・成長',
      'communication': 'コミュニケーション',
      'creativity': '創造性・アイデア',
      'worklife': 'ワークライフバランス',
      'general': '一般'
    };

    return categoryNames[category] || category;
  }

  /**
   * Bulk import questions
   */
  async importQuestions(questions: Array<Omit<CreateQuestionRequest, 'createdBy'>>, createdBy: string): Promise<{ success: number; errors: number }> {
    let success = 0;
    let errors = 0;

    for (const questionData of questions) {
      try {
        const validation = this.validateQuestion(questionData.content);
        if (!validation.isValid) {
          logger.warn(`Skipping invalid question: ${validation.errors.join(', ')}`);
          errors++;
          continue;
        }

        await this.createQuestion({
          ...questionData,
          createdBy
        });
        success++;
      } catch (error) {
        logger.error('Error importing question:', error);
        errors++;
      }
    }

    logger.info(`Question import completed. Success: ${success}, Errors: ${errors}`);
    return { success, errors };
  }
}