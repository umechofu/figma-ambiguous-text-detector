-- 社員提供の実用的な質問リストを追加
-- 既存の質問は残して、新しいカテゴリーの実用的な質問を追加

-- 技術系ライト Tips系
INSERT INTO questions (content, category, is_custom, is_active, created_by) VALUES
('最近「これ便利！」と思ったツール・拡張機能ってある？', 'technology', false, true, 'system'),
('最近ちょっとハマったバグ or 対処法を共有するなら？', 'technology', false, true, 'system'),
('VSCode（or JetBrainsなど）の便利設定、何かある？', 'technology', false, true, 'system'),
('「前の自分に教えたい一言Tips」があるなら？', 'technology', false, true, 'system'),
('最近作業効率上がった習慣 or 工夫ってある？', 'productivity', false, true, 'system'),

-- 知見・ナレッジ系
INSERT INTO questions (content, category, is_custom, is_active, created_by) VALUES
('最近「読んでよかった記事・Qiita・Zenn」があればぜひ！', 'learning', false, true, 'system'),
('Scrapboxに自分で書いた or 他人の「これは良かった」ページは？', 'learning', false, true, 'system'),
('日々のルーティンツール（CLI・アプリ・プラグインなど）教えて！', 'technology', false, true, 'system'),
('あえて誰にも共有してないTipsをここでこっそり教えるなら？', 'general', false, true, 'system'),
('ChatGPT・AI系で「地味に便利だった使い方」ある？', 'technology', false, true, 'system'),

-- リモートワーク・働き方系
INSERT INTO questions (content, category, is_custom, is_active, created_by) VALUES
('作業用BGM・集中テクでおすすめある？', 'worklife', false, true, 'system'),
('「休憩の取り方」で最近よかった工夫は？', 'worklife', false, true, 'system'),
('デスク環境でアップデートしたところあればぜひ〜！', 'worklife', false, true, 'system'),
('集中力切れたときにやってること or 考え方ある？', 'worklife', false, true, 'system'),
('「週の始まりにやると調子いいこと」ある？', 'worklife', false, true, 'system'),

-- 仕事の効率化・ツール TIPS系
INSERT INTO questions (content, category, is_custom, is_active, created_by) VALUES
('最近「仕事がラクになったツール」やアプリある？', 'productivity', false, true, 'system'),
('「このショートカットキー知ってたら早い！」ってのある？', 'productivity', false, true, 'system'),
('仕事でよく使うテンプレートやマクロ、便利な型ある？', 'productivity', false, true, 'system'),

-- 表現・デザイン・構造系（エンジニア・デザイナー共通）
INSERT INTO questions (content, category, is_custom, is_active, created_by) VALUES
('最近「おっ、いいUI/UXだな」って思ったサイトやアプリあった？', 'creativity', false, true, 'system'),
('「構成うまいな」と思ったドキュメント or 図 or Figmaがあったらぜひ！', 'creativity', false, true, 'system'),
('最近"やってみてよかった試み"や変更ってある？', 'productivity', false, true, 'system'),

-- チーム運用・コミュニケーション系
INSERT INTO questions (content, category, is_custom, is_active, created_by) VALUES
('今「これ言ってよかった」「伝え方うまくいった」経験ある？', 'communication', false, true, 'system'),
('最近うまくいった「タスクの切り方」「伝え方」「巻き込み方」ある？', 'communication', false, true, 'system'),
('最近「このチームの進め方、いいな」って思った瞬間ある？', 'communication', false, true, 'system'),

-- 発見・学び系（気軽にシェアしやすい）
INSERT INTO questions (content, category, is_custom, is_active, created_by) VALUES
('「これは知らなかった〜」って最近知ったことある？', 'learning', false, true, 'system'),

-- Chrome拡張・Google系
INSERT INTO questions (content, category, is_custom, is_active, created_by) VALUES
('最近入れてよかった Chrome拡張機能ある？', 'technology', false, true, 'system'),
('Googleドキュメントやスプレッドシートで便利な小技ある？', 'technology', false, true, 'system'),
('最近"これは検索しやすくなった"って工夫あった？', 'productivity', false, true, 'system'),
('地味に使ってる"仕事効率アプリ"をひとつ紹介するとしたら？', 'productivity', false, true, 'system'),
('仕事道具（アプリ・ツール・設定）で"ちょっといい感じ"にできたことある？', 'productivity', false, true, 'system');

-- 新しいカテゴリー追加（必要に応じて）
-- 既存のカテゴリーを使用:
-- technology: 技術・ツール
-- productivity: 業務効率化  
-- learning: 学習・成長
-- communication: コミュニケーション
-- creativity: 創造性・アイデア
-- worklife: ワークライフバランス
-- general: 一般