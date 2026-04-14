import axios from 'axios';
import { message } from 'antd';
import type { Agent, Category, Pipeline, ChatSession, KnowledgeBase, OverviewStats, Provider, ModelType, Lang } from '../types';

const api = axios.create({ baseURL: '/api', timeout: 60_000 });

// ─── 防抖/取消工具 ─────────────────────────────────────────────────────────────

/** 创建可取消的请求 — 同一 key 的请求会自动取消前一个 */
const pendingRequests = new Map<string, AbortController>();

export const cancelableRequest = <T>(key: string, requestFn: (signal: AbortSignal) => Promise<T>): Promise<T> => {
  // 取消同 key 的前一个请求
  const prev = pendingRequests.get(key);
  if (prev) prev.abort();

  const controller = new AbortController();
  pendingRequests.set(key, controller);

  return requestFn(controller.signal).finally(() => {
    // 只清理自己的 controller（避免清理后续请求的）
    if (pendingRequests.get(key) === controller) {
      pendingRequests.delete(key);
    }
  });
};

// ─── 请求拦截器 ────────────────────────────────────────────────────────────────

api.interceptors.request.use(
  (config) => {
    // 如果有 token，可在此添加 Authorization header
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── 响应拦截器 ────────────────────────────────────────────────────────────────

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const msg = error.response?.data?.message || error.message;

    if (status === 401) {
      message.error('未授权，请重新登录');
    } else if (status === 403) {
      message.error('没有权限执行此操作');
    } else if (status === 404) {
      message.error('请求的资源不存在');
    } else if (status === 500) {
      message.error('服务器内部错误，请稍后重试');
    } else if (!error.response) {
      message.error('网络连接失败，请检查服务是否启动');
    } else {
      message.error(msg || '请求失败');
    }

    return Promise.reject(error);
  }
);

// ─── 概览 ──────────────────────────────────────────────────────────────────────

export const fetchOverview = async () => {
  const { data } = await api.get<{
    success: boolean;
    data: {
      stats: OverviewStats;
  providers: { active: Provider; ollama: { textModel: string; visionModel: string }; openai: { textModel: string; visionModel: string } };
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

export const deleteChatSession = async (sessionId: string) => {
  const { data } = await api.delete<{ success: boolean; message: string }>(`/chat/session/${sessionId}`);
  return data;
};

export const renameChatSession = async (sessionId: string, title: string) => {
  const { data } = await api.patch<{ success: boolean; data: { sessionId: string; title: string } }>(`/chat/session/${sessionId}`, { title });
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

// ─── Vibe 全栈 Pipeline SSE 事件类型 ──────────────────────────────────────────

export interface FullStackPipelineSSEEvent {
  type: 'start' | 'step' | 'done' | 'error' | 'heartbeat';
  step?: number;
  total?: number;
  title?: string;
  status?: 'pending' | 'running' | 'done' | 'error';
  content?: string;
  // start 事件携带的初始步骤列表
  steps?: Array<{ step: number; total: number; title: string; status: 'pending' | 'running' | 'done' | 'error' }>;
  // done 事件的完整数据
  codeParts?: { html: string; css: string; js: string; jsx?: string; compiledJs?: string; isReact?: boolean; isFullHtml?: boolean };
  serverParts?: { model: string; route: string; service: string; middleware: string; envTemplate: string };
  dbSchema?: { collections: string; indexes: string; seedData: string };
  analysis?: string;
  isFullStack?: boolean;
  message?: string;
  // 质检完成后自动保存+部署的结果
  appId?: string;
  runtimeApiBase?: string;
}

/**
 * 全栈 Pipeline 流式调用（SSE）
 * 返回清理函数，调用后断开连接
 */
export const executeFullStackPipeline = (
  prompt: string,
  options: { provider?: string; modelType?: string },
  onEvent: (event: FullStackPipelineSSEEvent) => void,
  onError?: (err: Error) => void
): (() => void) => {
  const controller = new AbortController();

  fetch('/api/vibe/fullstack-pipeline', {
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
            const event = JSON.parse(line.slice(6)) as FullStackPipelineSSEEvent;
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
  codeParts: { html: string; css: string; js: string; jsx?: string; compiledJs?: string; isFullHtml?: boolean; isReact?: boolean };
}

export const fetchVibeTemplates = async (params?: { page?: number; limit?: number; category?: string; search?: string; sort?: string }) => {
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

// ─── Vibe App Runtime（动态后端部署）────────────────────────────────────────────

export interface DeployResult {
  appId: string;
  basePath: string;
  collections: Array<{ name: string; fields: string[] }>;
  deployedAt: string;
}

export interface RuntimeStatus {
  deployed: boolean;
  appId: string;
  title?: string;
  basePath?: string;
  collections?: Array<{ name: string; collectionName: string; fields: string[] }>;
  deployedAt?: string;
}

/** 部署 Vibe App 后端（解析 Model 代码，创建动态路由） */
export const deployVibeApp = async (appId: string): Promise<DeployResult> => {
  const { data } = await api.post<{ success: boolean; data: DeployResult; message: string }>(`/vibe-runtime/${appId}/deploy`);
  return data.data;
};

/** 卸载 Vibe App 后端 */
export const undeployVibeApp = async (appId: string): Promise<void> => {
  await api.delete(`/vibe-runtime/${appId}/deploy`);
};

/** 查询 Vibe App 部署状态 */
export const fetchVibeAppRuntimeStatus = async (appId: string): Promise<RuntimeStatus> => {
  const { data } = await api.get<{ success: boolean; data: RuntimeStatus }>(`/vibe-runtime/${appId}/status`);
  return data.data;
};

/** 获取所有已部署的 Vibe App 列表 */
export const fetchDeployedVibeApps = async (): Promise<Array<{ appId: string; title: string; basePath: string; collectionCount: number; deployedAt: string }>> => {
  const { data } = await api.get<{ success: boolean; data: Array<{ appId: string; title: string; basePath: string; collectionCount: number; deployedAt: string }> }>('/vibe-runtime/apps');
  return data.data;
};

// =============================================================================
// 扩展功能 API
// =============================================================================

import type {
  ProviderInfo, TokenUsageStats, TokenUsageRecord, Role, UserInfo,
  MemoryEntry, SemanticSearchResult, CollaborationMode, CollaborationStepResult,
  McpTemplate, ExtensionsStatus,
} from '../types';

// ─── 多 Provider 管理 ─────────────────────────────────────────────────────────

/** 获取所有可用的 LLM Provider */
export const fetchProviders = async () => {
  const { data } = await api.get<{ success: boolean; data: {
    activeProvider: string;
    providers: ProviderInfo[];
    routingStrategy: string;
    fallbackChain: string[];
  } }>('/providers');
  return data.data;
};

// ─── Token 用量统计 ──────────────────────────────────────────────────────────

/** 获取今日 Token 用量概览 */
export const fetchTokenUsageToday = async (): Promise<TokenUsageStats> => {
  const { data } = await api.get<{ success: boolean; data: TokenUsageStats }>('/token-usage/today');
  return data.data;
};

/** 获取 Token 用量统计 */
export const fetchTokenUsageStats = async (params?: {
  startDate?: string; endDate?: string; groupBy?: string; userId?: string;
}) => {
  const { data } = await api.get<{ success: boolean; data: Array<Record<string, unknown>> }>('/token-usage/stats', { params });
  return data.data;
};

/** 获取 Token 用量历史 */
export const fetchTokenUsageHistory = async (params?: {
  page?: number; limit?: number; provider?: string; callType?: string;
}) => {
  const { data } = await api.get<{ success: boolean; data: TokenUsageRecord[]; pagination: { page: number; limit: number; total: number } }>('/token-usage/history', { params });
  return data;
};

// ─── RAG 向量检索 ────────────────────────────────────────────────────────────

/** 语义搜索知识库 */
export const semanticSearchKnowledge = async (params: {
  query: string; categoryKey?: string; agentSlug?: string; limit?: number; minScore?: number;
}): Promise<SemanticSearchResult[]> => {
  const { data } = await api.post<{ success: boolean; data: SemanticSearchResult[] }>('/knowledge/semantic-search', params);
  return data.data;
};

/** 混合搜索知识库 */
export const hybridSearchKnowledge = async (params: {
  query: string; categoryKey?: string; agentSlug?: string; limit?: number;
}): Promise<SemanticSearchResult[]> => {
  const { data } = await api.post<{ success: boolean; data: SemanticSearchResult[] }>('/knowledge/hybrid-search', params);
  return data.data;
};

// ─── Agent 记忆系统 ──────────────────────────────────────────────────────────

/** 添加记忆 */
export const addAgentMemory = async (params: {
  userId: string; agentSlug?: string; content: string;
  type: 'session' | 'long_term' | 'working'; importance?: string; tags?: string[];
}): Promise<MemoryEntry> => {
  const { data } = await api.post<{ success: boolean; data: MemoryEntry }>('/memory', params);
  return data.data;
};

/** 获取记忆列表 */
export const fetchAgentMemories = async (params: {
  userId: string; agentSlug?: string; type?: string; limit?: number;
}): Promise<MemoryEntry[]> => {
  const { data } = await api.get<{ success: boolean; data: MemoryEntry[] }>('/memory', { params });
  return data.data;
};

/** 搜索记忆 */
export const searchAgentMemories = async (params: {
  userId: string; query: string; agentSlug?: string; limit?: number;
}): Promise<Array<MemoryEntry & { score: number }>> => {
  const { data } = await api.post<{ success: boolean; data: Array<MemoryEntry & { score: number }> }>('/memory/search', params);
  return data.data;
};

/** 删除记忆 */
export const deleteAgentMemory = async (memoryId: string, userId: string): Promise<void> => {
  await api.delete(`/memory/${memoryId}`, { params: { userId } });
};

/** 整合记忆 */
export const consolidateAgentMemories = async (userId: string, agentSlug?: string) => {
  const { data } = await api.post<{ success: boolean; data: { consolidated: number; newLongTermMemories: number } }>('/memory/consolidate', { userId, agentSlug });
  return data.data;
};

// ─── Multi-Agent 协作 ────────────────────────────────────────────────────────

/** 执行 Multi-Agent 协作 */
export const executeMultiAgent = async (params: {
  mode: CollaborationMode;
  userPrompt: string;
  agents: string[];
  options?: { userId?: string; mergeStrategy?: string; rounds?: number };
}) => {
  const { data } = await api.post<{ success: boolean; data: {
    taskId: string;
    results?: CollaborationStepResult[];
    finalOutput?: string;
    rounds?: Array<{ round: number; arguments: CollaborationStepResult[] }>;
    verdict?: string;
  } }>('/multi-agent/execute', params, { timeout: 5 * 60_000 }); // 协作任务可能耗时较长，5 分钟超时
  return data.data;
};

/** 获取可协作的 Agent 列表 */
export const fetchCollaborationAgents = async () => {
  const { data } = await api.get<{ success: boolean; data: Array<{
    _id: string; slug: string; name: { zh: string; en: string };
    description: { zh: string; en: string }; emoji: string; categoryKey: string;
  }> }>('/multi-agent/agents');
  return data.data;
};

// ─── MCP 工具市场 ────────────────────────────────────────────────────────────

/** 获取 MCP 模板列表 */
export const fetchMcpTemplates = async (category?: string) => {
  const { data } = await api.get<{ success: boolean; data: {
    templates: McpTemplate[];
    categories: Array<{ key: string; name: string; count: number }>;
    total: number;
  } }>('/mcp/templates', { params: category ? { category } : undefined });
  return data.data;
};

/** 从模板安装 MCP Server */
export const installMcpTemplate = async (key: string, overrides?: Record<string, unknown>) => {
  const { data } = await api.post<{ success: boolean; data: unknown; message: string }>(`/mcp/templates/${key}/install`, { overrides });
  return data;
};

// ─── 扩展功能状态 ────────────────────────────────────────────────────────────

/** 获取所有扩展功能状态 */
export const fetchExtensionsStatus = async (): Promise<ExtensionsStatus> => {
  const { data } = await api.get<{ success: boolean; data: ExtensionsStatus }>('/extensions/status');
  return data.data;
};

// ─── Skill 可视化编排器 API ──────────────────────────────────────────────────

import type { Skill, SkillExecutionResult, KnowledgeGraphData, AgentMarketItem, AgentExportFormat, McpResource, McpPrompt } from '../types';

/** 获取 Skill 列表 */
export const fetchSkills = async (params?: { page?: number; limit?: number; category?: string; search?: string; sort?: string }) => {
  const { data } = await api.get<{ success: boolean; data: Skill[]; pagination: { page: number; limit: number; total: number } }>('/skills', { params });
  return data;
};

/** 获取 Skill 详情 */
export const fetchSkill = async (key: string): Promise<Skill> => {
  const { data } = await api.get<{ success: boolean; data: Skill }>(`/skills/${key}`);
  return data.data;
};

/** 创建 Skill */
export const createSkill = async (body: Partial<Skill>): Promise<Skill> => {
  const { data } = await api.post<{ success: boolean; data: Skill }>('/skills', body);
  return data.data;
};

/** 更新 Skill */
export const updateSkill = async (key: string, body: Partial<Skill>): Promise<Skill> => {
  const { data } = await api.put<{ success: boolean; data: Skill }>(`/skills/${key}`, body);
  return data.data;
};

/** 删除 Skill */
export const deleteSkill = async (key: string): Promise<void> => {
  await api.delete(`/skills/${key}`);
};

/** 执行 Skill */
export const executeSkill = async (key: string, input: Record<string, unknown>, options?: { provider?: string; modelType?: string }): Promise<SkillExecutionResult> => {
  const { data } = await api.post<{ success: boolean; data: SkillExecutionResult }>(`/skills/${key}/execute`, { input, ...options });
  return data.data;
};

/** 切换 Skill 启用/禁用 */
export const toggleSkill = async (key: string) => {
  const { data } = await api.post<{ success: boolean; data: { key: string; isActive: boolean } }>(`/skills/${key}/toggle`);
  return data.data;
};

/** 获取 Skill 统计 */
export const fetchSkillStats = async (key: string) => {
  const { data } = await api.get<{ success: boolean; data: unknown }>(`/skills/${key}/stats`);
  return data.data;
};

/** 获取 Skill 全局统计 */
export const fetchSkillOverviewStats = async () => {
  const { data } = await api.get<{ success: boolean; data: {
    totalSkills: number; activeSkills: number; totalExecutions: number;
    recentSuccessRate: number; avgDuration: number; topSkills: Array<{ key: string; count: number }>;
  } }>('/skills/overview/stats');
  return data.data;
};

/** 测试路由匹配 — 输入消息，看会触发哪个 Skill */
export const testSkillMatch = async (message: string, useLLM = false) => {
  const { data } = await api.post<{ success: boolean; data: {
    matched: boolean; skillKey?: string; skillName?: string;
    confidence?: number; method?: string; matchedTrigger?: string;
  } }>('/skills/match', { message, useLLM });
  return data.data;
};

/** 获取 Skill 执行历史 */
export const fetchSkillExecutions = async (key: string, page = 1, limit = 10) => {
  const { data } = await api.get<{ success: boolean; data: {
    executions: Array<{
      executionId: string; status: string; totalDuration: number;
      totalTokens: number; triggerMethod: string; createdAt: string;
      stepResults?: Array<{ stepId: string; status: string; duration: number; outputSummary: string }>;
    }>; total: number;
  } }>(`/skills/${key}/executions`, { params: { page, limit } });
  return data.data;
};

// ─── 知识图谱 API ────────────────────────────────────────────────────────────

/** 获取完整知识图谱数据 */
export const fetchKnowledgeGraph = async (): Promise<KnowledgeGraphData> => {
  const { data } = await api.get<{ success: boolean; data: KnowledgeGraphData }>('/knowledge-graph');
  return data.data;
};

/** 获取单个 Agent 的关系子图 */
export const fetchAgentGraph = async (slug: string) => {
  const { data } = await api.get<{ success: boolean; data: { nodes: KnowledgeGraphData['nodes']; edges: KnowledgeGraphData['edges']; center: string } }>(`/knowledge-graph/agent/${slug}`);
  return data.data;
};

// ─── Agent 市场 API ──────────────────────────────────────────────────────────

/** 获取 Agent 市场列表 */
export const fetchAgentMarket = async (params?: { page?: number; limit?: number; category?: string; search?: string; sort?: string }) => {
  const { data } = await api.get<{ success: boolean; data: AgentMarketItem[]; pagination: { page: number; limit: number; total: number } }>('/agent-market', { params });
  return data;
};

/** 导出 Agent 配置 */
export const exportAgent = async (slug: string): Promise<AgentExportFormat> => {
  const { data } = await api.get<AgentExportFormat>(`/agent-market/${slug}/export`);
  return data;
};

/** 导入 Agent 配置 */
export const importAgent = async (agentData: AgentExportFormat) => {
  const { data } = await api.post<{ success: boolean; data: unknown; message: string; action: string }>('/agent-market/import', agentData);
  return data;
};

/** 分享 Agent 到市场 */
export const shareAgent = async (slug: string) => {
  const { data } = await api.post<{ success: boolean; message: string }>(`/agent-market/${slug}/share`);
  return data;
};

/** 取消分享 Agent */
export const unshareAgent = async (slug: string) => {
  const { data } = await api.delete<{ success: boolean; message: string }>(`/agent-market/${slug}/share`);
  return data;
};

// ─── MCP Resource/Prompt API ─────────────────────────────────────────────────

/** 获取 MCP Server 的资源列表 */
export const fetchMcpResources = async (serverKey: string): Promise<McpResource[]> => {
  const { data } = await api.get<{ success: boolean; data: McpResource[] }>(`/mcp/servers/${serverKey}/resources`);
  return data.data;
};

/** 读取 MCP Resource 内容 */
export const readMcpResource = async (serverKey: string, uri: string) => {
  const { data } = await api.post<{ success: boolean; data: Array<{ uri: string; text?: string; mimeType?: string }> }>(`/mcp/servers/${serverKey}/resources/read`, { uri });
  return data.data;
};

/** 获取 MCP Server 的 Prompt 列表 */
export const fetchMcpPrompts = async (serverKey: string): Promise<McpPrompt[]> => {
  const { data } = await api.get<{ success: boolean; data: McpPrompt[] }>(`/mcp/servers/${serverKey}/prompts`);
  return data.data;
};

/** 获取 MCP Prompt 消息内容 */
export const getMcpPromptMessages = async (serverKey: string, name: string, args?: Record<string, string>) => {
  const { data } = await api.post<{ success: boolean; data: Array<{ role: string; content: { type: string; text?: string } }> }>(`/mcp/servers/${serverKey}/prompts/get`, { name, arguments: args });
  return data.data;
};

// ─── 收藏功能 API ────────────────────────────────────────────────────────────

import type { FavoriteItem, FavoriteListResponse } from '../types';

/** 收藏 Agent */
export const addFavorite = async (agentId: string) => {
  const { data } = await api.post<{ success: boolean; data: { favoriteId: string; agentId: string; createdAt: string } }>('/favorites', { agentId });
  return data.data;
};

/** 取消收藏 Agent */
export const removeFavorite = async (agentId: string) => {
  const { data } = await api.delete<{ success: boolean }>(`/favorites/${agentId}`);
  return data;
};

/** 获取我的收藏列表 */
export const fetchFavorites = async (params?: { page?: number; limit?: number }): Promise<FavoriteListResponse> => {
  const { data } = await api.get<{ success: boolean; data: FavoriteListResponse }>('/favorites', { params });
  return data.data;
};

/** 批量检查收藏状态 */
export const checkFavorites = async (agentIds: string[]): Promise<Record<string, boolean>> => {
  if (agentIds.length === 0) return {};
  const { data } = await api.get<{ success: boolean; data: Record<string, boolean> }>('/favorites/check', {
    params: { agentIds: agentIds.join(',') },
  });
  return data.data;
};

// ─── Agent 评估/反馈 ────────────────────────────────────────────────────────

/** 提交用户评分/反馈 */
export const submitEvaluation = async (params: {
  agentSlug: string;
  chatId?: string;
  messageId?: string;
  rating: number;
  feedback?: string;
  userInput: string;
  agentOutput: string;
}) => {
  const { data } = await api.post<{ success: boolean; data: unknown }>('/evaluations', params);
  return data;
};

/** 获取 Agent 评估统计 */
export const fetchAgentEvalStats = async (agentSlug: string) => {
  const { data } = await api.get<{ success: boolean; data: {
    userRating: { avgRating: number; totalRatings: number };
    autoQuality: { avgOverall: number; totalEvals: number };
    recentFeedback: Array<{ feedback: string; rating: number; createdAt: string }>;
  } }>(`/evaluations/${agentSlug}/stats`);
  return data.data;
};

// ─── OAuth 登录 ──────────────────────────────────────────────────────────────

/** 获取可用的 OAuth Provider 列表 */
export const fetchOAuthProviders = async () => {
  const { data } = await api.get<{ success: boolean; data: Array<{
    key: string; name: string; icon: string; enabled: boolean;
  }> }>('/oauth/providers');
  return data.data;
};

// ─── Agent ReAct 自主决策 ────────────────────────────────────────────────────

import type { ReActSSEEvent } from '../types';

/** 执行 ReAct 自主决策循环（SSE 流式） */
export const executeReActLoop = (
  prompt: string,
  options: { provider?: string; maxIterations?: number },
  onEvent: (event: ReActSSEEvent) => void,
  onError?: (err: Error) => void
): (() => void) => {
  const controller = new AbortController();

  fetch('/api/agent/react', {
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
            const event = JSON.parse(line.slice(6)) as ReActSSEEvent;
            onEvent(event);
          } catch { /* 忽略 */ }
        }
      }
    })
    .catch((err: unknown) => {
      if (err instanceof Error && err.name === 'AbortError') return;
      onError?.(err instanceof Error ? err : new Error(String(err)));
    });

  return () => controller.abort();
};
