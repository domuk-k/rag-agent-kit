import { Elysia } from 'elysia';
import { pingDb } from '@repo/db';
import { embedQuery } from '@repo/vector';

// 서버 시작 시 백그라운드 워밍업 (Docker 캐시 있으면 ~2초)
let embeddingReady = false;
embedQuery('warmup').then(() => { embeddingReady = true; }).catch(() => {});

export const healthRoutes = new Elysia()
  .get('/health', async () => {
    const dbOk = await pingDb();
    return {
      status: dbOk && embeddingReady ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'rag-agent-kit',
      db: dbOk ? 'connected' : 'disconnected',
      embedding: embeddingReady ? 'loaded' : 'loading',
    };
  })
  .get('/', () => ({
    message: 'RAG Agent Kit API',
    version: '0.2.0',
    endpoints: {
      health: 'GET /health',
      chat: 'POST /api/chat',
    },
  }));
