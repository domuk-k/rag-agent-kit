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

에이전트가 가장 먼저 실행하는 단계. BM25와 Vector Search를 병렬 수행한 뒤 RRF로 병합.

```
사용자 질문: "수강 취소는 어떻게 하나요?"
          │
          ├──→ Atlas Search (BM25, lucene.korean)
          │    $search: text query → searchScore 순위
          │
          └──→ Transformers.js 임베딩 (e5-small, 384차원, ~15ms)
               → Atlas Vector Search ($vectorSearch)
               → vectorSearchScore 순위
          │
          ▼
    Reciprocal Rank Fusion (k=60)
    ─────────────────────────────
    양쪽 순위를 RRF 공식으로 합산: score(d) = Σ 1/(k + rank_i)
    동점 시 vector rank 우선 (의미 유사도가 키워드보다 정확).
          │
          ▼
    이중 확인 게이트 (Dual-Source Confirmation)
    ───────────────────────────────────────────
    BM25 정규화: rawScore / (rawScore + 2)

    양쪽 모두 매칭 → threshold 0.55 (신뢰도 높음)
    단독 매칭     → threshold 0.70 (보수적)
    vector-only   → BM25 norm = 0 → 항상 필터
          │
          ▼
    RRF 순 정렬 → topK(5)개 → threshold 필터 → FaqSearchResult[]
```

**핵심 파일**:
- `search.ts:searchFaq()` — 전체 파이프라인 오케스트레이션
- `search.ts:runTextSearch()` — Atlas Search BM25 (`$search`)
- `search.ts:runVectorSearch()` — Atlas Vector Search (`$vectorSearch`)
- `embeddings.ts:embedQuery()` — Transformers.js ONNX 임베딩 (로컬)
- `embeddings.ts:embedDocuments()` — 배치 임베딩 (시딩 시)

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
          │   • <50ms 응답 (임베딩 첫 로드 제외)                      │
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
    │                                  │                              │                            │ BM25 + Vector + RRF
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
├── db/                      # MongoDB Atlas
│   └── src/
│       ├── index.ts             # 연결, CRUD, 세션, 분석 이벤트
│       ├── types.ts             # FaqDocument (embedding 포함)
│       └── scripts/seed.ts      # JSON → MongoDB + 임베딩 생성
│
├── vector/                  # 하이브리드 검색
│   └── src/
│       ├── search.ts            # searchFaq() — BM25 + Vector + RRF
│       └── embeddings.ts        # Transformers.js 로컬 임베딩
│
├── protocol/                # Eden Treaty 타입 안전 API 계약
└── shared/                  # 공통 타입 (FaqItem, SSEEvent, ChatMessage)
```

## Database — MongoDB Atlas (M0 Free Tier)

Collection: `faqs`

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | number | 순차 ID (1-based) |
| `category` | string | 카테고리 |
| `subcategory` | string? | 서브카테고리 |
| `question` | string | FAQ 질문 |
| `answer` | string | FAQ 답변 |
| `embedding` | number[] | 384차원 e5-small 임베딩 |
| `createdAt` | Date | 생성일 |
| `updatedAt` | Date | 수정일 |

### Atlas 인덱스 (M0 무료 3개 중 2개 사용)

| 인덱스 | 타입 | 설명 |
|--------|------|------|
| `faq_text_search` | Atlas Search | lucene.korean, question+answer+category |
| `faq_vector_index` | Vector Search | cosine, 384차원 |

### 임베딩

| 항목 | 값 |
|------|-----|
| 모델 | Xenova/multilingual-e5-small (ONNX, int8 양자화) |
| 차원 | 384 |
| 크기 | ~113MB (첫 로드 시 다운로드, 이후 캐시) |
| 속도 | ~15-30ms/query (CPU), 첫 로드 ~2초 |
| 비용 | 무료 (로컬 실행) |

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
| POST | `/api/faq/reindex` | Bearer | 임베딩 재생성 |
| GET | `/api/analytics/*` | - | 인기 질문, 일별 사용량, Guard 거부 로그 |
| GET | `/health` | - | 헬스체크 |

## Environment Variables

```bash
# MongoDB Atlas
MONGODB_URI=mongodb+srv://...

# Auth
ADMIN_TOKEN=your-secret-token

# Server
PORT=8080

# Optional
LANGFUSE_SECRET_KEY=...     # 관측성
LANGFUSE_PUBLIC_KEY=...
```
