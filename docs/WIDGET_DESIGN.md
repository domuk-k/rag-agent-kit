# 위젯 시스템 설계

## 현재 구조

```
[Client: useChat]  ←→  [Elysia API]  ←→  [Search Agent]
     text/plain streaming (generator)
```

## 설계 옵션 비교

| 옵션 | 복잡도 | 확장성 | 현재 호환성 |
|------|--------|--------|-------------|
| A. Vercel AI SDK Data Parts | 높음 | 높음 | 재작성 필요 |
| B. 텍스트 마커 파싱 | 낮음 | 낮음 | 완벽 |
| C. SSE 커스텀 이벤트 | 중간 | 높음 | 약간 수정 |

---

## 추천: 옵션 C - SSE 커스텀 이벤트

### 이유
1. Elysia가 SSE 네이티브 지원
2. 구조화된 데이터 전송 가능
3. 클라이언트에서 이벤트 타입별 처리 가능
4. Vercel AI SDK의 `streamProtocol: 'data'`와 유사한 패턴

### 프로토콜 설계

```typescript
// 이벤트 타입
type WidgetEvent =
  | { type: 'text'; content: string }
  | { type: 'status'; status: string }
  | { type: 'faq'; data: FaqResult[] }
  | { type: 'source'; sources: Source[] }
  | { type: 'action'; actions: Action[] };

// SSE 포맷
// event: text
// data: {"content": "정산은..."}

// event: faq
// data: {"data": [{"question": "...", "answer": "..."}]}

// event: status
// data: {"status": "FAQ 검색 중..."}
```

---

## 구현 계획

### 1. 서버 (Elysia)

```typescript
// apps/api/src/routes/chat-sse.ts
import { Elysia } from 'elysia';

export const chatSseRoutes = new Elysia({ prefix: '/api' })
  .post('/chat/stream', async ({ body, set }) => {
    set.headers['content-type'] = 'text/event-stream';
    set.headers['cache-control'] = 'no-cache';
    set.headers['connection'] = 'keep-alive';

    return new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        // Status 이벤트
        send('status', { status: 'FAQ 검색 중...' });

        // FAQ 결과 이벤트
        send('faq', { data: faqResults });

        // 텍스트 스트리밍
        for await (const token of stream) {
          send('text', { content: token });
        }

        send('done', {});
        controller.close();
      }
    });
  });
```

### 2. 클라이언트 (React)

```typescript
// useSSEChat hook
function useSSEChat() {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('');
  const [faqResults, setFaqResults] = useState([]);

  const sendMessage = async (content: string) => {
    const eventSource = new EventSource('/api/chat/stream');

    eventSource.addEventListener('status', (e) => {
      setStatus(JSON.parse(e.data).status);
    });

    eventSource.addEventListener('faq', (e) => {
      setFaqResults(JSON.parse(e.data).data);
    });

    eventSource.addEventListener('text', (e) => {
      const { content } = JSON.parse(e.data);
      // Append to current message
    });

    eventSource.addEventListener('done', () => {
      eventSource.close();
    });
  };

  return { messages, status, faqResults, sendMessage };
}
```

### 3. 위젯 컴포넌트

```typescript
// components/widgets/FaqWidget.tsx
interface FaqWidgetProps {
  results: FaqResult[];
}

export function FaqWidget({ results }: FaqWidgetProps) {
  return (
    <div className="faq-widget">
      {results.map((faq, i) => (
        <div key={i} className="faq-item">
          <span className="category">{faq.category}</span>
          <p className="question">{faq.question}</p>
          <p className="answer">{faq.answer}</p>
        </div>
      ))}
    </div>
  );
}
```

---

## 위젯 타입 정의

### 1. FAQ 위젯 (`faq`)
검색된 FAQ 목록 표시

```typescript
interface FaqWidgetData {
  type: 'faq';
  data: {
    question: string;
    answer: string;
    category: string;
    similarity: number;
  }[];
}
```

### 2. 상태 위젯 (`status`)
진행 상태 표시 (토스트/배지)

```typescript
interface StatusWidgetData {
  type: 'status';
  status: string;
  level: 'info' | 'loading' | 'success' | 'error';
}
```

### 3. 액션 위젯 (`action`)
클릭 가능한 후속 질문/액션

```typescript
interface ActionWidgetData {
  type: 'action';
  actions: {
    label: string;
    query: string;
  }[];
}
```

### 4. 소스 위젯 (`source`)
참조 출처 표시

```typescript
interface SourceWidgetData {
  type: 'source';
  sources: {
    title: string;
    url?: string;
    category: string;
  }[];
}
```

---

## 마이그레이션 단계

### Phase 1: SSE 엔드포인트 추가
- [ ] `/api/chat/stream` SSE 엔드포인트 생성
- [ ] 기존 `/api/chat` 유지 (하위 호환)

### Phase 2: 클라이언트 훅 구현
- [ ] `useSSEChat` 훅 생성
- [ ] 이벤트 핸들링 로직

### Phase 3: 위젯 컴포넌트
- [ ] FaqWidget
- [ ] StatusWidget
- [ ] ActionWidget

### Phase 4: UI 통합
- [ ] 메시지에 위젯 렌더링
- [ ] 스타일링

---

## 참고: Vercel AI SDK Data Parts (미래)

현재는 SSE로 구현하되, 향후 Next.js 마이그레이션 시 Vercel AI SDK Data Parts로 전환 가능:

```typescript
// 서버
writer.write({
  type: 'data-faq',
  id: 'faq-1',
  data: { results: faqResults }
});

// 클라이언트
message.parts
  .filter(part => part.type === 'data-faq')
  .map(part => <FaqWidget data={part.data} />);
```
