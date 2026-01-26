import { Search, ChevronUp, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import type { FaqItem, SortField, SortOrder } from '@/types/admin';

interface FaqTableProps {
  faqs: FaqItem[];
  filteredCount: number;
  totalCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (faq: FaqItem) => void;
  onDelete: (faq: FaqItem) => void;
}

export function FaqTable({
  faqs,
  filteredCount,
  totalCount,
  searchQuery,
  onSearchChange,
  sortField,
  sortOrder,
  onSort,
  currentPage,
  totalPages,
  onPageChange,
  onEdit,
  onDelete,
}: FaqTableProps) {
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  return (
    <div className="bg-card border border-border rounded-lg">
      {/* Header */}
      <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold">
          FAQ 목록 ({filteredCount}개
          {searchQuery && ` / 전체 ${totalCount}개`})
        </h2>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="검색 (질문, 답변, 카테고리)"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-4 py-2 border border-input rounded-lg bg-background text-sm w-full sm:w-64"
          />
        </div>
      </div>

      {/* Table */}
      {faqs.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          {searchQuery ? '검색 결과가 없습니다.' : 'FAQ가 없습니다.'}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th
                    className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => onSort('id')}
                  >
                    <div className="flex items-center gap-1">
                      ID <SortIcon field="id" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => onSort('category')}
                  >
                    <div className="flex items-center gap-1">
                      카테고리 <SortIcon field="category" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => onSort('question')}
                  >
                    <div className="flex items-center gap-1">
                      질문 <SortIcon field="question" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {faqs.map((faq) => (
                  <tr key={faq.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm">{faq.id}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm bg-secondary px-2 py-1 rounded">
                        {faq.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm" title={faq.answer}>
                      {faq.question}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => onEdit(faq)}
                          className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                          title="수정"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(faq)}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-border flex items-center justify-center gap-2">
              <button
                onClick={() => onPageChange(1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm border border-input rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                «
              </button>
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm border border-input rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ‹
              </button>

              <span className="px-4 text-sm text-muted-foreground">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm border border-input rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ›
              </button>
              <button
                onClick={() => onPageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm border border-input rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                »
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
