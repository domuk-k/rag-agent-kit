import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { healthRoutes } from './routes/health';
import { aiSdkRoutes } from './routes/ai-sdk';
import { chatStreamRoutes } from './routes/chat-stream';
import { faqRoutes } from './routes/faq';
import { analyticsRoutes } from './routes/analytics';
import { feedbackRoutes } from './routes/feedback';

/**
 * Elysia 앱 빌더 (타입 추출용)
 * Eden Treaty 클라이언트에서 이 타입을 사용합니다.
 */
export const createApp = () =>
  new Elysia()
    .use(
      cors({
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      })
    )
    .use(healthRoutes)
    .use(aiSdkRoutes)
    .use(chatStreamRoutes)
    .use(faqRoutes)
    .use(analyticsRoutes)
    .use(feedbackRoutes);

/** API 앱 타입 (Eden Treaty 클라이언트용) */
export type App = ReturnType<typeof createApp>;
