import { Elysia } from 'elysia';
import { pingDb } from '@repo/db';
import { embedQuery } from '@repo/vector';

// 백그라운드 워밍업 — healthcheck와 무관하게 모델 프리로딩
let embeddingReady = false;
embedQuery('warmup').then(() => { embeddingReady = true; }).catch(() => {});

export const healthRoutes = new Elysia()
  .get('/health', async () => {
    const dbOk = await pingDb();
    return {
      status: dbOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'rag-agent-kit',
      db: dbOk ? 'connected' : 'disconnected',
      embedding: embeddingReady ? 'loaded' : 'loading',
    };
  })
  .get('/', () => ({
    message: 'RAG Agent Kit API',
    version: '0.3.0',
    endpoints: {
      health: 'GET /health',
      chat: 'POST /api/chat',
    },
  }));
