# ADR-001: 하이브리드 검색 아키텍처 (BM25 + Vector + RRF)

- **상태**: Accepted
- **날짜**: 2026-02-12
- **의사결정자**: @dwkim

## Context

온라인 교육 플랫폼 FAQ 챗봇의 검색 정확도 개선이 필요했다.

BM25 단독 검색(Atlas Search, lucene.korean)은 88% 정확도를 달성했으나 **구어체 쿼리에서 40% 정확도**라는 구조적 한계가 있었다. 유사 FAQ 간 키워드 겹침으로 인한 오매칭이 원인:

- "과제 제출 어떻게 함?" → FAQ#21 "과제 제출확인" (오답) vs FAQ#18 "과제 제출" (정답)
- "학습 진도 안올라감" → FAQ#13 "학습 진도제한" (오답) vs FAQ#15 "진도율 반영" (정답)
- "시험 언제 봄?" → FAQ#24 "과제 재제출" (오답) vs FAQ#23 "시험 보는법" (정답)

모두 BM25가 키워드 겹침으로 인접 FAQ를 혼동하는 패턴이다.

## Decision

### 1. 임베딩 모델: Transformers.js + multilingual-e5-small

**선택**: Bun 프로세스 내에서 ONNX 모델 직접 실행

**후보 비교**:

| 옵션 | 비용 | 지연 | 인프라 | 비고 |
|------|------|------|--------|------|
| **Transformers.js (e5-small)** | 무료 | ~15-30ms | 없음 | ONNX, 384차원, 113MB |
| Transformers.js (e5-base) | 무료 | ~50-100ms | 없음 | ONNX, 768차원, 470MB |
| OpenAI text-embedding-3-small | $0.02/1M tok | ~100-200ms | API 의존 | 512-1536차원 |
| Ollama + nomic-embed | 무료 | ~30-50ms | 사이드카 필요 | Docker 추가 컨테이너 |
| Cohere embed-multilingual-v3 | 100쿼리/분 무료 | ~150ms | API 의존 | Rate limit |

**e5-small을 e5-base 대신 선택한 이유**:
- 37개 FAQ 규모에서 384차원으로 충분한 구분력 확인 (구어체 5/5 정확도)
- 모델 크기 113MB vs 470MB — ECS Fargate 메모리 영향 최소화
- 로딩 시간 ~2초 vs ~5초 — cold start 영향
- base 모델의 추가 차원이 소규모 FAQ에서 실질적 이점 없음

**Transformers.js를 Ollama 대신 선택한 이유**:
- 별도 Docker 사이드카 불필요 — ECS task definition 단순화
- 프로세스 내 실행으로 IPC 오버헤드 없음
- npm 패키지로 설치 — 의존성 관리 간단

### 2. 검색 병합: Reciprocal Rank Fusion (RRF)

**선택**: k=60으로 BM25 순위와 Vector 순위를 앱 레벨에서 병합

```
RRF_score(d) = Σ 1/(k + rank_i)   (k=60)
```

**Atlas M0 제약**: `$rankFusion` 오퍼레이터는 M10+ 전용. M0에서는 `$search`와 `$vectorSearch`를 별도 쿼리로 실행한 뒤 애플리케이션에서 병합해야 한다.

**k=60 선택 근거**: RRF 논문의 표준값. 높은 k는 순위 차이를 완화하여 두 소스 간 균형을 유지한다.

**동점 해결**: RRF 점수가 동일할 때 vector rank가 낮은(더 좋은) 문서를 우선. 이유: 구어체 쿼리에서 BM25가 키워드 겹침으로 오답을 1위로 올리는 반면, vector는 의미적으로 정확한 FAQ를 찾는다.

### 3. Threshold: 이중 확인 게이트

**선택**: 단일 threshold 대신 소스 합의에 따른 가변 threshold

| 조건 | Threshold | 근거 |
|------|-----------|------|
| BM25 + Vector 양쪽 매칭 | 0.55 | 독립 신호의 합의 → 높은 신뢰도 |
| 단독 소스 매칭 | 0.70 | BM25-only 실험에서 검증된 안전 threshold |
| Vector-only | 필터됨 | BM25 norm = 0 → 어떤 threshold도 통과 불가 |

**유사도 점수 = BM25 정규화**: `rawScore / (rawScore + 2)`

Vector cosine score는 threshold에 사용하지 않음. e5-small의 한국어 FAQ에서 cosine similarity가 0.91-0.97로 클러스터되어 범위 내/범위 외 분리가 불가능함 (gap: -0.008, 분포 겹침).

### 4. Vector의 역할 제한

Vector search는 **ranking에만 기여**하고, threshold 판단에는 기여하지 않는다.

- BM25: threshold 판단 (범위 내/외 분리에 효과적)
- Vector: ranking 개선 (구어체·패러프레이즈에서 정확한 FAQ 식별)

## Consequences

### 정확도 변화

| 카테고리 | BM25-only | Hybrid | 변화 |
|---------|----------|--------|------|
| 정확 매칭 | 100% | 100% | = |
| 패러프레이즈 | 100% | 100% | = |
| **구어체** | **40%** | **100%** | **+60%p** |
| 키워드 | ~100% | 80% | -20%p |
| 범위 외 | 100% | 80% | -20%p |
| **전체** | **88%** | **92%** | **+4%p** |

### 트레이드오프

**개선**:
- 구어체 완전 해결 — 핵심 사용자 시나리오
- LLM 호출 없이 유지 — 비용 $0, 지연 <50ms

**비용**:
- 메모리 +~150MB (e5-small int8 모델)
- Cold start +~2초 (첫 임베딩 모델 로딩)
- 키워드 "배송" 오매칭 — 모호한 단일 키워드에서 유사 FAQ 혼동
- "피자 주문하고 싶어요" false positive — "~하고 싶어요" 문법 패턴 유사도

### 잔여 한계

1. **e5-small cosine 클러스터링**: 0.91-0.97 범위에 모든 쿼리가 집중 → threshold 분별 불가
2. **lucene.korean 문법 토큰**: "싶어요", "하고" 등 문법 요소를 content word로 취급
3. **Atlas M0 $rankFusion 미지원**: 2개 쿼리 + 앱 레벨 병합 필요

## Alternatives Considered

### A. BM25-only (기존)
- 장점: 구현 단순, 메모리 절약
- 단점: 구어체 40% — 핵심 시나리오 실패
- **기각 사유**: 한국어 구어체는 가장 빈번한 사용자 입력 패턴

### B. OpenAI 임베딩 + Vector Search
- 장점: 고품질 임베딩 (1536차원)
- 단점: API 비용, 지연 100-200ms, 외부 의존
- **기각 사유**: "LLM 호출 없음" 설계 원칙과 충돌

### C. Vector-only (BM25 제거)
- 장점: 구현 단순
- 단점: cosine 클러스터링으로 threshold 분별 불가 → 범위 외 필터 실패
- **기각 사유**: 범위 외 쿼리를 거부할 수 없음

### D. LLM 기반 re-ranker
- 장점: 최고 정확도 가능
- 단점: 비용, 지연 500ms+, 외부 의존
- **기각 사유**: 37개 FAQ에서 과잉 설계

## 임베딩 모델 선택 근거 보완

### MTEB Retrieval 벤치마크

초기 비교는 비용/지연/인프라 중심이었다. MTEB(Massive Text Embedding Benchmark) Retrieval 카테고리 스코어도 고려해야 한다는 피드백을 반영하여 2025-2026 기준 대안을 조사했다.

단, 우리 시스템에서 vector는 **ranking에만 기여**하고 threshold 판단에는 사용하지 않으므로, MTEB Retrieval 스코어 향상이 실질적 정확도 개선으로 이어지는지가 핵심 판단 기준이다.

### 검증된 대안 모델 (2025-2026)

| 모델 | 파라미터 | 크기 (q8) | 차원 | ONNX/TJS | MTEB 순위 | 비고 |
|------|---------|----------|------|----------|----------|------|
| **e5-small (현재)** | 117M | ~113MB | 384 | O | - | 2023, 구어체 ranking 100% |
| **EmbeddingGemma-300M** | 308M | ~200MB | 128-768 | O | under-500M 1위 | 2025.09, Matryoshka MRL |
| **Qwen3-Embedding-0.6B** | 600M | ~300MB | 512-4096 | O (TJS 3.6+) | 높음 | 2025, instruction-aware |
| Nomic Embed v2 MoE | 475M (305M active) | ~450MB | 256-768 | **X** | 높음 | ONNX export 불가 (custom arch) |
| Jina Embeddings v4 | **3.8B** | ~2GB+ | 1024 | 미확인 | SOTA | Bun 내 실행 비현실적 |
| Qwen3-Embedding-8B | **8B** | ~4GB | 4096 | GGUF만 | MTEB 1위 (70.58) | Bun 내 실행 불가 |

**Bun 프로세스 내 실행 가능한 현실적 후보**: EmbeddingGemma-300M, Qwen3-Embedding-0.6B

### 현재 교체하지 않는 이유

1. **남은 실패가 임베딩 품질 문제가 아님**
   - "배송" → 모호한 단일 키워드 (BM25 + Vector 모두 유사 FAQ 매칭)
   - "피자 주문하고 싶어요" → "~하고 싶어요" 문법 패턴 유사도 (BM25 문제)
   - 더 좋은 임베딩 모델로도 이 2건은 해결 불가

2. **vector ranking은 이미 100% 정확**
   - 구어체 5/5에서 vector가 정답 FAQ를 top rank로 올림
   - 개선 여지가 0%

3. **교체 비용 대비 이득 없음**
   - 재시딩 + Vector Search 인덱스 재생성 + 테스트 필요
   - 메모리 +100-150MB, cold start +1-2초
   - 37개 FAQ에서 측정 가능한 정확도 차이 없을 가능성 높음

### 교체 검토 트리거

- FAQ가 100개+ 규모로 확장되어 유사 FAQ 간 의미 구분이 필요해질 때
- Korean Retrieval 태스크에서 측정 가능한 정확도 차이가 확인될 때
- 최우선 후보: **EmbeddingGemma-300M** (크기 대비 최고 성능, Matryoshka 차원 조절, Transformers.js 지원)

## 검증

25개 테스트 케이스 (5 카테고리 × 5개): `scripts/test-search-quality.ts`

```
정확 매칭:     5/5 (100%)  — "로그인이 안돼요", "수강 취소는 어떻게 하나요?" 등
패러프레이즈:  5/5 (100%)  — "비밀번호를 잊어버렸어요", "접속이 안 됩니다" 등
구어체:        5/5 (100%)  — "과제 제출 어떻게 함?", "시험 언제 봄?" 등
키워드:        4/5  (80%)  — "배송" → FAQ#27 (기대: #25, 모호한 단일 키워드)
범위 외:       4/5  (80%)  — "피자 주문하고 싶어요" → false positive (문법 패턴 유사)
```
