import type { Message as AIMessage } from '@ai-sdk/react';
import { Copy, Check, ThumbsUp, ThumbsDown } from 'lucide-react';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from '@/components/ai-elements/message';
import { Suggestions, Suggestion } from '@/components/ai-elements/suggestion';
import { useClipboard } from '@/hooks/use-clipboard';
import { cn } from '@/lib/utils';
import {
  extractSources,
  extractActions,
  extractStatuses,
  extractFaqResults,
} from '@/lib/extract-data';
import { SourceCard } from './SourceCard';
import { FaqResultCard } from './FaqResultCard';
import { StreamingLoader } from './StreamingLoader';

interface FeedbackActions {
  submitFeedback: (messageId: string, type: 'positive' | 'negative', faqId?: number) => Promise<void>;
  getFeedback: (messageId: string) => 'positive' | 'negative' | undefined;
  isSubmittingFeedback: (messageId: string) => boolean;
}

interface MessageContainerProps {
  messages: AIMessage[];
  isLoading: boolean;
  streamingData?: Array<Record<string, unknown>>;
  onRelatedQuestionClick?: (question: string) => void;
  feedback?: FeedbackActions;
}

/**
 * AI Elements Conversation 기반 메시지 컨테이너
 * - StreamingLoader 로딩 UX (검색 → 작성 단계 표시)
 * - Suggestions 관련 질문
 * - Task 검색 상태 표시
 */
export function MessageContainer({
  messages,
  isLoading,
  streamingData,
  onRelatedQuestionClick,
  feedback,
}: MessageContainerProps) {
  // Extract streaming statuses for loading UX
  const streamingStatuses = extractStatuses(streamingData);

  return (
    <Conversation className="h-full">
      <ConversationContent className="mx-auto max-w-3xl gap-6 px-4 py-6">
        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            onRelatedQuestionClick={onRelatedQuestionClick}
            isLoading={isLoading}
            feedback={feedback}
          />
        ))}

        {/* 스트리밍 로딩 UI — 첫 텍스트가 도착하기 전까지 표시 */}
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <Message from="assistant">
            <MessageContent>
              <StreamingLoader statuses={streamingStatuses} />
            </MessageContent>
          </Message>
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}

interface MessageItemProps {
  message: AIMessage;
  onRelatedQuestionClick?: (question: string) => void;
  isLoading?: boolean;
  feedback?: FeedbackActions;
}

// Not using memo: AI SDK mutates message objects in-place when annotations arrive
// via 8: protocol, so shallow comparison always sees the same reference and bails out.
function MessageItem({
  message,
  onRelatedQuestionClick,
  isLoading,
  feedback,
}: MessageItemProps) {
  const { copy, isCopied } = useClipboard();
  const isUser = message.role === 'user';

  // Extract data from message annotations (AI SDK 8: protocol)
  const annotations = message.annotations as Array<Record<string, unknown>> | undefined;
  const sources = extractSources(annotations);
  const actions = extractActions(annotations);
  const faqResults = extractFaqResults(annotations);

  // Feedback state
  const currentFeedback = feedback?.getFeedback(message.id);
  const isSubmitting = feedback?.isSubmittingFeedback(message.id) ?? false;

  // 첫 번째 FAQ 결과의 ID (피드백 메타데이터용)
  const firstFaqId = faqResults?.[0]?.id;

  const handleFeedback = (type: 'positive' | 'negative') => {
    if (!feedback || currentFeedback || isSubmitting) return;
    feedback.submitFeedback(message.id, type, firstFaqId);
  };

  return (
    <Message from={message.role as 'user' | 'assistant' | 'system'}>
      <MessageContent>
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <MessageResponse>{message.content}</MessageResponse>
        )}
      </MessageContent>

      {/* Actions for assistant messages: Feedback + Copy */}
      {!isUser && message.content && (
        <MessageActions className="message-actions opacity-0 transition-opacity group-hover:opacity-100">
          {/* 피드백 버튼 */}
          <MessageAction
            onClick={() => handleFeedback('positive')}
            tooltip={currentFeedback === 'positive' ? '도움됨' : '도움이 됐어요'}
            label="긍정 피드백"
            disabled={isSubmitting || !!currentFeedback}
          >
            <ThumbsUp
              className={cn(
                'h-3.5 w-3.5 transition-colors',
                currentFeedback === 'positive' && 'fill-current text-green-500'
              )}
            />
          </MessageAction>
          <MessageAction
            onClick={() => handleFeedback('negative')}
            tooltip={currentFeedback === 'negative' ? '아쉬움' : '아쉬워요'}
            label="부정 피드백"
            disabled={isSubmitting || !!currentFeedback}
          >
            <ThumbsDown
              className={cn(
                'h-3.5 w-3.5 transition-colors',
                currentFeedback === 'negative' && 'fill-current text-red-500'
              )}
            />
          </MessageAction>
          {/* 복사 버튼 */}
          <MessageAction
            onClick={() => copy(message.content, message.id)}
            tooltip={isCopied(message.id) ? '복사됨' : '복사'}
            label="메시지 복사"
          >
            {isCopied(message.id) ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </MessageAction>
        </MessageActions>
      )}

      {/* Sources - Perplexity style grid */}
      {!isUser && sources && sources.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((source, idx) => (
            <SourceCard key={source.id ?? idx} source={source} index={idx} />
          ))}
        </div>
      )}

      {/* FAQ Search Results - 유사도 점수, 답변 미리보기 포함 */}
      {!isUser && faqResults && faqResults.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground font-medium">
            📚 관련 FAQ ({faqResults.length}개)
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {faqResults.slice(0, 4).map((result) => (
              <FaqResultCard
                key={result.id}
                result={result}
                onClick={onRelatedQuestionClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* 추천 질문 - actions를 Suggestions로 표시 */}
      {!isUser && actions && actions.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-muted-foreground">🔍 이런 질문도 해보세요</p>
          <Suggestions>
            {actions.map((action, idx) => (
              <Suggestion
                key={idx}
                suggestion={action.query}
                onClick={onRelatedQuestionClick}
                disabled={isLoading}
              >
                {action.label.length > 30 ? `${action.label.slice(0, 30)}...` : action.label}
              </Suggestion>
            ))}
          </Suggestions>
        </div>
      )}
    </Message>
  );
}
