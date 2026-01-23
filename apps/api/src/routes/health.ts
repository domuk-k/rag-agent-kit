import { Elysia } from 'elysia';

export const healthRoutes = new Elysia()
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'rag-agent-kit',
  }))
  .get('/', () => ({
    message: 'RAG Agent Kit API',
    version: '0.1.0',
    endpoints: {
      health: 'GET /health',
      chat: 'POST /api/chat',
    },
  }));
