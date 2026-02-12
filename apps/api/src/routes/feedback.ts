import { Elysia, t } from 'elysia';
import { logAnalyticsEvent } from '@repo/db';

/**
 * 피드백 API 라우트
 * 사용자가 답변에 대해 👍/👎 피드백을 제출할 때 사용
 */
export const feedbackRoutes = new Elysia({ prefix: '/api/feedback' }).post(
  '/',
  async ({ body }) => {
    const { messageId, sessionId, type, faqId } = body;

    const eventType = type === 'positive' ? 'feedback_positive' : 'feedback_negative';

    await logAnalyticsEvent({
      eventType,
      sessionId,
      metadata: {
        messageId,
        faqId,
      },
    });

    return { success: true };
  },
  {
    body: t.Object({
      messageId: t.String(),
      sessionId: t.String(),
      type: t.Union([t.Literal('positive'), t.Literal('negative')]),
      faqId: t.Optional(t.Number()),
    }),
  }
);
