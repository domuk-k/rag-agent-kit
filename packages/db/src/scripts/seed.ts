/**
 * FAQ Database Seed Script
 *
 * JSON 파일에서 FAQ 데이터를 읽어 SQLite에 저장하고,
 * FTS5 인덱스와 sqlite-vec 벡터를 생성합니다.
 *
 * Usage: bun run seed (from project root)
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import {
  resetForSeed,
  bulkInsertFaqs,
  getAllFaqs,
  getDb,
  closeDb,
  rebuildFtsIndex,
  getVectorCount,
  getFaqCount,
} from '../index';
import { upsertFaqItems } from '@repo/vector';
import type { FaqItem } from '@repo/shared';

async function loadFaqJson(): Promise<Omit<FaqItem, 'id'>[]> {
  const possiblePaths = [
    join(process.cwd(), 'data', 'faq.json'),
    join(process.cwd(), '..', '..', 'data', 'faq.json'),
  ];

  for (const p of possiblePaths) {
    try {
      const content = await readFile(p, 'utf-8');
      const rawData = JSON.parse(content);
      console.log(`[Seed] Loaded ${rawData.length} items from ${p}`);
      return rawData.map((item: any) => ({
        category: item.category,
        subcategory: item.subcategory ?? null,
        question: item.question,
        answer: item.answer,
      }));
    } catch {
      continue;
    }
  }

  throw new Error('faq.json not found');
}

async function main() {
  console.log('[Seed] Starting FAQ database seed...\n');

  // 1. Load FAQ data from JSON
  const faqData = await loadFaqJson();

  // 2. Reset DB (drops FTS5/vec/triggers → clears faq → recreates schema)
  const cleared = resetForSeed();
  console.log(`[Seed] Cleared ${cleared} existing FAQs from SQLite`);

  // 3. Insert into SQLite (FTS5 auto-syncs via triggers)
  const inserted = bulkInsertFaqs(faqData);
  console.log(`[Seed] Inserted ${inserted} FAQs into SQLite`);

  // 4. Rebuild FTS5 index for safety
  rebuildFtsIndex();

  // 5. Generate embeddings and insert into faq_vec
  const faqs = getAllFaqs();
  console.log(`[Seed] Generating embeddings for ${faqs.length} FAQs...\n`);
  await upsertFaqItems(faqs);

  // 7. Verify
  console.log(`\n[Seed] Verification:`);
  console.log(`  FAQ count: ${getFaqCount()}`);
  console.log(`  Vector count: ${getVectorCount()}`);

  // 8. Cleanup
  closeDb();
  console.log('\n[Seed] Complete!');
}

main().catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
