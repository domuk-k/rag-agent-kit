import { Elysia, t } from 'elysia';
import { formatSSE, generateSessionId, type SSEEvent, type ChatMessage } from '@repo/shared';
import { chatWithEvents, type ChatEvent } from '@repo/agents';
import {
  createSession,
  getSession,
  deleteSession,
  cleanupSessions,
  addMessage,
  getSessionMessages,
} from '@repo/db';

// 30분마다 만료된 세션 정리 (1시간 이상 미사용)
const CLEANUP_INTERVAL = 30 * 60 * 1000;
const SESSION_MAX_AGE = 60 * 60 * 1000;
setInterval(() => {
  const count = cleanupSessions(SESSION_MAX_AGE);
  if (count > 0) console.log(`[Session] Cleaned up ${count} expired sessions`);
}, CLEANUP_INTERVAL);

export const chatStreamRoutes = new Elysia({ prefix: '/api' })
  // 세션 생성 엔드포인트
  .post('/session', () => {
    const sessionId = generateSessionId();
    const session = createSession(sessionId);
    console.log(`[Session] Created: ${session.id}`);
    return { sessionId: session.id };
  })
  // 세션 삭제 엔드포인트
  .delete('/session/:sessionId', ({ params }) => {
    const deleted = deleteSession(params.sessionId);
    console.log(`[Session] Deleted: ${params.sessionId} (${deleted})`);
    return { success: deleted };
  })
  // SSE 채팅 엔드포인트
  .post(
    '/chat/stream',
    async ({ body, set }) => {
      set.headers['content-type'] = 'text/event-stream';
      set.headers['cache-control'] = 'no-cache';
      set.headers['connection'] = 'keep-alive';

      const { messages, sessionId: inputSessionId } = body;
      const lastUserMessage = messages.filter((m) => m.role === 'user').pop();

      if (!lastUserMessage) {
        const errorEvent: SSEEvent = {
          type: 'error',
          message: '사용자 메시지가 없습니다.',
          code: 'NO_USER_MESSAGE',
        };
        return new Response(formatSSE(errorEvent), {
          headers: { 'content-type': 'text/event-stream' },
        });
      }

      // 세션 관리
      const sessionId = inputSessionId ?? generateSessionId();
      let session = getSession(sessionId);
      if (!session) {
        session = createSession(sessionId);
      }

      // 사용자 메시지 저장
      const userMessage: ChatMessage = {
        role: 'user',
        content: lastUserMessage.content,
        timestamp: Date.now(),
      };
      addMessage(sessionId, userMessage);

      // 대화 히스토리 (최근 10턴)
      const history = getSessionMessages(sessionId, 20);

      console.log(
        `[ChatStream] Session: ${sessionId}, History: ${history.length} messages, User: "${lastUserMessage.content}"`
      );

      const encoder = new TextEncoder();
      let assistantResponse = '';

      const stream = new ReadableStream({
        async start(controller) {
          let closed = false;

          const send = (event: SSEEvent) => {
            if (closed) return;
            try {
              controller.enqueue(encoder.encode(formatSSE(event)));
            } catch {
              closed = true;
            }
          };

          // 세션 ID 전송 (클라이언트가 저장할 수 있도록)
          send({ type: 'status', status: `session:${sessionId}`, level: 'info' });

          try {
            const eventStream = chatWithEvents(lastUserMessage.content, {
              history: history.slice(0, -1), // 현재 메시지 제외
            });

            for await (const event of eventStream) {
              if (closed) break;
              send(mapChatEventToSSE(event));

              // 응답 텍스트 수집 (세션 저장용)
              if (event.type === 'text') {
                assistantResponse += event.content;
              }
            }

            // 어시스턴트 응답 저장
            if (assistantResponse) {
              const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: assistantResponse,
                timestamp: Date.now(),
              };
              addMessage(sessionId, assistantMessage);
            }

            send({ type: 'done' });
          } catch (error) {
            if (!closed) {
              console.error('[ChatStream] Error:', error);
              send({
                type: 'error',
                message: error instanceof Error ? error.message : '알 수 없는 오류',
                code: 'INTERNAL_ERROR',
              });
            }
          } finally {
            if (!closed) {
              try {
                controller.close();
              } catch {
                // Already closed
              }
            }
          }
        },
      });

      return new Response(stream, {
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          'connection': 'keep-alive',
        },
      });
    },
    {
      body: t.Object({
        messages: t.Array(
          t.Object({
            role: t.Union([t.Literal('user'), t.Literal('assistant'), t.Literal('system')]),
            content: t.String(),
          })
        ),
        sessionId: t.Optional(t.String()),
      }),
    }
  );

function mapChatEventToSSE(event: ChatEvent): SSEEvent {
  switch (event.type) {
    case 'text':
      return { type: 'text', content: event.content };
    case 'status':
      return { type: 'status', status: event.status, level: event.level };
    case 'faq':
      return { type: 'faq', results: event.results };
    case 'action':
      return { type: 'action', actions: event.actions };
    case 'source':
      return { type: 'source', sources: event.sources };
    default:
      return { type: 'text', content: '' };
  }
}
