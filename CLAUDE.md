# Figma あいまいテキスト検出君 - 開発ガイド

## プロジェクト概要

UIデザインにおける「これ」「それ」などの曖昧なテキスト表現を自動検出し、OOUI（オブジェクト指向ユーザーインターフェース）の原則に基づいて具体的な置換候補を提案するFigmaプラグインです。

### 技術スタック
- **言語**: TypeScript (ES2017)
- **プラットフォーム**: Figma Plugin API
- **アーキテクチャ**: メインスレッド（code.ts）+ UIスレッド（ui.html）
- **ビルドツール**: TypeScript Compiler

### 主要機能
- 指示代名詞（これ・それ・あれ）の検出
- 文脈に応じた置換候補生成
- 部分置換による具体的な表現への変換
- Figmaデザイン内テキストの一括スキャン

## 開発コマンド

```bash
# 依存関係インストール
npm install

# プロダクションビルド
npm run build

# 開発モード（ファイル監視）
npm run watch

# TypeScript型チェック
npx tsc --noEmit
```

## プロジェクト構造

```
figma-ambiguous-text-detector/
├── src/                           # TypeScriptソースコード
│   ├── code.ts                   # メインプラグインロジック（Figma API）
│   ├── TextScanner.ts            # テキストスキャン機能
│   ├── AmbiguousTextDetector.ts  # 曖昧表現検出エンジン
│   ├── SuggestionGenerator.ts    # 置換候補生成システム
│   └── types.ts                  # TypeScript型定義
├── docs/                         # ドキュメント
│   ├── DEVELOPMENT.md            # 開発ガイド詳細
│   ├── RELEASE_NOTES.md          # リリースノート
│   └── PUBLISHING.md             # 公開手順書
├── assets/                       # 画像・素材
├── dist/                         # ビルド出力（自動生成）
├── ui.html                       # プラグインUI
├── manifest.json                 # Figmaプラグイン設定
├── package.json                  # Node.js設定
└── tsconfig.json                 # TypeScript設定
```

## タスク実行の4段階フロー

### 1. 要件定義
- `.claude_workflow/complete.md`が存在すれば参照
- 機能要件の明確化、検出精度の目標設定、UI/UXの要件定義
- `.claude_workflow/requirements.md`に文書化
- **必須確認**: 「要件定義フェーズが完了しました。設計フェーズに進んでよろしいですか？」

### 2. 設計
- **必ず`.claude_workflow/requirements.md`を読み込んでから開始**
- 検出アルゴリズム設計、置換候補生成ロジック、Figma API連携方式
- `.claude_workflow/design.md`に文書化
- **必須確認**: 「設計フェーズが完了しました。タスク化フェーズに進んでよろしいですか？」

### 3. タスク化
- **必ず`.claude_workflow/design.md`を読み込んでから開始**
- 機能単位でのタスク分解、優先順位設定、テスト計画
- `.claude_workflow/tasks.md`に文書化
- **必須確認**: 「タスク化フェーズが完了しました。実行フェーズに進んでよろしいですか？」

### 4. 実行
- **必ず`.claude_workflow/tasks.md`を読み込んでから開始**
- タスクを順次実行、進捗を`.claude_workflow/tasks.md`に更新
- 各タスク完了時に報告、型チェック・ビルド確認

## 主要コンポーネント

### TextScanner (src/TextScanner.ts)
- Figmaドキュメント内のテキストノード検出
- 階層構造の解析とメタデータ収集
- テキスト内容の抽出とフィルタリング

### AmbiguousTextDetector (src/AmbiguousTextDetector.ts)  
- 曖昧表現パターンの定義・検出
- 文脈解析（前後文脈±20文字）
- 信頼度計算とカテゴリ分類

### SuggestionGenerator (src/SuggestionGenerator.ts)
- 文脈に応じた置換候補生成
- エラー系・詳細系・登録系等のカテゴリ別提案
- 親レイヤー情報を活用した提案精度向上

## 開発・デバッグ手順

### ローカル開発
1. `npm run watch` でファイル監視開始
2. Figmaで「Plugins」→「Development」→「Import plugin from manifest...」
3. `manifest.json`を選択してプラグイン読み込み
4. 「Hot reload plugin」でリアルタイム更新

### デバッグ方法
- **メインスレッド**: Figma開発者ツール（Plugins → Development → Open Console）
- **UIスレッド**: ブラウザ開発者ツールでui.htmlを検査
- `console.log()`でデバッグ情報出力

### テスト用サンプル
```typescript
const testTexts = [
  'これをクリックしてください',
  'そちらを選択する', 
  'こちらのボタンを押す',
  'このページを確認'
];
```

## 品質チェック

### 必須チェック項目
- **型チェック**: `npx tsc --noEmit`
- **ビルド確認**: `npm run build`
- **プラグイン動作確認**: Figmaでの実行テスト
- **エラーハンドリング**: 例外処理の実装確認

### コード品質基準
- TypeScript厳密型定義
- async/await適切使用
- エラーハンドリング必須
- パフォーマンス最適化

## 実行ルール

### ファイル操作
- 新規タスク開始時: 既存ファイルの**内容を全て削除して白紙から書き直す**
- ファイル編集前に必ず現在の内容を確認

### フェーズ管理  
- 各段階開始時: 「前段階のmdファイルを読み込みました」と報告
- 各段階の最後に、期待通りの結果になっているか確認
- 要件定義なしにいきなり実装を始めない

### 実行方針
- 段階的に進める: 一度に全てを変更せず、小さな変更を積み重ねる
- 複数のタスクを同時並行で進めない
- エラーは解決してから次へ進む
- エラーを無視して次のステップに進まない
- 指示にない機能を勝手に追加しない

## リリース手順

### バージョンアップ
1. `package.json`のversion更新
2. `docs/RELEASE_NOTES.md`に変更内容記載  
3. `npm run build`で最終ビルド
4. manifest.jsonのversion更新
5. Figma Communityで公開

### 公開前チェック
- console.logの削除
- UI応答性テスト
- 各種ブラウザでの動作確認
- エラーハンドリング確認

## 注意事項

- Figma Plugin APIの制限事項を理解して開発
- UI表示エラーはui.htmlの構文確認
- テキスト検出されない場合はパターンマッチング条件を確認
- セキュリティ: 秘密情報の露出・ログ出力禁止