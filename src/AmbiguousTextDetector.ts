// AmbiguousTextDetector.ts - 日本語曖昧テキスト検出エンジン

import { AmbiguousMatch, ContextAnalysis, ContextType, UIElementHint, ActionHint } from './types';

export class AmbiguousTextDetector {
  // 曖昧な表現のパターン定義
  private ambiguousPatterns: AmbiguousPattern[] = [
    // 基本的な指示代名詞
    { word: 'これ', variants: ['これ', 'コレ'], contextHints: ['を', 'が', 'は', 'に', 'で'] },
    { word: 'それ', variants: ['それ', 'ソレ'], contextHints: ['を', 'が', 'は', 'に', 'で'] },
    { word: 'あれ', variants: ['あれ', 'アレ'], contextHints: ['を', 'が', 'は', 'に', 'で'] },
    
    // 場所・方向を示す指示語
    { word: 'こちら', variants: ['こちら', 'コチラ'], contextHints: ['を', 'が', 'は', 'に', 'で', 'から'] },
    { word: 'そちら', variants: ['そちら', 'ソチラ'], contextHints: ['を', 'が', 'は', 'に', 'で', 'から'] },
    { word: 'あちら', variants: ['あちら', 'アチラ'], contextHints: ['を', 'が', 'は', 'に', 'で', 'から'] },
    
    // 種類・様子を示す指示語
    { word: 'こんな', variants: ['こんな', 'コンナ'], contextHints: ['もの', 'こと', '感じ', '風に'] },
    { word: 'そんな', variants: ['そんな', 'ソンナ'], contextHints: ['もの', 'こと', '感じ', '風に'] },
    { word: 'あんな', variants: ['あんな', 'アンナ'], contextHints: ['もの', 'こと', '感じ', '風に'] },
    
    // 方法を示す指示語
    { word: 'こう', variants: ['こう', 'コウ'], contextHints: ['して', 'やって', 'なって'] },
    { word: 'そう', variants: ['そう', 'ソウ'], contextHints: ['して', 'やって', 'なって'] },
    { word: 'ああ', variants: ['ああ', 'アア'], contextHints: ['して', 'やって', 'なって'] },
    
    // その他の曖昧な表現
    { word: 'ここ', variants: ['ここ', 'ココ'], contextHints: ['を', 'が', 'は', 'に', 'で', 'から'] },
    { word: 'そこ', variants: ['そこ', 'ソコ'], contextHints: ['を', 'が', 'は', 'に', 'で', 'から'] },
    { word: 'あそこ', variants: ['あそこ', 'アソコ'], contextHints: ['を', 'が', 'は', 'に', 'で', 'から'] },
    
    // UI特有の曖昧表現
    { word: 'この', variants: ['この', 'コノ'], contextHints: ['ボタン', 'リンク', 'ページ', '画面', '項目'] },
    { word: 'その', variants: ['その', 'ソノ'], contextHints: ['ボタン', 'リンク', 'ページ', '画面', '項目'] },
    { word: 'あの', variants: ['あの', 'アノ'], contextHints: ['ボタン', 'リンク', 'ページ', '画面', '項目'] }
  ];

  /**
   * テキスト内の曖昧な表現を検出
   */
  detectAmbiguousText(text: string): AmbiguousMatch[] {
    const matches: AmbiguousMatch[] = [];
    
    if (!text || text.trim().length === 0) {
      return matches;
    }

    // 各パターンに対してマッチングを実行
    for (const pattern of this.ambiguousPatterns) {
      const patternMatches = this.findPatternMatches(text, pattern);
      matches.push(...patternMatches);
    }

    // 重複を除去し、位置順にソート
    const uniqueMatches = this.removeDuplicateMatches(matches);
    return uniqueMatches.sort((a, b) => a.startIndex - b.startIndex);
  }

  /**
   * 単語が曖昧かどうかを判定
   */
  isAmbiguous(word: string): boolean {
    const normalizedWord = word.trim();
    
    return this.ambiguousPatterns.some(pattern => 
      pattern.variants.some(variant => 
        normalizedWord.includes(variant)
      )
    );
  }

  /**
   * 特定のパターンに対するマッチングを実行
   */
  private findPatternMatches(text: string, pattern: AmbiguousPattern): AmbiguousMatch[] {
    const matches: AmbiguousMatch[] = [];

    for (const variant of pattern.variants) {
      // 正規表現を使用して単語境界を考慮したマッチング
      const regex = new RegExp(`(${this.escapeRegExp(variant)})`, 'gi');
      let match;

      while ((match = regex.exec(text)) !== null) {
        const startIndex = match.index;
        const endIndex = startIndex + match[0].length;
        
        // 文脈を抽出（前後10文字程度）
        const contextStart = Math.max(0, startIndex - 10);
        const contextEnd = Math.min(text.length, endIndex + 10);
        const context = text.substring(contextStart, contextEnd);

        // マッチした表現が実際に曖昧かどうかを文脈で判定
        if (this.isContextuallyAmbiguous(text, startIndex, endIndex, pattern)) {
          const ambiguousMatch: AmbiguousMatch = {
            originalText: text,
            ambiguousWord: match[0],
            startIndex: startIndex,
            endIndex: endIndex,
            context: context.trim()
          };
          
          matches.push(ambiguousMatch);
        }

        // 無限ループを防ぐ
        if (regex.lastIndex === match.index) {
          regex.lastIndex++;
        }
      }
    }

    return matches;
  }

  /**
   * 文脈的に曖昧かどうかを判定
   */
  private isContextuallyAmbiguous(text: string, startIndex: number, endIndex: number, pattern: AmbiguousPattern): boolean {
    // 前後の文脈を取得
    const beforeContext = text.substring(Math.max(0, startIndex - 20), startIndex);
    const afterContext = text.substring(endIndex, Math.min(text.length, endIndex + 20));
    const fullContext = beforeContext + afterContext;

    // 文脈ヒントが含まれているかチェック
    const hasContextHint = pattern.contextHints.some(hint => 
      fullContext.includes(hint)
    );

    // 特定の除外パターンをチェック（曖昧でない使用例）
    const excludePatterns = [
      // 「そうです」「そうですね」などの相槌
      /そう(です|だ|ね|か)/,
      // 「ここで」「そこで」などの接続詞的用法
      /[こそあ][こそ]で/,
      // 固有名詞の一部
      /[A-Za-z][こそあ]/,
      /[こそあ][A-Za-z]/
    ];

    const isExcluded = excludePatterns.some(excludePattern => 
      excludePattern.test(fullContext)
    );

    // 文脈ヒントがあり、除外パターンに該当しない場合は曖昧と判定
    return hasContextHint && !isExcluded;
  }

  /**
   * 重複するマッチを除去
   */
  private removeDuplicateMatches(matches: AmbiguousMatch[]): AmbiguousMatch[] {
    const uniqueMatches: AmbiguousMatch[] = [];
    const seenPositions = new Set<string>();

    for (const match of matches) {
      const positionKey = `${match.startIndex}-${match.endIndex}-${match.ambiguousWord}`;
      
      if (!seenPositions.has(positionKey)) {
        seenPositions.add(positionKey);
        uniqueMatches.push(match);
      }
    }

    return uniqueMatches;
  }

  /**
   * 正規表現用の文字列エスケープ
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 検出統計を取得
   */
  getDetectionStats(text: string): DetectionStats {
    const matches = this.detectAmbiguousText(text);
    const wordCounts: { [key: string]: number } = {};

    matches.forEach(match => {
      const word = match.ambiguousWord;
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });

    return {
      totalMatches: matches.length,
      uniqueWords: Object.keys(wordCounts).length,
      wordFrequency: wordCounts,
      textLength: text.length,
      ambiguityRatio: matches.length / Math.max(1, text.length / 100) // 100文字あたりの曖昧語数
    };
  }

  /**
   * カスタムパターンを追加
   */
  addCustomPattern(pattern: AmbiguousPattern): void {
    // 既存のパターンと重複しないかチェック
    const exists = this.ambiguousPatterns.some(existing => 
      existing.word === pattern.word
    );

    if (!exists) {
      this.ambiguousPatterns.push(pattern);
      console.log(`カスタムパターンを追加: ${pattern.word}`);
    } else {
      console.warn(`パターンは既に存在します: ${pattern.word}`);
    }
  }

  /**
   * パターンリストを取得
   */
  getPatterns(): AmbiguousPattern[] {
    return [...this.ambiguousPatterns]; // コピーを返す
  }

  /**
   * 文脈解析を実行して詳細な情報を取得
   */
  analyzeContext(match: AmbiguousMatch): ContextAnalysis {
    const { originalText, startIndex, endIndex, ambiguousWord } = match;
    
    // 前後の文脈を広めに取得
    const contextRadius = 30;
    const beforeStart = Math.max(0, startIndex - contextRadius);
    const afterEnd = Math.min(originalText.length, endIndex + contextRadius);
    
    const beforeContext = originalText.substring(beforeStart, startIndex);
    const afterContext = originalText.substring(endIndex, afterEnd);
    const fullContext = originalText.substring(beforeStart, afterEnd);

    // 文脈の種類を判定
    const contextType = this.determineContextType(beforeContext, afterContext, ambiguousWord);
    
    // 関連キーワードを抽出
    const relatedKeywords = this.extractRelatedKeywords(fullContext, ambiguousWord);
    
    // UI要素の可能性を判定
    const uiElementHints = this.detectUIElementHints(fullContext);
    
    // アクションの可能性を判定
    const actionHints = this.detectActionHints(beforeContext, afterContext);

    return {
      contextType,
      beforeContext: beforeContext.trim(),
      afterContext: afterContext.trim(),
      fullContext: fullContext.trim(),
      relatedKeywords,
      uiElementHints,
      actionHints,
      confidence: this.calculateContextConfidence(contextType, relatedKeywords, uiElementHints, actionHints)
    };
  }

  /**
   * 文脈の種類を判定
   */
  private determineContextType(beforeContext: string, afterContext: string, ambiguousWord: string): ContextType {
    // UI操作系の文脈
    const uiActionPatterns = [
      /クリック|押|選択|タップ|開|閉じ|表示|非表示/,
      /ボタン|リンク|メニュー|タブ|アイコン/,
      /ページ|画面|ウィンドウ|ダイアログ/
    ];

    // データ・コンテンツ系の文脈
    const contentPatterns = [
      /保存|削除|編集|作成|更新|送信/,
      /ファイル|画像|テキスト|データ|情報/,
      /アカウント|プロフィール|設定|履歴/
    ];

    // ナビゲーション系の文脈
    const navigationPatterns = [
      /移動|戻|進|次|前|上|下/,
      /ホーム|トップ|一覧|詳細|検索/
    ];

    const fullContext = beforeContext + afterContext;

    if (uiActionPatterns.some(pattern => pattern.test(fullContext))) {
      return ContextType.UI_ACTION;
    } else if (contentPatterns.some(pattern => pattern.test(fullContext))) {
      return ContextType.CONTENT;
    } else if (navigationPatterns.some(pattern => pattern.test(fullContext))) {
      return ContextType.NAVIGATION;
    } else {
      return ContextType.GENERIC;
    }
  }

  /**
   * 関連キーワードを抽出
   */
  private extractRelatedKeywords(context: string, ambiguousWord: string): string[] {
    const keywords: string[] = [];
    
    // 一般的なUI関連キーワード
    const uiKeywords = [
      'ボタン', 'リンク', 'メニュー', 'タブ', 'アイコン', 'ページ', '画面',
      'ウィンドウ', 'ダイアログ', 'フォーム', 'テキスト', '画像', 'ファイル',
      'アカウント', 'プロフィール', '設定', '履歴', 'データ', '情報'
    ];

    // アクション関連キーワード
    const actionKeywords = [
      'クリック', '押', '選択', 'タップ', '開', '閉じ', '表示', '非表示',
      '保存', '削除', '編集', '作成', '更新', '送信', '移動', '戻', '進'
    ];

    const allKeywords = [...uiKeywords, ...actionKeywords];

    // 文脈内でキーワードを検索
    for (const keyword of allKeywords) {
      if (context.includes(keyword)) {
        keywords.push(keyword);
      }
    }

    // 重複を除去
    return [...new Set(keywords)];
  }

  /**
   * UI要素のヒントを検出
   */
  private detectUIElementHints(context: string): UIElementHint[] {
    const hints: UIElementHint[] = [];

    const elementPatterns: { [key: string]: RegExp } = {
      'button': /ボタン|押|クリック/,
      'link': /リンク|移動|ジャンプ/,
      'menu': /メニュー|選択|項目/,
      'page': /ページ|画面|表示/,
      'form': /フォーム|入力|送信/,
      'image': /画像|写真|イメージ/,
      'file': /ファイル|文書|ドキュメント/,
      'data': /データ|情報|内容/
    };

    for (const [elementType, pattern] of Object.entries(elementPatterns)) {
      if (pattern.test(context)) {
        hints.push({
          elementType,
          confidence: this.calculateElementConfidence(context, pattern)
        });
      }
    }

    return hints.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * アクションのヒントを検出
   */
  private detectActionHints(beforeContext: string, afterContext: string): ActionHint[] {
    const hints: ActionHint[] = [];

    const actionPatterns: { [key: string]: RegExp } = {
      'save': /保存|セーブ/,
      'delete': /削除|消去/,
      'edit': /編集|修正|変更/,
      'create': /作成|新規|追加/,
      'send': /送信|送る/,
      'open': /開|表示/,
      'close': /閉じ|非表示/,
      'select': /選択|選ぶ/
    };

    const fullContext = beforeContext + afterContext;

    for (const [actionType, pattern] of Object.entries(actionPatterns)) {
      if (pattern.test(fullContext)) {
        hints.push({
          actionType,
          confidence: this.calculateActionConfidence(fullContext, pattern),
          position: beforeContext.search(pattern) !== -1 ? 'before' : 'after'
        });
      }
    }

    return hints.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 文脈の信頼度を計算
   */
  private calculateContextConfidence(
    contextType: ContextType,
    relatedKeywords: string[],
    uiElementHints: UIElementHint[],
    actionHints: ActionHint[]
  ): number {
    let confidence = 0.5; // ベース信頼度

    // 文脈タイプによる調整
    if (contextType !== ContextType.GENERIC) {
      confidence += 0.2;
    }

    // 関連キーワード数による調整
    confidence += Math.min(relatedKeywords.length * 0.1, 0.3);

    // UI要素ヒントによる調整
    if (uiElementHints.length > 0) {
      confidence += Math.min(uiElementHints[0].confidence * 0.2, 0.2);
    }

    // アクションヒントによる調整
    if (actionHints.length > 0) {
      confidence += Math.min(actionHints[0].confidence * 0.2, 0.2);
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * UI要素の信頼度を計算
   */
  private calculateElementConfidence(context: string, pattern: RegExp): number {
    const matches = context.match(pattern);
    if (!matches) return 0;

    // マッチ数と文脈の長さから信頼度を計算
    const matchCount = matches.length;
    const contextLength = context.length;
    
    return Math.min(matchCount / Math.max(contextLength / 50, 1), 1.0);
  }

  /**
   * アクションの信頼度を計算
   */
  private calculateActionConfidence(context: string, pattern: RegExp): number {
    const matches = context.match(pattern);
    if (!matches) return 0;

    // マッチの位置と頻度から信頼度を計算
    const matchCount = matches.length;
    return Math.min(matchCount * 0.3, 1.0);
  }
}

// 型定義
interface AmbiguousPattern {
  word: string;
  variants: string[];
  contextHints: string[];
}

interface DetectionStats {
  totalMatches: number;
  uniqueWords: number;
  wordFrequency: { [key: string]: number };
  textLength: number;
  ambiguityRatio: number;
}