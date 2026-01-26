import { ChatOpenAI } from '@langchain/openai';
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import { searchFaq } from '@repo/vector';
import { logAnalyticsEvent } from '@repo/db';
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

// ─── Score-based routing thresholds ──────────────────────────────
const HIGH_CONFIDENCE = 0.8;   // 직접 반환 (LLM 호출 없음)
const LOW_CONFIDENCE = 0.3;    // 범위 외 안내 (LLM 호출 없음)

const SYSTEM_PROMPT = `당신은 온라인 교육 플랫폼의 학습지원 챗봇입니다.

## 역할
학습자의 질문에 친절하고 정확하게 답변합니다.

## 응답 규칙

### 1. FAQ 원문 충실성 (가장 중요)
- FAQ 검색 결과의 **모든 정보를 빠짐없이** 포함해야 합니다
- 숫자, 조건, 예외사항, 연락처 등 세부사항을 절대 생략하지 마세요
- 원문의 항목이 4개면 응답에도 4개 모두 포함

### 2. 구성 및 말투
- 원문을 읽기 쉽게 재구성하는 것은 허용
- 친근하고 공손한 말투 사용 (~해요, ~드려요)
- 번호 목록, 굵은 글씨 등 포맷팅 활용 가능

### 3. 기타
- 항상 한국어로 응답

## 예시
FAQ 원문: "1. 특수문자 제거 2. 확장자 확인 3. 압축 업로드 4. Comment란 붙여넣기"
→ 4가지 모두 응답에 포함해야 함 (일부만 언급 금지)`;

const OUT_OF_SCOPE_MESSAGE =
  '해당 질문은 제가 도움드리기 어려운 내용이에요.\n학습 관련 문의는 **학습지원센터(02-8282-777)**로 연락해주시면 안내받으실 수 있습니다.';

export interface ChatOptions {
  onStatus?: StatusCallback;
  onToken?: (token: string) => void;
}

export async function* chat(
  userMessage: string,
  options: ChatOptions = {}
): AsyncGenerator<string, void, unknown> {
  const { onStatus, onToken } = options;

  onStatus?.('FAQ 검색 중...');

  const results = await searchFaq(userMessage, { topK: 5, minScore: LOW_CONFIDENCE });
  const topScore = results[0]?.similarity ?? 0;

  // ─── Score-based routing ───────────────────────────
  if (topScore < LOW_CONFIDENCE || results.length === 0) {
    // LOW: 범위 외 → 정해진 안내 메시지
    logAnalyticsEvent({
      eventType: 'guard_rejected',
      metadata: { query: userMessage, score: topScore },
    });
    for (const char of OUT_OF_SCOPE_MESSAGE) {
      onToken?.(char);
      yield char;
    }
    onStatus?.('완료');
    return;
  }

  if (topScore >= HIGH_CONFIDENCE) {
    // HIGH: 직접 FAQ 반환 (LLM 호출 없음)
    onStatus?.('답변 반환 중...');
    const directAnswer = formatDirectAnswer(results[0]);
    for (const char of directAnswer) {
      onToken?.(char);
      yield char;
    }
    onStatus?.('완료');
    return;
  }

  // MEDIUM: LLM에 FAQ 컨텍스트 전달하여 종합 답변 생성
  onStatus?.('답변 작성 중...');

  const model = new ChatOpenAI({
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    configuration: {
      baseURL: process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1',
    },
    streaming: true,
  });

  const faqContext = results
    .map((r, i) => `[${i + 1}] Q: ${r.question}\nA: ${r.answer}`)
    .join('\n\n');

  const messages: BaseMessage[] = [
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(
      `아래 FAQ 검색 결과를 바탕으로 사용자 질문에 답변해주세요.\n\n` +
      `사용자 질문: ${userMessage}\n\n` +
      `FAQ 검색 결과:\n${faqContext}`
    ),
  ];

  const stream = await model.stream(messages);
  for await (const chunk of stream) {
    const content = chunk.content;
    if (typeof content === 'string' && content) {
      onToken?.(content);
      yield content;
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
 * Score-based routing:
 *   - HIGH (>0.8): 직접 FAQ answer 반환, LLM 호출 없음
 *   - MEDIUM (0.3~0.8): LLM이 FAQ 컨텍스트로 종합 답변 생성
 *   - LOW (<0.3): 범위 외 안내 메시지 반환, LLM 호출 없음
 */
export async function* chatWithEvents(
  userMessage: string,
  options: ChatWithEventsOptions = {}
): AsyncGenerator<ChatEvent, void, unknown> {
  const { history = [] } = options;

  yield { type: 'status', status: 'FAQ 검색 중...', level: 'loading' };

  // Step 1: 하이브리드 검색 (FTS5 + sqlite-vec + RRF)
  const results = await searchFaq(userMessage, { topK: 5, minScore: LOW_CONFIDENCE });
  const topScore = results[0]?.similarity ?? 0;

  console.log(
    `[Chat] Query: "${userMessage}" | Top score: ${topScore.toFixed(3)} | Results: ${results.length}`
  );

  // ─── LOW: 범위 외 ─────────────────────────────────
  if (topScore < LOW_CONFIDENCE || results.length === 0) {
    logAnalyticsEvent({
      eventType: 'guard_rejected',
      metadata: { query: userMessage, score: topScore },
    });

    yield { type: 'status', status: '범위 외 질문', level: 'info' };
    yield { type: 'text', content: OUT_OF_SCOPE_MESSAGE };
    yield { type: 'status', status: '완료', level: 'success' };
    return;
  }

  // Emit FAQ results
  yield { type: 'faq', results };

  // ─── HIGH: 직접 반환 ──────────────────────────────
  if (topScore >= HIGH_CONFIDENCE) {
    yield { type: 'status', status: '답변 반환 중...', level: 'loading' };

    const directAnswer = formatDirectAnswer(results[0]);
    yield { type: 'text', content: directAnswer };

    emitSourcesAndActions(results, userMessage);
    yield* emitTrailingEvents(results, userMessage);
    yield { type: 'status', status: '완료', level: 'success' };
    return;
  }

  // ─── MEDIUM: LLM 종합 답변 ────────────────────────
  yield { type: 'status', status: '답변 작성 중...', level: 'loading' };

  const model = new ChatOpenAI({
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    configuration: {
      baseURL: process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1',
    },
    streaming: true,
  });

  const faqContext = results
    .map((r, i) => `[${i + 1}] Q: ${r.question}\nA: ${r.answer}`)
    .join('\n\n');

  // Build messages with history
  const messages: BaseMessage[] = [new SystemMessage(SYSTEM_PROMPT)];

  for (const msg of history) {
    if (msg.role === 'user') {
      messages.push(new HumanMessage(msg.content));
    } else if (msg.role === 'assistant') {
      messages.push(new AIMessage(msg.content));
    }
  }

  messages.push(
    new HumanMessage(
      `아래 FAQ 검색 결과를 바탕으로 사용자 질문에 답변해주세요.\n\n` +
      `사용자 질문: ${userMessage}\n\n` +
      `FAQ 검색 결과:\n${faqContext}`
    )
  );

  if (history.length > 0) {
    console.log(`[Chat] Including ${history.length} history messages`);
  }

  const stream = await model.stream(messages);
  for await (const chunk of stream) {
    const content = chunk.content;
    if (typeof content === 'string' && content) {
      yield { type: 'text', content };
    }
  }

  yield* emitTrailingEvents(results, userMessage);
  yield { type: 'status', status: '완료', level: 'success' };
}

// ─── Helpers ─────────────────────────────────────────────────────

/** 고신뢰도 FAQ를 사용자 친화적으로 포맷 */
function formatDirectAnswer(faq: FaqSearchResult): string {
  return faq.answer;
}

/** 출처 + 관련 질문 이벤트 생성 */
async function* emitTrailingEvents(
  results: FaqSearchResult[],
  userMessage: string
): AsyncGenerator<ChatEvent, void, unknown> {
  if (results.length > 0) {
    const sources = results.slice(0, 1).map((r) => ({
      title: r.question,
      category: r.category,
    }));
    yield { type: 'source', sources };

    const relatedQuestions = results
      .slice(1, 4)
      .filter((r) => r.question !== userMessage)
      .map((r) => ({ label: r.question.slice(0, 30), query: r.question }));

    if (relatedQuestions.length > 0) {
      yield { type: 'action', actions: relatedQuestions };
    }
  }
}

/** Analytics 로깅 헬퍼 (non-blocking) */
function emitSourcesAndActions(results: FaqSearchResult[], userMessage: string): void {
  if (results.length > 0) {
    logAnalyticsEvent({
      eventType: 'faq_accessed',
      metadata: { faq_id: results[0].id, category: results[0].category },
    });
  }
}
