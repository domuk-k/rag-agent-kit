import Dexie, { type EntityTable } from 'dexie';

/**
 * 대화 메시지 타입
 */
export interface DbMessage {
  id?: number;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  data?: unknown[]; // 소스, 관련질문 등 메타데이터
  createdAt: number;
}

/**
 * 대화 세션 타입
 */
export interface DbConversation {
  id: string; // UUID or generated ID
  title: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Dexie 데이터베이스 정의
 */
class ChatDatabase extends Dexie {
  conversations!: EntityTable<DbConversation, 'id'>;
  messages!: EntityTable<DbMessage, 'id'>;

  constructor() {
    super('rag-agent-chat');

    this.version(1).stores({
      conversations: 'id, createdAt, updatedAt',
      messages: '++id, conversationId, createdAt',
    });
  }
}

export const db = new ChatDatabase();

/**
 * 대화 관련 CRUD 유틸리티
 */
export const conversationDb = {
  /**
   * 모든 대화 가져오기 (최신순)
   */
  async getAll(): Promise<DbConversation[]> {
    return db.conversations.orderBy('updatedAt').reverse().toArray();
  },

  /**
   * 대화 생성
   */
  async create(title: string = '새 대화'): Promise<DbConversation> {
    const now = Date.now();
    const id = `conv_${now}_${Math.random().toString(36).slice(2, 8)}`;

    const conversation: DbConversation = {
      id,
      title,
      createdAt: now,
      updatedAt: now,
    };

    await db.conversations.add(conversation);
    return conversation;
  },

  /**
   * 대화 업데이트 (제목, 타임스탬프)
   */
  async update(id: string, updates: Partial<Pick<DbConversation, 'title'>>): Promise<void> {
    await db.conversations.update(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },

  /**
   * 대화 삭제 (메시지 포함)
   */
  async delete(id: string): Promise<void> {
    await db.transaction('rw', [db.conversations, db.messages], async () => {
      await db.messages.where('conversationId').equals(id).delete();
      await db.conversations.delete(id);
    });
  },

  /**
   * 오래된 대화 정리 (최근 50개만 유지)
   */
  async cleanup(keepCount: number = 50): Promise<number> {
    const all = await db.conversations.orderBy('updatedAt').reverse().toArray();

    if (all.length <= keepCount) return 0;

    const toDelete = all.slice(keepCount);
    const idsToDelete = toDelete.map((c) => c.id);

    await db.transaction('rw', [db.conversations, db.messages], async () => {
      for (const id of idsToDelete) {
        await db.messages.where('conversationId').equals(id).delete();
      }
      await db.conversations.bulkDelete(idsToDelete);
    });

    return idsToDelete.length;
  },
};

/**
 * 메시지 관련 CRUD 유틸리티
 */
export const messageDb = {
  /**
   * 대화의 모든 메시지 가져오기
   */
  async getByConversation(conversationId: string): Promise<DbMessage[]> {
    return db.messages
      .where('conversationId')
      .equals(conversationId)
      .sortBy('createdAt');
  },

  /**
   * 메시지 추가
   */
  async add(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    data?: unknown[]
  ): Promise<DbMessage> {
    const message: Omit<DbMessage, 'id'> = {
      conversationId,
      role,
      content,
      data,
      createdAt: Date.now(),
    };

    const id = await db.messages.add(message as DbMessage);

    // 대화 타임스탬프 업데이트
    await db.conversations.update(conversationId, { updatedAt: Date.now() });

    // 첫 메시지면 대화 제목 업데이트
    if (role === 'user') {
      const count = await db.messages
        .where('conversationId')
        .equals(conversationId)
        .count();

      if (count === 1) {
        const title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
        await db.conversations.update(conversationId, { title });
      }
    }

    return { ...message, id };
  },

  /**
   * 대화의 마지막 N개 메시지 가져오기 (히스토리용)
   */
  async getRecentMessages(conversationId: string, count: number = 20): Promise<DbMessage[]> {
    const messages = await db.messages
      .where('conversationId')
      .equals(conversationId)
      .reverse()
      .limit(count)
      .toArray();

    return messages.reverse();
  },
};
