/**
 * Eden Treaty Client
 *
 * Elysia API와 타입 안전하게 통신하는 클라이언트입니다.
 * 서버의 App 타입을 기반으로 자동 완성과 타입 검사를 제공합니다.
 *
 * @example
 * ```typescript
 * import { createClient } from '@repo/protocol/eden';
 *
 * const client = createClient('http://localhost:3333');
 *
 * // 타입 안전한 API 호출
 * const { data } = await client.api.session.post();
 * console.log(data.sessionId);
 *
 * // 헬스 체크
 * const health = await client.health.get();
 * ```
 */

import { treaty } from '@elysiajs/eden';
import type { App } from '@repo/api/app';

/** Eden Treaty 클라이언트 생성 */
export function createClient(baseUrl: string) {
  return treaty<App>(baseUrl);
}

/** 클라이언트 타입 */
export type Client = ReturnType<typeof createClient>;

/**
 * SSE 스트림을 소비하는 헬퍼 함수
 *
 * @example
 * ```typescript
 * const response = await fetch(`${baseUrl}/api/chat/stream`, {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ messages, sessionId }),
 * });
 *
 * for await (const event of consumeSSE(response)) {
 *   if (event.type === 'text') {
 *     process.stdout.write(event.data.content);
 *   }
 * }
 * ```
 */
export async function* consumeSSE(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    let currentEvent = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7);
      } else if (line.startsWith('data: ')) {
        const data = line.slice(6);
        try {
          yield { type: currentEvent, data: JSON.parse(data) };
        } catch {
          yield { type: currentEvent, data };
        }
      }
    }
  }
}
