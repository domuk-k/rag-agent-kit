import { Send, AlertCircle, RefreshCw } from 'lucide-react';
import { useChatExtended } from '@/hooks/use-chat-extended';
import { usePopularQuestions } from '@/hooks/use-popular-questions';
import { useFeedback } from '@/hooks/use-feedback';
import { MessageContainer } from './MessageContainer';
import { ChatInput } from './ChatInput';
import { ActionConfirmDialog } from '@/components/hitl/ActionConfirmDialog';
import { Button } from '@/components/ui/button';

export function ChatContainer() {
  const { messages, isLoading, sendMessage, status, data, error, reload } = useChatExtended();
  const feedback = useFeedback();

  const handleSubmit = async (content: string) => {
    await sendMessage(content);
  };

  // Extract current streaming status from data
  const streamingData = data as Array<Record<string, unknown>> | undefined;

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-hidden">
        {messages.length === 0 ? (
          <EmptyState onQuestionClick={handleSubmit} />
        ) : (
          <MessageContainer
            messages={messages}
            isLoading={isLoading}
            streamingData={streamingData}
            onRelatedQuestionClick={handleSubmit}
            feedback={feedback}
          />
        )}
      </div>

      {/* Error state with retry */}
      {error && (
        <div className="mx-auto max-w-3xl px-4 pb-2">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">오류 발생</p>
                <p className="text-xs text-muted-foreground">응답을 가져오는 중 문제가 발생했습니다</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => reload()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              다시 시도
            </Button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t bg-background p-4">
        <div className="mx-auto max-w-3xl">
          <ChatInput
            onSubmit={handleSubmit}
            status={status}
            placeholder="메시지를 입력하세요..."
          />
        </div>
      </div>

      {/* HITL Dialog */}
      <ActionConfirmDialog />
    </div>
  );
}

interface EmptyStateProps {
  onQuestionClick?: (question: string) => void;
}

// 기본 제안 (API 데이터가 없을 때 폴백)
const DEFAULT_SUGGESTIONS = [
  '수강 취소는 어떻게 하나요?',
  '회원탈퇴는 어디서 하나요?',
  '개인정보 변경요청은 어떻게 하나요?',
  '재무제표 다운로드 가능한 곳은 어디인가요?',
  '예제파일 및 과제(교안) 다운로드가 안돼요!',
];

function EmptyState({ onQuestionClick }: EmptyStateProps) {
  const { questions, isLoading } = usePopularQuestions(5);

  // API 데이터 + 기본값으로 항상 5개 보장
  const suggestions = (() => {
    const apiQuestions = questions.map((q) => q.question);
    if (apiQuestions.length >= 5) return apiQuestions.slice(0, 5);
    if (apiQuestions.length === 0) return DEFAULT_SUGGESTIONS;
    const fill = DEFAULT_SUGGESTIONS.filter((q) => !apiQuestions.includes(q));
    return [...apiQuestions, ...fill].slice(0, 5);
  })();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="rounded-full bg-primary/10 p-4">
        <Send className="h-8 w-8 text-primary" />
      </div>
      <div>
        <h2 className="text-xl font-semibold">FAQ 챗봇</h2>
        <p className="mt-2 text-muted-foreground">궁금한 점을 질문해보세요</p>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {isLoading ? (
          // 로딩 중 스켈레톤 표시
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-9 w-32 animate-pulse rounded-full bg-muted"
              />
            ))}
          </>
        ) : (
          suggestions.map((q) => (
            <button
              key={q}
              onClick={() => onQuestionClick?.(q)}
              className="touch-target rounded-full border px-4 py-2 text-sm transition-colors hover:bg-muted active:bg-muted/80"
            >
              {q}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
