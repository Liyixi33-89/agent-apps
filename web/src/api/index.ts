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

export const fetchKnowledge = async (params?: { categoryKey?: string; agentSlug?: string; search?: string; page?: number; limit?: number }) => {
  const { data } = await api.get<{ success: boolean; data: KnowledgeBase[]; pagination: { total: number } }>('/knowledge', { params });
  return data;
};

export const searchKnowledge = async (query: string, options?: { categoryKey?: string; agentSlug?: string; lang?: Lang; limit?: number }) => {
  const { data } = await api.post<{ success: boolean; data: Array<{ title: { zh: string; en: string }; content: { zh: string; en: string }; chunkId: string }> }>('/knowledge/search', { query, ...options });
  return data.data;
};

export interface RagSource {
  type: 'agent' | 'knowledge';
  name: string;
  slug?: string;
  categoryKey?: string;
  chunkId?: string;
  score?: number;
}

export const ragQuery = async (question: string, options?: { categoryKey?: string; agentSlug?: string; provider?: Provider; lang?: Lang; history?: Array<{ role: 'user' | 'assistant'; content: string }>; rewrite?: boolean }) => {
  const { data } = await api.post<{ success: boolean; data: { answer: string; question: string; rewrittenQuestion?: string; sources: RagSource[] } }>('/knowledge/rag', { question, ...options });
  return data.data;
};

// ─── Vibe Coding ───────────────────────────────────────────────────────────────

export const vibeGenerate = async (params: { prompt: string; agentSlug?: string; provider?: Provider; modelType?: ModelType }) => {
  const { data } = await api.post<{ success: boolean; data: { content: string; provider: Provider; model: string } }>('/vibe/generate', params);
  return data.data;
};

// ─── Vibe 模板市场 ─────────────────────────────────────────────────────────────

export interface VibeTemplateItem {
  _id: string;
  title: string;
  description: string;
  category: string;
  author: string;
  thumbnail?: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  tags: string[];
  isActive: boolean;
}

export interface VibeTemplateDetail extends VibeTemplateItem {
  codeParts: { html: string; css: string; js: string; jsx?: string; isFullHtml?: boolean; isReact?: boolean };
}

export const fetchVibeTemplates = async (params?: { page?: number; limit?: number; category?: string }) => {
  const { data } = await api.get<{ success: boolean; data: VibeTemplateItem[]; pagination: { page: number; limit: number; total: number } }>('/vibe/templates', { params });
  return data;
};

export const fetchVibeTemplate = async (id: string) => {
  const { data } = await api.get<{ success: boolean; data: VibeTemplateDetail }>(`/vibe/templates/${id}`);
  return data.data;
};

export const publishVibeTemplate = async (body: {
  title: string; description?: string; category?: string;
  author?: string; codeParts: object; thumbnail?: string; tags?: string[];
}) => {
  const { data } = await api.post<{ success: boolean; data: VibeTemplateDetail }>('/vibe/templates', body);
  return data.data;
};

// 保存应用（不发布到市场），返回后端生成的记录
export const saveVibeApp = async (body: {
  title: string; description?: string; category?: string;
  author?: string; codeParts: object; thumbnail?: string; tags?: string[];
}) => {
  const { data } = await api.post<{ success: boolean; data: VibeTemplateDetail }>('/vibe/apps', body);
  return data.data;
};

// 获取已保存的应用详情（通过后端 ID）
export const fetchVibeApp = async (id: string) => {
  const { data } = await api.get<{ success: boolean; data: VibeTemplateDetail }>(`/vibe/apps/${id}`);
  return data.data;
};

export const uploadTemplateImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('image', file);
  const { data } = await api.post<{ success: boolean; url: string }>('/upload/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.url;
};

// ─── 导入 ──────────────────────────────────────────────────────────────────────

export const triggerIngest = async () => {
  const { data } = await api.post<{ success: boolean; data: { totalAgents: number; totalCategories: number } }>('/ingest');
  return data.data;
};

// ─── Agent 规划器 ──────────────────────────────────────────────────────────────

import type { TaskComplexity, ExecutionPlan, ToolDefinition, PlanSSEEvent } from '../types';

export interface AnalyzeResult {
  prompt: string;
  complexity: TaskComplexity;
  reason: string;
  description: string;
  /** 意图类型：qa=问答对话，action=操作/生成页面 */
  intent: 'qa' | 'action';
}

/** 分析任务复杂度（无 LLM 调用，极快） */
export const analyzeTaskComplexity = async (prompt: string): Promise<AnalyzeResult> => {
  const { data } = await api.post<{ success: boolean; data: AnalyzeResult }>('/agent/analyze', { prompt });
  return data.data;
};

/** 生成执行计划（调用 LLM） */
export const generateAgentPlan = async (
  prompt: string,
  options?: { provider?: string; modelType?: string }
): Promise<ExecutionPlan> => {
  const { data } = await api.post<{ success: boolean; data: ExecutionPlan }>('/agent/plan', {
    prompt,
    ...options,
  });
  return data.data;
};

/** 获取所有可用工具定义 */
export const fetchAgentTools = async (): Promise<{ total: number; tools: ToolDefinition[] }> => {
  const { data } = await api.get<{ success: boolean; data: { total: number; tools: ToolDefinition[] } }>('/agent/tools');
  return data.data;
};

/** 单独调用某个工具 */
export const callAgentTool = async (
  name: string,
  args: Record<string, unknown> = {}
): Promise<{ success: boolean; data?: unknown; error?: string }> => {
  const { data } = await api.post<{ success: boolean; data?: unknown; error?: string }>('/agent/tool', {
    name,
    arguments: args,
  });
  return data;
};

/**
 * Plan-Execute 完整流程（SSE 流式）
 * 返回一个清理函数，调用后断开连接
 */
export const executeAgentPlan = (
  prompt: string,
  options: { provider?: string; modelType?: string; isReact?: boolean },
  onEvent: (event: PlanSSEEvent) => void,
  onError?: (err: Error) => void
): (() => void) => {
  const controller = new AbortController();

  fetch('/api/agent/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, ...options }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6)) as PlanSSEEvent;
            onEvent(event);
          } catch { /* 忽略解析失败的行 */ }
        }
      }
    })
    .catch((err: unknown) => {
      if (err instanceof Error && err.name === 'AbortError') return;
      onError?.(err instanceof Error ? err : new Error(String(err)));
    });

  return () => controller.abort();
};
