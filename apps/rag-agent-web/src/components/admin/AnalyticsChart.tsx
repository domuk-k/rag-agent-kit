import { BarChart3 } from 'lucide-react';
import type { DailyUsage } from '@/types/admin';

interface AnalyticsChartProps {
  data: DailyUsage[];
}

export function AnalyticsChart({ data }: AnalyticsChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          일별 사용량 (최근 7일)
        </h2>
        <p className="text-muted-foreground text-center py-8">
          데이터가 없습니다
        </p>
      </div>
    );
  }

  const maxMessages = Math.max(...data.map((d) => d.messages), 1);

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
        <BarChart3 className="w-5 h-5" />
        일별 사용량 (최근 7일)
      </h2>

      {/* Bar Chart */}
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.date} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {new Date(item.date).toLocaleDateString('ko-KR', {
                  month: 'short',
                  day: 'numeric',
                  weekday: 'short',
                })}
              </span>
              <span className="font-medium">
                {item.messages}건 / {item.sessions}세션
              </span>
            </div>
            <div className="h-6 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{
                  width: `${(item.messages / maxMessages) * 100}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Summary Table */}
      <div className="mt-8">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          상세 데이터
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">날짜</th>
                <th className="px-3 py-2 text-right font-medium">세션</th>
                <th className="px-3 py-2 text-right font-medium">메시지</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((item) => (
                <tr key={item.date}>
                  <td className="px-3 py-2">{item.date}</td>
                  <td className="px-3 py-2 text-right">{item.sessions}</td>
                  <td className="px-3 py-2 text-right">{item.messages}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
