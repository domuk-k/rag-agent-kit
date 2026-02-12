/**
 * FAQ Database Seed Script
 *
 * JSON 파일에서 FAQ 데이터를 읽어 MongoDB에 저장합니다.
 *
 * Usage: bun run seed (from project root)
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import {
  resetForSeed,
  bulkInsertFaqs,
  getDb,
  closeDb,
  getFaqCount,
} from '../index';
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

  // 1. Ensure MongoDB connection
  await getDb();

  // 2. Load FAQ data from JSON
  const faqData = await loadFaqJson();

  // 3. Reset DB (clear all FAQs + reset counter)
  const cleared = await resetForSeed();
  console.log(`[Seed] Cleared ${cleared} existing FAQs from MongoDB`);

  // 4. Insert into MongoDB
  const inserted = await bulkInsertFaqs(faqData);
  console.log(`[Seed] Inserted ${inserted} FAQs into MongoDB`);

  // 5. Verify
  console.log(`\n[Seed] Verification:`);
  console.log(`  FAQ count: ${await getFaqCount()}`);

  // 6. Cleanup
  await closeDb();
  console.log('\n[Seed] Complete!');
}

main().catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
