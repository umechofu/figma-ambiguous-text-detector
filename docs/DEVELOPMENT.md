# 開発ガイド

## 🛠️ 開発環境セットアップ

### 前提条件
- Node.js (v14以上)
- npm
- TypeScript
- Figma Desktop版またはブラウザ版

### インストール
```bash
npm install
```

### 開発コマンド
```bash
# ビルド
npm run build

# 開発モード（ファイル監視）
npm run watch

# TypeScript型チェック
npx tsc --noEmit
```

## 📁 プロジェクト構造

```
kiro/
├── src/                     # TypeScriptソースコード
│   ├── code.ts             # メインプラグインロジック
│   ├── TextScanner.ts      # テキストスキャン機能
│   ├── AmbiguousTextDetector.ts  # 曖昧表現検出
│   ├── SuggestionGenerator.ts    # 置換候補生成
│   └── types.ts            # 型定義
├── docs/                   # ドキュメント
│   ├── DEVELOPMENT.md      # このファイル
│   ├── RELEASE_NOTES.md    # リリースノート
│   └── PUBLISHING.md       # 公開手順
├── dist/                   # ビルド出力（git無視）
├── ui.html                 # プラグインUI
├── manifest.json           # Figmaプラグイン設定
├── package.json            # Node.js設定
├── tsconfig.json           # TypeScript設定
└── .gitignore              # Git無視設定
```

## 🔧 開発フロー

### 1. ローカル開発
1. `npm run watch` でファイル監視開始
2. Figmaで「Development」→「Hot reload plugin」
3. コード変更が自動的に反映される

### 2. デバッグ
- Figma開発者ツール: `Plugins` → `Development` → `Open Console`
- `console.log()` でデバッグ情報を出力
- UIデバッグ: ブラウザ開発者ツールでui.htmlを検査

### 3. テスト
```typescript
// テスト用サンプルテキスト
const testTexts = [
  'これをクリックしてください',
  'そちらを選択する',
  'こちらのボタンを押す',
  'このページを確認'
];
```

## 🏗️ アーキテクチャ

### メインスレッド (code.ts)
- Figma APIとの通信
- ドキュメントスキャン
- テキスト解析・置換

### UIスレッド (ui.html)
- ユーザーインターフェース
- 結果表示
- ユーザーインタラクション

### 主要クラス

#### TextScanner
```typescript
class TextScanner {
  async scanDocument(): Promise<TextNodeInfo[]>
  async scanPage(page: PageNode): Promise<TextNodeInfo[]>
  async analyzeParentInfo(textNode: TextNode): Promise<ParentInfo>
}
```

#### AmbiguousTextDetector
```typescript
class AmbiguousTextDetector {
  detectAmbiguousText(text: string): AmbiguousMatch[]
  analyzeContext(match: AmbiguousMatch): ContextAnalysis
}
```

#### SuggestionGenerator
```typescript
class SuggestionGenerator {
  generateSuggestions(match: AmbiguousMatch, parentInfo: ParentInfo): Suggestion[]
  getContextualSuggestions(ambiguousWord: string, context: string): Suggestion[]
}
```

## 🎯 検出ロジック

### 曖昧表現パターン
```typescript
const ambiguousPatterns = [
  { word: 'これ', variants: ['これ', 'コレ'], contextHints: ['を', 'が', 'は'] },
  { word: 'それ', variants: ['それ', 'ソレ'], contextHints: ['を', 'が', 'は'] },
  // ... 他のパターン
];
```

### 文脈解析
1. **前後文脈取得** (±20文字)
2. **キーワード抽出** (ボタン、リンク、ページ等)
3. **信頼度計算** (0.0-1.0)
4. **カテゴリ分類** (UI_ELEMENT, ACTION, CONTENT, GENERIC)

### 置換候補生成
1. **親レイヤー解析** (コンポーネント名、階層)
2. **文脈マッチング** (エラー系、詳細系、登録系等)
3. **汎用候補** (デフォルト置換リスト)
4. **信頼度ソート** (高信頼度順)

## 🚀 リリース手順

### バージョンアップ
1. `package.json` のversion更新
2. `docs/RELEASE_NOTES.md` に変更内容記載
3. `npm run build` で最終ビルド
4. Figma Communityで公開

### コード品質
- TypeScript型チェック必須
- console.logの削除
- エラーハンドリング確認
- UI応答性テスト

## 🐛 トラブルシューティング

### よくある問題
1. **プラグインが読み込まれない**
   - manifest.jsonの構文チェック
   - dist/code.jsの存在確認

2. **UI表示されない**
   - ui.htmlの構文エラー確認
   - JavaScriptエラーをコンソールで確認

3. **テキスト検出されない**
   - パターンマッチング条件確認
   - 文脈ヒント設定確認

### デバッグコマンド
```typescript
// 検出パターンテスト
console.log('検出結果:', detector.detectAmbiguousText(text));

// 提案生成テスト
console.log('提案結果:', generator.generateSuggestions(match, parentInfo));
```

## 📝 コーディング規約

### TypeScript
- 厳密な型定義
- async/awaitの適切な使用
- エラーハンドリング必須

### CSS/HTML
- 既存テーマカラー使用
- レスポンシブ対応
- アクセシビリティ考慮

### JavaScript
- ES6+構文使用
- 関数型プログラミング推奨
- パフォーマンス最適化