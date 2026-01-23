import { Elysia, t } from 'elysia';
import { bearer } from '@elysiajs/bearer';
import {
  getAllFaqs,
  getFaqById,
  getFaqsByCategory,
  createFaq,
  updateFaq,
  deleteFaq,
  getCategories,
  getFaqCount,
  bulkInsertFaqs,
  logAnalyticsEvent,
} from '@repo/db';
import { upsertFaqItems, deleteFaqFromVector, resetCollection } from '@repo/vector';

// Admin 인증 체크 - Elysia context의 set 객체 타입 호환
function checkAdminAuth(
  bearerToken: string | undefined,
  set: { status?: number | string; headers: Record<string, string | number | undefined> }
): { error: string } | null {
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    console.error('[AdminAuth] ADMIN_TOKEN not configured');
    set.status = 500;
    return { error: 'Server configuration error' };
  }

  if (!bearerToken || bearerToken !== adminToken) {
    set.status = 401;
    set.headers['WWW-Authenticate'] = 'Bearer realm="admin"';
    return { error: 'Authentication required' };
  }

  return null; // 인증 성공
}

export const faqRoutes = new Elysia({ prefix: '/api/faq' })
  .use(bearer())

  // ============================================
  // Public Routes (인증 불필요)
  // ============================================

  // GET /api/faq - 전체 FAQ 목록
  .get(
    '/',
    ({ query }) => {
      const { category } = query;
      if (category) {
        return getFaqsByCategory(category);
      }
      return getAllFaqs();
    },
    {
      query: t.Object({
        category: t.Optional(t.String()),
      }),
    }
  )

  // GET /api/faq/categories - 카테고리 목록
  .get('/categories', () => {
    return getCategories();
  })

  // GET /api/faq/count - FAQ 개수
  .get('/count', () => {
    return { count: getFaqCount() };
  })

  // GET /api/faq/:id - 단일 FAQ 조회
  .get(
    '/:id',
    ({ params, set }) => {
      const faq = getFaqById(Number(params.id));
      if (!faq) {
        set.status = 404;
        return { error: 'FAQ not found' };
      }
      return faq;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )

  // ============================================
  // Protected Routes (Admin 인증 필요)
  // ============================================

  // POST /api/faq - FAQ 생성
  .post(
    '/',
    async ({ bearer, body, set }) => {
      const authError = checkAdminAuth(bearer, set);
      if (authError) return authError;

      const faq = createFaq(body);
      console.log(`[FAQ] Created: ${faq.id} - ${faq.question}`);

      // Qdrant에 벡터 추가
      try {
        await upsertFaqItems([faq]);
        console.log(`[FAQ] Vector indexed: ${faq.id}`);
      } catch (error) {
        console.error(`[FAQ] Vector indexing failed:`, error);
      }

      // Analytics 이벤트 기록
      logAnalyticsEvent({
        eventType: 'faq_created',
        metadata: { faqId: faq.id, category: faq.category },
      });

      set.status = 201;
      return faq;
    },
    {
      body: t.Object({
        category: t.String(),
        subcategory: t.Optional(t.String()),
        question: t.String(),
        answer: t.String(),
      }),
    }
  )

  // PUT /api/faq/:id - FAQ 수정
  .put(
    '/:id',
    async ({ bearer, params, body, set }) => {
      const authError = checkAdminAuth(bearer, set);
      if (authError) return authError;

      const faq = updateFaq(Number(params.id), body);
      if (!faq) {
        set.status = 404;
        return { error: 'FAQ not found' };
      }
      console.log(`[FAQ] Updated: ${faq.id} - ${faq.question}`);

      // Qdrant 벡터 업데이트
      try {
        await upsertFaqItems([faq]);
        console.log(`[FAQ] Vector updated: ${faq.id}`);
      } catch (error) {
        console.error(`[FAQ] Vector update failed:`, error);
      }

      // Analytics 이벤트 기록
      logAnalyticsEvent({
        eventType: 'faq_updated',
        metadata: { faqId: faq.id, category: faq.category },
      });

      return faq;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        category: t.Optional(t.String()),
        subcategory: t.Optional(t.String()),
        question: t.Optional(t.String()),
        answer: t.Optional(t.String()),
      }),
    }
  )

  // DELETE /api/faq/:id - FAQ 삭제
  .delete(
    '/:id',
    async ({ bearer, params, set }) => {
      const authError = checkAdminAuth(bearer, set);
      if (authError) return authError;

      const id = Number(params.id);
      const deleted = deleteFaq(id);

      if (!deleted) {
        set.status = 404;
        return { error: 'FAQ not found' };
      }
      console.log(`[FAQ] Deleted: ${id}`);

      // Qdrant에서 벡터 삭제
      try {
        await deleteFaqFromVector(id);
        console.log(`[FAQ] Vector deleted: ${id}`);
      } catch (error) {
        console.error(`[FAQ] Vector deletion failed:`, error);
      }

      // Analytics 이벤트 기록
      logAnalyticsEvent({
        eventType: 'faq_deleted',
        metadata: { faqId: id },
      });

      return { success: true, id };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )

  // POST /api/faq/reindex - 전체 재인덱싱
  .post('/reindex', async ({ bearer, set }) => {
    const authError = checkAdminAuth(bearer, set);
    if (authError) return authError;

    const faqs = getAllFaqs();
    if (faqs.length === 0) {
      set.status = 400;
      return { error: 'No FAQs to index' };
    }

    console.log(`[FAQ] Reindexing ${faqs.length} items...`);
    await upsertFaqItems(faqs);
    console.log(`[FAQ] Reindex complete`);

    return { success: true, count: faqs.length };
  })

  // POST /api/faq/reset - 컬렉션 리셋 후 재인덱싱
  .post('/reset', async ({ bearer, set }) => {
    const authError = checkAdminAuth(bearer, set);
    if (authError) return authError;

    const faqs = getAllFaqs();
    if (faqs.length === 0) {
      set.status = 400;
      return { error: 'No FAQs to index' };
    }

    console.log(`[FAQ] Resetting collection and reindexing ${faqs.length} items...`);
    await resetCollection();
    await upsertFaqItems(faqs);
    console.log(`[FAQ] Reset and reindex complete`);

    return { success: true, count: faqs.length };
  })

  // POST /api/faq/bulk - FAQ 일괄 등록
  .post(
    '/bulk',
    async ({ bearer, body, set }) => {
      const authError = checkAdminAuth(bearer, set);
      if (authError) return authError;

      const { items } = body;

      if (!items || items.length === 0) {
        set.status = 400;
        return { error: 'No items provided' };
      }

      console.log(`[FAQ] Bulk importing ${items.length} items...`);

      // DB에 일괄 삽입
      const insertedCount = bulkInsertFaqs(items);

      // 새로 추가된 FAQ들 가져와서 벡터 인덱싱
      const allFaqs = getAllFaqs();
      const newFaqs = allFaqs.slice(-insertedCount);

      try {
        await upsertFaqItems(newFaqs);
        console.log(`[FAQ] Bulk indexed ${insertedCount} items to Qdrant`);
      } catch (error) {
        console.error(`[FAQ] Bulk indexing failed:`, error);
      }

      // Analytics 이벤트 기록
      logAnalyticsEvent({
        eventType: 'faq_created',
        metadata: { bulkCount: insertedCount },
      });

      set.status = 201;
      return { success: true, count: insertedCount };
    },
    {
      body: t.Object({
        items: t.Array(
          t.Object({
            category: t.String(),
            subcategory: t.Optional(t.String()),
            question: t.String(),
            answer: t.String(),
          })
        ),
      }),
    }
  );
