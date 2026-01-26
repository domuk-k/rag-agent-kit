# RAG Agent Kit Architecture

온라인 교육 플랫폼 FAQ 챗봇 — 하이브리드 검색 + 점수 기반 라우팅

---

## 핵심 동작 흐름

사용자 메시지가 응답으로 바뀌기까지의 전체 경로.

### 1. HTTP 진입 — `apps/api/src/routes/chat-stream.ts`

```
클라이언트 POST /api/chat/stream
  { messages: [...], sessionId?: string }
```

1. 세션이 없으면 자동 생성 (`sess_{timestamp}_{random}`)
2. 사용자 메시지를 DB에 저장
3. 세션의 최근 20개 메시지를 히스토리로 로드
4. `chatWithEvents(userMessage, { history })` 호출 — **여기서 에이전트 패키지로 진입**
5. 반환되는 `AsyncGenerator<ChatEvent>`를 SSE 이벤트로 변환하며 스트리밍
6. 스트리밍 완료 후 어시스턴트 응답을 DB에 저장

### 2. 하이브리드 검색 — `packages/vector/src/search.ts`

에이전트가 가장 먼저 실행하는 단계. 두 가지 검색을 병렬로 수행한 뒤 병합.

```
사용자 질문: "수강 취소는 어떻게 하나요?"
          │
          ├──→ FTS5 BM25 키워드 검색 (로컬, <1ms)
          │    "수강" "취소" → faq_fts MATCH → rowid + bm25 순위
          │
          └──→ OpenAI 임베딩 (text-embedding-3-small, 512차원)
               → sqlite-vec 코사인 거리 검색 (로컬, <5ms)
               → rowid + distance 순위
          │
          ▼
    Reciprocal Rank Fusion (k=60)
    ─────────────────────────────
    양쪽 순위를 RRF 공식으로 합산.
    두 검색에 모두 등장하는 항목일수록 높은 점수.
    FTS5-only 매칭은 기본 유사도 0.4 부여.
    벡터 매칭은 cosine distance → similarity 변환 (1 - distance).
          │
          ▼
    RRF 점수 순 정렬 → topK(5)개 → minScore 필터 → FaqSearchResult[]
```

**핵심 파일**:
- `search.ts:searchFaq()` — 전체 파이프라인 오케스트레이션
- `search.ts:ftsSearch()` — FTS5 BM25 쿼리 (`faq_fts MATCH`)
- `search.ts:vecSearch()` — sqlite-vec 코사인 거리 (`faq_vec MATCH`)
- `search.ts:reciprocalRankFusion()` — 두 결과 병합
- `embeddings.ts:getEmbedding()` — OpenAI API 호출

### 3. 점수 기반 라우팅 — `packages/agents/src/langchain-agent.ts`

검색 결과의 **최고 유사도 점수(topScore)**로 2가지 경로 중 하나를 선택. LLM 호출 없음.

```
topScore = results[0].similarity
          │
          ├── ≥ 0.5 (HIGH) ────────────────────────────────────────┐
          │   매칭된 FAQ                                            │
          │   • results[0].answer 그대로 반환                        │
          │   • + faq 이벤트 (참고 FAQ 카드)                         │
          │   • + source 이벤트 (출처)                               │
          │   • + action 이벤트 (추천 질문 최대 3개)                   │
          │   • <50ms 응답                                          │
          │                                                         │
          └── < 0.5 (LOW) ─────────────────────────────────────────┐│
              범위 외 질문으로 판단                                    ││
              • analytics_events에 guard_rejected 기록               ││
              • 고정 안내 메시지 반환 (학습지원센터 연락처)               ││
              └───────────────────────────────────────────────────┘│
                                                                   │
              모든 경로는 ChatEvent 제너레이터로 반환 ◀────────────────┘
```

### 4. SSE 이벤트 스트리밍 — 클라이언트 수신

에이전트가 yield하는 `ChatEvent`가 SSE로 변환되어 클라이언트에 전달되는 순서:

```
① status  {"status":"FAQ 검색 중...", "level":"loading"}
② status  {"status":"답변 반환 중...", "level":"loading"}
③ text    {"content":"수강 취소는..."}
④ faq     {"results":[...]}                                 ← 유사도 ≥ 0.2인 참고 FAQ
⑤ source  {"sources":[{"title":"...", "category":"..."}]}   ← 최상위 매칭 FAQ 출처
⑥ action  {"actions":[{"label":"...", "query":"..."}]}      ← 추천 질문 (최대 3개)
⑦ status  {"status":"완료", "level":"success"}
⑧ done    {}
```

**타입 정의**: `packages/shared/src/index.ts`의 `SSEEvent` discriminated union.

---

## 전체 요청-응답 시퀀스

```
Browser (React)                    API (Elysia)                    Agent                        Search
    │                                  │                              │                            │
    │  POST /api/chat/stream           │                              │                            │
    │  {messages, sessionId}           │                              │                            │
    │─────────────────────────────────▶│                              │                            │
    │                                  │ 세션 조회/생성                 │                            │
    │                                  │ 메시지 DB 저장                │                            │
    │                                  │ 히스토리 로드 (최근 20개)      │                            │
    │                                  │                              │                            │
    │                                  │ chatWithEvents(msg, {history})│                            │
    │                                  │─────────────────────────────▶│                            │
    │                                  │                              │ searchFaq(query)            │
    │                                  │                              │────────────────────────────▶│
    │                                  │                              │                            │ FTS5 + 벡터 + RRF
    │                                  │                              │◀────────────────────────────│
    │                                  │                              │                            │
    │                                  │                              │ 점수 분기                    │
    │                                  │                              │ ≥0.5: FAQ 직접 반환          │
    │                                  │                              │ <0.5: 범위 외 안내           │
    │                                  │                              │                            │
    │  ◀─ SSE: status, text, faq,      │◀─ ChatEvent yield ───────────│                            │
    │         source, action, done     │                              │                            │
    │                                  │ 어시스턴트 응답 DB 저장        │                            │
    │                                  │                              │                            │
```

---

## 프로젝트 구조

```
apps/
├── api/                     # Elysia 백엔드
│   └── src/routes/
│       ├── chat-stream.ts       # SSE 채팅 + 세션 관리
│       ├── ai-sdk.ts            # Vercel AI SDK 호환 엔드포인트
│       ├── faq.ts               # FAQ CRUD (ADMIN_TOKEN 인증)
│       ├── analytics.ts         # 분석 API
│       └── health.ts            # 헬스체크
│
└── rag-agent-web/           # React 19 프론트엔드
    └── src/
        ├── components/chat/     # ChatContainer, MessageContainer, ChatInput
        ├── hooks/               # use-chat-extended, use-admin, use-feedback
        ├── stores/              # Zustand (conversation, hitl, theme)
        └── pages/               # Admin, Conversations

packages/
├── agents/                  # 점수 기반 라우팅 에이전트
│   └── src/
│       ├── langchain-agent.ts   # chat(), chatWithEvents() — 핵심 로직
│       └── index.ts             # re-export
│
├── db/                      # SQLite (Bun 네이티브)
│   └── src/index.ts             # 스키마, CRUD, 세션, 분석 이벤트
│
├── vector/                  # 하이브리드 검색
│   └── src/
│       ├── search.ts            # searchFaq() — FTS5 + sqlite-vec + RRF
│       └── embeddings.ts        # OpenAI 임베딩 API
│
├── protocol/                # Eden Treaty 타입 안전 API 계약
└── shared/                  # 공통 타입 (FaqItem, SSEEvent, ChatMessage)
```

## Database Schema

SQLite (Bun 네이티브) — `packages/db/src/index.ts`

| 테이블 | 용도 |
|--------|------|
| `faq` | FAQ 데이터 (id, category, subcategory, question, answer) |
| `faq_fts` | FTS5 가상 테이블 — INSERT/UPDATE/DELETE 트리거로 자동 동기화 |
| `faq_vec` | sqlite-vec 임베딩 저장 (rowid → Float32 벡터, 512차원) |
| `sessions` | 대화 세션 (id: `sess_{ts}_{rand}`, created_at, updated_at) |
| `messages` | 세션별 메시지 (FK → sessions.id, role, content, timestamp) |
| `analytics_events` | 이벤트 로그 (faq_accessed, guard_rejected 등) |

## API Endpoints

Base URL: `http://localhost:8080`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/chat/stream` | - | SSE 채팅 스트리밍 (메인) |
| POST | `/api/chat` | - | 단순 텍스트 스트리밍 |
| POST | `/api/chat/ai-sdk` | - | Vercel AI SDK Data Stream Protocol |
| POST | `/api/session` | - | 세션 생성 |
| DELETE | `/api/session/:id` | - | 세션 삭제 |
| GET | `/api/faq` | - | FAQ 목록 |
| POST | `/api/faq` | Bearer | FAQ 생성 |
| PUT | `/api/faq/:id` | Bearer | FAQ 수정 |
| DELETE | `/api/faq/:id` | Bearer | FAQ 삭제 |
| POST | `/api/faq/reindex` | Bearer | FTS5 + 벡터 재인덱싱 |
| GET | `/api/analytics/*` | - | 인기 질문, 일별 사용량, Guard 거부 로그 |
| GET | `/health` | - | 헬스체크 |

## Environment Variables

```bash
# Embedding (OpenAI)
OPENAI_API_KEY=sk-proj-xxx                # 또는 OPENAI_EMBEDDING_API_KEY
EMBEDDING_MODEL=text-embedding-3-small    # 기본값
EMBEDDING_DIMENSION=512                   # 기본값

# SQLite
DB_PATH=data/faq.db

# Auth
ADMIN_TOKEN=your-secret-token

# Server
PORT=8080
```
