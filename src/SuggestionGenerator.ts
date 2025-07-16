// SuggestionGenerator.ts - 文脈に応じた置換候補生成システム

import { AmbiguousMatch, Suggestion, SuggestionCategory, ContextAnalysis, ContextType } from './types';
import { AmbiguousTextDetector } from './AmbiguousTextDetector';

export class SuggestionGenerator {
  private detector: AmbiguousTextDetector;
  private suggestionRules: SuggestionRule[] = [];
  private suggestionDatabase: SuggestionDatabase = {} as SuggestionDatabase;

  constructor() {
    this.detector = new AmbiguousTextDetector();
    this.initializeSuggestionRules();
    this.initializeSuggestionDatabase();
  }

  /**
   * 曖昧なマッチに対して置換候補を生成
   */
  generateSuggestions(match: AmbiguousMatch): Suggestion[] {
    // 文脈解析を実行
    const contextAnalysis = this.detector.analyzeContext(match);
    
    // 文脈に基づいて候補を生成
    const contextualSuggestions = this.getContextualSuggestions(match, contextAnalysis);
    
    // 汎用的な候補を生成
    const genericSuggestions = this.getGenericSuggestions(match.ambiguousWord);
    
    // 候補を統合し、重複を除去
    const allSuggestions = [...contextualSuggestions, ...genericSuggestions];
    const uniqueSuggestions = this.removeDuplicateSuggestions(allSuggestions);
    
    // 信頼度順にソート
    return uniqueSuggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 文脈に基づいた置換候補を生成
   */
  private getContextualSuggestions(match: AmbiguousMatch, analysis: ContextAnalysis): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const { ambiguousWord } = match;

    // UI要素ヒントに基づく候補生成
    for (const uiHint of analysis.uiElementHints) {
      const uiSuggestions = this.generateUIElementSuggestions(ambiguousWord, uiHint, analysis);
      suggestions.push(...uiSuggestions);
    }

    // アクションヒントに基づく候補生成
    for (const actionHint of analysis.actionHints) {
      const actionSuggestions = this.generateActionSuggestions(ambiguousWord, actionHint, analysis);
      suggestions.push(...actionSuggestions);
    }

    // 文脈タイプに基づく候補生成
    const typeSuggestions = this.generateContextTypeSuggestions(ambiguousWord, analysis.contextType, analysis);
    suggestions.push(...typeSuggestions);

    return suggestions;
  }

  /**
   * UI要素に基づく候補を生成
   */
  private generateUIElementSuggestions(ambiguousWord: string, uiHint: any, analysis: ContextAnalysis): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const baseConfidence = uiHint.confidence * 0.8;

    const elementMappings: { [key: string]: { [key: string]: string[] } } = {
      'button': {
        'これ': ['このボタン', 'ボタン', '送信ボタン', '確認ボタン'],
        'それ': ['そのボタン', 'ボタン', '戻るボタン', 'キャンセルボタン'],
        'あれ': ['あのボタン', 'ボタン', '削除ボタン', '設定ボタン']
      },
      'link': {
        'これ': ['このリンク', 'リンク', 'ページリンク', '詳細リンク'],
        'それ': ['そのリンク', 'リンク', '戻るリンク', '関連リンク'],
        'あれ': ['あのリンク', 'リンク', '外部リンク', 'ヘルプリンク']
      },
      'page': {
        'これ': ['このページ', 'ページ', '現在のページ', 'メインページ'],
        'それ': ['そのページ', 'ページ', '前のページ', '一覧ページ'],
        'あれ': ['あのページ', 'ページ', '設定ページ', '詳細ページ']
      },
      'image': {
        'これ': ['この画像', '画像', 'プロフィール画像', 'メイン画像'],
        'それ': ['その画像', '画像', 'サムネイル画像', '背景画像'],
        'あれ': ['あの画像', '画像', 'アイコン画像', 'ロゴ画像']
      },
      'file': {
        'これ': ['このファイル', 'ファイル', 'ドキュメント', 'データファイル'],
        'それ': ['そのファイル', 'ファイル', '添付ファイル', '設定ファイル'],
        'あれ': ['あのファイル', 'ファイル', 'バックアップファイル', 'ログファイル']
      }
    };

    const mappings = elementMappings[uiHint.elementType];
    if (mappings && mappings[ambiguousWord]) {
      for (const replacement of mappings[ambiguousWord]) {
        suggestions.push({
          replacementText: replacement,
          confidence: baseConfidence,
          category: SuggestionCategory.UI_ELEMENT
        });
      }
    }

    return suggestions;
  }

  /**
   * アクションに基づく候補を生成
   */
  private generateActionSuggestions(ambiguousWord: string, actionHint: any, analysis: ContextAnalysis): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const baseConfidence = actionHint.confidence * 0.7;

    const actionMappings: { [key: string]: { [key: string]: string[] } } = {
      'save': {
        'これ': ['この内容', 'データ', 'ファイル', '変更内容'],
        'それ': ['その内容', 'データ', '設定', '入力内容'],
        'あれ': ['あの内容', 'データ', '作業内容', 'プロジェクト']
      },
      'delete': {
        'これ': ['この項目', 'データ', 'ファイル', 'アカウント'],
        'それ': ['その項目', 'データ', '履歴', '設定'],
        'あれ': ['あの項目', 'データ', '古いファイル', '不要なデータ']
      },
      'edit': {
        'これ': ['この内容', 'テキスト', 'プロフィール', '設定'],
        'それ': ['その内容', 'テキスト', '情報', 'データ'],
        'あれ': ['あの内容', 'テキスト', 'ドキュメント', '項目']
      },
      'send': {
        'これ': ['このメッセージ', 'データ', 'ファイル', '情報'],
        'それ': ['そのメッセージ', 'データ', 'レポート', '通知'],
        'あれ': ['あのメッセージ', 'データ', 'ドキュメント', '招待']
      }
    };

    const mappings = actionMappings[actionHint.actionType];
    if (mappings && mappings[ambiguousWord]) {
      for (const replacement of mappings[ambiguousWord]) {
        suggestions.push({
          replacementText: replacement,
          confidence: baseConfidence,
          category: SuggestionCategory.ACTION
        });
      }
    }

    return suggestions;
  }

  /**
   * 文脈タイプに基づく候補を生成
   */
  private generateContextTypeSuggestions(ambiguousWord: string, contextType: ContextType, analysis: ContextAnalysis): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const baseConfidence = 0.6;

    const contextMappings: { [key in ContextType]: { [key: string]: string[] } } = {
      [ContextType.UI_ACTION]: {
        'これ': ['この操作', 'この機能', 'このボタン', 'この項目'],
        'それ': ['その操作', 'その機能', 'そのボタン', 'その項目'],
        'あれ': ['あの操作', 'あの機能', 'あのボタン', 'あの項目']
      },
      [ContextType.CONTENT]: {
        'これ': ['この内容', 'このデータ', 'この情報', 'このファイル'],
        'それ': ['その内容', 'そのデータ', 'その情報', 'そのファイル'],
        'あれ': ['あの内容', 'あのデータ', 'あの情報', 'あのファイル']
      },
      [ContextType.NAVIGATION]: {
        'これ': ['このページ', 'この画面', 'この場所', 'このセクション'],
        'それ': ['そのページ', 'その画面', 'その場所', 'そのセクション'],
        'あれ': ['あのページ', 'あの画面', 'あの場所', 'あのセクション']
      },
      [ContextType.GENERIC]: {
        'これ': ['この項目', 'この要素', 'この部分', 'この内容'],
        'それ': ['その項目', 'その要素', 'その部分', 'その内容'],
        'あれ': ['あの項目', 'あの要素', 'あの部分', 'あの内容']
      }
    };

    const mappings = contextMappings[contextType];
    if (mappings && mappings[ambiguousWord]) {
      for (const replacement of mappings[ambiguousWord]) {
        suggestions.push({
          replacementText: replacement,
          confidence: baseConfidence,
          category: SuggestionCategory.CONTENT
        });
      }
    }

    return suggestions;
  }

  /**
   * 汎用的な置換候補を生成
   */
  private getGenericSuggestions(ambiguousWord: string): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const baseConfidence = 0.4;

    const genericMappings: { [key: string]: string[] } = {
      'これ': ['この項目', 'この内容', 'この機能', 'この部分', 'この要素'],
      'それ': ['その項目', 'その内容', 'その機能', 'その部分', 'その要素'],
      'あれ': ['あの項目', 'あの内容', 'あの機能', 'あの部分', 'あの要素'],
      'こちら': ['この方向', 'この場所', 'このページ', 'この選択肢'],
      'そちら': ['その方向', 'その場所', 'そのページ', 'その選択肢'],
      'あちら': ['あの方向', 'あの場所', 'あのページ', 'あの選択肢'],
      'ここ': ['この場所', 'この位置', 'このページ', 'この画面'],
      'そこ': ['その場所', 'その位置', 'そのページ', 'その画面'],
      'あそこ': ['あの場所', 'あの位置', 'あのページ', 'あの画面']
    };

    const replacements = genericMappings[ambiguousWord];
    if (replacements) {
      for (const replacement of replacements) {
        suggestions.push({
          replacementText: replacement,
          confidence: baseConfidence,
          category: SuggestionCategory.GENERIC
        });
      }
    }

    return suggestions;
  }

  /**
   * 重複する候補を除去
   */
  private removeDuplicateSuggestions(suggestions: Suggestion[]): Suggestion[] {
    const uniqueSuggestions: Suggestion[] = [];
    const seenTexts = new Set<string>();

    for (const suggestion of suggestions) {
      if (!seenTexts.has(suggestion.replacementText)) {
        seenTexts.add(suggestion.replacementText);
        uniqueSuggestions.push(suggestion);
      }
    }

    return uniqueSuggestions;
  }

  /**
   * 提案ルールを初期化
   */
  private initializeSuggestionRules(): void {
    this.suggestionRules = [
      // UI要素関連のルール
      {
        pattern: /ボタン|クリック|押/,
        contextKeywords: ['ボタン', 'クリック', '押す', '選択'],
        suggestions: ['ボタン', '送信ボタン', '確認ボタン', 'キャンセルボタン'],
        priority: 0.8,
        category: SuggestionCategory.UI_ELEMENT
      },
      {
        pattern: /ページ|画面|表示/,
        contextKeywords: ['ページ', '画面', '表示', '移動'],
        suggestions: ['ページ', '画面', 'メインページ', '設定画面'],
        priority: 0.7,
        category: SuggestionCategory.UI_ELEMENT
      },
      // アクション関連のルール
      {
        pattern: /保存|セーブ/,
        contextKeywords: ['保存', 'セーブ', '保持'],
        suggestions: ['データ', 'ファイル', '設定', '変更内容'],
        priority: 0.8,
        category: SuggestionCategory.ACTION
      },
      {
        pattern: /削除|消去/,
        contextKeywords: ['削除', '消去', '除去'],
        suggestions: ['項目', 'ファイル', 'データ', 'アカウント'],
        priority: 0.8,
        category: SuggestionCategory.ACTION
      }
    ];
  }

  /**
   * カスタム提案ルールを追加
   */
  addCustomRule(rule: SuggestionRule): void {
    this.suggestionRules.push(rule);
    // 優先度順にソート
    this.suggestionRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 提案の品質を評価
   */
  evaluateSuggestionQuality(suggestion: Suggestion, context: string): number {
    let quality = suggestion.confidence;

    // 文脈との関連性をチェック
    const contextWords = context.toLowerCase().split(/\s+/);
    const suggestionWords = suggestion.replacementText.toLowerCase().split(/\s+/);
    
    const commonWords = contextWords.filter(word => 
      suggestionWords.some(sugWord => sugWord.includes(word) || word.includes(sugWord))
    );

    // 共通語数に基づいて品質を調整
    quality += commonWords.length * 0.1;

    // カテゴリに基づく調整
    switch (suggestion.category) {
      case SuggestionCategory.UI_ELEMENT:
        quality += 0.1;
        break;
      case SuggestionCategory.ACTION:
        quality += 0.05;
        break;
      default:
        break;
    }

    return Math.min(quality, 1.0);
  }

  /**
   * 提案データベースを初期化
   */
  private initializeSuggestionDatabase(): void {
    this.suggestionDatabase = {
      // UI要素カテゴリ
      uiElements: {
        'button': {
          patterns: ['ボタン', 'クリック', '押す', '選択'],
          suggestions: {
            'これ': [
              { text: 'このボタン', weight: 0.9, context: ['クリック', '押す'] },
              { text: '送信ボタン', weight: 0.8, context: ['送信', '確認'] },
              { text: '確認ボタン', weight: 0.8, context: ['確認', 'OK'] },
              { text: 'ボタン', weight: 0.7, context: [] }
            ],
            'それ': [
              { text: 'そのボタン', weight: 0.9, context: ['クリック', '押す'] },
              { text: '戻るボタン', weight: 0.8, context: ['戻る', 'キャンセル'] },
              { text: 'キャンセルボタン', weight: 0.8, context: ['キャンセル', '中止'] },
              { text: 'ボタン', weight: 0.7, context: [] }
            ],
            'あれ': [
              { text: 'あのボタン', weight: 0.9, context: ['クリック', '押す'] },
              { text: '削除ボタン', weight: 0.8, context: ['削除', '消去'] },
              { text: '設定ボタン', weight: 0.8, context: ['設定', '変更'] },
              { text: 'ボタン', weight: 0.7, context: [] }
            ]
          }
        },
        'page': {
          patterns: ['ページ', '画面', '表示', '移動'],
          suggestions: {
            'これ': [
              { text: 'このページ', weight: 0.9, context: ['ページ', '画面'] },
              { text: '現在のページ', weight: 0.8, context: ['現在', '今'] },
              { text: 'メインページ', weight: 0.7, context: ['メイン', 'トップ'] },
              { text: 'ページ', weight: 0.6, context: [] }
            ],
            'それ': [
              { text: 'そのページ', weight: 0.9, context: ['ページ', '画面'] },
              { text: '前のページ', weight: 0.8, context: ['前', '戻る'] },
              { text: '一覧ページ', weight: 0.7, context: ['一覧', 'リスト'] },
              { text: 'ページ', weight: 0.6, context: [] }
            ],
            'あれ': [
              { text: 'あのページ', weight: 0.9, context: ['ページ', '画面'] },
              { text: '設定ページ', weight: 0.8, context: ['設定', '変更'] },
              { text: '詳細ページ', weight: 0.7, context: ['詳細', '情報'] },
              { text: 'ページ', weight: 0.6, context: [] }
            ]
          }
        }
      },
      // アクションカテゴリ
      actions: {
        'save': {
          patterns: ['保存', 'セーブ', '保持'],
          suggestions: {
            'これ': [
              { text: 'この内容', weight: 0.9, context: ['内容', 'データ'] },
              { text: 'データ', weight: 0.8, context: ['データ', '情報'] },
              { text: 'ファイル', weight: 0.8, context: ['ファイル', '文書'] },
              { text: '変更内容', weight: 0.7, context: ['変更', '修正'] }
            ],
            'それ': [
              { text: 'その内容', weight: 0.9, context: ['内容', 'データ'] },
              { text: '設定', weight: 0.8, context: ['設定', '構成'] },
              { text: '入力内容', weight: 0.8, context: ['入力', 'フォーム'] },
              { text: 'データ', weight: 0.7, context: ['データ', '情報'] }
            ],
            'あれ': [
              { text: 'あの内容', weight: 0.9, context: ['内容', 'データ'] },
              { text: '作業内容', weight: 0.8, context: ['作業', '編集'] },
              { text: 'プロジェクト', weight: 0.7, context: ['プロジェクト', '案件'] },
              { text: 'データ', weight: 0.7, context: ['データ', '情報'] }
            ]
          }
        },
        'delete': {
          patterns: ['削除', '消去', '除去'],
          suggestions: {
            'これ': [
              { text: 'この項目', weight: 0.9, context: ['項目', 'アイテム'] },
              { text: 'ファイル', weight: 0.8, context: ['ファイル', '文書'] },
              { text: 'データ', weight: 0.8, context: ['データ', '情報'] },
              { text: 'アカウント', weight: 0.7, context: ['アカウント', 'ユーザー'] }
            ],
            'それ': [
              { text: 'その項目', weight: 0.9, context: ['項目', 'アイテム'] },
              { text: '履歴', weight: 0.8, context: ['履歴', '記録'] },
              { text: '設定', weight: 0.7, context: ['設定', '構成'] },
              { text: 'データ', weight: 0.7, context: ['データ', '情報'] }
            ],
            'あれ': [
              { text: 'あの項目', weight: 0.9, context: ['項目', 'アイテム'] },
              { text: '古いファイル', weight: 0.8, context: ['古い', 'ファイル'] },
              { text: '不要なデータ', weight: 0.8, context: ['不要', '無用'] },
              { text: 'データ', weight: 0.7, context: ['データ', '情報'] }
            ]
          }
        }
      },
      // 汎用カテゴリ
      generic: {
        'これ': [
          { text: 'この項目', weight: 0.6, context: ['項目', 'アイテム'] },
          { text: 'この内容', weight: 0.6, context: ['内容', 'コンテンツ'] },
          { text: 'この機能', weight: 0.6, context: ['機能', 'フィーチャー'] },
          { text: 'この部分', weight: 0.5, context: ['部分', 'セクション'] },
          { text: 'この要素', weight: 0.5, context: ['要素', 'エレメント'] }
        ],
        'それ': [
          { text: 'その項目', weight: 0.6, context: ['項目', 'アイテム'] },
          { text: 'その内容', weight: 0.6, context: ['内容', 'コンテンツ'] },
          { text: 'その機能', weight: 0.6, context: ['機能', 'フィーチャー'] },
          { text: 'その部分', weight: 0.5, context: ['部分', 'セクション'] },
          { text: 'その要素', weight: 0.5, context: ['要素', 'エレメント'] }
        ],
        'あれ': [
          { text: 'あの項目', weight: 0.6, context: ['項目', 'アイテム'] },
          { text: 'あの内容', weight: 0.6, context: ['内容', 'コンテンツ'] },
          { text: 'あの機能', weight: 0.6, context: ['機能', 'フィーチャー'] },
          { text: 'あの部分', weight: 0.5, context: ['部分', 'セクション'] },
          { text: 'あの要素', weight: 0.5, context: ['要素', 'エレメント'] }
        ]
      }
    };
  }

  /**
   * データベースから最適な候補を検索
   */
  private searchDatabase(ambiguousWord: string, context: string): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const contextWords = this.extractContextWords(context);

    // UI要素カテゴリから検索
    for (const [elementType, elementData] of Object.entries(this.suggestionDatabase.uiElements)) {
      if (this.matchesPatterns(context, elementData.patterns)) {
        const elementSuggestions = this.generateDatabaseSuggestions(
          ambiguousWord,
          elementData.suggestions[ambiguousWord] || [],
          contextWords,
          SuggestionCategory.UI_ELEMENT,
          0.1
        );
        suggestions.push(...elementSuggestions);
      }
    }

    // アクションカテゴリから検索
    for (const [actionType, actionData] of Object.entries(this.suggestionDatabase.actions)) {
      if (this.matchesPatterns(context, actionData.patterns)) {
        const actionSuggestions = this.generateDatabaseSuggestions(
          ambiguousWord,
          actionData.suggestions[ambiguousWord] || [],
          contextWords,
          SuggestionCategory.ACTION,
          0.05
        );
        suggestions.push(...actionSuggestions);
      }
    }

    // 汎用カテゴリから検索
    const genericSuggestions = this.generateDatabaseSuggestions(
      ambiguousWord,
      this.suggestionDatabase.generic[ambiguousWord] || [],
      contextWords,
      SuggestionCategory.GENERIC,
      0
    );
    suggestions.push(...genericSuggestions);

    return suggestions;
  }

  /**
   * データベースから候補を生成
   */
  private generateDatabaseSuggestions(
    ambiguousWord: string,
    dbSuggestions: DatabaseSuggestion[],
    contextWords: string[],
    category: SuggestionCategory,
    categoryBonus: number
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];

    for (const dbSuggestion of dbSuggestions) {
      let confidence = dbSuggestion.weight;

      // 文脈マッチングによる信頼度調整
      const contextMatches = dbSuggestion.context.filter(contextWord =>
        contextWords.some(word => word.includes(contextWord) || contextWord.includes(word))
      );
      confidence += contextMatches.length * 0.1;

      // カテゴリボーナス
      confidence += categoryBonus;

      suggestions.push({
        replacementText: dbSuggestion.text,
        confidence: Math.min(confidence, 1.0),
        category: category
      });
    }

    return suggestions;
  }

  /**
   * パターンマッチング
   */
  private matchesPatterns(context: string, patterns: string[]): boolean {
    return patterns.some(pattern => context.includes(pattern));
  }

  /**
   * 文脈から重要な単語を抽出
   */
  private extractContextWords(context: string): string[] {
    // 日本語の助詞や接続詞を除外
    const stopWords = ['を', 'が', 'は', 'に', 'で', 'から', 'まで', 'と', 'や', 'の', 'も', 'こと', 'もの'];
    
    const words = context.split(/[\s、。！？]+/).filter(word => 
      word.length > 0 && !stopWords.includes(word)
    );

    return words;
  }

  /**
   * 学習機能：使用された候補の重みを調整
   */
  learnFromUsage(ambiguousWord: string, selectedSuggestion: string, context: string): void {
    // 実際の使用例から学習してデータベースを更新
    console.log(`学習: "${ambiguousWord}" -> "${selectedSuggestion}" (文脈: ${context.substring(0, 50)}...)`);
    
    // 簡単な学習アルゴリズム：選択された候補の重みを少し上げる
    this.adjustSuggestionWeight(ambiguousWord, selectedSuggestion, 0.05);
  }

  /**
   * 候補の重みを調整
   */
  private adjustSuggestionWeight(ambiguousWord: string, suggestionText: string, adjustment: number): void {
    // 汎用カテゴリで重みを調整
    const genericSuggestions = this.suggestionDatabase.generic[ambiguousWord];
    if (genericSuggestions) {
      const suggestion = genericSuggestions.find(s => s.text === suggestionText);
      if (suggestion) {
        suggestion.weight = Math.min(suggestion.weight + adjustment, 1.0);
      }
    }

    // UI要素とアクションカテゴリでも同様に調整
    for (const elementData of Object.values(this.suggestionDatabase.uiElements)) {
      const suggestions = elementData.suggestions[ambiguousWord];
      if (suggestions) {
        const suggestion = suggestions.find(s => s.text === suggestionText);
        if (suggestion) {
          suggestion.weight = Math.min(suggestion.weight + adjustment, 1.0);
        }
      }
    }

    for (const actionData of Object.values(this.suggestionDatabase.actions)) {
      const suggestions = actionData.suggestions[ambiguousWord];
      if (suggestions) {
        const suggestion = suggestions.find(s => s.text === suggestionText);
        if (suggestion) {
          suggestion.weight = Math.min(suggestion.weight + adjustment, 1.0);
        }
      }
    }
  }
}

// 型定義
interface SuggestionRule {
  pattern: RegExp;
  contextKeywords: string[];
  suggestions: string[];
  priority: number;
  category: SuggestionCategory;
}

interface SuggestionDatabase {
  uiElements: {
    [elementType: string]: {
      patterns: string[];
      suggestions: {
        [ambiguousWord: string]: DatabaseSuggestion[];
      };
    };
  };
  actions: {
    [actionType: string]: {
      patterns: string[];
      suggestions: {
        [ambiguousWord: string]: DatabaseSuggestion[];
      };
    };
  };
  generic: {
    [ambiguousWord: string]: DatabaseSuggestion[];
  };
}

interface DatabaseSuggestion {
  text: string;
  weight: number;
  context: string[];
}