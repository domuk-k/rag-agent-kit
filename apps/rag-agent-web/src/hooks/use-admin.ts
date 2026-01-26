import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import type { FaqItem, FaqFormData, DailyUsage, SortField, SortOrder } from '@/types/admin';
import { translateError } from '@/lib/validation';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const PAGE_SIZE = 10;

interface UseAdminReturn {
  // Auth state
  token: string;
  isAuthenticated: boolean;
  login: (inputToken: string) => void;
  logout: () => void;

  // Data state
  faqs: FaqItem[];
  categories: string[];
  dailyUsage: DailyUsage[];
  loadData: () => Promise<void>;

  // Filtered & paginated data
  filteredFaqs: FaqItem[];
  paginatedFaqs: FaqItem[];
  totalPages: number;

  // Search, sort, pagination controls
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortField: SortField;
  sortOrder: SortOrder;
  handleSort: (field: SortField) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;

  // CRUD operations
  createFaq: (data: FaqFormData) => Promise<boolean>;
  updateFaq: (id: number, data: FaqFormData) => Promise<boolean>;
  deleteFaq: (id: number) => Promise<boolean>;

  // Loading states
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  deletingId: number | null;
}

export function useAdmin(): UseAdminReturn {
  // Auth state
  const [token, setToken] = useState(() => localStorage.getItem('admin-token') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('admin-token'));

  // Data state
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);

  // Table controls
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Load all data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [faqRes, catRes, usageRes] = await Promise.all([
        fetch(`${API_URL}/api/faq`),
        fetch(`${API_URL}/api/faq/categories`),
        fetch(`${API_URL}/api/analytics/daily-usage?days=7`),
      ]);

      if (faqRes.ok) {
        setFaqs(await faqRes.json());
      }
      if (catRes.ok) {
        setCategories(await catRes.json());
      }
      if (usageRes.ok) {
        setDailyUsage(await usageRes.json());
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      toast.error('데이터 로딩에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Filtered and sorted FAQs
  const filteredFaqs = useMemo(() => {
    let result = [...faqs];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (faq) =>
          faq.question.toLowerCase().includes(query) ||
          faq.answer.toLowerCase().includes(query) ||
          faq.category.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      const aVal = String(a[sortField]).toLowerCase();
      const bVal = String(b[sortField]).toLowerCase();

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [faqs, searchQuery, sortField, sortOrder]);

  // Paginated FAQs
  const paginatedFaqs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredFaqs.slice(start, start + PAGE_SIZE);
  }, [filteredFaqs, currentPage]);

  const totalPages = Math.ceil(filteredFaqs.length / PAGE_SIZE);

  // Sort handler
  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortOrder('asc');
      return field;
    });
  }, []);

  // Auth handlers
  const login = useCallback((inputToken: string) => {
    if (inputToken.trim()) {
      localStorage.setItem('admin-token', inputToken);
      setToken(inputToken);
      setIsAuthenticated(true);
      toast.success('로그인 성공');
    } else {
      toast.error('토큰을 입력해주세요');
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('admin-token');
    setToken('');
    setIsAuthenticated(false);
    toast.success('로그아웃 되었습니다');
  }, []);

  // CRUD operations
  const createFaq = useCallback(async (data: FaqFormData): Promise<boolean> => {
    setIsCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/faq`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        toast.success('FAQ가 추가되었습니다');
        await loadData();
        return true;
      } else {
        const errData = await res.json();
        toast.error(translateError(errData.error));
        return false;
      }
    } catch {
      toast.error('네트워크 오류가 발생했습니다');
      return false;
    } finally {
      setIsCreating(false);
    }
  }, [token, loadData]);

  const updateFaq = useCallback(async (id: number, data: FaqFormData): Promise<boolean> => {
    setIsUpdating(true);
    try {
      const res = await fetch(`${API_URL}/api/faq/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        toast.success('FAQ가 수정되었습니다');
        await loadData();
        return true;
      } else {
        const errData = await res.json();
        toast.error(translateError(errData.error));
        return false;
      }
    } catch {
      toast.error('네트워크 오류가 발생했습니다');
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [token, loadData]);

  const deleteFaq = useCallback(async (id: number): Promise<boolean> => {
    setDeletingId(id);
    try {
      const res = await fetch(`${API_URL}/api/faq/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        toast.success('FAQ가 삭제되었습니다');
        await loadData();
        return true;
      } else {
        const errData = await res.json();
        toast.error(translateError(errData.error));
        return false;
      }
    } catch {
      toast.error('네트워크 오류가 발생했습니다');
      return false;
    } finally {
      setDeletingId(null);
    }
  }, [token, loadData]);

  return {
    // Auth
    token,
    isAuthenticated,
    login,
    logout,

    // Data
    faqs,
    categories,
    dailyUsage,
    loadData,

    // Filtered & paginated
    filteredFaqs,
    paginatedFaqs,
    totalPages,

    // Controls
    searchQuery,
    setSearchQuery,
    sortField,
    sortOrder,
    handleSort,
    currentPage,
    setCurrentPage,

    // CRUD
    createFaq,
    updateFaq,
    deleteFaq,

    // Loading states
    isLoading,
    isCreating,
    isUpdating,
    deletingId,
  };
}
