import type { SourceItem } from '@/types';

// Action item type
export interface ActionItem {
  label: string;
  query: string;
  category?: string;
}

// Status item type
export interface StatusItem {
  status: string;
  level: 'info' | 'loading' | 'success' | 'error';
}

// FAQ result type
export interface FaqResultItem {
  id: number;
  question: string;
  answer: string;
  category: string;
  similarity: number;
}

/**
 * AI SDK 스트림 데이터에서 소스 항목 추출
 * @param data - AI SDK 메시지의 data 필드
 */
export function extractSources(data: unknown): SourceItem[] | undefined {
  if (!Array.isArray(data)) return undefined;

  const sourceData = data.find(
    (d): d is { type: 'source'; sources: SourceItem[] } =>
      typeof d === 'object' && d !== null && 'type' in d && d.type === 'source'
  );

  return sourceData?.sources;
}

/**
 * AI SDK 스트림 데이터에서 관련 질문 추출
 * @param data - AI SDK 메시지의 data 필드
 */
export function extractRelatedQuestions(data: unknown): string[] | undefined {
  if (!Array.isArray(data)) return undefined;

  const relatedData = data.find(
    (d): d is { type: 'related'; questions: string[] } =>
      typeof d === 'object' && d !== null && 'type' in d && d.type === 'related'
  );

  return relatedData?.questions;
}

/**
 * AI SDK 스트림 데이터에서 액션 항목 추출
 * @param data - AI SDK 메시지의 data 필드
 */
export function extractActions(data: unknown): ActionItem[] | undefined {
  if (!Array.isArray(data)) return undefined;

  const actionData = data.find(
    (d): d is { type: 'action'; actions: ActionItem[] } =>
      typeof d === 'object' && d !== null && 'type' in d && d.type === 'action'
  );

  return actionData?.actions;
}

/**
 * AI SDK 스트림 데이터에서 상태 이벤트 추출
 * @param data - AI SDK 메시지의 data 필드
 */
export function extractStatuses(data: unknown): StatusItem[] | undefined {
  if (!Array.isArray(data)) return undefined;

  const statuses = data.filter(
    (d): d is { type: 'status' } & StatusItem =>
      typeof d === 'object' && d !== null && 'type' in d && d.type === 'status'
  );

  return statuses.length > 0 ? statuses : undefined;
}

/**
 * AI SDK 스트림 데이터에서 FAQ 검색 결과 추출
 * @param data - AI SDK 메시지의 data 필드
 */
export function extractFaqResults(data: unknown): FaqResultItem[] | undefined {
  if (!Array.isArray(data)) return undefined;

  const faqData = data.find(
    (d): d is { type: 'faq'; results: FaqResultItem[] } =>
      typeof d === 'object' && d !== null && 'type' in d && d.type === 'faq'
  );

  return faqData?.results;
}
