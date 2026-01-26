import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useConversationStore } from '@/stores/conversation-store';

const API_URL = import.meta.env.VITE_API_URL || '';

type FeedbackType = 'positive' | 'negative';

/**
 * 메시지 피드백 훅
 * 각 메시지에 대한 👍/👎 피드백 상태를 관리하고 API로 전송
 */
export function useFeedback() {
  const [feedbackMap, setFeedbackMap] = useState<Map<string, FeedbackType>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState<Set<string>>(new Set());
  const { currentConversationId } = useConversationStore();

  const submitFeedback = useCallback(
    async (messageId: string, type: FeedbackType, faqId?: number) => {
      // 이미 제출 중이거나 이미 피드백을 남긴 경우
      if (isSubmitting.has(messageId) || feedbackMap.has(messageId)) {
        return;
      }

      setIsSubmitting((prev) => new Set(prev).add(messageId));

      try {
        const response = await fetch(`${API_URL}/api/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId,
            sessionId: currentConversationId,
            type,
            faqId,
          }),
        });

        if (!response.ok) {
          throw new Error('피드백 전송 실패');
        }

        setFeedbackMap((prev) => new Map(prev).set(messageId, type));
        toast.success(type === 'positive' ? '감사합니다!' : '피드백이 기록되었습니다');
      } catch (error) {
        console.error('Feedback submission error:', error);
        toast.error('피드백 전송에 실패했습니다');
      } finally {
        setIsSubmitting((prev) => {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
      }
    },
    [currentConversationId, feedbackMap, isSubmitting]
  );

  const getFeedback = useCallback(
    (messageId: string): FeedbackType | undefined => feedbackMap.get(messageId),
    [feedbackMap]
  );

  const isSubmittingFeedback = useCallback(
    (messageId: string): boolean => isSubmitting.has(messageId),
    [isSubmitting]
  );

  return {
    submitFeedback,
    getFeedback,
    isSubmittingFeedback,
  };
}
