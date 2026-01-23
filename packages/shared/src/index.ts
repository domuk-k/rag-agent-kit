// @repo/shared - Common types and utilities

// ============================================
// FAQ Types
// ============================================

export interface FaqItem {
  id: number;
  category: string;
  subcategory?: string;
  question: string;
  answer: string;
}

export interface FaqSearchResult extends FaqItem {
  similarity: number;
}

export const FAQ_CATEGORIES = [
  '상품등록',
  '정산',
  '배송',
  '주문',
  '반품/교환',
] as const;

export type FaqCategory = (typeof FAQ_CATEGORIES)[number];

// ============================================
// SSE Stream Events (Server → Client)
// ============================================

/** 텍스트 청크 스트리밍 */
export interface TextEvent {
  type: 'text';
  content: string;
}

/** 진행 상태 표시 */
export interface StatusEvent {
  type: 'status';
  status: string;
  level: 'info' | 'loading' | 'success' | 'error';
}

/** FAQ 검색 결과 */
export interface FaqEvent {
  type: 'faq';
  results: FaqSearchResult[];
}

/** 후속 질문 제안 */
export interface ActionEvent {
  type: 'action';
  actions: {
    label: string;
    query: string;
  }[];
}

/** 참조 출처 */
export interface SourceEvent {
  type: 'source';
  sources: {
    title: string;
    url?: string;
    category: string;
  }[];
}

/** 스트림 완료 */
export interface DoneEvent {
  type: 'done';
}

/** 에러 발생 */
export interface ErrorEvent {
  type: 'error';
  message: string;
  code?: string;
}

/** 모든 SSE 이벤트 타입 */
export type SSEEvent =
  | TextEvent
  | StatusEvent
  | FaqEvent
  | ActionEvent
  | SourceEvent
  | DoneEvent
  | ErrorEvent;

/** SSE 이벤트 타입 이름 */
export type SSEEventType = SSEEvent['type'];

// ============================================
// SSE Utilities
// ============================================

/** SSE 포맷으로 변환 */
export function formatSSE(event: SSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

// ============================================
// Session Management (Multi-turn Context)
// ============================================

/** 채팅 메시지 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

/** 세션 데이터 */
export interface Session {
  id: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

/** 세션 스토어 인터페이스 */
export interface SessionStore {
  get(sessionId: string): Promise<Session | null>;
  create(sessionId?: string): Promise<Session>;
  addMessage(sessionId: string, message: ChatMessage): Promise<Session>;
  getMessages(sessionId: string, limit?: number): Promise<ChatMessage[]>;
  delete(sessionId: string): Promise<boolean>;
  cleanup(maxAge: number): Promise<number>;
}

/** 세션 ID 생성 */
export function generateSessionId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/** In-Memory 세션 스토어 */
export class InMemorySessionStore implements SessionStore {
  private sessions = new Map<string, Session>();

  async get(sessionId: string): Promise<Session | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async create(sessionId?: string): Promise<Session> {
    const id = sessionId ?? generateSessionId();
    const now = Date.now();
    const session: Session = {
      id,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(id, session);
    return session;
  }

  async addMessage(sessionId: string, message: ChatMessage): Promise<Session> {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = await this.create(sessionId);
    }
    session.messages.push(message);
    session.updatedAt = Date.now();
    return session;
  }

  async getMessages(sessionId: string, limit?: number): Promise<ChatMessage[]> {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    const messages = session.messages;
    return limit ? messages.slice(-limit) : messages;
  }

  async delete(sessionId: string): Promise<boolean> {
    return this.sessions.delete(sessionId);
  }

  async cleanup(maxAge: number): Promise<number> {
    const now = Date.now();
    let count = 0;
    for (const [id, session] of this.sessions) {
      if (now - session.updatedAt > maxAge) {
        this.sessions.delete(id);
        count++;
      }
    }
    return count;
  }

  /** 디버그용: 전체 세션 수 */
  get size(): number {
    return this.sessions.size;
  }
}
