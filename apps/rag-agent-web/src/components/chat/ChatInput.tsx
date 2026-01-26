import { useState } from 'react';
import type { ChatStatus } from 'ai';
import { Loader2, Sparkles, AlertCircle } from 'lucide-react';
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSubmit: (content: string) => void;
  status?: ChatStatus;
  placeholder?: string;
}

const STATUS_CONFIG: Record<ChatStatus, {
  label: string;
  icon: React.ReactNode;
  className: string;
} | null> = {
  ready: null,
  submitted: {
    label: '생각중...',
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    className: 'text-muted-foreground',
  },
  streaming: {
    label: '응답중...',
    icon: <Sparkles className="h-3.5 w-3.5 animate-pulse" />,
    className: 'text-primary',
  },
  error: {
    label: '오류 발생',
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    className: 'text-destructive',
  },
};

/**
 * AI Elements 기반 채팅 입력 컴포넌트
 * - Enter로 제출, Shift+Enter로 줄바꿈
 * - 자동 높이 조절
 * - 로딩 상태 표시
 */
export function ChatInput({
  onSubmit,
  status = 'ready',
  placeholder = '메시지를 입력하세요...',
}: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (message: PromptInputMessage) => {
    const text = message.text?.trim();
    if (text) {
      onSubmit(text);
      setInput('');
    }
  };

  const isEmpty = !input.trim();
  const isSubmitting = status === 'submitted' || status === 'streaming';
  const statusConfig = STATUS_CONFIG[status];

  return (
    <PromptInput
      onSubmit={handleSubmit}
      className="rounded-xl border bg-background"
    >
      <PromptInputBody>
        <PromptInputTextarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={isSubmitting}
          className="chat-input min-h-12 px-4 py-3 text-base md:text-sm"
        />
      </PromptInputBody>
      <PromptInputFooter className="px-2 py-1.5">
        {/* Status indicator */}
        {statusConfig && (
          <div
            className={cn(
              'flex items-center gap-1.5 text-xs font-medium transition-opacity',
              statusConfig.className
            )}
          >
            {statusConfig.icon}
            <span>{statusConfig.label}</span>
          </div>
        )}
        {!statusConfig && <div />}

        <PromptInputSubmit
          disabled={isEmpty || isSubmitting}
          status={status}
        />
      </PromptInputFooter>
    </PromptInput>
  );
}
