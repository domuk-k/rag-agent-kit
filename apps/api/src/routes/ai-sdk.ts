import { Elysia, t } from 'elysia';
import { chat } from '@repo/agents';

export const aiSdkRoutes = new Elysia({ prefix: '/api' }).post(
  '/chat',
  async function* ({ body, set }) {
    set.headers['content-type'] = 'text/plain; charset=utf-8';
    const { messages } = body;

    // Get last user message
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop();

    if (!lastUserMessage) {
      yield '사용자 메시지가 없습니다.';
      return;
    }

    console.log(`[Chat] User: "${lastUserMessage.content}"`);

    let currentStatus = '';

    try {
      const stream = chat(lastUserMessage.content, {
        onStatus: (status) => {
          currentStatus = status;
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
);
