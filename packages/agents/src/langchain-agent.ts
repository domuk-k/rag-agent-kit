import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import { z } from 'zod';
import { searchFaq } from '@repo/vector';
import type { FaqSearchResult } from '@repo/shared';

// Event emitter for progress status
export type StatusCallback = (status: string) => void;

// Structured chat events for SSE streaming
export type ChatEvent =
  | { type: 'text'; content: string }
  | { type: 'status'; status: string; level: 'info' | 'loading' | 'success' | 'error' }
  | { type: 'faq'; results: FaqSearchResult[] }
  | { type: 'action'; actions: { label: string; query: string }[] }
  | { type: 'source'; sources: { title: string; url?: string; category: string }[] };

// Define the check order status tool (Mock)
const createCheckOrderStatusTool = (onStatus?: StatusCallback) =>
  tool(
    async ({ orderId }) => {
      onStatus?.('주문 조회 중...');
      console.log(`[checkOrderStatus] OrderId: "${orderId}"`);

      // Mock data - 실제 구현시 DB 또는 외부 API 연동
      const mockOrders: Record<string, { status: string; items: string; date: string; shipping?: string }> = {
        '2024010001': {
          status: '배송완료',
          items: '상품A x 2, 상품B x 1',
          date: '2024-01-15',
          shipping: 'CJ대한통운 1234567890',
        },
        '2024010002': {
          status: '배송중',
          items: '상품C x 1',
          date: '2024-01-16',
          shipping: '한진택배 9876543210',
        },
        '2024010003': {
          status: '상품준비중',
          items: '상품D x 3',
          date: '2024-01-17',
        },
        '2024010004': {
          status: '주문취소',
          items: '상품E x 1',
          date: '2024-01-10',
        },
      };

      const order = mockOrders[orderId];
      if (!order) {
        return `주문번호 "${orderId}"를 찾을 수 없습니다. 주문번호를 다시 확인해주세요.`;
      }

      let result = `📦 주문번호: ${orderId}\n`;
      result += `📅 주문일: ${order.date}\n`;
      result += `📋 상품: ${order.items}\n`;
      result += `🚚 상태: ${order.status}`;
      if (order.shipping) {
        result += `\n🔍 운송장: ${order.shipping}`;
      }

      return result;
    },
    {
      name: 'check_order_status',
      description: '주문번호로 주문 상태를 조회합니다. 배송 상태, 주문 내역 확인에 사용하세요.',
      schema: z.object({
        orderId: z.string().describe('조회할 주문번호 (예: 2024010001)'),
      }),
    }
  );

// Define the search FAQ tool
const createSearchFaqTool = (onStatus?: StatusCallback) =>
  tool(
    async ({ query }) => {
      onStatus?.('FAQ 검색 중...');
      console.log(`[searchFaq] Query: "${query}"`);

      // Category filter is optional - vector search handles relevance
      const results = await searchFaq(query, {
        category: undefined, // Let vector search find best matches
        topK: 5,
        minScore: 0.3, // Lower threshold for more inclusive results
      });

      console.log(`[searchFaq] Found ${results.length} results`);

      if (results.length === 0) {
        return '관련 FAQ를 찾지 못했습니다.';
      }

      return results
        .map((r, i) => `[${i + 1}] Q: ${r.question}\nA: ${r.answer}`)
        .join('\n\n');
    },
    {
      name: 'search_faq',
      description:
        '스마트스토어 FAQ를 검색합니다. 상품관리, 정산, 배송, 주문관리, 고객응대, 프로모션 등 관련 질문에 사용하세요.',
      schema: z.object({
        query: z.string().describe('검색할 질문 또는 키워드 (자연어로 입력)'),
      }),
    }
  );

const SYSTEM_PROMPT = `당신은 네이버 스마트스토어 FAQ 챗봇입니다.

## 역할
- 스마트스토어 판매자의 질문에 친절하게 답변합니다.
- 적절한 도구를 사용하여 정보를 검색합니다.

## 사용 가능한 도구
1. **search_faq**: FAQ 데이터베이스를 검색합니다.
2. **check_order_status**: 주문번호로 주문 상태를 조회합니다.

## 규칙
1. 스마트스토어 관련 질문: search_faq 도구로 검색 후 답변
2. 주문 조회 요청: check_order_status 도구로 주문 상태 확인
3. FAQ 범위 밖 질문: 정중히 안내하고 도움 가능한 주제 제시
4. 항상 한국어로 응답
5. 검색 결과가 없으면 솔직히 모른다고 말하고 고객센터 안내

## 답변 가능 주제
- 상품 등록/수정/삭제
- 정산, 수수료, 입금
- 배송 설정, 송장
- 주문 관리, 취소, 환불
- 반품, 교환
- 주문 상태 조회 (주문번호 필요)`;

export interface ChatOptions {
  onStatus?: StatusCallback;
  onToken?: (token: string) => void;
}

// Guard threshold - questions below this score are considered out of scope
const GUARD_THRESHOLD = 0.25;

const GUARD_MESSAGE = `죄송합니다. 해당 질문은 스마트스토어 FAQ 범위를 벗어납니다.

저는 다음 주제에 대해 도움을 드릴 수 있어요:
• 상품 등록/수정/삭제
• 정산, 수수료, 입금
• 배송 설정, 송장 등록
• 주문 관리, 취소/환불
• 반품/교환 처리
• 고객 문의 응대
• 스토어 관리, 프로모션

위 주제에 대해 궁금한 점이 있으시면 질문해 주세요!`;

export async function* chat(
  userMessage: string,
  options: ChatOptions = {}
): AsyncGenerator<string, void, unknown> {
  const { onStatus, onToken } = options;

  onStatus?.('질문 분석 중...');

  // Guard Pre-filter: Check if question is in FAQ scope before calling LLM
  const preCheck = await searchFaq(userMessage, { topK: 1, minScore: 0 });
  const bestScore = preCheck[0]?.similarity ?? 0;

  console.log(`[Guard] Query: "${userMessage}", Best score: ${bestScore.toFixed(3)}`);

  if (bestScore < GUARD_THRESHOLD) {
    // Out of scope - return guard message without LLM call
    console.log(`[Guard] Below threshold (${GUARD_THRESHOLD}), returning guard message`);
    onStatus?.('완료');
    for (const char of GUARD_MESSAGE) {
      yield char;
      // Small delay for natural feel
      if (char === '\n') await new Promise((r) => setTimeout(r, 10));
    }
    return;
  }

  onStatus?.('모델 초기화 중...');

  const model = new ChatOpenAI({
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    configuration: {
      baseURL: process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1',
    },
    streaming: true,
  });

  const searchTool = createSearchFaqTool(onStatus);
  const orderTool = createCheckOrderStatusTool(onStatus);
  const modelWithTools = model.bindTools([searchTool, orderTool]);

  const messages: BaseMessage[] = [new SystemMessage(SYSTEM_PROMPT), new HumanMessage(userMessage)];

  onStatus?.('응답 생성 중...');

  // First call - may include tool calls
  const response = await modelWithTools.invoke(messages);

  // Check if tool calls are needed
  if (response.tool_calls && response.tool_calls.length > 0) {
    messages.push(response as BaseMessage);

    // Execute tool calls
    for (const toolCall of response.tool_calls) {
      let toolResult: string;
      if (toolCall.name === 'search_faq') {
        toolResult = await searchTool.invoke(toolCall.args);
      } else if (toolCall.name === 'check_order_status') {
        toolResult = await orderTool.invoke(toolCall.args);
      } else {
        toolResult = 'Unknown tool';
      }
      messages.push({
        role: 'tool',
        content: toolResult,
        tool_call_id: toolCall.id,
      } as any);
    }

    onStatus?.('답변 작성 중...');

    // Final response with tool results - stream it
    const finalStream = await model.stream(messages);

    for await (const chunk of finalStream) {
      const content = chunk.content;
      if (typeof content === 'string' && content) {
        onToken?.(content);
        yield content;
      }
    }
  } else {
    // No tool calls, stream directly
    const content = response.content;
    if (typeof content === 'string') {
      for (const char of content) {
        onToken?.(char);
        yield char;
      }
    }
  }

  onStatus?.('완료');
}

/** chatWithEvents 옵션 */
export interface ChatWithEventsOptions {
  /** 이전 대화 히스토리 */
  history?: { role: 'user' | 'assistant' | 'system'; content: string }[];
}

/**
 * Enhanced chat function that yields structured events for SSE streaming.
 * Includes FAQ results, status updates, and suggested actions.
 * Supports multi-turn conversation with history.
 */
export async function* chatWithEvents(
  userMessage: string,
  options: ChatWithEventsOptions = {}
): AsyncGenerator<ChatEvent, void, unknown> {
  const { history = [] } = options;

  yield { type: 'status', status: '질문 분석 중...', level: 'loading' };

  // Check if message contains order number pattern (skip guard for order queries)
  const orderPattern = /(?:주문|조회|배송|상태).*\d{8,}/i;
  const hasOrderNumber = orderPattern.test(userMessage) || /\d{10,}/.test(userMessage);

  if (hasOrderNumber) {
    console.log(`[Guard] Order number detected, skipping guard`);
  }

  // Guard Pre-filter (skip if order number detected)
  const preCheck = await searchFaq(userMessage, { topK: 1, minScore: 0 });
  const bestScore = preCheck[0]?.similarity ?? 0;

  console.log(`[Guard] Query: "${userMessage}", Best score: ${bestScore.toFixed(3)}`);

  if (bestScore < GUARD_THRESHOLD && !hasOrderNumber) {
    console.log(`[Guard] Below threshold (${GUARD_THRESHOLD}), returning guard message`);
    yield { type: 'status', status: 'FAQ 범위 확인', level: 'info' };
    yield { type: 'text', content: GUARD_MESSAGE };
    yield {
      type: 'action',
      actions: [
        { label: '정산 관련 질문', query: '정산은 언제 되나요?' },
        { label: '상품 등록 방법', query: '상품 등록은 어떻게 하나요?' },
        { label: '배송비 설정', query: '배송비는 어떻게 설정하나요?' },
      ],
    };
    yield { type: 'status', status: '완료', level: 'success' };
    return;
  }

  yield { type: 'status', status: '모델 초기화 중...', level: 'loading' };

  const model = new ChatOpenAI({
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    configuration: {
      baseURL: process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1',
    },
    streaming: true,
  });

  // Capture FAQ results from tool execution
  let faqResults: FaqSearchResult[] = [];

  const searchToolWithCapture = tool(
    async ({ query }) => {
      console.log(`[searchFaq] Query: "${query}"`);

      const results = await searchFaq(query, {
        category: undefined,
        topK: 5,
        minScore: 0.3,
      });

      console.log(`[searchFaq] Found ${results.length} results`);
      faqResults = results; // Capture for later emission

      if (results.length === 0) {
        return '관련 FAQ를 찾지 못했습니다.';
      }

      return results
        .map((r, i) => `[${i + 1}] Q: ${r.question}\nA: ${r.answer}`)
        .join('\n\n');
    },
    {
      name: 'search_faq',
      description:
        '스마트스토어 FAQ를 검색합니다. 상품관리, 정산, 배송, 주문관리, 고객응대, 프로모션 등 관련 질문에 사용하세요.',
      schema: z.object({
        query: z.string().describe('검색할 질문 또는 키워드 (자연어로 입력)'),
      }),
    }
  );

  const orderToolWithCapture = createCheckOrderStatusTool();

  const modelWithTools = model.bindTools([searchToolWithCapture, orderToolWithCapture]);

  // Build messages with history
  const messages: BaseMessage[] = [new SystemMessage(SYSTEM_PROMPT)];

  // Add conversation history
  for (const msg of history) {
    if (msg.role === 'user') {
      messages.push(new HumanMessage(msg.content));
    } else if (msg.role === 'assistant') {
      messages.push(new AIMessage(msg.content));
    }
    // system messages are ignored in history (only one system prompt)
  }

  // Add current user message
  messages.push(new HumanMessage(userMessage));

  if (history.length > 0) {
    console.log(`[Chat] Including ${history.length} history messages`);
  }

  yield { type: 'status', status: '응답 생성 중...', level: 'loading' };

  const response = await modelWithTools.invoke(messages);

  if (response.tool_calls && response.tool_calls.length > 0) {
    messages.push(response as BaseMessage);

    for (const toolCall of response.tool_calls) {
      let toolResult: string;
      if (toolCall.name === 'search_faq') {
        yield { type: 'status', status: 'FAQ 검색 중...', level: 'loading' };
        toolResult = await searchToolWithCapture.invoke(toolCall.args);
      } else if (toolCall.name === 'check_order_status') {
        yield { type: 'status', status: '주문 조회 중...', level: 'loading' };
        toolResult = await orderToolWithCapture.invoke(toolCall.args);
      } else {
        toolResult = 'Unknown tool';
      }
      messages.push({
        role: 'tool',
        content: toolResult,
        tool_call_id: toolCall.id,
      } as any);
    }

    // Emit FAQ results as widget data
    if (faqResults.length > 0) {
      yield { type: 'faq', results: faqResults };
      yield {
        type: 'source',
        sources: faqResults.slice(0, 3).map((r) => ({
          title: r.question,
          category: r.category,
        })),
      };
    }

    yield { type: 'status', status: '답변 작성 중...', level: 'loading' };

    const finalStream = await model.stream(messages);

    for await (const chunk of finalStream) {
      const content = chunk.content;
      if (typeof content === 'string' && content) {
        yield { type: 'text', content };
      }
    }
  } else {
    const content = response.content;
    if (typeof content === 'string') {
      yield { type: 'text', content };
    }
  }

  // Emit sources (referenced FAQs)
  if (faqResults.length > 0) {
    const sources = faqResults.slice(0, 3).map((r) => ({
      title: r.question,
      category: r.category,
    }));
    yield { type: 'source', sources };

    // Suggest related questions (exclude the first one used for answer)
    const relatedQuestions = faqResults
      .slice(1, 4)
      .filter((r) => r.question !== userMessage)
      .map((r) => ({ label: r.question.slice(0, 30), query: r.question }));

    if (relatedQuestions.length > 0) {
      yield { type: 'action', actions: relatedQuestions };
    }
  }

  yield { type: 'status', status: '완료', level: 'success' };
}
