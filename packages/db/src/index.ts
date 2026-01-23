/**
 * @repo/db - SQLite FAQ Database
 *
 * Bun 네이티브 SQLite를 사용한 FAQ 저장소입니다.
 * 벡터 검색은 Qdrant에서, 메타데이터/CRUD는 여기서 처리합니다.
 */

import { Database } from 'bun:sqlite';
import type { FaqItem, ChatMessage, Session } from '@repo/shared';

// 데이터베이스 파일 경로
const DB_PATH = process.env.DB_PATH ?? 'data/faq.db';

// 싱글톤 DB 인스턴스
let db: Database | null = null;

/** DB 인스턴스 가져오기 */
export function getDb(): Database {
  if (!db) {
    db = new Database(DB_PATH, { create: true });
    initSchema(db);
  }
  return db;
}

/** 스키마 초기화 */
function initSchema(db: Database) {
  // FAQ 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS faq (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      subcategory TEXT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_faq_category ON faq(category)`);

  // 세션 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      metadata TEXT
    )
  `);

  // 메시지 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)`);

  // 분석 이벤트 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      session_id TEXT,
      timestamp INTEGER NOT NULL,
      metadata TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics_events(timestamp)`);

  console.log(`[DB] Initialized: ${DB_PATH}`);
}

/** DB 연결 종료 */
export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

// ============================================
// FAQ CRUD Operations
// ============================================

/** 모든 FAQ 조회 */
export function getAllFaqs(): FaqItem[] {
  const stmt = getDb().prepare(`
    SELECT id, category, subcategory, question, answer
    FROM faq
    ORDER BY category, id
  `);
  return stmt.all() as FaqItem[];
}

/** 카테고리별 FAQ 조회 */
export function getFaqsByCategory(category: string): FaqItem[] {
  const stmt = getDb().prepare(`
    SELECT id, category, subcategory, question, answer
    FROM faq
    WHERE category = ?
    ORDER BY id
  `);
  return stmt.all(category) as FaqItem[];
}

/** 단일 FAQ 조회 */
export function getFaqById(id: number): FaqItem | null {
  const stmt = getDb().prepare(`
    SELECT id, category, subcategory, question, answer
    FROM faq
    WHERE id = ?
  `);
  return (stmt.get(id) as FaqItem) ?? null;
}

/** FAQ 생성 */
export function createFaq(
  faq: Omit<FaqItem, 'id'>
): FaqItem {
  const stmt = getDb().prepare(`
    INSERT INTO faq (category, subcategory, question, answer)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(
    faq.category,
    faq.subcategory ?? null,
    faq.question,
    faq.answer
  );
  return {
    id: Number(result.lastInsertRowid),
    ...faq,
  };
}

/** FAQ 수정 */
export function updateFaq(
  id: number,
  updates: Partial<Omit<FaqItem, 'id'>>
): FaqItem | null {
  const existing = getFaqById(id);
  if (!existing) return null;

  const updated = { ...existing, ...updates };
  const stmt = getDb().prepare(`
    UPDATE faq
    SET category = ?, subcategory = ?, question = ?, answer = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(
    updated.category,
    updated.subcategory ?? null,
    updated.question,
    updated.answer,
    id
  );
  return updated;
}

/** FAQ 삭제 */
export function deleteFaq(id: number): boolean {
  const stmt = getDb().prepare(`DELETE FROM faq WHERE id = ?`);
  const result = stmt.run(id);
  return result.changes > 0;
}

/** 여러 FAQ 일괄 삽입 */
export function bulkInsertFaqs(faqs: Omit<FaqItem, 'id'>[]): number {
  const stmt = getDb().prepare(`
    INSERT INTO faq (category, subcategory, question, answer)
    VALUES (?, ?, ?, ?)
  `);

  const insertMany = getDb().transaction((items: Omit<FaqItem, 'id'>[]) => {
    for (const faq of items) {
      stmt.run(faq.category, faq.subcategory ?? null, faq.question, faq.answer);
    }
    return items.length;
  });

  return insertMany(faqs);
}

/** 모든 FAQ 삭제 (재시딩용) */
export function clearAllFaqs(): number {
  const result = getDb().run(`DELETE FROM faq`);
  return result.changes;
}

/** FAQ 개수 조회 */
export function getFaqCount(): number {
  const stmt = getDb().prepare(`SELECT COUNT(*) as count FROM faq`);
  const result = stmt.get() as { count: number };
  return result.count;
}

/** 카테고리 목록 조회 */
export function getCategories(): string[] {
  const stmt = getDb().prepare(`
    SELECT DISTINCT category FROM faq ORDER BY category
  `);
  const results = stmt.all() as { category: string }[];
  return results.map((r) => r.category);
}

// ============================================
// Session CRUD Operations
// ============================================

/** 세션 생성 */
export function createSession(sessionId: string, metadata?: Record<string, unknown>): Session {
  const now = Date.now();
  const stmt = getDb().prepare(`
    INSERT INTO sessions (id, created_at, updated_at, metadata)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(sessionId, now, now, metadata ? JSON.stringify(metadata) : null);

  logAnalyticsEvent({ eventType: 'session_created', sessionId });

  return { id: sessionId, messages: [], createdAt: now, updatedAt: now, metadata };
}

/** 세션 조회 */
export function getSession(sessionId: string): Session | null {
  const stmt = getDb().prepare(`SELECT * FROM sessions WHERE id = ?`);
  const row = stmt.get(sessionId) as { id: string; created_at: number; updated_at: number; metadata: string | null } | null;
  if (!row) return null;

  const messages = getSessionMessages(sessionId);
  return {
    id: row.id,
    messages,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  };
}

/** 세션 타임스탬프 업데이트 */
export function updateSessionTimestamp(sessionId: string): void {
  const stmt = getDb().prepare(`UPDATE sessions SET updated_at = ? WHERE id = ?`);
  stmt.run(Date.now(), sessionId);
}

/** 세션 삭제 */
export function deleteSession(sessionId: string): boolean {
  const stmt = getDb().prepare(`DELETE FROM sessions WHERE id = ?`);
  const result = stmt.run(sessionId);
  if (result.changes > 0) {
    logAnalyticsEvent({ eventType: 'session_deleted', sessionId });
  }
  return result.changes > 0;
}

/** 오래된 세션 정리 */
export function cleanupSessions(maxAge: number): number {
  const cutoff = Date.now() - maxAge;
  const stmt = getDb().prepare(`DELETE FROM sessions WHERE updated_at < ?`);
  const result = stmt.run(cutoff);
  return result.changes;
}

// ============================================
// Message CRUD Operations
// ============================================

/** 메시지 추가 */
export function addMessage(sessionId: string, message: ChatMessage): void {
  // 세션이 없으면 생성
  const session = getSession(sessionId);
  if (!session) {
    createSession(sessionId);
  }

  const stmt = getDb().prepare(`
    INSERT INTO messages (session_id, role, content, timestamp)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(sessionId, message.role, message.content, message.timestamp);
  updateSessionTimestamp(sessionId);
}

/** 세션 메시지 조회 */
export function getSessionMessages(sessionId: string, limit?: number): ChatMessage[] {
  const query = limit
    ? `SELECT role, content, timestamp FROM messages WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?`
    : `SELECT role, content, timestamp FROM messages WHERE session_id = ? ORDER BY timestamp ASC`;

  const stmt = getDb().prepare(query);
  const rows = (limit ? stmt.all(sessionId, limit) : stmt.all(sessionId)) as ChatMessage[];

  return limit ? rows.reverse() : rows;
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
  | 'guard_rejected';

/** 분석 이벤트 기록 */
export function logAnalyticsEvent(event: {
  eventType: AnalyticsEventType;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}): void {
  try {
    const stmt = getDb().prepare(`
      INSERT INTO analytics_events (event_type, session_id, timestamp, metadata)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(
      event.eventType,
      event.sessionId ?? null,
      Date.now(),
      event.metadata ? JSON.stringify(event.metadata) : null
    );
  } catch (err) {
    console.error('[Analytics] Failed to log event:', err);
  }
}

/** 인기 질문 조회 */
export function getPopularQuestions(limit = 10, days = 7): Array<{ question: string; category: string; count: number }> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const stmt = getDb().prepare(`
    SELECT
      json_extract(ae.metadata, '$.faq_id') as faq_id,
      COUNT(*) as count
    FROM analytics_events ae
    WHERE ae.event_type = 'faq_accessed'
      AND ae.timestamp > ?
      AND json_extract(ae.metadata, '$.faq_id') IS NOT NULL
    GROUP BY faq_id
    ORDER BY count DESC
    LIMIT ?
  `);
  const rows = stmt.all(cutoff, limit) as Array<{ faq_id: number; count: number }>;

  return rows.map((r) => {
    const faq = getFaqById(r.faq_id);
    return {
      question: faq?.question ?? 'Unknown',
      category: faq?.category ?? 'Unknown',
      count: r.count,
    };
  });
}

/** 일별 사용량 조회 */
export function getDailyUsage(days = 30): Array<{ date: string; sessions: number; messages: number }> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  // 세션 수
  const sessionStmt = getDb().prepare(`
    SELECT date(created_at / 1000, 'unixepoch') as date, COUNT(*) as count
    FROM sessions
    WHERE created_at > ?
    GROUP BY date
    ORDER BY date DESC
  `);
  const sessionRows = sessionStmt.all(cutoff) as Array<{ date: string; count: number }>;

  // 메시지 수
  const messageStmt = getDb().prepare(`
    SELECT date(timestamp / 1000, 'unixepoch') as date, COUNT(*) as count
    FROM messages
    WHERE timestamp > ?
    GROUP BY date
    ORDER BY date DESC
  `);
  const messageRows = messageStmt.all(cutoff) as Array<{ date: string; count: number }>;

  // 날짜별 합치기
  const dateMap = new Map<string, { sessions: number; messages: number }>();
  for (const r of sessionRows) {
    dateMap.set(r.date, { sessions: r.count, messages: 0 });
  }
  for (const r of messageRows) {
    const existing = dateMap.get(r.date) ?? { sessions: 0, messages: 0 };
    existing.messages = r.count;
    dateMap.set(r.date, existing);
  }

  return Array.from(dateMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** 카테고리별 접근 통계 */
export function getCategoryBreakdown(days = 7): Array<{ category: string; count: number }> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const stmt = getDb().prepare(`
    SELECT
      json_extract(metadata, '$.category') as category,
      COUNT(*) as count
    FROM analytics_events
    WHERE event_type = 'faq_accessed'
      AND timestamp > ?
      AND json_extract(metadata, '$.category') IS NOT NULL
    GROUP BY category
    ORDER BY count DESC
  `);
  return stmt.all(cutoff) as Array<{ category: string; count: number }>;
}

/** Guard 거부 목록 */
export function getGuardRejections(days = 7): Array<{ query: string; score: number; timestamp: number }> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const stmt = getDb().prepare(`
    SELECT
      json_extract(metadata, '$.query') as query,
      json_extract(metadata, '$.score') as score,
      timestamp
    FROM analytics_events
    WHERE event_type = 'guard_rejected'
      AND timestamp > ?
    ORDER BY timestamp DESC
    LIMIT 100
  `);
  return stmt.all(cutoff) as Array<{ query: string; score: number; timestamp: number }>;
}
