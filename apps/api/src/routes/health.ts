import { Elysia } from 'elysia';
import { pingDb } from '@repo/db';

export const healthRoutes = new Elysia()
  .get('/health', async () => {
    const dbOk = await pingDb();
    return {
      status: dbOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'rag-agent-kit',
      db: dbOk ? 'connected' : 'disconnected',
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
