import { upsertFaqItems } from '../upsert';
import { getAllFaqs } from '@repo/db';

/**
 * faq 테이블의 기존 데이터를 벡터로 변환하여 faq_vec에 삽입.
 * faq 테이블 시딩은 packages/db/src/scripts/seed.ts 에서 수행.
 */
async function main() {
  const faqs = getAllFaqs();

  if (faqs.length === 0) {
    console.log('[Seed] No FAQs found in database. Run DB seed first.');
    return;
  }

  console.log(`[Seed] Vectorizing ${faqs.length} FAQs...`);
  await upsertFaqItems(faqs);
  console.log(`[Seed] Complete!`);
}

main().catch(console.error);
