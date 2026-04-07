import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Agent, Category, Pipeline, ChatSession, OverviewStats, Provider, ModelType, Lang } from '../types';

interface AppState {
  // 语言
  lang: Lang;
  setLang: (lang: Lang) => void;

  // Provider
  activeProvider: Provider;
  setActiveProvider: (provider: Provider) => void;

  // 概览数据
  overview: { stats: OverviewStats; categories: Category[]; featuredAgents: Agent[] } | null;
  setOverview: (data: AppState['overview']) => void;

  // Agents
  agents: Agent[];
  setAgents: (agents: Agent[]) => void;
  selectedAgent: Agent | null;
  setSelectedAgent: (agent: Agent | null) => void;

  // 分类
  categories: Category[];
  setCategories: (categories: Category[]) => void;
  selectedCategory: string;
  setSelectedCategory: (key: string) => void;

  // Pipeline
  pipelines: Pipeline[];
  setPipelines: (pipelines: Pipeline[]) => void;

  // Chat
  chatSessions: ChatSession[];
  setChatSessions: (sessions: ChatSession[]) => void;
  currentSession: ChatSession | null;
  setCurrentSession: (session: ChatSession | null) => void;

  // 搜索
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // 模型类型
  modelType: ModelType;
  setModelType: (type: ModelType) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      lang: 'zh',
      setLang: (lang) => set({ lang }),

      activeProvider: 'ollama',
      setActiveProvider: (activeProvider) => set({ activeProvider }),

      overview: null,
      setOverview: (overview) => set({ overview }),

      agents: [],
      setAgents: (agents) => set({ agents }),
      selectedAgent: null,
      setSelectedAgent: (selectedAgent) => set({ selectedAgent }),

      categories: [],
      setCategories: (categories) => set({ categories }),
      selectedCategory: '',
      setSelectedCategory: (selectedCategory) => set({ selectedCategory }),

      pipelines: [],
      setPipelines: (pipelines) => set({ pipelines }),

      chatSessions: [],
      setChatSessions: (chatSessions) => set({ chatSessions }),
      currentSession: null,
      setCurrentSession: (currentSession) => set({ currentSession }),

      searchQuery: '',
      setSearchQuery: (searchQuery) => set({ searchQuery }),

      modelType: 'text',
      setModelType: (modelType) => set({ modelType })
    }),
    {
      name: 'agency-agents-store',
      partialize: (state) => ({
        lang: state.lang,
        activeProvider: state.activeProvider,
        modelType: state.modelType,
      }),
    }
  )
);
