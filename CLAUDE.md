# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

온라인 교육 플랫폼 FAQ 챗봇 — Bun 모노레포. 하이브리드 검색(Atlas Search BM25 + Transformers.js Vector + RRF)과 점수 기반 라우팅으로 유사도 ≥0.5이면 FAQ 직접 반환(<50ms), 미만이면 범위 외 안내. LLM 호출 없음, 외부 API 비용 $0.

## Development Commands

```bash
# 전체 실행 (API + Web 동시)
bun run dev

# 개별 서비스
bun run dev:api              # Elysia API (localhost:8080)
bun run dev:web              # React + Vite (localhost:5174)

# 타입 체크 & 빌드
bun run typecheck            # 전체 워크스페이스
bun run build                # apps 빌드 (API + Web)

# DB 시딩
bun run seed                 # FAQ JSON → MongoDB + 임베딩 생성
bun run db:indexes           # Atlas Search/Vector 인덱스 생성
```

## Architecture

```
apps/
├── api/               # Elysia 백엔드 (SSE 스트리밍, FAQ CRUD, 세션 관리)
└── rag-agent-web/     # React 19 프론트엔드 (채팅 UI, 어드민, 대화 기록)

packages/
├── agents/            # 점수 기반 라우팅 에이전트 (LLM 없음, 검색 기반)
├── db/                # MongoDB Atlas — FAQ, 세션, 메시지, 분석 이벤트
├── vector/            # 하이브리드 검색 (BM25 + Vector + RRF) + Transformers.js 임베딩
├── protocol/          # Eden Treaty 타입 안전 API 계약
└── shared/            # 공통 타입 (FaqItem, ChatMessage, SSEEvent 등)

infra/
└── ecs-task-definition.json  # ECS Fargate 배포 설정

docs/
├── architecture.md           # 상세 아키텍처 문서
└── adr-001-hybrid-search.md  # 하이브리드 검색 ADR
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
  → Atlas Search (lucene.korean BM25)     ─┐
  → Transformers.js 임베딩 (e5-small, 384d) ─┤
  → Atlas Vector Search (cosine)          ─┘
  → RRF(k=60) 병합 (동점 시 vector rank 우선)
  → 이중 확인 게이트:
      양쪽 매칭 → threshold 0.55
      단독 매칭 → threshold 0.70
  → 점수 기반 라우팅
```

- BM25 정규화: `rawScore / (rawScore + 2)` — threshold 판단용
- Vector cosine score는 threshold에 사용하지 않음 (0.91-0.97 클러스터, 분별 불가)
- Vector는 ranking에만 기여 (구어체 의미 매칭)

### 임베딩 (`packages/vector/src/embeddings.ts`)

- 모델: `Xenova/multilingual-e5-small` (ONNX int8, 384차원, ~113MB)
- Bun 프로세스 내 직접 실행 (Transformers.js), 외부 서비스 불필요
- e5 모델은 `query:` / `passage:` prefix 필수
- 첫 호출 시 모델 로딩 (~2초), 이후 ~15-30ms/쿼리
- Promise-based singleton으로 동시 첫 호출 시 중복 로딩 방지

### FAQ CRUD 시 임베딩 동기화

`apps/api/src/routes/faq.ts`에서 FAQ 생성/수정 시 자동으로 임베딩 생성.
`POST /api/faq/reindex`로 전체 임베딩 재생성 가능.

### MongoDB 컬렉션

| 컬렉션 | 용도 |
|--------|------|
| `faqs` | FAQ 데이터 + embedding (384차원) |
| `sessions` | 세션 관리 |
| `messages` | 채팅 메시지 |
| `analyticsEvents` | 분석 이벤트 |
| `counters` | Auto-increment 시퀀스 |

### Atlas 인덱스 (M0 무료 3개 중 2개 사용)

| 인덱스 | 타입 | 대상 |
|--------|------|------|
| `faq_text_search` | Atlas Search | question, answer (lucene.korean) |
| `faq_vector_index` | Vector Search | embedding (cosine, 384d) |

### SSE 이벤트 스트리밍

이벤트 타입: `text`, `status`, `faq`, `action`, `source`, `done`, `error` — `packages/shared/src/index.ts`에 discriminated union으로 정의.

### 세션 관리

- ID 형식: `sess_{timestamp}_{random}`
- 1시간 미활동 시 자동 정리 (30분 주기)
- 최근 20개 메시지만 컨텍스트 유지

## API Endpoints

- `POST /api/chat/stream` — 메인 채팅 (SSE 스트리밍)
- `POST /api/ai-sdk/*` — Vercel AI SDK 호환 엔드포인트
- `GET/POST/PUT/DELETE /api/faq` — FAQ CRUD (변경 작업은 `ADMIN_TOKEN` Bearer 인증)
- `POST /api/faq/reindex` — 전체 임베딩 재생성 (Bearer 인증)
- `POST/DELETE /api/session` — 세션 생성/삭제
- `GET /api/analytics/*` — 인기 질문, 일별 사용량, 카테고리 통계, Guard 거부 로그
- `GET /health` — 헬스체크 (MongoDB ping 포함)

## Environment Variables

`.env.example` 참조. 필수:
- `MONGODB_URI` — MongoDB Atlas 연결 문자열
- `ADMIN_TOKEN` — FAQ CRUD 보호용 Bearer 토큰

선택:
- `MONGODB_DB_NAME` — DB 이름 (기본: `rag_agent_kit`)
- `PORT` — API 포트 (기본: `8080`)
- `LANGFUSE_*` — Langfuse 관측성 (선택)

## Frontend Stack

React 19 + Vite + Tailwind CSS 4. 상태: Zustand 5. 로컬 대화 기록: Dexie (IndexedDB). 스트리밍: Vercel AI SDK 6.0. UI: Radix UI 컴포넌트.

## Deployment

- **API**: ECS Fargate (`infra/ecs-task-definition.json`) — ap-northeast-1, 1024 CPU / 2048 MB
- **DB**: MongoDB Atlas M0 (외부 관리형, Atlas Search + Vector Search)
- **Web**: Vercel (`vercel.json`) — `apps/rag-agent-web` 빌드
- **Docker**: `oven/bun:1` multi-stage 빌드, ONNX 모델 사전 캐시, `entrypoint.sh`에서 MongoDB 대기 후 시딩 및 서버 시작
