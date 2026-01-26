import { useState, useEffect } from 'react';

/**
 * 미디어 쿼리 매칭을 감지하는 훅
 * @param query - CSS 미디어 쿼리 문자열 (예: '(min-width: 768px)')
 * @returns 쿼리 매칭 여부
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/**
 * 데스크톱 환경인지 감지 (768px 이상)
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)');
}
