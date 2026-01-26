# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

온라인 교육 플랫폼 FAQ 챗봇 - 하이브리드 검색(FTS5 + sqlite-vec)과 점수 기반 라우팅을 활용한 Bun 모노레포 프로젝트. 고신뢰도 매칭은 LLM 없이 직접 반환, 중간 신뢰도만 LLM 종합 답변 생성.

## Development Commands

```bash
# 전체 실행 (API + Web 동시)
bun run dev

# 개별 서비스
bun run dev:api    # Elysia API 서버 (localhost:8080)
bun run dev:web    # React + Vite (localhost:5173)

# 타입 체크
bun run typecheck

# 빌드
bun run build

# DB 설정 확인 및 데이터 시딩
bun run db:setup               # SQLite + sqlite-vec 확인
bun run seed                   # FAQ 데이터 시딩 (SQLite + FTS5 + 벡터)
```

## Architecture

```
apps/
├── api/          # Elysia 백엔드 (SSE 스트리밍, FAQ CRUD, 세션 관리)
└── web/          # React 프론트엔드 (채팅 UI, 어드민)

packages/
├── agents/       # 점수 기반 라우팅 (직접반환 / LLM종합 / 범위외거부)
├── db/           # SQLite - FAQ, FTS5, sqlite-vec, 세션, 분석 이벤트
├── vector/       # 하이브리드 검색 (FTS5 + sqlite-vec + RRF) + OpenAI 임베딩
├── protocol/     # Eden Treaty 타입 안전 API 계약
└── shared/       # 공통 타입 (FaqItem, ChatMessage, SSEEvent)
```

## Key Patterns

**점수 기반 라우팅**: `packages/agents/src/langchain-agent.ts`
- HIGH (>0.8): FAQ answer 직접 반환 (LLM 호출 없음, <50ms)
- MEDIUM (0.3~0.8): LLM이 FAQ 컨텍스트로 종합 답변 생성
- LOW (<0.3): 범위 외 안내 메시지 반환 (LLM 호출 없음)

**하이브리드 검색**: `packages/vector/src/search.ts` - FTS5 키워드 + sqlite-vec 벡터 + Reciprocal Rank Fusion

**FTS5 자동 동기화**: faq 테이블 INSERT/UPDATE/DELETE 트리거가 faq_fts 자동 갱신

**SSE 이벤트 타입**: text, status, faq, action, source, done, error - `packages/shared/src/index.ts` 참조

**세션 관리**: 자동 생성 ID `sess_{timestamp}_{random}`, 1시간 미활동 시 자동 정리, 최근 20개 메시지 유지

## Environment Variables

`.env.example` 복사 후 설정:
- `OPENROUTER_API_KEY` - OpenRouter API 키
- `OPENROUTER_MODEL` - 모델 ID (기본: google/gemini-2.5-flash-preview-05-20)
- `OPENAI_API_KEY` - OpenAI API 키 (임베딩용)
- `ADMIN_TOKEN` - FAQ CRUD 보호용 Bearer 토큰

macOS 개발 환경: `brew install sqlite` 필요 (확장 로딩 지원)

## API Endpoints

- `POST /api/chat/stream` - 메인 채팅 (SSE 스트리밍)
- `GET/POST/PUT/DELETE /api/faq` - FAQ CRUD (POST/PUT/DELETE은 ADMIN_TOKEN 필요)
- `GET /api/analytics/*` - 인기 질문, 일별 사용량 등

## Search Pipeline

```
사용자 질문
  → FTS5 BM25 키워드 검색 (로컬, <1ms)
  → OpenAI 임베딩 (text-embedding-3-small, 512차원)
  → sqlite-vec 코사인 유사도 검색 (로컬, <5ms)
  → RRF 병합 → 점수 기반 라우팅
```
