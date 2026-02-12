/**
 * MongoDB Document 타입 정의
 *
 * @repo/shared의 FaqItem, ChatMessage 등은 API 응답용 타입이고,
 * 여기서는 MongoDB 내부 저장 형식을 정의합니다.
 */
import type { ObjectId } from 'mongodb';

/** FAQ Document */
export interface FaqDocument {
  _id?: ObjectId;
  /** 외부 노출용 numeric ID (auto-increment) */
  id: number;
  category: string;
  subcategory?: string | null;
  question: string;
  answer: string;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

/** 세션 Document */
export interface SessionDocument {
  _id?: ObjectId;
  /** sess_{timestamp}_{random} 형식 */
  id: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown> | null;
}

/** 메시지 Document */
export interface MessageDocument {
  _id?: ObjectId;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

/** 분석 이벤트 Document */
export interface AnalyticsEventDocument {
  _id?: ObjectId;
  eventType: string;
  sessionId?: string | null;
  timestamp: number;
  metadata?: Record<string, unknown> | null;
}

/** Auto-increment 카운터 Document */
export interface CounterDocument {
  _id: string;
  seq: number;
}
