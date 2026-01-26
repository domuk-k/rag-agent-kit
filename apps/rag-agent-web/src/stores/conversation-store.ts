import { create } from 'zustand';
import { conversationDb, messageDb, type DbConversation, type DbMessage } from '@/lib/db';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: unknown[];
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

interface ConversationState {
  // State
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Message[];
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  createConversation: () => Promise<string>;
  selectConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  addMessage: (role: 'user' | 'assistant', content: string, data?: unknown[]) => Promise<void>;
  updateConversationTitle: (id: string, title: string) => Promise<void>;
}

export const useConversationStore = create<ConversationState>()((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    if (get().isInitialized) return;

    set({ isLoading: true });

    try {
      const conversations = await conversationDb.getAll();

      // Auto-cleanup old conversations
      await conversationDb.cleanup(50);

      set({
        conversations: conversations.map(dbToConversation),
        isInitialized: true,
      });

      // Select most recent conversation if exists
      if (conversations.length > 0) {
        await get().selectConversation(conversations[0].id);
      }
    } finally {
      set({ isLoading: false });
    }
  },

  createConversation: async () => {
    const dbConversation = await conversationDb.create();
    const conversation = dbToConversation(dbConversation);

    set((state) => ({
      conversations: [conversation, ...state.conversations],
      currentConversationId: conversation.id,
      messages: [],
    }));

    return conversation.id;
  },

  selectConversation: async (id: string) => {
    if (get().currentConversationId === id) return;

    set({ isLoading: true });

    try {
      const dbMessages = await messageDb.getByConversation(id);

      set({
        currentConversationId: id,
        messages: dbMessages.map(dbToMessage),
      });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteConversation: async (id: string) => {
    await conversationDb.delete(id);

    set((state) => {
      const filtered = state.conversations.filter((c) => c.id !== id);
      const isCurrentDeleted = state.currentConversationId === id;

      return {
        conversations: filtered,
        currentConversationId: isCurrentDeleted
          ? (filtered[0]?.id ?? null)
          : state.currentConversationId,
        messages: isCurrentDeleted ? [] : state.messages,
      };
    });

    // Load messages for new current conversation
    const newCurrentId = get().currentConversationId;
    if (newCurrentId && get().messages.length === 0) {
      await get().selectConversation(newCurrentId);
    }
  },

  addMessage: async (role, content, data) => {
    let conversationId = get().currentConversationId;

    // Create new conversation if none exists
    if (!conversationId) {
      conversationId = await get().createConversation();
    }

    const dbMessage = await messageDb.add(conversationId, role, content, data);
    const message = dbToMessage(dbMessage);

    set((state) => ({
      messages: [...state.messages, message],
      // Update conversation in list (for title/timestamp)
      conversations: state.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        return {
          ...c,
          updatedAt: Date.now(),
          // Update title from first user message
          title: role === 'user' && c.title === '새 대화'
            ? content.slice(0, 50) + (content.length > 50 ? '...' : '')
            : c.title,
        };
      }),
    }));
  },

  updateConversationTitle: async (id, title) => {
    await conversationDb.update(id, { title });

    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, title, updatedAt: Date.now() } : c
      ),
    }));
  },
}));

// Converters
function dbToConversation(db: DbConversation): Conversation {
  return {
    id: db.id,
    title: db.title,
    createdAt: db.createdAt,
    updatedAt: db.updatedAt,
  };
}

function dbToMessage(db: DbMessage): Message {
  return {
    id: db.id !== undefined ? String(db.id) : `msg_${db.createdAt}`,
    role: db.role,
    content: db.content,
    data: db.data as unknown[] | undefined,
    createdAt: db.createdAt,
  };
}
