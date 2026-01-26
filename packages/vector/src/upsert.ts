import { getDb, insertVector, clearAllVectors } from '@repo/db';
import { getEmbeddings } from './embeddings';
import type { FaqItem } from '@repo/shared';

/**
 * FAQ 항목들의 임베딩을 생성하여 faq_vec 테이블에 삽입.
 * FTS5는 faq 테이블 INSERT 트리거로 자동 동기화됨.
 */
export async function upsertFaqItems(items: FaqItem[]): Promise<void> {
  console.log(`[Upsert] Generating embeddings for ${items.length} items...`);

  const questions = items.map((item) => item.question);
  const embeddings = await getEmbeddings(questions);

  console.log(`[Upsert] Inserting vectors into SQLite faq_vec...`);

  const db = getDb();
  const insertTransaction = db.transaction(() => {
    for (let i = 0; i < items.length; i++) {
      insertVector(items[i].id, new Float32Array(embeddings[i]));
    }
  });

  insertTransaction();
  console.log(`[Upsert] Inserted ${items.length} vectors. Complete!`);
}

/**
 * 단일 FAQ 벡터 업서트 (생성/수정 시)
 */
export async function upsertSingleFaqVector(faq: FaqItem): Promise<void> {
  const [embedding] = await getEmbeddings([faq.question]);
  const db = getDb();

  // 기존 벡터 삭제 후 재삽입 (vec0는 UPDATE 미지원)
  db.prepare(`DELETE FROM faq_vec WHERE rowid = ?`).run(BigInt(faq.id));
  insertVector(faq.id, new Float32Array(embedding));
}
