# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

온라인 교육 플랫폼 FAQ 챗봇 — Bun 모노레포. 하이브리드 검색(FTS5 + sqlite-vec + RRF)과 점수 기반 라우팅으로 유사도 ≥0.5이면 FAQ 직접 반환(<50ms), 미만이면 범위 외 안내. LLM 호출 없음.

## Development Commands

```bash
# 전체 실행 (API + Web 동시)
bun run dev

# 개별 서비스
bun run dev:api              # Elysia API (localhost:8080)
bun run dev:web              # React + Vite (localhost:5174)

# 타입 체크 & 빌드
bun run typecheck            # 전체 워크스페이스
bun run build                # packages → apps 순서

# DB 설정 & 시딩
bun run db:setup             # SQLite + sqlite-vec 확인
bun run seed                 # FAQ JSON → SQLite + FTS5 + 벡터 임베딩
```

macOS: `brew install sqlite` 필요 (Apple 기본 SQLite는 확장 로딩 미지원).

## Architecture

```
apps/
├── api/               # Elysia 백엔드 (SSE 스트리밍, FAQ CRUD, 세션 관리)
└── rag-agent-web/     # React 19 프론트엔드 (채팅 UI, 어드민, 대화 기록)

packages/
├── agents/            # 점수 기반 라우팅 에이전트 (LLM 없음, 검색 기반)
├── db/                # SQLite — FAQ, FTS5, sqlite-vec, 세션, 분석 이벤트
├── vector/            # 하이브리드 검색 (FTS5 + sqlite-vec + RRF) + OpenAI 임베딩
├── protocol/          # Eden Treaty 타입 안전 API 계약
└── shared/            # 공통 타입 (FaqItem, ChatMessage, SSEEvent 등)
```

## Key Patterns

### 점수 기반 라우팅 (`packages/agents/src/langchain-agent.ts`)

검색 결과의 최고 점수로 2가지 경로 분기 (LLM 호출 없음):

| 점수 | 경로 |
|------|------|
| ≥0.5 (HIGH) | FAQ answer 직접 반환 |
| <0.5 (LOW) | 범위 외 안내 메시지 |

### 하이브리드 검색 파이프라인 (`packages/vector/src/search.ts`)

```
사용자 질문
  → FTS5 BM25 키워드 검색 (로컬, <1ms)
  → OpenAI 임베딩 (text-embedding-3-small, 512차원)
  → sqlite-vec 코사인 유사도 검색 (로컬, <5ms)
  → Reciprocal Rank Fusion 병합 → 점수 기반 라우팅
```

### SSE 이벤트 스트리밍

이벤트 타입: `text`, `status`, `faq`, `action`, `source`, `done`, `error` — `packages/shared/src/index.ts`에 discriminated union으로 정의.

### FTS5 자동 동기화

`faq` 테이블의 INSERT/UPDATE/DELETE 트리거가 `faq_fts` 가상 테이블 자동 갱신. 수동 동기화 불필요.

### 세션 관리

- ID 형식: `sess_{timestamp}_{random}`
- 1시간 미활동 시 자동 정리 (30분 주기)
- 최근 20개 메시지만 컨텍스트 유지

## API Endpoints

- `POST /api/chat/stream` — 메인 채팅 (SSE 스트리밍)
- `POST /api/ai-sdk/*` — Vercel AI SDK 호환 엔드포인트
- `GET/POST/PUT/DELETE /api/faq` — FAQ CRUD (변경 작업은 `ADMIN_TOKEN` Bearer 인증)
- `POST/DELETE /api/session` — 세션 생성/삭제
- `GET /api/analytics/*` — 인기 질문, 일별 사용량, 카테고리 통계, Guard 거부 로그
- `GET /health` — 헬스체크

## Environment Variables

`.env.example` 참조. 필수:
- `OPENAI_API_KEY` — OpenAI 임베딩용
- `ADMIN_TOKEN` — FAQ CRUD 보호용 Bearer 토큰

선택:
- `EMBEDDING_MODEL` / `EMBEDDING_DIMENSION` — 임베딩 설정 (기본: `text-embedding-3-small`, 512)
- `DB_PATH` — SQLite 경로 (기본: `data/faq.db`)
- `PORT` — API 포트 (기본: `8080`)
- `LANGFUSE_*` — Langfuse 관측성 (선택)

## Frontend Stack

React 19 + Vite + Tailwind CSS 4. 상태: Zustand 5. 로컬 대화 기록: Dexie (IndexedDB). 스트리밍: Vercel AI SDK 6.0. UI: Radix UI 컴포넌트.

## Deployment

- **API**: Fly.io (`fly.toml`) — nrt 리전, 볼륨 마운트 `/app/data`, 첫 부팅 시 자동 시딩
- **Web**: Vercel (`vercel.json`) — `apps/rag-agent-web` 빌드
- **Docker**: `oven/bun:1` 베이스, `entrypoint.sh`에서 자동 시딩 후 서버 시작
