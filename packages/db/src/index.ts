/**
 * @repo/db - MongoDB FAQ Database
 *
 * MongoDB Atlas를 사용한 FAQ 저장소입니다.
 * Atlas Search(Nori 한국어 형태소 분석)로 검색을 지원합니다.
 */

import { MongoClient, type Db, type Collection } from 'mongodb';
import type { FaqItem, ChatMessage, Session } from '@repo/shared';
import type {
  FaqDocument,
  SessionDocument,
  MessageDocument,
  AnalyticsEventDocument,
  CounterDocument,
} from './types';

// ============================================
// Connection
// ============================================

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'rag_agent_kit';

let client: MongoClient | null = null;
let dbInstance: Db | null = null;

/** MongoDB 연결 및 Db 인스턴스 가져오기 */
export async function getDb(): Promise<Db> {
  if (dbInstance) return dbInstance;

  client = new MongoClient(MONGODB_URI);
  await client.connect();
  dbInstance = client.db(MONGODB_DB_NAME);
  await ensureIndexes(dbInstance);
  console.log(`[DB] Connected to MongoDB: ${MONGODB_DB_NAME}`);
  return dbInstance;
}

/** MongoDB 연결 종료 */
export async function closeDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    dbInstance = null;
  }
}

/** MongoDB 연결 상태 확인 (health check용) */
export async function pingDb(): Promise<boolean> {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

// ============================================
// Collections
// ============================================

async function faqs(): Promise<Collection<FaqDocument>> {
  return (await getDb()).collection<FaqDocument>('faqs');
}

async function sessions(): Promise<Collection<SessionDocument>> {
  return (await getDb()).collection<SessionDocument>('sessions');
}

async function messages(): Promise<Collection<MessageDocument>> {
  return (await getDb()).collection<MessageDocument>('messages');
}

async function analyticsEvents(): Promise<Collection<AnalyticsEventDocument>> {
  return (await getDb()).collection<AnalyticsEventDocument>('analyticsEvents');
}

async function counters(): Promise<Collection<CounterDocument>> {
  return (await getDb()).collection<CounterDocument>('counters');
}

// ============================================
// Index Setup
// ============================================

async function ensureIndexes(db: Db): Promise<void> {
  const faqCol = db.collection('faqs');
  const sessCol = db.collection('sessions');
  const msgCol = db.collection('messages');
  const analyticsCol = db.collection('analyticsEvents');

  await Promise.all([
    faqCol.createIndex({ id: 1 }, { unique: true }),
    faqCol.createIndex({ category: 1 }),
    sessCol.createIndex({ id: 1 }, { unique: true }),
    sessCol.createIndex({ updatedAt: 1 }),
    msgCol.createIndex({ sessionId: 1 }),
    msgCol.createIndex({ timestamp: 1 }),
    analyticsCol.createIndex({ eventType: 1 }),
    analyticsCol.createIndex({ timestamp: 1 }),
  ]);
}

// ============================================
// Auto-increment Helper
// ============================================

async function getNextSequence(name: string): Promise<number> {
  const col = await counters();
  const result = await col.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return result!.seq;
}

// ============================================
// FAQ CRUD Operations
// ============================================

/** 모든 FAQ 조회 */
export async function getAllFaqs(): Promise<FaqItem[]> {
  const col = await faqs();
  const docs = await col
    .find({}, { projection: { _id: 0, id: 1, category: 1, subcategory: 1, question: 1, answer: 1 } })
    .sort({ category: 1, id: 1 })
    .toArray();
  return docs as FaqItem[];
}

/** 카테고리별 FAQ 조회 */
export async function getFaqsByCategory(category: string): Promise<FaqItem[]> {
  const col = await faqs();
  const docs = await col
    .find({ category }, { projection: { _id: 0, id: 1, category: 1, subcategory: 1, question: 1, answer: 1 } })
    .sort({ id: 1 })
    .toArray();
  return docs as FaqItem[];
}

/** 단일 FAQ 조회 */
export async function getFaqById(id: number): Promise<FaqItem | null> {
  const col = await faqs();
  const doc = await col.findOne(
    { id },
    { projection: { _id: 0, id: 1, category: 1, subcategory: 1, question: 1, answer: 1 } }
  );
  return doc as FaqItem | null;
}

/** FAQ 생성 */
export async function createFaq(faq: Omit<FaqItem, 'id'>): Promise<FaqItem> {
  const col = await faqs();
  const id = await getNextSequence('faq_id');
  const now = new Date();

  const doc: FaqDocument = {
    id,
    category: faq.category,
    subcategory: faq.subcategory ?? null,
    question: faq.question,
    answer: faq.answer,
    createdAt: now,
    updatedAt: now,
  };

  await col.insertOne(doc);
  return { id, ...faq };
}

/** FAQ 수정 */
export async function updateFaq(
  id: number,
  updates: Partial<Omit<FaqItem, 'id'>>
): Promise<FaqItem | null> {
  const col = await faqs();
  const result = await col.findOneAndUpdate(
    { id },
    { $set: { ...updates, updatedAt: new Date() } },
    { returnDocument: 'after', projection: { _id: 0, id: 1, category: 1, subcategory: 1, question: 1, answer: 1 } }
  );
  return result as FaqItem | null;
}

/** FAQ 임베딩 업데이트 (vector search용) */
export async function updateFaqEmbedding(id: number, embedding: number[]): Promise<void> {
  const col = await faqs();
  await col.updateOne({ id }, { $set: { embedding } });
}

/** FAQ 삭제 */
export async function deleteFaq(id: number): Promise<boolean> {
  const col = await faqs();
  const result = await col.deleteOne({ id });
  return result.deletedCount > 0;
}

/** 여러 FAQ 일괄 삽입 */
export async function bulkInsertFaqs(faqItems: Omit<FaqItem, 'id'>[]): Promise<number> {
  const col = await faqs();
  const now = new Date();

  const docs: FaqDocument[] = [];
  for (const faq of faqItems) {
    const id = await getNextSequence('faq_id');
    docs.push({
      id,
      category: faq.category,
      subcategory: faq.subcategory ?? null,
      question: faq.question,
      answer: faq.answer,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (docs.length > 0) {
    await col.insertMany(docs);
  }
  return docs.length;
}

/** 시딩 전 전체 초기화 */
export async function resetForSeed(): Promise<number> {
  const col = await faqs();
  const result = await col.deleteMany({});
  // 카운터도 리셋
  const counterCol = await counters();
  await counterCol.updateOne({ _id: 'faq_id' }, { $set: { seq: 0 } }, { upsert: true });
  return result.deletedCount;
}

/** 모든 FAQ 삭제 (재시딩용) */
export async function clearAllFaqs(): Promise<number> {
  const col = await faqs();
  const result = await col.deleteMany({});
  return result.deletedCount;
}

/** FAQ 개수 조회 */
export async function getFaqCount(): Promise<number> {
  const col = await faqs();
  return col.countDocuments();
}

/** 카테고리 목록 조회 */
export async function getCategories(): Promise<string[]> {
  const col = await faqs();
  return col.distinct('category');
}

// ============================================
// Session CRUD Operations
// ============================================

/** 세션 생성 */
export async function createSession(sessionId: string, metadata?: Record<string, unknown>): Promise<Session> {
  const col = await sessions();
  const now = Date.now();

  const doc: SessionDocument = {
    id: sessionId,
    createdAt: now,
    updatedAt: now,
    metadata: metadata ?? null,
  };
  await col.insertOne(doc);

  logAnalyticsEvent({ eventType: 'session_created', sessionId }).catch(console.error);

  return { id: sessionId, messages: [], createdAt: now, updatedAt: now, metadata };
}

/** 세션 조회 */
export async function getSession(sessionId: string): Promise<Session | null> {
  const col = await sessions();
  const row = await col.findOne({ id: sessionId });
  if (!row) return null;

  const msgs = await getSessionMessages(sessionId);
  return {
    id: row.id,
    messages: msgs,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    metadata: row.metadata ?? undefined,
  };
}

/** 세션 타임스탬프 업데이트 */
export async function updateSessionTimestamp(sessionId: string): Promise<void> {
  const col = await sessions();
  await col.updateOne({ id: sessionId }, { $set: { updatedAt: Date.now() } });
}

/** 세션 삭제 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const col = await sessions();
  const result = await col.deleteOne({ id: sessionId });
  // 관련 메시지도 삭제 (CASCADE 모방)
  const msgCol = await messages();
  await msgCol.deleteMany({ sessionId });

  if (result.deletedCount > 0) {
    logAnalyticsEvent({ eventType: 'session_deleted', sessionId }).catch(console.error);
  }
  return result.deletedCount > 0;
}

/** 오래된 세션 정리 */
export async function cleanupSessions(maxAge: number): Promise<number> {
  const cutoff = Date.now() - maxAge;
  const col = await sessions();
  const msgCol = await messages();

  // 만료된 세션 ID 목록
  const expiredSessions = await col.find(
    { updatedAt: { $lt: cutoff } },
    { projection: { id: 1 } }
  ).toArray();

  if (expiredSessions.length === 0) return 0;

  const ids = expiredSessions.map(s => s.id);
  await msgCol.deleteMany({ sessionId: { $in: ids } });
  const result = await col.deleteMany({ updatedAt: { $lt: cutoff } });
  return result.deletedCount;
}

// ============================================
// Message CRUD Operations
// ============================================

/** 메시지 추가 */
export async function addMessage(sessionId: string, message: ChatMessage): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) {
    await createSession(sessionId);
  }

  const col = await messages();
  await col.insertOne({
    sessionId,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
  });
  await updateSessionTimestamp(sessionId);
}

/** 세션 메시지 조회 */
export async function getSessionMessages(sessionId: string, limit?: number): Promise<ChatMessage[]> {
  const col = await messages();

  if (limit) {
    // 최신 N개를 가져온 뒤 시간순 정렬
    const rows = await col
      .find({ sessionId }, { projection: { _id: 0, role: 1, content: 1, timestamp: 1 } })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    return rows.reverse() as ChatMessage[];
  }

  const rows = await col
    .find({ sessionId }, { projection: { _id: 0, role: 1, content: 1, timestamp: 1 } })
    .sort({ timestamp: 1 })
    .toArray();
  return rows as ChatMessage[];
}

// ============================================
// Analytics Operations
// ============================================

export type AnalyticsEventType =
  | 'session_created'
  | 'session_deleted'
  | 'faq_accessed'
  | 'faq_created'
  | 'faq_updated'
  | 'faq_deleted'
  | 'guard_rejected'
  | 'feedback_positive'
  | 'feedback_negative';

/** 분석 이벤트 기록 */
export async function logAnalyticsEvent(event: {
  eventType: AnalyticsEventType;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const col = await analyticsEvents();
    await col.insertOne({
      eventType: event.eventType,
      sessionId: event.sessionId ?? null,
      timestamp: Date.now(),
      metadata: event.metadata ?? null,
    });
  } catch (err) {
    console.error('[Analytics] Failed to log event:', err);
  }
}

/** 인기 질문 조회 */
export async function getPopularQuestions(limit = 10, days = 7): Promise<Array<{ question: string; category: string; count: number }>> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const col = await analyticsEvents();

  const pipeline = [
    {
      $match: {
        eventType: 'faq_accessed',
        timestamp: { $gt: cutoff },
        'metadata.faqId': { $ne: null },
      },
    },
    {
      $group: {
        _id: '$metadata.faqId',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 as const } },
    { $limit: limit },
  ];

  const rows = await col.aggregate(pipeline).toArray();

  const results: Array<{ question: string; category: string; count: number }> = [];
  for (const r of rows) {
    const faq = await getFaqById(r._id as number);
    results.push({
      question: faq?.question ?? 'Unknown',
      category: faq?.category ?? 'Unknown',
      count: r.count,
    });
  }
  return results;
}

/** 일별 사용량 조회 */
export async function getDailyUsage(days = 30): Promise<Array<{ date: string; sessions: number; messages: number }>> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const sessCol = await sessions();
  const msgCol = await messages();

  // 세션 수 (createdAt ms → 일별)
  const sessionPipeline = [
    { $match: { createdAt: { $gt: cutoff } } },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: { $toDate: '$createdAt' },
          },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 as const } },
  ];

  // 메시지 수
  const messagePipeline = [
    { $match: { timestamp: { $gt: cutoff } } },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: { $toDate: '$timestamp' },
          },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 as const } },
  ];

  const [sessionRows, messageRows] = await Promise.all([
    sessCol.aggregate(sessionPipeline).toArray(),
    msgCol.aggregate(messagePipeline).toArray(),
  ]);

  const dateMap = new Map<string, { sessions: number; messages: number }>();
  for (const r of sessionRows) {
    dateMap.set(r._id as string, { sessions: r.count, messages: 0 });
  }
  for (const r of messageRows) {
    const existing = dateMap.get(r._id as string) ?? { sessions: 0, messages: 0 };
    existing.messages = r.count;
    dateMap.set(r._id as string, existing);
  }

  return Array.from(dateMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** 카테고리별 접근 통계 */
export async function getCategoryBreakdown(days = 7): Promise<Array<{ category: string; count: number }>> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const col = await analyticsEvents();

  const pipeline = [
    {
      $match: {
        eventType: 'faq_accessed',
        timestamp: { $gt: cutoff },
        'metadata.category': { $ne: null },
      },
    },
    {
      $group: {
        _id: '$metadata.category',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 as const } },
  ];

  const rows = await col.aggregate(pipeline).toArray();
  return rows.map(r => ({ category: r._id as string, count: r.count }));
}

/** Guard 거부 목록 */
export async function getGuardRejections(days = 7): Promise<Array<{ query: string; score: number; timestamp: number }>> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const col = await analyticsEvents();

  const docs = await col
    .find(
      { eventType: 'guard_rejected', timestamp: { $gt: cutoff } },
      { projection: { 'metadata.query': 1, 'metadata.score': 1, timestamp: 1 } }
    )
    .sort({ timestamp: -1 })
    .limit(100)
    .toArray();

  return docs.map(d => ({
    query: (d.metadata?.query as string) ?? '',
    score: (d.metadata?.score as number) ?? 0,
    timestamp: d.timestamp,
  }));
}

// ============================================
// Re-exports
// ============================================

export type { FaqDocument, SessionDocument, MessageDocument, AnalyticsEventDocument, CounterDocument } from './types';
