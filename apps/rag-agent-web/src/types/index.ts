// Re-export types from stores
export type { Conversation, Message } from '@/stores/conversation-store';

// Source item from FAQ search results
export interface SourceItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
  score?: number;
}

// Human-in-the-Loop types
export interface HITLRequest {
  requestId: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  timestamp: Date;
}

export interface HITLResponse {
  requestId: string;
  approved: boolean;
  sessionId: string;
}
