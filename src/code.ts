/// <reference types="@figma/plugin-typings" />

// 型定義
interface TextNodeInfo {
  id: string;
  content: string;
  node: TextNode;
  location: NodeLocation;
  parentInfo: ParentInfo;
}

interface ParentInfo {
  parentName: string;
  parentType: string;
  isComponent: boolean;
  componentName?: string;
  layerHierarchy: string[];
}

interface NodeLocation {
  pageName: string;
  layerName: string;
  coordinates: { x: number; y: number };
}

interface AmbiguousMatch {
  originalText: string;
  ambiguousWord: string;
  startIndex: number;
  endIndex: number;
  context: string;
}

interface Suggestion {
  replacementText: string;
  confidence: number;
  category: SuggestionCategory;
}

enum SuggestionCategory {
  UI_ELEMENT = 'ui_element',
  ACTION = 'action',
  CONTENT = 'content',
  GENERIC = 'generic'
}

interface DetectionResult {
  id: string;
  nodeId: string;
  originalText: string;
  ambiguousMatch: AmbiguousMatch;
  suggestions: Suggestion[];
  location: NodeLocation;
  status: ProcessingStatus;
  isButtonText: boolean;
}

enum ProcessingStatus {
  PENDING = 'pending',
  REPLACED = 'replaced',
  SKIPPED = 'skipped'
}

interface ScanProgress {
  current: number;
  total: number;
  currentOperation: string;
}

// TextScannerクラス
class TextScanner {
  private onProgress?: (progress: ScanProgress) => void;

  constructor(onProgress?: (progress: ScanProgress) => void) {
    this.onProgress = onProgress;
  }

  async scanDocument(): Promise<TextNodeInfo[]> {
    const allTextNodes: TextNodeInfo[] = [];
    const pages = figma.root.children;
    
    let totalNodes = 0;
    let processedNodes = 0;

    for (const page of pages) {
      if (page.type === 'PAGE') {
        totalNodes += this.countNodes(page);
      }
    }

    this.reportProgress(0, totalNodes, 'スキャンを開始しています...');

    for (const page of pages) {
      if (page.type === 'PAGE') {
        this.reportProgress(processedNodes, totalNodes, `ページ "${page.name}" をスキャン中...`);
        
        const pageTextNodes = await this.scanPage(page);
        allTextNodes.push(...pageTextNodes);
        
        processedNodes += this.countNodes(page);
      }
    }

    this.reportProgress(totalNodes, totalNodes, 'スキャン完了');
    
    console.log(`スキャン完了: ${allTextNodes.length}個のテキストノードを検出`);
    return allTextNodes;
  }

  async scanCurrentPage(): Promise<TextNodeInfo[]> {
    const currentPage = figma.currentPage;
    const totalNodes = this.countNodes(currentPage);
    
    this.reportProgress(0, totalNodes, `現在のページ "${currentPage.name}" をスキャン中...`);
    
    const textNodes = await this.scanPage(currentPage);
    
    this.reportProgress(totalNodes, totalNodes, 'スキャン完了');
    
    console.log(`現在のページスキャン完了: ${textNodes.length}個のテキストノードを検出`);
    return textNodes;
  }

  /**
   * 親レイヤー情報を解析
   */
  analyzeParentInfo(textNode: TextNode): ParentInfo {
    const parent = textNode.parent;
    if (!parent) {
      return {
        parentName: 'No Parent',
        parentType: 'UNKNOWN',
        isComponent: false,
        layerHierarchy: []
      };
    }

    // レイヤー階層を取得
    const hierarchy: string[] = [];
    let currentNode: BaseNode | null = parent;
    
    while (currentNode && currentNode.type !== 'PAGE') {
      hierarchy.unshift(currentNode.name || 'Unnamed');
      currentNode = currentNode.parent;
    }

    // コンポーネント情報を判定
    const isComponent = parent.type === 'COMPONENT' || parent.type === 'INSTANCE';
    let componentName: string | undefined;
    
    if (parent.type === 'INSTANCE') {
      const instanceNode = parent as InstanceNode;
      componentName = instanceNode.mainComponent?.name;
    } else if (parent.type === 'COMPONENT') {
      componentName = parent.name;
    }

    return {
      parentName: parent.name || 'Unnamed',
      parentType: parent.type,
      isComponent: isComponent,
      componentName: componentName,
      layerHierarchy: hierarchy
    };
  }

  /**
   * テキストがボタン内にあるかどうかを判定
   */
  isButtonText(textContent: string, parentInfo: ParentInfo): boolean {
    const { parentName, isComponent, componentName } = parentInfo;
    
    // 1. コンポーネント名にボタンが含まれている
    const hasButtonComponent = (componentName && componentName.toLowerCase().includes('button')) ||
                              (parentName.toLowerCase().includes('button'));
    
    // 2. テキストが短い（ボタンテキストの特徴）
    const isShortText = textContent.length <= 15;
    
    // 3. クリック系のアクションで終わる
    const endsWithAction = /クリック|押|タップ|選択$/.test(textContent);
    
    // 4. 単純なテキスト構造（複雑な文章ではない）
    const isSimpleText = !textContent.includes('。') && !textContent.includes('、') && 
                        textContent.split(' ').length <= 3;
    
    return hasButtonComponent && isShortText && endsWithAction && isSimpleText;
  }

  async scanPage(page: PageNode): Promise<TextNodeInfo[]> {
    const textNodes: TextNodeInfo[] = [];
    
    const traverseNode = (node: SceneNode, pageName: string) => {
      if (node.type === 'TEXT') {
        const textContent = this.extractTextContent(node);
        if (textContent && textContent.trim().length > 0) {
          const parentInfo = this.analyzeParentInfo(node);
          const textNodeInfo: TextNodeInfo = {
            id: node.id,
            content: textContent,
            node: node,
            location: {
              pageName: pageName,
              layerName: node.name || 'Unnamed Layer',
              coordinates: {
                x: Math.round(node.x),
                y: Math.round(node.y)
              }
            },
            parentInfo: parentInfo
          };
          textNodes.push(textNodeInfo);
        }
      }

      if ('children' in node && node.children) {
        for (const child of node.children) {
          traverseNode(child, pageName);
        }
      }
    };

    for (const child of page.children) {
      traverseNode(child, page.name);
    }

    return textNodes;
  }

  extractTextContent(node: SceneNode): string | null {
    if (node.type !== 'TEXT') {
      return null;
    }

    try {
      const textNode = node as TextNode;
      return textNode.characters;
    } catch (error) {
      console.warn(`テキスト抽出エラー (ノードID: ${node.id}):`, error);
      return null;
    }
  }

  private countNodes(node: BaseNode): number {
    let count = 1;
    
    if ('children' in node && node.children) {
      for (const child of node.children) {
        count += this.countNodes(child);
      }
    }
    
    return count;
  }

  private reportProgress(current: number, total: number, operation: string) {
    if (this.onProgress) {
      this.onProgress({
        current,
        total,
        currentOperation: operation
      });
    }
  }

  async updateTextContent(nodeId: string, newText: string, ambiguousMatch?: AmbiguousMatch): Promise<boolean> {
    try {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node || node.type !== 'TEXT') {
        console.error(`テキストノードが見つかりません (ID: ${nodeId})`);
        return false;
      }

      const textNode = node as TextNode;
      await figma.loadFontAsync(textNode.fontName as FontName);
      
      // 部分置換の場合
      if (ambiguousMatch) {
        const originalText = textNode.characters;
        const beforeText = originalText.substring(0, ambiguousMatch.startIndex);
        const afterText = originalText.substring(ambiguousMatch.endIndex);
        const replacedText = beforeText + newText + afterText;
        textNode.characters = replacedText;
        console.log(`部分テキスト更新成功: "${ambiguousMatch.ambiguousWord}" → "${newText}" (ノードID: ${nodeId})`);
      } else {
        // 全文置換の場合（従来の動作）
        textNode.characters = newText;
        console.log(`テキスト更新成功: "${newText}" (ノードID: ${nodeId})`);
      }
      
      return true;
    } catch (error) {
      console.error(`テキスト更新エラー (ノードID: ${nodeId}):`, error);
      return false;
    }
  }

  async focusOnNode(nodeId: string): Promise<boolean> {
    try {
      console.log(`ノード検索開始 (ID: ${nodeId})`);
      
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node) {
        console.error(`ノードが見つかりません (ID: ${nodeId})`);
        return false;
      }

      console.log(`ノードが見つかりました: ${node.name} (タイプ: ${node.type})`);

      // ノードが別のページにある場合、そのページに移動
      if (node.type === 'TEXT') {
        const textNode = node as TextNode;
        let parentPage: PageNode | null = null;
        
        // 親ページを探す
        let currentNode: BaseNode | null = textNode.parent;
        while (currentNode && currentNode.type !== 'PAGE') {
          currentNode = currentNode.parent;
        }
        
        if (currentNode && currentNode.type === 'PAGE') {
          parentPage = currentNode as PageNode;
          
          // 現在のページと異なる場合はページを切り替え
          if (figma.currentPage.id !== parentPage.id) {
            console.log(`ページを切り替え: ${parentPage.name}`);
            figma.currentPage = parentPage;
          }
        }
      }

      // ノードを選択してビューポートに表示
      figma.currentPage.selection = [node as SceneNode];
      figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
      
      console.log(`ノードにフォーカス成功 (ID: ${nodeId})`);
      return true;
    } catch (error) {
      console.error(`ノードフォーカスエラー (ID: ${nodeId}):`, error);
      return false;
    }
  }
}

// AmbiguousTextDetectorクラス
class AmbiguousTextDetector {
  private ambiguousPatterns = [
    // 基本的な指示代名詞
    { word: 'これ', variants: ['これ', 'コレ'], contextHints: ['を', 'が', 'は', 'に', 'で', 'から'] },
    { word: 'それ', variants: ['それ', 'ソレ'], contextHints: ['を', 'が', 'は', 'に', 'で', 'から'] },
    { word: 'あれ', variants: ['あれ', 'アレ'], contextHints: ['を', 'が', 'は', 'に', 'で', 'から'] },
    
    // 連体詞（この、その、あの）
    { word: 'この', variants: ['この', 'コノ'], contextHints: ['ボタン', 'リンク', 'ページ', '画面', '項目', '機能', 'メニュー'] },
    { word: 'その', variants: ['その', 'ソノ'], contextHints: ['ボタン', 'リンク', 'ページ', '画面', '項目', '機能', 'メニュー'] },
    { word: 'あの', variants: ['あの', 'アノ'], contextHints: ['ボタン', 'リンク', 'ページ', '画面', '項目', '機能', 'メニュー'] },
    
    // 場所を示す指示語
    { word: 'こちら', variants: ['こちら', 'コチラ'], contextHints: ['を', 'が', 'は', 'に', 'で', 'から', 'へ', 'クリック', '選択'] },
    { word: 'そちら', variants: ['そちら', 'ソチラ'], contextHints: ['を', 'が', 'は', 'に', 'で', 'から', 'へ', 'クリック', '選択'] },
    { word: 'あちら', variants: ['あちら', 'アチラ'], contextHints: ['を', 'が', 'は', 'に', 'で', 'から', 'へ', 'クリック', '選択'] },
    
    // 場所（ここ、そこ、あそこ）
    { word: 'ここ', variants: ['ここ', 'ココ'], contextHints: ['を', 'が', 'は', 'に', 'で', 'から', 'へ', 'クリック', '押'] },
    { word: 'そこ', variants: ['そこ', 'ソコ'], contextHints: ['を', 'が', 'は', 'に', 'で', 'から', 'へ', 'クリック', '押'] },
    { word: 'あそこ', variants: ['あそこ', 'アソコ'], contextHints: ['を', 'が', 'は', 'に', 'で', 'から', 'へ', 'クリック', '押'] },
    
    // 方法を示す指示語
    { word: 'こう', variants: ['こう', 'コウ'], contextHints: ['して', 'やって', 'なって', 'すれば', 'だと'] },
    { word: 'そう', variants: ['そう', 'ソウ'], contextHints: ['して', 'やって', 'なって', 'すれば', 'だと'] },
    { word: 'ああ', variants: ['ああ', 'アア'], contextHints: ['して', 'やって', 'なって', 'すれば', 'だと'] },
    
    // 種類・様子を示す指示語
    { word: 'こんな', variants: ['こんな', 'コンナ'], contextHints: ['もの', 'こと', '感じ', '風に', '場合', '時'] },
    { word: 'そんな', variants: ['そんな', 'ソンナ'], contextHints: ['もの', 'こと', '感じ', '風に', '場合', '時'] },
    { word: 'あんな', variants: ['あんな', 'アンナ'], contextHints: ['もの', 'こと', '感じ', '風に', '場合', '時'] },
    
    // 複数を示す指示語
    { word: 'これら', variants: ['これら', 'コレラ'], contextHints: ['を', 'が', 'は', 'に', 'で', 'から', 'すべて', '全て'] },
    { word: 'それら', variants: ['それら', 'ソレラ'], contextHints: ['を', 'が', 'は', 'に', 'で', 'から', 'すべて', '全て'] },
    { word: 'あれら', variants: ['あれら', 'アレラ'], contextHints: ['を', 'が', 'は', 'に', 'で', 'から', 'すべて', '全て'] }
  ];

  detectAmbiguousText(text: string): AmbiguousMatch[] {
    const matches: AmbiguousMatch[] = [];
    
    if (!text || text.trim().length === 0) {
      return matches;
    }

    for (const pattern of this.ambiguousPatterns) {
      const patternMatches = this.findPatternMatches(text, pattern);
      matches.push(...patternMatches);
    }

    const uniqueMatches = this.removeDuplicateMatches(matches);
    return uniqueMatches.sort((a, b) => a.startIndex - b.startIndex);
  }

  private findPatternMatches(text: string, pattern: any): AmbiguousMatch[] {
    const matches: AmbiguousMatch[] = [];

    for (const variant of pattern.variants) {
      const regex = new RegExp(`(${this.escapeRegExp(variant)})`, 'gi');
      let match;

      while ((match = regex.exec(text)) !== null) {
        const startIndex = match.index;
        const endIndex = startIndex + match[0].length;
        
        const contextStart = Math.max(0, startIndex - 10);
        const contextEnd = Math.min(text.length, endIndex + 10);
        const context = text.substring(contextStart, contextEnd);

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

        if (regex.lastIndex === match.index) {
          regex.lastIndex++;
        }
      }
    }

    return matches;
  }

  private isContextuallyAmbiguous(text: string, startIndex: number, endIndex: number, pattern: any): boolean {
    const beforeContext = text.substring(Math.max(0, startIndex - 20), startIndex);
    const afterContext = text.substring(endIndex, Math.min(text.length, endIndex + 20));
    const fullContext = beforeContext + afterContext;

    const hasContextHint = pattern.contextHints.some((hint: string) => 
      fullContext.includes(hint)
    );

    const excludePatterns = [
      /そう(です|だ|ね|か)/,
      /[こそあ][こそ]で/,
      /[A-Za-z][こそあ]/,
      /[こそあ][A-Za-z]/
    ];

    const isExcluded = excludePatterns.some(excludePattern => 
      excludePattern.test(fullContext)
    );

    return hasContextHint && !isExcluded;
  }

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

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// SuggestionGeneratorクラス
class SuggestionGenerator {
  generateSuggestions(match: AmbiguousMatch, parentInfo?: ParentInfo): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const { ambiguousWord, context } = match;

    // 親レイヤー情報に基づく高精度な候補生成
    if (parentInfo) {
      const parentBasedSuggestions = this.getParentBasedSuggestions(ambiguousWord, context, parentInfo);
      suggestions.push(...parentBasedSuggestions);
    }

    // 文脈に基づく候補生成
    const contextualSuggestions = this.getContextualSuggestions(ambiguousWord, context);
    suggestions.push(...contextualSuggestions);

    // 汎用候補生成
    const genericSuggestions = this.getGenericSuggestions(ambiguousWord);
    suggestions.push(...genericSuggestions);

    // 重複除去とソート
    const uniqueSuggestions = this.removeDuplicateSuggestions(suggestions);
    return uniqueSuggestions.sort((a, b) => b.confidence - a.confidence);
  }

  private getParentBasedSuggestions(ambiguousWord: string, context: string, parentInfo: ParentInfo): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const { parentName, parentType, isComponent, componentName, layerHierarchy } = parentInfo;

    // コンポーネント名に基づく高精度判定
    if (isComponent && componentName) {
      const componentSuggestions = this.analyzeComponentName(ambiguousWord, componentName, context);
      suggestions.push(...componentSuggestions);
    }

    // 親レイヤー名に基づく判定
    const parentSuggestions = this.analyzeParentName(ambiguousWord, parentName, context);
    suggestions.push(...parentSuggestions);

    // レイヤー階層に基づく判定
    const hierarchySuggestions = this.analyzeLayerHierarchy(ambiguousWord, layerHierarchy, context);
    suggestions.push(...hierarchySuggestions);

    return suggestions;
  }

  private analyzeComponentName(ambiguousWord: string, componentName: string, context: string): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const lowerComponentName = componentName.toLowerCase();

    // ボタン系コンポーネント
    if (lowerComponentName.includes('button') || lowerComponentName.includes('btn')) {
      if (context.includes('クリック') || context.includes('押')) {
        // ボタンの種類を特定
        if (lowerComponentName.includes('primary') || lowerComponentName.includes('submit')) {
          suggestions.push({ replacementText: '送信', confidence: 0.95, category: SuggestionCategory.ACTION });
        } else if (lowerComponentName.includes('secondary') || lowerComponentName.includes('cancel')) {
          suggestions.push({ replacementText: 'キャンセル', confidence: 0.95, category: SuggestionCategory.ACTION });
        } else if (lowerComponentName.includes('delete') || lowerComponentName.includes('remove')) {
          suggestions.push({ replacementText: '削除', confidence: 0.95, category: SuggestionCategory.ACTION });
        } else if (lowerComponentName.includes('save')) {
          suggestions.push({ replacementText: '保存', confidence: 0.95, category: SuggestionCategory.ACTION });
        } else if (lowerComponentName.includes('next')) {
          suggestions.push({ replacementText: '次へ', confidence: 0.95, category: SuggestionCategory.ACTION });
        } else if (lowerComponentName.includes('back') || lowerComponentName.includes('prev')) {
          suggestions.push({ replacementText: '戻る', confidence: 0.95, category: SuggestionCategory.ACTION });
        } else {
          suggestions.push({ replacementText: 'ボタン', confidence: 0.9, category: SuggestionCategory.UI_ELEMENT });
        }
      }
    }

    // リンク系コンポーネント
    if (lowerComponentName.includes('link')) {
      suggestions.push({ replacementText: 'リンク', confidence: 0.9, category: SuggestionCategory.UI_ELEMENT });
    }

    // フォーム系コンポーネント
    if (lowerComponentName.includes('form') || lowerComponentName.includes('input')) {
      suggestions.push({ replacementText: 'フォーム', confidence: 0.9, category: SuggestionCategory.UI_ELEMENT });
    }

    // カード系コンポーネント
    if (lowerComponentName.includes('card')) {
      suggestions.push({ replacementText: 'カード', confidence: 0.9, category: SuggestionCategory.UI_ELEMENT });
    }

    // モーダル系コンポーネント
    if (lowerComponentName.includes('modal') || lowerComponentName.includes('dialog')) {
      suggestions.push({ replacementText: 'ダイアログ', confidence: 0.9, category: SuggestionCategory.UI_ELEMENT });
    }

    return suggestions;
  }

  private analyzeParentName(ambiguousWord: string, parentName: string, context: string): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const lowerParentName = parentName.toLowerCase();

    // 親レイヤー名からUI要素を推測
    const uiElementPatterns = [
      { pattern: /button|btn/, suggestion: 'ボタン', confidence: 0.85 },
      { pattern: /link/, suggestion: 'リンク', confidence: 0.85 },
      { pattern: /form/, suggestion: 'フォーム', confidence: 0.85 },
      { pattern: /card/, suggestion: 'カード', confidence: 0.85 },
      { pattern: /modal|dialog/, suggestion: 'ダイアログ', confidence: 0.85 },
      { pattern: /menu/, suggestion: 'メニュー', confidence: 0.85 },
      { pattern: /tab/, suggestion: 'タブ', confidence: 0.85 },
      { pattern: /header/, suggestion: 'ヘッダー', confidence: 0.8 },
      { pattern: /footer/, suggestion: 'フッター', confidence: 0.8 },
      { pattern: /sidebar/, suggestion: 'サイドバー', confidence: 0.8 }
    ];

    for (const { pattern, suggestion, confidence } of uiElementPatterns) {
      if (pattern.test(lowerParentName)) {
        suggestions.push({
          replacementText: suggestion,
          confidence: confidence,
          category: SuggestionCategory.UI_ELEMENT
        });
      }
    }

    return suggestions;
  }

  private analyzeLayerHierarchy(ambiguousWord: string, hierarchy: string[], context: string): Suggestion[] {
    const suggestions: Suggestion[] = [];
    
    // 階層全体を文字列として結合して解析
    const hierarchyText = hierarchy.join(' ').toLowerCase();

    // 階層からUI構造を推測
    if (hierarchyText.includes('navigation') || hierarchyText.includes('nav')) {
      suggestions.push({ replacementText: 'ナビゲーション', confidence: 0.8, category: SuggestionCategory.UI_ELEMENT });
    }

    if (hierarchyText.includes('content') || hierarchyText.includes('main')) {
      suggestions.push({ replacementText: 'コンテンツ', confidence: 0.75, category: SuggestionCategory.CONTENT });
    }

    if (hierarchyText.includes('section')) {
      suggestions.push({ replacementText: 'セクション', confidence: 0.75, category: SuggestionCategory.UI_ELEMENT });
    }

    return suggestions;
  }

  private getContextualSuggestions(ambiguousWord: string, context: string): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // エラー・トラブル系の文脈パターン - 操作可能な具体的オブジェクト
    if ((context.includes('エラー') || context.includes('問題') || context.includes('トラブル') || context.includes('不具合') || context.includes('失敗')) 
        && (context.includes('クリック') || context.includes('確認') || context.includes('参照') || context.includes('見る'))) {
      const errorHelpObjects = ['サポートページ', 'FAQ', 'お問い合わせフォーム', 'ヘルプドキュメント', 'マニュアル', 'ガイド', 'チュートリアル', 'サポートチケット'];
      errorHelpObjects.forEach((suggestion, index) => {
        suggestions.push({
          replacementText: suggestion,
          confidence: 0.95 - index * 0.03,
          category: SuggestionCategory.CONTENT
        });
      });
    }

    // 詳細情報・続き系の文脈パターン - 操作可能な具体的オブジェクト
    if ((context.includes('詳細') || context.includes('詳しく') || context.includes('もっと') || context.includes('続き') || context.includes('さらに'))
        && (context.includes('クリック') || context.includes('確認') || context.includes('見る') || context.includes('読む'))) {
      const moreInfoObjects = ['詳細ページ', '記事', 'ドキュメント', 'レポート', '仕様書', 'マニュアル', 'ガイド', '説明書'];
      moreInfoObjects.forEach((suggestion, index) => {
        suggestions.push({
          replacementText: suggestion,
          confidence: 0.92 - index * 0.03,
          category: SuggestionCategory.CONTENT
        });
      });
    }

    // 外部リンク・サイト系の文脈パターン - 操作可能な具体的オブジェクト
    if ((context.includes('サイト') || context.includes('ページ') || context.includes('リンク') || context.includes('URL') || context.includes('ウェブ'))
        && (context.includes('クリック') || context.includes('アクセス') || context.includes('移動') || context.includes('訪問'))) {
      const externalLinkObjects = ['公式サイト', 'ホームページ', 'ウェブサイト', 'ランディングページ', 'サービスページ', 'プロダクトページ', 'ポータルサイト', 'オンラインストア'];
      externalLinkObjects.forEach((suggestion, index) => {
        suggestions.push({
          replacementText: suggestion,
          confidence: 0.90 - index * 0.03,
          category: SuggestionCategory.CONTENT
        });
      });
    }

    // ダウンロード・取得系の文脈パターン - 操作可能な具体的オブジェクト
    if ((context.includes('ダウンロード') || context.includes('取得') || context.includes('入手') || context.includes('受け取り'))
        && (context.includes('クリック') || context.includes('押') || context.includes('選択'))) {
      const downloadObjects = ['ファイル', 'アプリ', 'ソフトウェア', 'ドキュメント', 'PDF', 'インストーラー', 'プログラム', 'データ'];
      downloadObjects.forEach((suggestion, index) => {
        suggestions.push({
          replacementText: suggestion,
          confidence: 0.88 - index * 0.03,
          category: SuggestionCategory.CONTENT
        });
      });
    }

    // 登録・申込み系の文脈パターン - 操作可能な具体的オブジェクト
    if ((context.includes('登録') || context.includes('申込') || context.includes('申し込み') || context.includes('サインアップ') || context.includes('会員'))
        && (context.includes('クリック') || context.includes('押') || context.includes('進む'))) {
      const registrationObjects = ['登録フォーム', '申込みフォーム', 'アカウント作成', '会員登録ページ', 'サインアップページ', '新規登録フォーム', 'ユーザー登録', 'メンバー登録'];
      registrationObjects.forEach((suggestion, index) => {
        suggestions.push({
          replacementText: suggestion,
          confidence: 0.87 - index * 0.03,
          category: SuggestionCategory.CONTENT
        });
      });
    }

    // ログイン・認証系の文脈パターン
    if ((context.includes('ログイン') || context.includes('サインイン') || context.includes('認証') || context.includes('アカウント'))
        && (context.includes('クリック') || context.includes('押') || context.includes('進む'))) {
      const loginSuggestions = ['ログインページ', 'サインイン', 'ログインフォーム', 'アカウントページ', 'ログインボタン', '認証画面', 'マイページ', 'ダッシュボード'];
      loginSuggestions.forEach((suggestion, index) => {
        suggestions.push({
          replacementText: suggestion,
          confidence: 0.86 - index * 0.03,
          category: SuggestionCategory.ACTION
        });
      });
    }

    // 設定・管理系の文脈パターン
    if ((context.includes('設定') || context.includes('管理') || context.includes('変更') || context.includes('編集') || context.includes('カスタマイズ'))
        && (context.includes('クリック') || context.includes('開く') || context.includes('アクセス'))) {
      const settingsSuggestions = ['設定ページ', '管理画面', '設定メニュー', 'コントロールパネル', '環境設定', 'アカウント設定', 'プロフィール設定', '詳細設定'];
      settingsSuggestions.forEach((suggestion, index) => {
        suggestions.push({
          replacementText: suggestion,
          confidence: 0.85 - index * 0.03,
          category: SuggestionCategory.UI_ELEMENT
        });
      });
    }

    // 連絡・問い合わせ系の文脈パターン
    if ((context.includes('連絡') || context.includes('問い合わせ') || context.includes('質問') || context.includes('相談') || context.includes('サポート'))
        && (context.includes('クリック') || context.includes('押') || context.includes('送信'))) {
      const contactSuggestions = ['お問い合わせフォーム', '連絡先', 'サポート窓口', 'カスタマーサポート', 'ヘルプデスク', 'お問い合わせページ', 'サポートチーム', '相談窓口'];
      contactSuggestions.forEach((suggestion, index) => {
        suggestions.push({
          replacementText: suggestion,
          confidence: 0.84 - index * 0.03,
          category: SuggestionCategory.CONTENT
        });
      });
    }

    // 購入・決済系の文脈パターン
    if ((context.includes('購入') || context.includes('買う') || context.includes('決済') || context.includes('支払い') || context.includes('注文'))
        && (context.includes('クリック') || context.includes('押') || context.includes('進む'))) {
      const purchaseSuggestions = ['購入ページ', '決済画面', 'カート', 'チェックアウト', '注文フォーム', '購入ボタン', '決済手続き', 'ショッピングカート'];
      purchaseSuggestions.forEach((suggestion, index) => {
        suggestions.push({
          replacementText: suggestion,
          confidence: 0.83 - index * 0.03,
          category: SuggestionCategory.ACTION
        });
      });
    }

    // 共有・シェア系の文脈パターン
    if ((context.includes('共有') || context.includes('シェア') || context.includes('送信') || context.includes('転送'))
        && (context.includes('クリック') || context.includes('押') || context.includes('選択'))) {
      const shareSuggestions = ['シェアボタン', '共有リンク', 'SNSシェア', '共有オプション', 'シェア機能', '送信ボタン', '共有メニュー', 'エクスポート'];
      shareSuggestions.forEach((suggestion, index) => {
        suggestions.push({
          replacementText: suggestion,
          confidence: 0.82 - index * 0.03,
          category: SuggestionCategory.UI_ELEMENT
        });
      });
    }

    // 一般的なクリック・タップの文脈（上記に該当しない場合）
    if ((context.includes('クリック') || context.includes('タップ') || context.includes('押')) && suggestions.length === 0) {
      const clickActions = ['次へ', '送信', '確認', '保存', '完了', 'OK', 'キャンセル', '戻る', '閉じる', '開く'];
      clickActions.forEach((action, index) => {
        suggestions.push({
          replacementText: action,
          confidence: 0.75 - index * 0.03,
          category: SuggestionCategory.ACTION
        });
      });

      const uiElements = ['ボタン', 'リンク', 'アイコン'];
      uiElements.forEach((element, index) => {
        suggestions.push({
          replacementText: element,
          confidence: 0.65 - index * 0.05,
          category: SuggestionCategory.UI_ELEMENT
        });
      });
    }

    // 選択の文脈 - OOUIの選択可能オブジェクト
    if (context.includes('選択') || context.includes('選ぶ') || context.includes('選んで')) {
      const selectableObjects = ['項目', 'オプション', 'メニュー', 'タブ', 'カテゴリ', 'ファイル', '画像'];
      selectableObjects.forEach((obj, index) => {
        suggestions.push({
          replacementText: obj,
          confidence: 0.85 - index * 0.05,
          category: SuggestionCategory.UI_ELEMENT
        });
      });
    }

    // 移動・ナビゲーションの文脈
    if (context.includes('移動') || context.includes('行く') || context.includes('進む') || context.includes('戻る')) {
      const navigationTargets = ['ページ', '画面', 'セクション', 'ホーム', '前のページ', '次のページ', 'トップ'];
      navigationTargets.forEach((target, index) => {
        suggestions.push({
          replacementText: target,
          confidence: 0.8 - index * 0.05,
          category: SuggestionCategory.CONTENT
        });
      });
    }

    // 保存の文脈 - 保存対象オブジェクト
    if (context.includes('保存') || context.includes('セーブ')) {
      const saveableObjects = ['ファイル', 'データ', '設定', '変更', 'ドキュメント', '画像', 'プロジェクト'];
      saveableObjects.forEach((obj, index) => {
        suggestions.push({
          replacementText: obj,
          confidence: 0.85 - index * 0.05,
          category: SuggestionCategory.CONTENT
        });
      });
    }

    // 削除の文脈 - 削除対象オブジェクト
    if (context.includes('削除') || context.includes('消去') || context.includes('除去')) {
      const deletableObjects = ['ファイル', 'データ', '項目', 'アカウント', '履歴', '設定', 'フォルダ'];
      deletableObjects.forEach((obj, index) => {
        suggestions.push({
          replacementText: obj,
          confidence: 0.85 - index * 0.05,
          category: SuggestionCategory.CONTENT
        });
      });
    }

    // 編集の文脈 - 編集対象オブジェクト
    if (context.includes('編集') || context.includes('修正') || context.includes('変更')) {
      const editableObjects = ['テキスト', '内容', '設定', 'プロフィール', 'データ', '情報', 'ドキュメント'];
      editableObjects.forEach((obj, index) => {
        suggestions.push({
          replacementText: obj,
          confidence: 0.8 - index * 0.05,
          category: SuggestionCategory.CONTENT
        });
      });
    }

    // 表示・非表示の文脈
    if (context.includes('表示') || context.includes('非表示') || context.includes('見る') || context.includes('隠す')) {
      const displayObjects = ['詳細', '情報', 'メニュー', 'パネル', 'ダイアログ', 'ポップアップ', 'リスト'];
      displayObjects.forEach((obj, index) => {
        suggestions.push({
          replacementText: obj,
          confidence: 0.8 - index * 0.05,
          category: SuggestionCategory.UI_ELEMENT
        });
      });
    }

    // 送信・共有の文脈
    if (context.includes('送信') || context.includes('共有') || context.includes('送る')) {
      const sendableObjects = ['メッセージ', 'ファイル', 'データ', 'リンク', '招待', 'レポート', '通知'];
      sendableObjects.forEach((obj, index) => {
        suggestions.push({
          replacementText: obj,
          confidence: 0.8 - index * 0.05,
          category: SuggestionCategory.CONTENT
        });
      });
    }

    // 場所系指示語の特別処理
    if (['こちら', 'そちら', 'あちら', 'ここ', 'そこ', 'あそこ'].includes(ambiguousWord)) {
      const locationObjects = ['ページ', '画面', 'セクション', 'エリア', '場所', 'リンク'];
      locationObjects.forEach((obj, index) => {
        suggestions.push({
          replacementText: obj,
          confidence: 0.75 - index * 0.05,
          category: SuggestionCategory.UI_ELEMENT
        });
      });
    }

    // 方法系指示語の特別処理
    if (['こう', 'そう', 'ああ'].includes(ambiguousWord)) {
      const methodSuggestions = ['この方法で', 'この手順で', 'このように', '以下の通り', '次の手順で'];
      methodSuggestions.forEach((method, index) => {
        suggestions.push({
          replacementText: method,
          confidence: 0.7 - index * 0.05,
          category: SuggestionCategory.GENERIC
        });
      });
    }

    return suggestions;
  }

  private getGenericSuggestions(ambiguousWord: string): Suggestion[] {
    const suggestions: Suggestion[] = [];

    const genericMappings: { [key: string]: string[] } = {
      // 基本的な指示代名詞
      'これ': ['この項目', 'この内容', 'この機能', 'この部分'],
      'それ': ['その項目', 'その内容', 'その機能', 'その部分'],
      'あれ': ['あの項目', 'あの内容', 'あの機能', 'あの部分'],
      
      // 連体詞
      'この': ['この項目', 'この内容', 'この機能', 'この部分'],
      'その': ['その項目', 'その内容', 'その機能', 'その部分'],
      'あの': ['あの項目', 'あの内容', 'あの機能', 'あの部分'],
      
      // 場所を示す指示語
      'こちら': ['この方向', 'この場所', 'このページ', 'この選択肢'],
      'そちら': ['その方向', 'その場所', 'そのページ', 'その選択肢'],
      'あちら': ['あの方向', 'あの場所', 'あのページ', 'あの選択肢'],
      
      // 場所（ここ、そこ、あそこ）
      'ここ': ['この場所', 'この位置', 'このページ', 'この画面'],
      'そこ': ['その場所', 'その位置', 'そのページ', 'その画面'],
      'あそこ': ['あの場所', 'あの位置', 'あのページ', 'あの画面'],
      
      // 方法を示す指示語
      'こう': ['この方法で', 'このように', 'この手順で', 'こうして'],
      'そう': ['その方法で', 'そのように', 'その手順で', 'そうして'],
      'ああ': ['あの方法で', 'あのように', 'あの手順で', 'ああして'],
      
      // 種類・様子を示す指示語
      'こんな': ['この種類の', 'このような', 'この形式の', 'このタイプの'],
      'そんな': ['その種類の', 'そのような', 'その形式の', 'そのタイプの'],
      'あんな': ['あの種類の', 'あのような', 'あの形式の', 'あのタイプの'],
      
      // 複数を示す指示語
      'これら': ['これらの項目', 'これらの内容', 'これらの機能', 'すべての項目'],
      'それら': ['それらの項目', 'それらの内容', 'それらの機能', 'すべての項目'],
      'あれら': ['あれらの項目', 'あれらの内容', 'あれらの機能', 'すべての項目']
    };

    const replacements = genericMappings[ambiguousWord];
    if (replacements) {
      replacements.forEach((replacement, index) => {
        suggestions.push({
          replacementText: replacement,
          confidence: 0.4 - index * 0.05,
          category: SuggestionCategory.GENERIC
        });
      });
    }

    return suggestions;
  }

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
}

// コンポーネントの初期化
const textScanner = new TextScanner((progress) => {
  figma.ui.postMessage({
    type: 'scan-progress',
    progress: progress
  });
});

const ambiguousDetector = new AmbiguousTextDetector();
const suggestionGenerator = new SuggestionGenerator();

// 検出結果を保存するグローバル変数
let currentDetectionResults: DetectionResult[] = [];

// プラグインの初期化
console.log('あいまいテキスト検出君が開始されました');

// UIを表示
figma.showUI(__html__, { 
  width: 400, 
  height: 600,
  title: '曖昧テキスト検出器'
});

// UIからのメッセージを処理
figma.ui.onmessage = (msg: any) => {
  console.log('メッセージを受信:', msg);
  
  switch (msg.type) {
    case 'scan-document':
      handleScanDocument(msg.scanAllPages);
      break;
    case 'replace-text':
      handleReplaceText(msg.nodeId, msg.newText, msg.resultId);
      break;
    case 'navigate-to-node':
      handleNavigateToNode(msg.nodeId);
      break;
    default:
      console.log('未知のメッセージタイプ:', msg.type);
  }
};

// ドキュメントスキャン処理
async function handleScanDocument(scanAllPages: boolean = false) {
  try {
    figma.ui.postMessage({ 
      type: 'scan-started',
      message: 'スキャンを開始しています...' 
    });
    
    console.log(`ドキュメントスキャンを開始 (全ページ: ${scanAllPages})`);
    
    let textNodes: TextNodeInfo[];
    if (scanAllPages) {
      // 全ページをスキャン
      textNodes = await textScanner.scanDocument();
    } else {
      // 現在のページのみをスキャン
      textNodes = await textScanner.scanCurrentPage();
    }
    console.log(`${textNodes.length}個のテキストノードを検出`);
    
    const detectionResults: DetectionResult[] = [];
    
    for (const textNode of textNodes) {
      const ambiguousMatches = ambiguousDetector.detectAmbiguousText(textNode.content);
      
      for (const match of ambiguousMatches) {
        // ボタンテキストかどうかを判定
        const isButtonText = textScanner.isButtonText(textNode.content, textNode.parentInfo);
        
        // 親レイヤー情報を活用した高精度な提案生成
        const suggestions = suggestionGenerator.generateSuggestions(match, textNode.parentInfo);
        
        const result: DetectionResult = {
          id: `${textNode.id}-${match.startIndex}`,
          nodeId: textNode.id,
          originalText: textNode.content,
          ambiguousMatch: match,
          suggestions: suggestions.slice(0, 5),
          location: textNode.location,
          status: ProcessingStatus.PENDING,
          isButtonText: isButtonText
        };
        
        detectionResults.push(result);
      }
    }
    
    console.log(`${detectionResults.length}個の曖昧な表現を検出`);
    
    // 検出結果をグローバル変数に保存
    currentDetectionResults = detectionResults;
    
    figma.ui.postMessage({
      type: 'scan-completed',
      results: detectionResults
    });
    
  } catch (error) {
    console.error('スキャンエラー:', error);
    figma.ui.postMessage({
      type: 'error',
      message: `スキャン中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

// テキスト置換処理
async function handleReplaceText(nodeId: string, newText: string, resultId?: string) {
  try {
    console.log(`テキスト置換: ${nodeId} -> ${newText}`);
    
    // resultIdから対応するDetectionResultを見つける
    let ambiguousMatch: AmbiguousMatch | undefined;
    let isButtonText = false;
    
    if (resultId && currentDetectionResults) {
      const result = currentDetectionResults.find(r => r.id === resultId);
      if (result) {
        ambiguousMatch = result.ambiguousMatch;
        isButtonText = result.isButtonText;
      }
    }
    
    // ボタンテキストの場合は全文置換、その他は部分置換
    const success = await textScanner.updateTextContent(
      nodeId, 
      newText, 
      isButtonText ? undefined : ambiguousMatch
    );
    
    if (success) {
      figma.ui.postMessage({
        type: 'replacement-completed',
        nodeId: nodeId,
        newText: newText
      });
      console.log(`テキスト置換成功: ${nodeId} (${isButtonText ? '全文置換' : '部分置換'})`);
    } else {
      throw new Error('テキストの更新に失敗しました');
    }
    
  } catch (error) {
    console.error('置換エラー:', error);
    figma.ui.postMessage({
      type: 'error',
      message: `テキスト置換中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

// ノードナビゲーション処理
async function handleNavigateToNode(nodeId: string) {
  try {
    console.log(`ノードに移動: ${nodeId}`);
    
    const success = await textScanner.focusOnNode(nodeId);
    
    if (success) {
      figma.ui.postMessage({
        type: 'navigation-completed',
        nodeId: nodeId
      });
      console.log(`ナビゲーション成功: ${nodeId}`);
    } else {
      throw new Error('ノードが見つかりません');
    }
    
  } catch (error) {
    console.error('ナビゲーションエラー:', error);
    figma.ui.postMessage({
      type: 'error',
      message: `ナビゲーション中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}