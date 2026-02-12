/**
 * Atlas Search 인덱스 생성 스크립트
 *
 * Atlas M0 (무료 클러스터)에서는 이 스크립트 대신 Atlas UI에서 수동으로 인덱스를 생성해야 합니다.
 * M10+ (유료 클러스터)에서는 이 스크립트로 프로그래매틱하게 생성 가능합니다.
 *
 * Usage: bun run db:indexes
 */

import { getDb, closeDb } from '@repo/db';

const TEXT_SEARCH_INDEX = {
  name: 'faq_text_search',
  definition: {
    analyzer: 'lucene.korean',
    searchAnalyzer: 'lucene.korean',
    mappings: {
      dynamic: false,
      fields: {
        question: {
          type: 'string',
          analyzer: 'lucene.korean',
        },
        answer: {
          type: 'string',
          analyzer: 'lucene.korean',
        },
        category: {
          type: 'string',
          analyzer: 'lucene.keyword',
        },
      },
    },
  },
};

async function main() {
  console.log('[Indexes] Creating Atlas Search index...\n');

  const db = await getDb();
  const col = db.collection('faqs');

  try {
    console.log('[Indexes] Creating text search index (lucene.korean)...');
    await col.createSearchIndex(TEXT_SEARCH_INDEX);
    console.log('[Indexes] Text search index created: faq_text_search');
  } catch (err: any) {
    if (err.codeName === 'IndexAlreadyExists' || err.message?.includes('already exists')) {
      console.log('[Indexes] Text search index already exists, skipping.');
    } else {
      console.error('[Indexes] Failed to create text search index:', err.message);
      console.log('\n  Note: Atlas M0 (free) requires manual index creation via Atlas UI.');
    }
  }

  console.log('\n[Indexes] Done!');
  console.log('\nManual index definition for Atlas UI:');
  console.log('\n--- faq_text_search (Atlas Search) ---');
  console.log(JSON.stringify(TEXT_SEARCH_INDEX.definition, null, 2));

  await closeDb();
}

main().catch((err) => {
  console.error('[Indexes] Error:', err);
  process.exit(1);
});
