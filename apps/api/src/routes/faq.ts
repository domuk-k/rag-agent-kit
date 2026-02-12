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
    async ({ query }) => {
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
  .get('/categories', async () => {
    return getCategories();
  })

  // GET /api/faq/count - FAQ 개수
  .get('/count', async () => {
    return { count: await getFaqCount() };
  })

  // GET /api/faq/:id - 단일 FAQ 조회
  .get(
    '/:id',
    async ({ params, set }) => {
      const faq = await getFaqById(Number(params.id));
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

      const faq = await createFaq(body);
      console.log(`[FAQ] Created: ${faq.id} - ${faq.question}`);

      await logAnalyticsEvent({
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

      const faq = await updateFaq(Number(params.id), body);
      if (!faq) {
        set.status = 404;
        return { error: 'FAQ not found' };
      }
      console.log(`[FAQ] Updated: ${faq.id} - ${faq.question}`);

      await logAnalyticsEvent({
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
      const deleted = await deleteFaq(id);

      if (!deleted) {
        set.status = 404;
        return { error: 'FAQ not found' };
      }
      console.log(`[FAQ] Deleted: ${id}`);

      await logAnalyticsEvent({
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
      const insertedCount = await bulkInsertFaqs(items);

      await logAnalyticsEvent({
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
