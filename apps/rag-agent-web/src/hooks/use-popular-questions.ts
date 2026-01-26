import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

interface PopularQuestion {
  question: string;
  category: string;
  count: number;
}

/**
 * 인기 질문 목록을 API에서 가져오는 훅
 * 지정된 기간(기본 7일) 동안 가장 많이 조회된 FAQ를 반환
 */
export function usePopularQuestions(limit = 5, days = 7) {
  const [questions, setQuestions] = useState<PopularQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPopularQuestions = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/analytics/popular-questions?limit=${limit}&days=${days}`
        );

        if (!response.ok) {
          throw new Error('인기 질문을 불러오는데 실패했습니다');
        }

        const data = await response.json();
        setQuestions(data);
      } catch (err) {
        console.error('Failed to fetch popular questions:', err);
        setError(err instanceof Error ? err : new Error('알 수 없는 오류'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchPopularQuestions();
  }, [limit, days]);

  return { questions, isLoading, error };
}
