/**
 * FAQ Database Seed Script
 *
 * JSON 파일에서 FAQ 데이터를 읽어 MongoDB에 저장하고,
 * Transformers.js로 임베딩을 생성합니다.
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
import { embedDocuments } from '@repo/vector';
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
  const db = await getDb();

  // 2. Load FAQ data from JSON
  const faqData = await loadFaqJson();

  // 3. Reset DB (clear all FAQs + reset counter)
  const cleared = await resetForSeed();
  console.log(`[Seed] Cleared ${cleared} existing FAQs from MongoDB`);

  // 4. Insert into MongoDB
  const inserted = await bulkInsertFaqs(faqData);
  console.log(`[Seed] Inserted ${inserted} FAQs into MongoDB`);

  // 5. Generate embeddings
  console.log(`\n[Seed] Generating embeddings (${faqData.length} questions)...`);
  const questions = faqData.map((f) => f.question);
  const start = Date.now();
  const embeddings = await embedDocuments(questions);
  console.log(`[Seed] Embeddings generated in ${Date.now() - start}ms (${embeddings[0].length}dim)`);

  // 6. Update MongoDB with embeddings
  const col = db.collection('faqs');
  const bulkOps = faqData.map((_, i) => ({
    updateOne: {
      filter: { id: i + 1 },
      update: { $set: { embedding: embeddings[i] } },
    },
  }));
  const bulkResult = await col.bulkWrite(bulkOps);
  console.log(`[Seed] Updated ${bulkResult.modifiedCount} FAQs with embeddings`);

  // 7. Verify
  console.log(`\n[Seed] Verification:`);
  console.log(`  FAQ count: ${await getFaqCount()}`);
  const sample = await col.findOne({ id: 1 }, { projection: { embedding: 1 } });
  console.log(`  Embedding dimensions: ${sample?.embedding?.length ?? 'N/A'}`);

  // 8. Cleanup
  await closeDb();
  console.log('\n[Seed] Complete!');
}

main().catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
