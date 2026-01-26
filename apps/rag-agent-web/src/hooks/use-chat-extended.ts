import { useChat } from '@ai-sdk/react';
import { useCallback, useEffect } from 'react';
import { useConversationStore } from '@/stores/conversation-store';
import { useHITLStore } from '@/stores/hitl-store';
import type { HITLRequest } from '@/types';

const API_URL = import.meta.env.VITE_API_URL || '';

interface UseChatExtendedOptions {
  sessionId?: string;
}

export function useChatExtended(options: UseChatExtendedOptions = {}) {
  const { sessionId } = options;
  const { currentConversationId, addMessage } = useConversationStore();
  const { setPendingRequest } = useHITLStore();

  const chat = useChat({
    api: `${API_URL}/api/chat/ai-sdk`,
    body: {
      sessionId: sessionId ?? currentConversationId,
    },
    onFinish: async (message) => {
      // Save assistant message to IndexedDB
      try {
        const data = message.data as unknown[] | undefined;
        await addMessage('assistant', message.content, data);
      } catch (error) {
        console.error('Failed to save assistant message:', error);
      }
    },
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  // Handle HITL requests from stream data
  useEffect(() => {
    const data = chat.data as Array<Record<string, unknown>> | undefined;
    if (!data) return;

    const hitlRequest = data.find((d) => d.type === 'hitl_request') as
      | (HITLRequest & { type: string })
      | undefined;

    if (hitlRequest) {
      setPendingRequest({
        requestId: hitlRequest.requestId,
        toolName: hitlRequest.toolName,
        toolArgs: hitlRequest.toolArgs,
        timestamp: new Date(),
      });
    }
  }, [chat.data, setPendingRequest]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      // Save user message to IndexedDB
      try {
        await addMessage('user', content);
      } catch (error) {
        console.error('Failed to save user message:', error);
      }

      // Send to API
      await chat.append({
        role: 'user',
        content,
      });
    },
    [chat, addMessage]
  );

  return {
    ...chat,
    sendMessage,
    currentConversationId,
    // 에러 상태 및 재시도 함수 명시적 노출
    error: chat.error,
    reload: chat.reload,
  };
}
