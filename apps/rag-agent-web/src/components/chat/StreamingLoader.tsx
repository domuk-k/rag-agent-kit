import { useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check } from 'lucide-react';
import { Loader } from '@/components/ai-elements/loader';
import { Shimmer } from '@/components/ai-elements/shimmer';
import type { StatusItem } from '@/lib/extract-data';

type Phase = 'init' | 'searching' | 'generating';

interface StreamingLoaderProps {
  statuses?: StatusItem[];
}

/**
 * 스트리밍 로딩 UI — 검색 → 작성 단계를 시각적으로 표현
 *
 * Phase 전이:
 *   init (대기) → searching (FAQ 검색) → generating (답변 작성)
 *
 * "완료" 등 success-level 상태는 표시하지 않음.
 */
export function StreamingLoader({ statuses }: StreamingLoaderProps) {
  // success 상태("완료") 이후만 보기 — 이전 대화 잔여 상태 무시
  const recentStatuses = useMemo(() => {
    if (!statuses || statuses.length === 0) return [];
    const lastSuccessIdx = statuses.findLastIndex((s) => s.level === 'success');
    if (lastSuccessIdx === -1) return statuses;
    return statuses.slice(lastSuccessIdx + 1);
  }, [statuses]);

  const phase: Phase = useMemo(() => {
    const last = recentStatuses[recentStatuses.length - 1];
    if (!last) return 'init';
    if (last.status.includes('작성') || last.status.includes('반환')) return 'generating';
    if (last.status.includes('검색')) return 'searching';
    return 'init';
  }, [recentStatuses]);

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout" initial={false}>
        {/* Init — 아직 서버 상태 미수신 */}
        {phase === 'init' && (
          <Step key="init" icon={<Loader size={14} className="text-primary" />}>
            <Shimmer className="text-sm" duration={1.5}>
              응답을 준비하고 있어요...
            </Shimmer>
          </Step>
        )}

        {/* Step 1: FAQ 검색 */}
        {phase === 'searching' && (
          <Step key="search-active" icon={<Loader size={14} className="text-primary" />}>
            <Shimmer className="text-sm" duration={1.5}>
              FAQ를 검색하고 있어요...
            </Shimmer>
          </Step>
        )}

        {/* Step 1 완료 + Step 2 진행 */}
        {phase === 'generating' && (
          <>
            <Step key="search-done" icon={<DoneIcon />}>
              <span className="text-xs text-muted-foreground">FAQ 검색 완료</span>
            </Step>
            <Step key="generate-active" icon={<Loader size={14} className="text-primary" />}>
              <Shimmer className="text-sm" duration={1.5}>
                답변을 작성하고 있어요...
              </Shimmer>
            </Step>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/** 각 단계 행 — motion으로 부드러운 등장/퇴장 */
function Step({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.div
      className="flex items-center gap-2.5"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</div>
      {children}
    </motion.div>
  );
}

/** 완료 체크 아이콘 */
function DoneIcon() {
  return (
    <motion.div
      className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
    >
      <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
    </motion.div>
  );
}
