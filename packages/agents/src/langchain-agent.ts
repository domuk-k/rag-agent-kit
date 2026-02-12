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

// ─── Score-based routing threshold ──────────────────────────────
const CONFIDENCE_THRESHOLD = 0.5;

const OUT_OF_SCOPE_MESSAGE =
  '해당 질문은 제가 도움드리기 어려운 내용이에요.\n학습 관련 문의는 **학습지원센터(02-8282-777)**로 연락해주시면 안내받으실 수 있습니다.';

export interface ChatOptions {
  onStatus?: StatusCallback;
  onToken?: (token: string) => void;
}

/**
 * FAQ 검색 기반 채팅 (텍스트 스트리밍).
 * Score-based routing:
 *   - HIGH (>=0.5): FAQ answer 직접 반환
 *   - LOW  (<0.5): 범위 외 안내 메시지
 */
export async function* chat(
  userMessage: string,
  options: ChatOptions = {}
): AsyncGenerator<string, void, unknown> {
  const { onStatus, onToken } = options;

  onStatus?.('FAQ 검색 중...');

  const results = await searchFaq(userMessage, { topK: 5, minScore: 0.0 });
  const topScore = results[0]?.similarity ?? 0;

  if (topScore < CONFIDENCE_THRESHOLD) {
    logAnalyticsEvent({
      eventType: 'guard_rejected',
      metadata: { query: userMessage, score: topScore },
    }).catch(console.error);
    for (const char of OUT_OF_SCOPE_MESSAGE) {
      onToken?.(char);
      yield char;
    }
    onStatus?.('완료');
    return;
  }

  onStatus?.('답변 반환 중...');
  const directAnswer = results[0].answer;
  for (const char of directAnswer) {
    onToken?.(char);
    yield char;
  }
  onStatus?.('완료');
}

/** chatWithEvents 옵션 */
export interface ChatWithEventsOptions {
  /** 이전 대화 히스토리 */
  history?: { role: 'user' | 'assistant' | 'system'; content: string }[];
}

/**
 * FAQ 검색 기반 채팅 (구조화된 이벤트 스트리밍).
 * Score-based routing:
 *   - HIGH (>=0.5): FAQ answer 직접 반환
 *   - LOW  (<0.5): 범위 외 안내 메시지
 */
export async function* chatWithEvents(
  userMessage: string,
  options: ChatWithEventsOptions = {}
): AsyncGenerator<ChatEvent, void, unknown> {
  yield { type: 'status', status: 'FAQ 검색 중...', level: 'loading' };

  const results = await searchFaq(userMessage, { topK: 5, minScore: 0.0 });
  const topScore = results[0]?.similarity ?? 0;

  console.log(
    `[Chat] Query: "${userMessage}" | Top score: ${topScore.toFixed(3)} | Results: ${results.length}`
  );

  // ─── LOW: 범위 외 ─────────────────────────────────
  if (topScore < CONFIDENCE_THRESHOLD) {
    logAnalyticsEvent({
      eventType: 'guard_rejected',
      metadata: { query: userMessage, score: topScore },
    }).catch(console.error);

    yield { type: 'status', status: '범위 외 질문', level: 'info' };
    yield { type: 'text', content: OUT_OF_SCOPE_MESSAGE };
    yield { type: 'status', status: '완료', level: 'success' };
    return;
  }

  // ─── HIGH: FAQ 직접 반환 ───────────────────────────
  yield { type: 'status', status: '답변 반환 중...', level: 'loading' };

  yield { type: 'text', content: results[0].answer };

  logAnalyticsEvent({
    eventType: 'faq_accessed',
    metadata: { faq_id: results[0].id, category: results[0].category },
  }).catch(console.error);
  yield* emitTrailingEvents(results, userMessage);
  yield { type: 'status', status: '완료', level: 'success' };
}

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * 텍스트 응답 이후에 emit되는 메타데이터 이벤트들.
 * AI SDK는 첫 text part(0:) 이후에 온 data part(2:)만
 * message.data에 연결하므로, 반드시 텍스트 이후에 호출해야 함.
 */
async function* emitTrailingEvents(
  results: FaqSearchResult[],
  userMessage: string
): AsyncGenerator<ChatEvent, void, unknown> {
  if (results.length === 0) return;

  // 1. 참고 FAQ: 유사도 0.2 이상인 결과만 카드로 표시
  const meaningfulResults = results.filter((r) => r.similarity >= 0.2);
  if (meaningfulResults.length > 0) {
    yield { type: 'faq', results: meaningfulResults };
  }

  // 2. 출처 정보: 최상위 매칭 FAQ
  const sources = results.slice(0, 1).map((r) => ({
    title: r.question,
    category: r.category,
  }));
  yield { type: 'source', sources };

  // 3. 추천 질문: 현재 질문 제외, 최대 3개
  const relatedQuestions = results
    .slice(1)
    .filter((r) => r.question !== userMessage)
    .slice(0, 3)
    .map((r) => ({ label: r.question.slice(0, 30), query: r.question }));

  if (relatedQuestions.length > 0) {
    yield { type: 'action', actions: relatedQuestions };
  }
}
