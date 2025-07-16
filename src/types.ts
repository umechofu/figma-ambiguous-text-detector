// 型定義ファイル

/// <reference types="@figma/plugin-typings" />

export interface TextNodeInfo {
  id: string;
  content: string;
  node: TextNode;
  location: NodeLocation;
}

export interface NodeLocation {
  pageName: string;
  layerName: string;
  coordinates: { x: number; y: number };
}

export interface AmbiguousMatch {
  originalText: string;
  ambiguousWord: string;
  startIndex: number;
  endIndex: number;
  context: string;
}

export interface Suggestion {
  replacementText: string;
  confidence: number;
  category: SuggestionCategory;
}

export enum SuggestionCategory {
  UI_ELEMENT = 'ui_element',
  ACTION = 'action',
  CONTENT = 'content',
  GENERIC = 'generic'
}

export interface DetectionResult {
  id: string;
  nodeId: string;
  originalText: string;
  ambiguousMatch: AmbiguousMatch;
  suggestions: Suggestion[];
  location: NodeLocation;
  status: ProcessingStatus;
}

export enum ProcessingStatus {
  PENDING = 'pending',
  REPLACED = 'replaced',
  SKIPPED = 'skipped'
}

export interface ScanProgress {
  current: number;
  total: number;
  currentOperation: string;
}

// 文脈解析関連の型定義
export interface ContextAnalysis {
  contextType: ContextType;
  beforeContext: string;
  afterContext: string;
  fullContext: string;
  relatedKeywords: string[];
  uiElementHints: UIElementHint[];
  actionHints: ActionHint[];
  confidence: number;
}

export enum ContextType {
  UI_ACTION = 'ui_action',
  CONTENT = 'content',
  NAVIGATION = 'navigation',
  GENERIC = 'generic'
}

export interface UIElementHint {
  elementType: string;
  confidence: number;
}

export interface ActionHint {
  actionType: string;
  confidence: number;
  position: 'before' | 'after';
}