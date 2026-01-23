# A2UI 패턴 분석

Google이 2025년 12월 공개한 Agent-to-User Interface 프로토콜과 현재 구현의 비교 분석

## 1. A2UI란?

### 개요
A2UI(Agent-to-User Interface)는 AI Agent가 사용자에게 동적 UI를 제공하기 위한 선언적 프로토콜입니다.

### 핵심 개념
- **선언적 JSON 포맷**: Agent가 UI 구조를 JSON으로 선언
- **컴포넌트 카탈로그**: 미리 정의된 UI 컴포넌트 세트
- **보안 모델**: 허용된 컴포넌트만 렌더링 가능
- **양방향 통신**: UI 이벤트를 Agent로 전달

### A2UI 메시지 예시
```json
{
  "type": "a2ui",
  "components": [
    {
      "type": "card",
      "title": "검색 결과",
      "children": [
        { "type": "text", "content": "3건의 FAQ를 찾았습니다." },
        { "type": "button", "label": "자세히 보기", "action": "show_details" }
      ]
    }
  ]
}
```

## 2. 현재 구현 (SSE Events)

### 이벤트 타입
```typescript
type EventType = 'text' | 'status' | 'faq' | 'action' | 'source' | 'error' | 'done';
```

### 이벤트 구조
```typescript
// 텍스트 스트리밍
{ type: 'text', content: '답변 내용...' }

// 상태 표시
{ type: 'status', status: '검색 중...', level: 'loading' }

// 관련 질문 제안
{ type: 'action', actions: [{ label: '정산 관련', query: '정산은 언제 되나요?' }] }

// 참조 소스
{ type: 'source', sources: [{ title: 'FAQ 제목', category: '정산' }] }
```

### 클라이언트 렌더링
- 각 이벤트 타입별 고정된 위젯 컴포넌트
- React에서 조건부 렌더링

## 3. 비교 분석

| 항목 | 현재 구현 (SSE) | A2UI |
|------|----------------|------|
| UI 구성 | 고정된 위젯 | 동적 컴포넌트 |
| 확장성 | 새 이벤트 타입 추가 필요 | 컴포넌트 조합으로 확장 |
| 복잡도 | 낮음 | 중간~높음 |
| 유연성 | 제한적 | 높음 |
| 보안 | 이벤트 타입별 검증 | 컴포넌트 카탈로그 기반 |

### 공통점
- 선언적 데이터 전달
- Agent와 UI의 분리
- 스트리밍 지원

### 차이점
- **동적 UI 구성**: A2UI는 런타임에 UI 구조 결정 가능
- **컴포넌트 중첩**: A2UI는 복잡한 UI 트리 구성 가능
- **표준화**: A2UI는 범용 프로토콜 지향

## 4. 향후 A2UI 적용 시 변경사항

### 4.1 컴포넌트 카탈로그 정의
```typescript
const componentCatalog = {
  text: TextComponent,
  card: CardComponent,
  button: ButtonComponent,
  list: ListComponent,
  faq: FaqComponent,
  source: SourceComponent,
};
```

### 4.2 SSE → A2UI 변환 레이어
```typescript
function sseToA2UI(event: SSEEvent): A2UIMessage {
  switch (event.type) {
    case 'text':
      return { components: [{ type: 'text', content: event.content }] };
    case 'action':
      return {
        components: [{
          type: 'card',
          children: event.actions.map(a => ({
            type: 'button',
            label: a.label,
            action: { type: 'query', value: a.query }
          }))
        }]
      };
    // ...
  }
}
```

### 4.3 React 렌더러 구현
```typescript
function A2UIRenderer({ message }: { message: A2UIMessage }) {
  return (
    <>
      {message.components.map((comp, idx) => {
        const Component = componentCatalog[comp.type];
        return <Component key={idx} {...comp} />;
      })}
    </>
  );
}
```

## 5. 결론

현재 SSE 기반 구현은 데모 수준에서 충분히 동작하며, A2UI의 핵심 철학(선언적 UI, Agent-UI 분리)을 이미 부분적으로 구현하고 있습니다.

A2UI 전환은 다음 상황에서 고려할 수 있습니다:
- 다양한 UI 레이아웃이 필요한 경우
- 외부 시스템과 UI 프로토콜 표준화가 필요한 경우
- 동적 폼이나 복잡한 인터랙션이 필요한 경우

## 6. 참고 자료

- [AG-UI Protocol](https://github.com/ag-ui-protocol/ag-ui) - Agent-UI 프로토콜 오픈소스
- [Google A2A/A2UI 발표](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/) - 2025년 12월
- [Vercel AI SDK UI Events](https://sdk.vercel.ai/docs/ai-sdk-ui/streaming) - 유사 패턴 참고
