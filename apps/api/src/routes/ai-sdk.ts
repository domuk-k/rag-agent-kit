import { Elysia, t } from 'elysia';
import { chat, chatWithEvents } from '@repo/agents';
import {
  createSession,
  getSession,
  addMessage,
  getSessionMessages,
} from '@repo/db';
import { generateSessionId, type ChatMessage } from '@repo/shared';

/**
 * AI SDK Data Stream Protocol helpers
 * @see https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol
 */
function formatTextPart(text: string): string {
  return `0:${JSON.stringify(text)}\n`;
}

function formatDataPart(data: unknown[]): string {
  return `2:${JSON.stringify(data)}\n`;
}

function formatMessageAnnotationPart(annotation: unknown): string {
  return `8:${JSON.stringify(annotation)}\n`;
}

function formatFinishPart(): string {
  return `d:{"finishReason":"stop"}\n`;
}

export const aiSdkRoutes = new Elysia({ prefix: '/api' })
  // 기존 단순 텍스트 스트리밍 (useChat 기본 호환)
  .post(
    '/chat',
    async function* ({ body, set }) {
      set.headers['content-type'] = 'text/plain; charset=utf-8';
      const { messages } = body;

      const lastUserMessage = messages.filter((m) => m.role === 'user').pop();

      if (!lastUserMessage) {
        yield '사용자 메시지가 없습니다.';
        return;
      }

      console.log(`[Chat] User: "${lastUserMessage.content}"`);

      try {
        const stream = chat(lastUserMessage.content, {
          onStatus: (status) => {
            console.log(`[Status] ${status}`);
          },
        });

        let responseLength = 0;
        for await (const token of stream) {
          responseLength += token.length;
          yield token;
        }

        console.log(`[Chat] Response length: ${responseLength}`);
      } catch (error) {
        console.error('[Chat] Error:', error);

        yield error instanceof Error
          ? `오류가 발생했습니다: ${error.message}`
          : '알 수 없는 오류가 발생했습니다.';
      }
    },
    {
      body: t.Object({
        messages: t.Array(
          t.Object({
            role: t.Union([t.Literal('user'), t.Literal('assistant'), t.Literal('system')]),
            content: t.String(),
          })
        ),
      }),
    }
  )
  // AI SDK Data Stream Protocol (소스 카드, HITL 등 메타데이터 지원)
  .post(
    '/chat/ai-sdk',
    async ({ body }) => {
      const { messages, sessionId: inputSessionId } = body;
      const lastUserMessage = messages.filter((m) => m.role === 'user').pop();

      if (!lastUserMessage) {
        return new Response(formatTextPart('사용자 메시지가 없습니다.'), {
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        });
      }

      // 세션 관리: 없으면 생성
      const sessionId = inputSessionId ?? generateSessionId();
      if (!getSession(sessionId)) {
        createSession(sessionId);
      }

      // 사용자 메시지 저장
      const userMessage: ChatMessage = {
        role: 'user',
        content: lastUserMessage.content,
        timestamp: Date.now(),
      };
      addMessage(sessionId, userMessage);

      // 대화 히스토리
      const history = getSessionMessages(sessionId, 20);

      console.log(
        `[AI-SDK] Session: ${sessionId}, History: ${history.length}, User: "${lastUserMessage.content}"`
      );

      const encoder = new TextEncoder();
      let assistantResponse = '';

      const stream = new ReadableStream({
        async start(controller) {
          let closed = false;

          const send = (data: string) => {
            if (closed) return;
            try {
              controller.enqueue(encoder.encode(data));
            } catch {
              closed = true;
            }
          };

          // 세션 ID를 데이터로 전송
          send(formatDataPart([{ type: 'session', sessionId }]));

          try {
            // history.slice(0, -1): 방금 저장한 현재 메시지 제외 (이미 userMessage로 전달)
            const eventStream = chatWithEvents(lastUserMessage.content, {
              history: history.slice(0, -1),
            });

            for await (const event of eventStream) {
              if (closed) break;

              switch (event.type) {
                case 'text':
                  assistantResponse += event.content;
                  send(formatTextPart(event.content));
                  break;

                case 'source':
                  // 8: message annotation → message.annotations에 저장
                  send(formatMessageAnnotationPart({ type: 'source', sources: event.sources }));
                  break;

                case 'action':
                  send(formatMessageAnnotationPart({ type: 'action', actions: event.actions }));
                  break;

                case 'faq':
                  // FAQ 검색 결과 전체 전송 (유사도, 답변 포함)
                  send(formatMessageAnnotationPart({
                    type: 'faq',
                    results: event.results.slice(0, 5).map((r) => ({
                      id: r.id,
                      question: r.question,
                      answer: r.answer,
                      category: r.category,
                      similarity: r.similarity,
                    })),
                  }));
                  break;

                case 'status':
                  send(formatDataPart([{ type: 'status', status: event.status }]));
                  break;
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

            send(formatFinishPart());
          } catch (error) {
            if (!closed) {
              console.error('[AI-SDK] Error:', error);
              send(formatTextPart(
                error instanceof Error
                  ? `오류가 발생했습니다: ${error.message}`
                  : '알 수 없는 오류가 발생했습니다.'
              ));
              send(formatFinishPart());
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
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-cache',
          'x-vercel-ai-data-stream': 'v1',
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
