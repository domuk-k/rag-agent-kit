# RAG Agent Kit Architecture

온라인 교육 플랫폼 FAQ 챗봇 - RAG 기반 멀티턴 대화 시스템

## Project Structure

```
rag-agent-kit/
├── apps/
│   └── api/                 # Elysia API 서버
│       └── src/routes/
│           ├── chat-stream.ts   # SSE 채팅 스트리밍
│           ├── ai-sdk.ts        # Vercel AI SDK 호환 엔드포인트
│           ├── faq.ts           # FAQ CRUD
│           ├── analytics.ts     # 분석 API
│           └── health.ts        # 헬스체크
│
├── packages/
│   ├── agents/              # LangChain 에이전트
│   │   └── src/
│   │       └── langchain-agent.ts
│   │
│   ├── db/                  # SQLite 데이터베이스
│   │   └── src/index.ts
│   │
│   ├── vector/              # Qdrant 벡터 검색
│   │   └── src/
│   │       ├── client.ts        # Qdrant 클라이언트
│   │       ├── embeddings.ts    # OpenAI 임베딩
│   │       ├── search.ts        # 벡터 검색
│   │       └── upsert.ts        # 벡터 업서트
│   │
│   ├── shared/              # 공통 타입
│   │   └── src/index.ts
│   │
│   └── protocol/            # Eden Treaty API 계약
│
└── data/
    ├── faq.json             # FAQ 시드 데이터
    └── faq.db               # SQLite DB 파일
```

## Database Schema

SQLite (Bun 네이티브) - `packages/db/src/index.ts`

### Tables

#### `faq` - FAQ 데이터
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | PK, 자동증가 |
| category | TEXT | 카테고리 (일반, 시험/과제, 학습진도, 로그인, 동영상, 도서) |
| subcategory | TEXT | 서브카테고리 (nullable) |
| question | TEXT | 질문 |
| answer | TEXT | 답변 |
| created_at | TEXT | 생성일시 |
| updated_at | TEXT | 수정일시 |

#### `sessions` - 대화 세션
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | PK, `sess_{timestamp}_{random}` 형식 |
| created_at | INTEGER | 생성 타임스탬프 (ms) |
| updated_at | INTEGER | 마지막 활동 타임스탬프 (ms) |
| metadata | TEXT | JSON 메타데이터 (nullable) |

#### `messages` - 대화 메시지
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | PK, 자동증가 |
| session_id | TEXT | FK → sessions.id |
| role | TEXT | 'user' \| 'assistant' \| 'system' |
| content | TEXT | 메시지 내용 |
| timestamp | INTEGER | 타임스탬프 (ms) |

#### `analytics_events` - 분석 이벤트
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | PK, 자동증가 |
| event_type | TEXT | 이벤트 타입 |
| session_id | TEXT | FK → sessions.id (nullable) |
| timestamp | INTEGER | 타임스탬프 (ms) |
| metadata | TEXT | JSON 메타데이터 |

**Event Types:**
- `session_created` - 세션 생성
- `session_deleted` - 세션 삭제
- `faq_accessed` - FAQ 조회 (metadata: faq_id, category)
- `faq_created` - FAQ 생성
- `faq_updated` - FAQ 수정
- `faq_deleted` - FAQ 삭제
- `guard_rejected` - Guard 거부 (metadata: query, score)

## API Endpoints

Base URL: `http://localhost:3333`

### Chat

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat/stream` | SSE 채팅 스트리밍 (메인) |
| POST | `/api/chat` | 단순 텍스트 스트리밍 |
| POST | `/api/chat/ai-sdk` | Vercel AI SDK Data Stream Protocol |

#### POST /api/chat/stream

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "수강 취소는 어떻게 하나요?" }
  ],
  "sessionId": "sess_xxx" // optional
}
```

**Response (SSE):**
```
event: status
data: {"type":"status","status":"session:sess_xxx","level":"info"}

event: faq
data: {"type":"faq","results":[...]}

event: text
data: {"type":"text","content":"안녕하세요..."}

event: source
data: {"type":"source","sources":[{"title":"...", "category":"..."}]}

event: done
data: {"type":"done"}
```

### FAQ CRUD

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/faq` | - | 전체 FAQ 조회 |
| GET | `/api/faq/:id` | - | 단일 FAQ 조회 |
| POST | `/api/faq` | ADMIN_TOKEN | FAQ 생성 |
| PUT | `/api/faq/:id` | ADMIN_TOKEN | FAQ 수정 |
| DELETE | `/api/faq/:id` | ADMIN_TOKEN | FAQ 삭제 |
| POST | `/api/faq/reindex` | ADMIN_TOKEN | 벡터 재인덱싱 |
| POST | `/api/faq/reset` | ADMIN_TOKEN | 전체 리셋 + 재시딩 |

**Auth Header:**
```
Authorization: Bearer {ADMIN_TOKEN}
```

### Analytics

| Method | Path | Query Params | Description |
|--------|------|--------------|-------------|
| GET | `/api/analytics/popular-questions` | limit, days | 인기 질문 |
| GET | `/api/analytics/daily-usage` | days | 일별 사용량 |
| GET | `/api/analytics/category-breakdown` | days | 카테고리별 통계 |
| GET | `/api/analytics/guard-rejections` | days | Guard 거부 로그 |

### Session

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/session` | 세션 생성 |
| GET | `/api/session/:id` | 세션 조회 |
| DELETE | `/api/session/:id` | 세션 삭제 |

## Session Management

### 세션 생성
- 클라이언트가 `sessionId`를 제공하지 않으면 자동 생성
- 형식: `sess_{timestamp(base36)}_{random(7자)}`
- 예: `sess_mkqn447z_755jujm`

### 세션 유지
- 매 메시지마다 `updated_at` 갱신
- 최근 20개 메시지만 컨텍스트로 사용

### 세션 정리
- 30분마다 백그라운드 정리 실행
- 1시간 미활동 세션 자동 삭제

```typescript
// 정리 로직
const SESSION_TTL = 60 * 60 * 1000; // 1시간
const CLEANUP_INTERVAL = 30 * 60 * 1000; // 30분

setInterval(() => {
  const deleted = cleanupSessions(SESSION_TTL);
  console.log(`[Cleanup] Deleted ${deleted} stale sessions`);
}, CLEANUP_INTERVAL);
```

## Vector Search

Qdrant + OpenAI Embeddings

### 설정
- **Collection**: `faq` (환경변수: `QDRANT_COLLECTION`)
- **Embedding Model**: `text-embedding-3-small`
- **Dimensions**: 1536
- **Distance**: Cosine

### 검색 파라미터
- `topK`: 5 (기본값)
- `minScore`: 0.3 (유사도 임계값)

### 데이터 흐름
```
User Query
    ↓
OpenAI Embedding (1536 dims)
    ↓
Qdrant Vector Search
    ↓
FAQ Results (similarity score)
    ↓
LangChain Agent
    ↓
Streaming Response
```

## Agent Architecture

`packages/agents/src/langchain-agent.ts`

### 구성요소
- **LLM**: OpenRouter → Gemini 2.5 Flash Lite
- **Tools**: `search_faq` (Qdrant 벡터 검색)
- **Streaming**: Token-by-token SSE

### SYSTEM_PROMPT 핵심 규칙
1. FAQ 원문의 모든 정보를 빠짐없이 포함
2. 구성 재배치, 말투 변경은 허용
3. 검색 결과 없으면 학습지원센터 안내

### 이벤트 타입 (ChatEvent)
```typescript
type ChatEvent =
  | { type: 'text'; content: string }
  | { type: 'status'; status: string; level: 'info' | 'loading' | 'success' | 'error' }
  | { type: 'faq'; results: FaqSearchResult[] }
  | { type: 'action'; actions: { label: string; query: string }[] }
  | { type: 'source'; sources: { title: string; url?: string; category: string }[] };
```

## Environment Variables

```bash
# LLM
OPENROUTER_API_KEY=sk-or-v1-xxx
OPENROUTER_MODEL=google/gemini-2.5-flash-lite
OPENAI_BASE_URL=https://openrouter.ai/api/v1

# Embedding
OPENAI_EMBEDDING_API_KEY=sk-proj-xxx

# Vector DB
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=xxx  # Qdrant Cloud용
QDRANT_COLLECTION=faq

# SQLite
DB_PATH=data/faq.db

# Auth
ADMIN_TOKEN=your-secret-token

# Server
PORT=3333
```

## Development Commands

```bash
# 전체 실행
bun run dev

# 개별 서비스
bun run dev:api    # API (localhost:3333)

# 데이터베이스
docker-compose up -d   # Qdrant 시작
bun run qdrant:setup   # 컬렉션 초기화
bun run seed           # FAQ 시딩

# 타입체크
bun run typecheck
```

## Deployment (Fly.io)

```bash
# 배포
fly deploy

# 시크릿 설정
fly secrets set KEY=value

# 로그 확인
fly logs
```
