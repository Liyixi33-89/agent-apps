import axios from 'axios';
import type { Agent, Category, Pipeline, ChatSession, KnowledgeBase, OverviewStats, Provider, ModelType, Lang } from '../types';

const api = axios.create({ baseURL: '/api', timeout: 60_000 });

// ─── 概览 ──────────────────────────────────────────────────────────────────────

export const fetchOverview = async () => {
  const { data } = await api.get<{
    success: boolean;
    data: {
      stats: OverviewStats;
      providers: { active: Provider; ollama: { textModel: string; visionModel: string }; codebuddy: { textModel: string; visionModel: string } };
      categories: Category[];
      featuredAgents: Agent[];
    };
  }>('/overview');
  return data.data;
};

// ─── Agents ────────────────────────────────────────────────────────────────────

export const fetchAgents = async (params?: { category?: string; search?: string; modelType?: string; page?: number; limit?: number }) => {
  const { data } = await api.get<{ success: boolean; data: Agent[]; pagination: { page: number; limit: number; total: number; pages: number } }>('/agents', { params });
  return data;
};

export const fetchAgent = async (slug: string) => {
  const { data } = await api.get<{ success: boolean; data: Agent }>(`/agents/${slug}`);
  return data.data;
};

// ─── 分类 ──────────────────────────────────────────────────────────────────────

export const fetchCategories = async () => {
  const { data } = await api.get<{ success: boolean; data: Category[] }>('/categories');
  return data.data;
};

// ─── Pipeline ──────────────────────────────────────────────────────────────────

export const fetchPipelines = async () => {
  const { data } = await api.get<{ success: boolean; data: Pipeline[] }>('/pipelines');
  return data.data;
};

// ─── Chat ──────────────────────────────────────────────────────────────────────

export const createChatSession = async (params: { agentSlug?: string; provider?: Provider; modelType?: ModelType }) => {
  const { data } = await api.post<{ success: boolean; data: { sessionId: string; agentName: string; provider: Provider; modelType: ModelType } }>('/chat/session', params);
  return data.data;
};

export const fetchChatSessions = async () => {
  const { data } = await api.get<{ success: boolean; data: ChatSession[] }>('/chat/sessions');
  return data.data;
};

export const fetchChatSession = async (sessionId: string) => {
  const { data } = await api.get<{ success: boolean; data: ChatSession }>(`/chat/session/${sessionId}`);
  return data.data;
};

export const sendChatMessage = async (sessionId: string, message: string) => {
  const { data } = await api.post<{ success: boolean; data: { content: string; provider: Provider; model: string } }>('/chat/message', { sessionId, message });
  return data.data;
};

// ─── 知识库 ────────────────────────────────────────────────────────────────────

export const fetchKnowledge = async (params?: { categoryKey?: string; agentSlug?: string; search?: string; page?: number }) => {
  const { data } = await api.get<{ success: boolean; data: KnowledgeBase[]; pagination: { total: number } }>('/knowledge', { params });
  return data;
};

export const searchKnowledge = async (query: string, options?: { categoryKey?: string; agentSlug?: string; lang?: Lang; limit?: number }) => {
  const { data } = await api.post<{ success: boolean; data: Array<{ title: { zh: string; en: string }; content: { zh: string; en: string }; chunkId: string }> }>('/knowledge/search', { query, ...options });
  return data.data;
};

export const ragQuery = async (question: string, options?: { categoryKey?: string; agentSlug?: string; provider?: Provider; lang?: Lang }) => {
  const { data } = await api.post<{ success: boolean; data: { answer: string; question: string } }>('/knowledge/rag', { question, ...options });
  return data.data;
};

// ─── Vibe Coding ───────────────────────────────────────────────────────────────

export const vibeGenerate = async (params: { prompt: string; agentSlug?: string; provider?: Provider; modelType?: ModelType }) => {
  const { data } = await api.post<{ success: boolean; data: { content: string; provider: Provider; model: string } }>('/vibe/generate', params);
  return data.data;
};

// ─── 导入 ──────────────────────────────────────────────────────────────────────

export const triggerIngest = async () => {
  const { data } = await api.post<{ success: boolean; data: { totalAgents: number; totalCategories: number } }>('/ingest');
  return data.data;
};
