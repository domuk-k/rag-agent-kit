/**
 * Eden Treaty 클라이언트 사용 예제
 *
 * 실행: bun run packages/protocol/src/eden/example.ts
 *
 * 주의: API 서버가 실행 중이어야 합니다.
 * bun run --cwd apps/api dev
 */

import { createClient, consumeSSE } from './index';
import type { SSEEvent } from '@repo/shared';

const API_URL = process.env.API_URL ?? 'http://localhost:3333';

async function main() {
  console.log('=== Eden Treaty Client Example ===\n');
  console.log(`API URL: ${API_URL}\n`);

  const client = createClient(API_URL);

  // 1. 헬스 체크
  console.log('1. Health Check');
  const health = await client.health.get();
  console.log('   Status:', health.data);
  console.log();

  // 2. 세션 생성
  console.log('2. Create Session');
  const session = await client.api.session.post();
  const sessionId = (session.data as { sessionId: string }).sessionId;
  console.log('   Session ID:', sessionId);
  console.log();

  // 3. SSE 채팅 (Eden은 SSE 직접 지원하지 않으므로 fetch 사용)
  console.log('3. Chat with SSE Stream');
  console.log('   Question: 정산은 언제 되나요?\n');

  const response = await fetch(`${API_URL}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: '정산은 언제 되나요?' }],
      sessionId,
    }),
  });

  let answer = '';
  console.log('   Response:');
  process.stdout.write('   ');

  for await (const event of consumeSSE(response)) {
    const sseEvent = event.data as SSEEvent;

    if (sseEvent.type === 'text') {
      process.stdout.write(sseEvent.content);
      answer += sseEvent.content;
    } else if (sseEvent.type === 'status' && sseEvent.level === 'loading') {
      // Skip loading status
    } else if (sseEvent.type === 'faq') {
      console.log(`\n   [FAQ 검색 결과: ${sseEvent.results.length}개]`);
    }
  }

  console.log('\n');

  // 4. 후속 질문 (세션 컨텍스트)
  console.log('4. Follow-up Question (Multi-turn)');
  console.log('   Question: 수수료는 얼마인가요?\n');

  const response2 = await fetch(`${API_URL}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: '수수료는 얼마인가요?' }],
      sessionId, // Same session
    }),
  });

  console.log('   Response:');
  process.stdout.write('   ');

  for await (const event of consumeSSE(response2)) {
    const sseEvent = event.data as SSEEvent;
    if (sseEvent.type === 'text') {
      process.stdout.write(sseEvent.content);
    }
  }

  console.log('\n');

  // 5. 세션 삭제
  console.log('5. Delete Session');
  const deleted = await client.api.session({ sessionId }).delete();
  console.log('   Deleted:', deleted.data);

  console.log('\n=== Done ===');
}

main().catch(console.error);
