const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 環境変数を読み込み
require('dotenv').config();

// Supabaseクライアントを初期化
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyQuestionsMigration() {
  console.log('🚀 新しい質問リストをデータベースに追加しています...');

  // 社員提供の実用的な質問リスト
  const newQuestions = [
    // 技術系ライト Tips系
    { content: '最近「これ便利！」と思ったツール・拡張機能ってある？', category: 'technology' },
    { content: '最近ちょっとハマったバグ or 対処法を共有するなら？', category: 'technology' },
    { content: 'VSCode（or JetBrainsなど）の便利設定、何かある？', category: 'technology' },
    { content: '「前の自分に教えたい一言Tips」があるなら？', category: 'technology' },
    { content: '最近作業効率上がった習慣 or 工夫ってある？', category: 'productivity' },

    // 知見・ナレッジ系
    { content: '最近「読んでよかった記事・Qiita・Zenn」があればぜひ！', category: 'learning' },
    { content: 'Scrapboxに自分で書いた or 他人の「これは良かった」ページは？', category: 'learning' },
    { content: '日々のルーティンツール（CLI・アプリ・プラグインなど）教えて！', category: 'technology' },
    { content: 'あえて誰にも共有してないTipsをここでこっそり教えるなら？', category: 'general' },
    { content: 'ChatGPT・AI系で「地味に便利だった使い方」ある？', category: 'technology' },

    // リモートワーク・働き方系
    { content: '作業用BGM・集中テクでおすすめある？', category: 'worklife' },
    { content: '「休憩の取り方」で最近よかった工夫は？', category: 'worklife' },
    { content: 'デスク環境でアップデートしたところあればぜひ〜！', category: 'worklife' },
    { content: '集中力切れたときにやってること or 考え方ある？', category: 'worklife' },
    { content: '「週の始まりにやると調子いいこと」ある？', category: 'worklife' },

    // 仕事の効率化・ツール TIPS系
    { content: '最近「仕事がラクになったツール」やアプリある？', category: 'productivity' },
    { content: '「このショートカットキー知ってたら早い！」ってのある？', category: 'productivity' },
    { content: '仕事でよく使うテンプレートやマクロ、便利な型ある？', category: 'productivity' },

    // 表現・デザイン・構造系
    { content: '最近「おっ、いいUI/UXだな」って思ったサイトやアプリあった？', category: 'creativity' },
    { content: '「構成うまいな」と思ったドキュメント or 図 or Figmaがあったらぜひ！', category: 'creativity' },
    { content: '最近"やってみてよかった試み"や変更ってある？', category: 'productivity' },

    // チーム運用・コミュニケーション系
    { content: '今「これ言ってよかった」「伝え方うまくいった」経験ある？', category: 'communication' },
    { content: '最近うまくいった「タスクの切り方」「伝え方」「巻き込み方」ある？', category: 'communication' },
    { content: '最近「このチームの進め方、いいな」って思った瞬間ある？', category: 'communication' },

    // 発見・学び系
    { content: '「これは知らなかった〜」って最近知ったことある？', category: 'learning' },

    // Chrome拡張・Google系
    { content: '最近入れてよかった Chrome拡張機能ある？', category: 'technology' },
    { content: 'Googleドキュメントやスプレッドシートで便利な小技ある？', category: 'technology' },
    { content: '最近"これは検索しやすくなった"って工夫あった？', category: 'productivity' },
    { content: '地味に使ってる"仕事効率アプリ"をひとつ紹介するとしたら？', category: 'productivity' },
    { content: '仕事道具（アプリ・ツール・設定）で"ちょっといい感じ"にできたことある？', category: 'productivity' }
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const question of newQuestions) {
    try {
      // 同じ質問が既に存在しないかチェック
      const { data: existing, error: checkError } = await supabase
        .from('questions')
        .select('id')
        .eq('content', question.content)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error(`チェックエラー: ${question.content}`, checkError);
        errorCount++;
        continue;
      }

      if (existing) {
        console.log(`⏭️  質問は既に存在します: ${question.content.substring(0, 50)}...`);
        continue;
      }

      // 新しい質問を挿入 (created_byは省略してデフォルト値またはNULLを使用)
      const { error: insertError } = await supabase
        .from('questions')
        .insert({
          content: question.content,
          category: question.category,
          is_custom: false,
          is_active: true
        });

      if (insertError) {
        console.error(`挿入エラー: ${question.content}`, insertError);
        errorCount++;
      } else {
        console.log(`✅ 追加完了: ${question.content.substring(0, 50)}...`);
        successCount++;
      }
    } catch (error) {
      console.error(`予期しないエラー: ${question.content}`, error);
      errorCount++;
    }
  }

  console.log(`\n🎉 質問追加完了！`);
  console.log(`✅ 成功: ${successCount}問`);
  console.log(`❌ エラー: ${errorCount}問`);

  // 現在の質問統計を表示
  try {
    const { data: stats, error } = await supabase
      .from('questions')
      .select('category, is_active')
      .order('category');

    if (error) {
      console.error('統計取得エラー:', error);
    } else {
      const categoryStats = stats.reduce((acc, q) => {
        acc[q.category] = acc[q.category] || { total: 0, active: 0 };
        acc[q.category].total++;
        if (q.is_active) acc[q.category].active++;
        return acc;
      }, {});

      console.log('\n📊 カテゴリー別質問統計:');
      Object.entries(categoryStats).forEach(([category, counts]) => {
        console.log(`  ${category}: ${counts.active}/${counts.total}問 (アクティブ/総数)`);
      });
    }
  } catch (error) {
    console.error('統計表示エラー:', error);
  }
}

// 実行
applyQuestionsMigration()
  .then(() => {
    console.log('\n✅ すべての処理が完了しました');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 処理中にエラーが発生しました:', error);
    process.exit(1);
  });