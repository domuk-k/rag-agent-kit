import { Elysia, t } from 'elysia';
import {
  getPopularQuestions,
  getDailyUsage,
  getCategoryBreakdown,
  getGuardRejections,
} from '@repo/db';

export const analyticsRoutes = new Elysia({ prefix: '/api/analytics' })
  // 인기 질문 조회
  .get(
    '/popular-questions',
    async ({ query }) => {
      const limit = query.limit ? parseInt(query.limit) : 10;
      const days = query.days ? parseInt(query.days) : 7;
      return getPopularQuestions(limit, days);
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        days: t.Optional(t.String()),
      }),
    }
  )
  // 일별 사용량 조회
  .get(
    '/daily-usage',
    async ({ query }) => {
      const days = query.days ? parseInt(query.days) : 30;
      return getDailyUsage(days);
    },
    {
      query: t.Object({
        days: t.Optional(t.String()),
      }),
    }
  )
  // 카테고리별 접근 통계
  .get(
    '/category-breakdown',
    async ({ query }) => {
      const days = query.days ? parseInt(query.days) : 7;
      return getCategoryBreakdown(days);
    },
    {
      query: t.Object({
        days: t.Optional(t.String()),
      }),
    }
  )
  // Guard 거부 목록
  .get(
    '/guard-rejections',
    async ({ query }) => {
      const days = query.days ? parseInt(query.days) : 7;
      return getGuardRejections(days);
    },
    {
      query: t.Object({
        days: t.Optional(t.String()),
      }),
    }
  );
