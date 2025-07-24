# あいまいテキスト検出君 - Figma プラグイン

[![Version](https://img.shields.io/badge/version-1.1.0-green.svg)](./docs/RELEASE_NOTES.md)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Figma](https://img.shields.io/badge/figma-plugin-orange.svg)](https://www.figma.com/community)

UIデザインにおける「これ」「それ」などの曖昧なテキスト表現を自動検出し、OOUI（オブジェクト指向ユーザーインターフェース）の原則に基づいて具体的な置換候補を提供するFigmaプラグインです。

## 機能

### 🔍 曖昧テキスト検出

- 「これ」「それ」「あれ」などの基本的な指示代名詞
- 「こちら」「そちら」「あちら」などの場所を示す指示語
- 「この」「その」「あの」などの連体詞
- 「こう」「そう」「ああ」などの方法を示す指示語
- 「こんな」「そんな」「あんな」などの種類・様子を示す指示語

### 🎯 文脈に応じた高精度な提案

- **エラー・トラブル系**: 「サポートページ」「FAQ」「お問い合わせフォーム」
- **詳細情報系**: 「記事」「ドキュメント」「レポート」「マニュアル」
- **外部リンク系**: 「公式サイト」「ホームページ」「ウェブサイト」
- **ダウンロード系**: 「ファイル」「アプリ」「ソフトウェア」「PDF」
- **登録・申込み系**: 「登録フォーム」「申込みフォーム」「アカウント作成」

### ⚡ 部分置換機能

曖昧な部分のみを具体的な表現に置き換えます。

**例:**

- 「エラーが発生しました。こちらをクリックしてください」
- ↓ 「こちら」を「サポートページ」に置換
- 「エラーが発生しました。サポートページをクリックしてください」

## インストール

### 前提条件

- Node.js (v14 以上)
- npm
- Figma Desktop 版または Web 版

### セットアップ

1. リポジトリをクローン

```bash
git clone <repository-url>
cd figma-ambiguous-text-detector
```

2. 依存関係をインストール

```bash
npm install
```

3. プラグインをビルド

```bash
npm run build
```

4. Figma でプラグインを読み込み

- Figma で `Plugins` > `Development` > `Import plugin from manifest...` を選択
- `manifest.json` ファイルを選択

## 使用方法

1. **プラグインを起動**

   - `Plugins` > `Development` > `曖昧テキスト検出器` を選択

2. **デザインをスキャン**

   - 「デザインをスキャン」ボタンをクリック
   - プラグインが Figma デザイン内のテキストを解析

3. **結果を確認**

   - 検出された曖昧なテキストが一覧表示される
   - 各項目に文脈に応じた置換候補が表示される

4. **テキストを置換**

   - 適切な置換候補をクリック
   - 曖昧な部分のみが具体的な表現に置き換わる

5. **ナビゲーション**
   - 「移動」ボタンで該当するテキストレイヤーに移動可能

## 技術仕様

### アーキテクチャ

- **メインスレッド (code.ts)**: Figma API との相互作用、テキストスキャン、データ処理
- **UI スレッド (ui.html)**: ユーザーインターフェース、結果表示、ユーザーインタラクション

### 主要コンポーネント

- **TextScanner**: Figma ドキュメントのテキストノード検出とスキャン
- **AmbiguousTextDetector**: 日本語曖昧テキストの検出エンジン
- **SuggestionGenerator**: 文脈に応じた置換候補生成システム

### 対応言語

- 日本語（ひらがな、カタカナ、漢字、混合テキスト）

## 開発

### ビルド

```bash
npm run build
```

### 開発モード（ファイル監視）

```bash
npm run watch
```

### プロジェクト構造

```
kiro/
├── src/                     # TypeScriptソースコード
│   ├── code.ts             # メインプラグインロジック
│   ├── TextScanner.ts      # テキストスキャン機能
│   ├── AmbiguousTextDetector.ts  # 曖昧表現検出エンジン
│   ├── SuggestionGenerator.ts    # 置換候補生成システム
│   └── types.ts            # TypeScript型定義
├── docs/                   # ドキュメント
│   ├── DEVELOPMENT.md      # 開発ガイド
│   ├── RELEASE_NOTES.md    # リリースノート
│   └── PUBLISHING.md       # 公開手順書
├── assets/                 # 画像・素材
│   ├── screenshots/        # プラグインUI画面
│   ├── icons/             # アイコン・ロゴ
│   └── examples/          # 使用例画像
├── dist/                  # ビルド出力（git無視）
├── ui.html                # プラグインUI
├── manifest.json          # Figmaプラグイン設定
├── package.json           # Node.js設定
├── tsconfig.json          # TypeScript設定
└── .gitignore             # Git無視設定
```

## OOUI の原則

このプラグインは、オブジェクト指向ユーザーインターフェース（OOUI）の原則に基づいて設計されています：

- **具体的なオブジェクト名詞**: 抽象的な表現を避け、ユーザーが操作・参照できる具体的なオブジェクトを提案
- **操作可能性**: ユーザーが直接操作できるオブジェクト（フォーム、ファイル、ページなど）を重視
- **文脈理解**: テキストの文脈を解析し、適切なオブジェクトを提案

## 📚 ドキュメント

- **[開発ガイド](./docs/DEVELOPMENT.md)** - 開発環境セットアップとアーキテクチャ解説
- **[リリースノート](./docs/RELEASE_NOTES.md)** - バージョン履歴と変更内容
- **[公開手順](./docs/PUBLISHING.md)** - Figma Community公開ガイド

## 🆕 最新アップデート (v1.1.0)

- 🔧 **Figma最新版での動作エラーを修正**
- ✨ **ローディングスピナーでUX向上**
- 📈 **処理の安定性を改善**

詳細は[リリースノート](./docs/RELEASE_NOTES.md)をご覧ください。

## 🤝 貢献

プルリクエストやイシューの報告を歓迎します！

### 貢献方法
1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📄 ライセンス

MIT License - 詳細は[LICENSE](./LICENSE)ファイルをご覧ください。

## 👤 作者

開発者: [Your Name]
- GitHub: [あなたのGitHubアカウント]
- Figma Community: [プラグインページ]

---

**⭐ このプラグインが役に立ったら、GitHubでスターをお願いします！**
