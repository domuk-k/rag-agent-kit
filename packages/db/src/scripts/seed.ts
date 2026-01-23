/**
 * FAQ Database Seed Script
 *
 * JSON 파일에서 FAQ 데이터를 읽어 SQLite에 저장하고,
 * Qdrant에 벡터 인덱싱합니다.
 *
 * Usage: bun run seed (from project root)
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { clearAllFaqs, bulkInsertFaqs, getAllFaqs, getDb, closeDb } from '../index';
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

  // 2. Initialize DB and clear existing data
  getDb();
  const cleared = clearAllFaqs();
  console.log(`[Seed] Cleared ${cleared} existing FAQs from SQLite`);

  // 3. Insert into SQLite
  const inserted = bulkInsertFaqs(faqData);
  console.log(`[Seed] Inserted ${inserted} FAQs into SQLite`);

  // 4. Read back with IDs and index to Qdrant
  const faqs = getAllFaqs();
  console.log(`[Seed] Indexing ${faqs.length} FAQs to Qdrant...\n`);
  await upsertFaqItems(faqs);

  // 5. Cleanup
  closeDb();
  console.log('\n[Seed] Complete!');
}

main().catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
