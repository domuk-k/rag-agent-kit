import { getDb, deleteVector, clearAllVectors } from '@repo/db';

/**
 * Delete a FAQ item's vector by its ID.
 * Note: faq 테이블 DELETE 트리거가 faq_vec도 자동 삭제하므로,
 * faq 테이블에서 먼저 삭제할 경우 이 함수는 별도로 호출할 필요 없음.
 */
export async function deleteFaqFromVector(faqId: number): Promise<boolean> {
  try {
    deleteVector(faqId);
    console.log(`[Vector] Deleted FAQ ${faqId} vector`);
    return true;
  } catch (error) {
    console.error(`[Vector] Failed to delete FAQ ${faqId}:`, error);
    return false;
  }
}

/**
 * Delete multiple FAQ vectors
 */
export async function deleteFaqsFromVector(faqIds: number[]): Promise<number> {
  try {
    const db = getDb();
    const deleteStmt = db.prepare(`DELETE FROM faq_vec WHERE rowid = ?`);
    const deleteAll = db.transaction((ids: number[]) => {
      for (const id of ids) {
        deleteStmt.run(BigInt(id));
      }
    });
    deleteAll(faqIds);
    console.log(`[Vector] Deleted ${faqIds.length} FAQ vectors`);
    return faqIds.length;
  } catch (error) {
    console.error(`[Vector] Failed to delete FAQs:`, error);
    return 0;
  }
}

/**
 * Reset all vectors
 */
export async function resetCollection(): Promise<void> {
  clearAllVectors();
  console.log(`[Vector] All vectors cleared`);
}
