-- Insert default questions for the shuffle feature
INSERT INTO questions (content, category, is_custom, is_active) VALUES
-- 技術系質問
('最近使い始めて生産性が上がったツールやサービスはありますか？', 'technology', false, true),
('開発効率を上げるために実践している工夫やTIPSを教えてください', 'technology', false, true),
('最近ハマったバグとその解決方法を共有してください', 'technology', false, true),
('おすすめのVSCode拡張機能があれば教えてください', 'technology', false, true),
('よく使うショートカットキーで、これは便利！というものはありますか？', 'technology', false, true),

-- 業務効率化系質問
('時間管理で実践していることがあれば教えてください', 'productivity', false, true),
('会議を効率的に進めるために心がけていることはありますか？', 'productivity', false, true),
('タスク管理で使っているツールや方法を教えてください', 'productivity', false, true),
('集中力を維持するために実践していることはありますか？', 'productivity', false, true),
('リモートワークで工夫していることがあれば教えてください', 'productivity', false, true),

-- 学習・成長系質問
('最近読んだ本や記事で印象に残ったものはありますか？', 'learning', false, true),
('新しいスキルを身につけるときの学習方法を教えてください', 'learning', false, true),
('参考にしているブログやWebサイトがあれば教えてください', 'learning', false, true),
('失敗から学んだ貴重な経験があれば共有してください', 'learning', false, true),
('メンターや尊敬する人から教わった大切なことはありますか？', 'learning', false, true),

-- コミュニケーション系質問
('チームワークを良くするために心がけていることはありますか？', 'communication', false, true),
('難しい内容を分かりやすく説明するコツがあれば教えてください', 'communication', false, true),
('フィードバックをもらうときに意識していることはありますか？', 'communication', false, true),
('オンラインでのコミュニケーションで工夫していることはありますか？', 'communication', false, true),
('新しいメンバーを迎えるときに大切にしていることはありますか？', 'communication', false, true),

-- 創造性・アイデア系質問
('アイデアを思いつくときはどんな時ですか？', 'creativity', false, true),
('問題解決で独自のアプローチを取った経験があれば教えてください', 'creativity', false, true),
('インスピレーションを得るために実践していることはありますか？', 'creativity', false, true),
('クリエイティブな作業をするときの環境づくりで工夫していることはありますか？', 'creativity', false, true),
('「これは面白い！」と思った最近の発見があれば教えてください', 'creativity', false, true),

-- ワークライフバランス系質問
('仕事とプライベートのバランスを取るために実践していることはありますか？', 'worklife', false, true),
('ストレス解消法があれば教えてください', 'worklife', false, true),
('リフレッシュするために定期的にやっていることはありますか？', 'worklife', false, true),
('健康管理で気をつけていることがあれば教えてください', 'worklife', false, true),
('趣味や興味のあることで最近ハマっているものはありますか？', 'worklife', false, true),

-- 一般的な質問
('今日の気分を天気で表すとどんな感じですか？', 'general', false, true),
('最近嬉しかった出来事があれば教えてください', 'general', false, true),
('今週の小さな成功体験があれば共有してください', 'general', false, true),
('同僚に感謝したいことがあれば教えてください', 'general', false, true),
('今取り組んでいることで楽しみにしていることはありますか？', 'general', false, true);