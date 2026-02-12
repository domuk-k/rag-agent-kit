import { createApp } from './app';
import { closeDb } from '@repo/db';

const app = createApp().listen(process.env.PORT || 8080);

// ECS Fargate: SIGTERM → 30초 대기 → SIGKILL
const shutdown = async () => {
  console.log('[Server] Shutting down...');
  app.stop();
  await closeDb();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log(`
╔═══════════════════════════════════════════════════╗
║           RAG Agent Kit API Server                ║
╠═══════════════════════════════════════════════════╣
║  URL: http://localhost:${app.server?.port}                       ║
║                                                   ║
║  Chat (Multi-Agent):                              ║
║    POST /api/chat/stream  - SSE 채팅 (FAQ+주문조회)  ║
║    POST /api/session      - 세션 생성              ║
║    DEL  /api/session/:id  - 세션 삭제              ║
║                                                   ║
║  FAQ CRUD (POST/PUT/DEL requires Bearer token):   ║
║    GET  /api/faq          - FAQ 목록               ║
║    POST /api/faq          - FAQ 생성 🔒            ║
║    PUT  /api/faq/:id      - FAQ 수정 🔒            ║
║    DEL  /api/faq/:id      - FAQ 삭제 🔒            ║
║    POST /api/faq/bulk     - 일괄 등록 🔒           ║
║    POST /api/faq/reindex  - 재인덱싱 🔒            ║
║                                                   ║
║  Analytics:                                       ║
║    GET /api/analytics/popular-questions           ║
║    GET /api/analytics/daily-usage                 ║
║    GET /api/analytics/category-breakdown          ║
║    GET /api/analytics/guard-rejections            ║
╚═══════════════════════════════════════════════════╝
`);

// Re-export App type for Eden Treaty clients
export type { App } from './app';
