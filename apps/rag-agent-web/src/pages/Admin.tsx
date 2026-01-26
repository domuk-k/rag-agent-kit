import { useState } from 'react';
import { MessageSquare, BarChart3, LogOut, Settings } from 'lucide-react';
import { useAdmin } from '@/hooks/use-admin';
import { LoginForm } from '@/components/admin/LoginForm';
import { FaqForm } from '@/components/admin/FaqForm';
import { FaqTable } from '@/components/admin/FaqTable';
import { EditModal, DeleteModal } from '@/components/admin/FaqModal';
import { AnalyticsChart } from '@/components/admin/AnalyticsChart';
import type { FaqItem } from '@/types/admin';

type Tab = 'faq' | 'analytics';

export function Admin() {
  const admin = useAdmin();
  const [activeTab, setActiveTab] = useState<Tab>('faq');
  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null);
  const [deletingFaq, setDeletingFaq] = useState<FaqItem | null>(null);

  // Not authenticated - show login
  if (!admin.isAuthenticated) {
    return <LoginForm onLogin={admin.login} />;
  }

  return (
    <>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-card border-b border-border">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-primary" />
              <h1 className="font-semibold">RAG Agent Kit Admin</h1>
            </div>

            <nav className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('faq')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'faq'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                <span className="hidden sm:inline">FAQ 관리</span>
                <MessageSquare className="w-4 h-4 sm:hidden" />
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'analytics'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                <span className="hidden sm:inline">Analytics</span>
                <BarChart3 className="w-4 h-4 sm:hidden" />
              </button>

              <span className="w-px h-6 bg-border mx-2" />

              <a
                href="#/"
                className="px-3 py-1.5 text-sm hover:bg-muted rounded-lg transition-colors"
              >
                Chat
              </a>
              <button
                onClick={admin.logout}
                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                title="로그아웃"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </nav>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
          {activeTab === 'faq' && (
            <>
              <FaqForm
                categories={admin.categories}
                onSubmit={admin.createFaq}
                isSubmitting={admin.isCreating}
              />

              <FaqTable
                faqs={admin.paginatedFaqs}
                filteredCount={admin.filteredFaqs.length}
                totalCount={admin.faqs.length}
                searchQuery={admin.searchQuery}
                onSearchChange={admin.setSearchQuery}
                sortField={admin.sortField}
                sortOrder={admin.sortOrder}
                onSort={admin.handleSort}
                currentPage={admin.currentPage}
                totalPages={admin.totalPages}
                onPageChange={admin.setCurrentPage}
                onEdit={setEditingFaq}
                onDelete={setDeletingFaq}
              />
            </>
          )}

          {activeTab === 'analytics' && (
            <AnalyticsChart data={admin.dailyUsage} />
          )}
        </main>
      </div>

      {/* Edit Modal */}
      {editingFaq && (
        <EditModal
          faq={editingFaq}
          categories={admin.categories}
          onClose={() => setEditingFaq(null)}
          onSubmit={admin.updateFaq}
          isSubmitting={admin.isUpdating}
        />
      )}

      {/* Delete Modal */}
      {deletingFaq && (
        <DeleteModal
          faq={deletingFaq}
          onClose={() => setDeletingFaq(null)}
          onConfirm={async () => {
            const success = await admin.deleteFaq(deletingFaq.id);
            if (success) {
              setDeletingFaq(null);
            }
          }}
          isDeleting={admin.deletingId === deletingFaq.id}
        />
      )}
    </>
  );
}
