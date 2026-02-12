/**
 * Atlas Search + Vector Search 인덱스 생성 스크립트
 *
 * Usage: bun run db:indexes
 */

import { getDb, closeDb } from '@repo/db';
import { EMBEDDING_DIMENSIONS } from '@repo/vector';

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

const VECTOR_SEARCH_INDEX = {
  name: 'faq_vector_index',
  type: 'vectorSearch',
  definition: {
    fields: [
      {
        type: 'vector',
        path: 'embedding',
        numDimensions: EMBEDDING_DIMENSIONS,
        similarity: 'cosine',
      },
    ],
  },
};

async function createIndex(col: any, index: any) {
  try {
    console.log(`[Indexes] Creating: ${index.name}...`);
    await col.createSearchIndex(index);
    console.log(`[Indexes] Created: ${index.name}`);
  } catch (err: any) {
    if (err.codeName === 'IndexAlreadyExists' || err.message?.includes('already exists')) {
      console.log(`[Indexes] Already exists: ${index.name}, skipping.`);
    } else {
      console.error(`[Indexes] Failed: ${index.name}:`, err.message);
    }
  }
}

async function main() {
  console.log('[Indexes] Creating Atlas indexes...\n');

  const db = await getDb();
  const col = db.collection('faqs');

  await createIndex(col, TEXT_SEARCH_INDEX);
  await createIndex(col, VECTOR_SEARCH_INDEX);

  console.log('\n[Indexes] Done!');
  console.log('\nManual index definitions for Atlas UI:');
  console.log('\n--- faq_text_search (Atlas Search) ---');
  console.log(JSON.stringify(TEXT_SEARCH_INDEX.definition, null, 2));
  console.log('\n--- faq_vector_index (Vector Search) ---');
  console.log(JSON.stringify(VECTOR_SEARCH_INDEX.definition, null, 2));

  await closeDb();
}

main().catch((err) => {
  console.error('[Indexes] Error:', err);
  process.exit(1);
});
