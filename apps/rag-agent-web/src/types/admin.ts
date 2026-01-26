// Admin-related types for FAQ management

export interface FaqItem {
  id: number;
  category: string;
  subcategory?: string;
  question: string;
  answer: string;
}

export interface FaqFormData {
  category: string;
  question: string;
  answer: string;
}

export interface DailyUsage {
  date: string;
  sessions: number;
  messages: number;
}

export interface ValidationErrors {
  category?: string;
  question?: string;
  answer?: string;
}

export type SortField = 'id' | 'category' | 'question';
export type SortOrder = 'asc' | 'desc';
