# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

네이버 스마트스토어 FAQ 챗봇 - RAG와 멀티에이전트 패턴을 활용한 Bun 모노레포 프로젝트. LangChain 기반 에이전트가 Qdrant 벡터 검색과 SQLite 세션 관리를 통해 멀티턴 대화를 지원함.

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

# Qdrant 설정 및 데이터 시딩
docker-compose up -d           # Qdrant 시작
bun run qdrant:setup           # 벡터 컬렉션 초기화
bun run seed                   # FAQ 데이터 시딩
```

## Architecture

```
apps/
├── api/          # Elysia 백엔드 (SSE 스트리밍, FAQ CRUD, 세션 관리)
└── web/          # React 프론트엔드 (채팅 UI, 어드민)

packages/
├── agents/       # LangChain 에이전트 (chat, chatWithEvents)
├── db/           # SQLite - FAQ, 세션, 메시지, 분석 이벤트
├── vector/       # Qdrant 벡터 검색 + HuggingFace 임베딩
├── protocol/     # Eden Treaty 타입 안전 API 계약
└── shared/       # 공통 타입 (FaqItem, ChatMessage, SSEEvent)
```

## Key Patterns

**Guard 메커니즘**: `packages/agents/src/langchain-agent.ts:146` - FAQ 유사도 0.25 미만이면 LLM 호출 없이 범위 외 응답 반환

**SSE 이벤트 타입**: text, status, faq, action, source, done, error - `packages/shared/src/types.ts` 참조

**세션 관리**: 자동 생성 ID `sess_{timestamp}_{random}`, 1시간 미활동 시 자동 정리, 최근 20개 메시지 유지

## Environment Variables

`.env.example` 복사 후 설정:
- `OPENROUTER_API_KEY` - OpenRouter API 키
- `OPENROUTER_MODEL` - 모델 ID (기본: google/gemini-2.5-flash-preview-05-20)
- `QDRANT_URL` - Qdrant 주소 (기본: http://localhost:6333)
- `ADMIN_TOKEN` - FAQ CRUD 보호용 Bearer 토큰

## API Endpoints

- `POST /api/chat/stream` - 메인 채팅 (SSE 스트리밍)
- `GET/POST/PUT/DELETE /api/faq` - FAQ CRUD (POST/PUT/DELETE은 ADMIN_TOKEN 필요)
- `GET /api/analytics/*` - 인기 질문, 일별 사용량 등

## Tools

LangChain 에이전트가 사용하는 도구:
1. `search_faq` - Qdrant 벡터 검색으로 FAQ 조회
2. `check_order_status` - 주문번호로 배송 상태 조회 (현재 Mock)
