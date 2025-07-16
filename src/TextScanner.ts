// TextScanner.ts - Figmaドキュメントのテキストスキャン機能

/// <reference types="@figma/plugin-typings" />

import { TextNodeInfo, NodeLocation, ScanProgress } from './types';

export class TextScanner {
  private onProgress?: (progress: ScanProgress) => void;
  private batchSize: number = 100; // バッチ処理のサイズ
  private processingDelay: number = 10; // バッチ間の遅延（ms）

  constructor(onProgress?: (progress: ScanProgress) => void) {
    this.onProgress = onProgress;
  }

  /**
   * ドキュメント全体をスキャンしてテキストノードを抽出（パフォーマンス最適化版）
   */
  async scanDocument(): Promise<TextNodeInfo[]> {
    const allTextNodes: TextNodeInfo[] = [];
    const pages = figma.root.children;
    
    let totalNodes = 0;
    let processedNodes = 0;

    // 全ノード数をカウント（進捗表示用）
    for (const page of pages) {
      if (page.type === 'PAGE') {
        totalNodes += this.countNodes(page);
      }
    }

    this.reportProgress(0, totalNodes, 'スキャンを開始しています...');

    // 各ページを並列処理でスキャン（メモリ使用量を考慮して制限）
    const pagePromises: Promise<TextNodeInfo[]>[] = [];
    const maxConcurrentPages = 3; // 同時処理ページ数の制限

    for (let i = 0; i < pages.length; i += maxConcurrentPages) {
      const pageBatch = pages.slice(i, i + maxConcurrentPages);
      
      for (const page of pageBatch) {
        if (page.type === 'PAGE') {
          pagePromises.push(this.scanPageOptimized(page, processedNodes, totalNodes));
        }
      }

      // バッチごとに処理して結果を統合
      const batchResults = await Promise.all(pagePromises);
      for (const pageResult of batchResults) {
        allTextNodes.push(...pageResult);
      }

      // 次のバッチ前に少し待機（UIの応答性を保つため）
      if (i + maxConcurrentPages < pages.length) {
        await this.delay(this.processingDelay);
      }

      pagePromises.length = 0; // 配列をクリア
    }

    this.reportProgress(totalNodes, totalNodes, 'スキャン完了');
    
    console.log(`スキャン完了: ${allTextNodes.length}個のテキストノードを検出`);
    return allTextNodes;
  }

  /**
   * 指定されたページをスキャン
   */
  async scanPage(page: PageNode): Promise<TextNodeInfo[]> {
    const textNodes: TextNodeInfo[] = [];
    
    const traverseNode = (node: SceneNode, pageName: string) => {
      // テキストノードの場合
      if (node.type === 'TEXT') {
        const textContent = this.extractTextContent(node);
        if (textContent && textContent.trim().length > 0) {
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
            }
          };
          textNodes.push(textNodeInfo);
        }
      }

      // 子ノードがある場合は再帰的に処理
      if ('children' in node && node.children) {
        for (const child of node.children) {
          traverseNode(child, pageName);
        }
      }
    };

    // ページの全子ノードを走査
    for (const child of page.children) {
      traverseNode(child, page.name);
    }

    return textNodes;
  }

  /**
   * テキストノードからテキストコンテンツを抽出
   */
  extractTextContent(node: SceneNode): string | null {
    if (node.type !== 'TEXT') {
      return null;
    }

    try {
      // Figmaのテキストノードから文字列を取得
      const textNode = node as TextNode;
      return textNode.characters;
    } catch (error) {
      console.warn(`テキスト抽出エラー (ノードID: ${node.id}):`, error);
      return null;
    }
  }

  /**
   * ノード数をカウント（進捗計算用）
   */
  private countNodes(node: BaseNode): number {
    let count = 1;
    
    if ('children' in node && node.children) {
      for (const child of node.children) {
        count += this.countNodes(child);
      }
    }
    
    return count;
  }

  /**
   * 進捗を報告
   */
  private reportProgress(current: number, total: number, operation: string) {
    if (this.onProgress) {
      this.onProgress({
        current,
        total,
        currentOperation: operation
      });
    }
  }

  /**
   * 特定のノードIDでテキストノードを検索
   */
  async findTextNodeById(nodeId: string): Promise<TextNode | null> {
    try {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (node && node.type === 'TEXT') {
        return node as TextNode;
      }
      return null;
    } catch (error) {
      console.error(`ノード検索エラー (ID: ${nodeId}):`, error);
      return null;
    }
  }

  /**
   * テキストノードの内容を更新
   */
  async updateTextContent(nodeId: string, newText: string): Promise<boolean> {
    try {
      const textNode = await this.findTextNodeById(nodeId);
      if (!textNode) {
        console.error(`テキストノードが見つかりません (ID: ${nodeId})`);
        return false;
      }

      // フォントを読み込んでからテキストを更新
      await figma.loadFontAsync(textNode.fontName as FontName);
      textNode.characters = newText;
      
      console.log(`テキスト更新成功: "${newText}" (ノードID: ${nodeId})`);
      return true;
    } catch (error) {
      console.error(`テキスト更新エラー (ノードID: ${nodeId}):`, error);
      return false;
    }
  }

  /**
   * 指定されたノードにフォーカス
   */
  async focusOnNode(nodeId: string): Promise<boolean> {
    try {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node) {
        console.error(`ノードが見つかりません (ID: ${nodeId})`);
        return false;
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

  /**
   * パフォーマンス最適化版ページスキャン
   */
  private async scanPageOptimized(page: PageNode, processedNodes: number, totalNodes: number): Promise<TextNodeInfo[]> {
    const textNodes: TextNodeInfo[] = [];
    let currentBatch: SceneNode[] = [];
    let nodeCount = 0;

    this.reportProgress(processedNodes, totalNodes, `ページ "${page.name}" をスキャン中...`);

    const processNodeBatch = async (nodes: SceneNode[], pageName: string) => {
      for (const node of nodes) {
        this.traverseNodeOptimized(node, pageName, textNodes);
      }
      
      // バッチ処理後に少し待機
      if (nodes.length >= this.batchSize) {
        await this.delay(this.processingDelay);
      }
    };

    // ページの全子ノードをバッチ処理
    for (const child of page.children) {
      currentBatch.push(child);
      nodeCount++;

      // バッチサイズに達したら処理
      if (currentBatch.length >= this.batchSize) {
        await processNodeBatch(currentBatch, page.name);
        currentBatch = [];
      }
    }

    // 残りのノードを処理
    if (currentBatch.length > 0) {
      await processNodeBatch(currentBatch, page.name);
    }

    return textNodes;
  }

  /**
   * パフォーマンス最適化版ノード走査
   */
  private traverseNodeOptimized(node: SceneNode, pageName: string, textNodes: TextNodeInfo[]): void {
    try {
      // テキストノードの場合
      if (node.type === 'TEXT') {
        const textContent = this.extractTextContent(node);
        if (textContent && textContent.trim().length > 0) {
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
            }
          };
          textNodes.push(textNodeInfo);
        }
      }

      // 子ノードがある場合は再帰的に処理（深度制限付き）
      if ('children' in node && node.children && node.children.length > 0) {
        // 大量の子ノードがある場合は警告
        if (node.children.length > 1000) {
          console.warn(`大量の子ノードを検出 (${node.children.length}個) - ノード: ${node.name}`);
        }

        for (const child of node.children) {
          this.traverseNodeOptimized(child, pageName, textNodes);
        }
      }
    } catch (error) {
      console.warn(`ノード処理エラー (ID: ${node.id}):`, error);
      // エラーが発生しても処理を継続
    }
  }

  /**
   * 指定時間待機するユーティリティ関数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * メモリ使用量を監視（デバッグ用）
   */
  private logMemoryUsage(context: string): void {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      console.log(`${context} - メモリ使用量:`, {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024) + 'MB',
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024) + 'MB',
        limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
      });
    }
  }
}