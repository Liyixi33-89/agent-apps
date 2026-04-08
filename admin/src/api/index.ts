import axios from 'axios';

const api = axios.create({ baseURL: '/api/admin', timeout: 60_000 });

// 请求拦截器：自动附加 token
api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('admin_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch { /* ignore */ }
  return config;
});

/** 外部调用：手动设置 token（store 初始化时使用） */
export const initAdminToken = (token: string) => {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

// 响应拦截器：401 跳转登录
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const adminLogin = async (username: string, password: string) => {
  const { data } = await api.post<{ success: boolean; data: { token: string; username: string; role: string } }>('/login', { username, password });
  return data.data;
};

export const fetchDashboard = async () => {
  const { data } = await api.get('/dashboard');
  return data.data;
};

export const fetchAdminAgents = async (params?: { page?: number; limit?: number; category?: string; search?: string }) => {
  const { data } = await api.get('/agents', { params });
  return data;
};

export const updateAgent = async (id: string, update: Record<string, unknown>) => {
  const { data } = await api.put(`/agents/${id}`, update);
  return data.data;
};

export const deleteAgent = async (id: string) => {
  await api.delete(`/agents/${id}`);
};

/** 上传 MD 文件解析生成 Agent */
export const uploadAgentMd = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/agents/upload-md', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000, // MD 解析可能较慢
  });
  return data.data as {
    agent: Record<string, unknown>;
    action: 'created' | 'updated';
    message: string;
  };
};

export const fetchAdminKnowledge = async (params?: { page?: number; limit?: number }) => {
  const { data } = await api.get('/knowledge', { params });
  return data;
};

export const createKnowledge = async (body: {
  titleZh: string; titleEn: string; content: string;
  sourceType: 'markdown' | 'text' | 'url'; categoryKey?: string;
  agentSlug?: string; tags?: string[]; translate?: boolean;
}) => {
  const { data } = await api.post('/knowledge', body);
  return data.data;
};

export const deleteKnowledge = async (id: string) => {
  await api.delete(`/knowledge/${id}`);
};

export const fetchAdminPipelines = async () => {
  const { data } = await api.get('/pipelines');
  return data.data;
};

export const createPipeline = async (body: Record<string, unknown>) => {
  const { data } = await api.post('/pipelines', body);
  return data.data;
};

export const updatePipeline = async (id: string, body: Record<string, unknown>) => {
  const { data } = await api.put(`/pipelines/${id}`, body);
  return data.data;
};

export const deletePipeline = async (id: string) => {
  await api.delete(`/pipelines/${id}`);
};

export const fetchAdminChats = async (params?: { page?: number; limit?: number }) => {
  const { data } = await api.get('/chats', { params });
  return data;
};

export const deleteChat = async (id: string) => {
  await api.delete(`/chats/${id}`);
};

export const triggerAdminIngest = async (translate = false) => {
  const { data } = await api.post('/ingest', { translate });
  return data.data;
};

export const triggerKnowledgeIngest = async () => {
  const { data } = await api.post('/ingest/knowledge');
  return data.data as {
    totalAgents: number;
    created: number;
    updated: number;
    totalChunks: number;
    errors: Array<{ slug: string; error: string }>;
  };
};

export const fetchSettings = async () => {
  const { data } = await api.get('/settings');
  return data.data;
};

// ─── 提示词管理 ────────────────────────────────────────────────────────────────

/** Prompt 分类类型 */
export type PromptCategory =
  | 'vibe'               // Vibe Coding 对话/流式生成
  | 'pipeline'           // 固定 4 步 Pipeline
  | 'fullstack_pipeline' // 全栈 Pipeline
  | 'agent_plan'         // Agent 任务规划与执行
  | 'knowledge'          // 知识库 RAG
  | 'system';            // 通用系统级 Prompt

export interface SystemPrompt {
  _id: string;
  key: string;
  category: PromptCategory;
  name: string;
  description: string;
  content: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export const fetchAdminPrompts = async (category?: string) => {
  const { data } = await api.get<{ success: boolean; data: SystemPrompt[] }>('/prompts', {
    params: category ? { category } : undefined,
  });
  return data.data;
};

export const fetchAdminPrompt = async (key: string) => {
  const { data } = await api.get<{ success: boolean; data: SystemPrompt }>(`/prompts/${key}`);
  return data.data;
};

export const createAdminPrompt = async (body: Omit<SystemPrompt, '_id' | 'createdAt' | 'updatedAt'>) => {
  const { data } = await api.post<{ success: boolean; data: SystemPrompt }>('/prompts', body);
  return data.data;
};

export const updateAdminPrompt = async (key: string, body: Partial<Omit<SystemPrompt, '_id' | 'key' | 'createdAt' | 'updatedAt'>>) => {
  const { data } = await api.put<{ success: boolean; data: SystemPrompt }>(`/prompts/${key}`, body);
  return data.data;
};

export const deleteAdminPrompt = async (key: string) => {
  await api.delete(`/prompts/${key}`);
};

export const seedAdminPrompts = async (force = false) => {
  const { data } = await api.post<{ success: boolean; data: Array<{ key: string; action: string }> }>('/prompts/seed', { force });
  return data.data;
};

// ─── Vibe 模板市场管理 ─────────────────────────────────────────────────────────

export interface VibeTemplateAdmin {
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
  createdAt: string;
  updatedAt: string;
}

export const fetchAdminVibeTemplates = async (params?: { page?: number; limit?: number; category?: string; search?: string }) => {
  const { data } = await api.get<{ success: boolean; data: VibeTemplateAdmin[]; pagination: { page: number; limit: number; total: number } }>('/vibe-templates', { params });
  return data;
};

export const updateAdminVibeTemplate = async (id: string, body: Partial<Omit<VibeTemplateAdmin, '_id' | 'createdAt' | 'updatedAt'>>) => {
  const { data } = await api.put<{ success: boolean; data: VibeTemplateAdmin }>(`/vibe-templates/${id}`, body);
  return data.data;
};

export const deleteAdminVibeTemplate = async (id: string) => {
  await api.delete(`/vibe-templates/${id}`);
};

// ─── Vibe 已发布应用管理 ──────────────────────────────────────────────────────

export interface VibeAppAdmin {
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
  isFullStack?: boolean;
  codeParts: {
    html?: string;
    css?: string;
    js?: string;
    jsx?: string;
    isReact?: boolean;
    isFullHtml?: boolean;
  };
  serverParts?: {
    model: string;
    route: string;
    service: string;
    middleware: string;
    envTemplate: string;
  };
  dbSchema?: {
    collections: string;
    indexes: string;
    seedData: string;
  };
  menuConfig?: {
    menus: string;
    permissions: string;
    roles: string;
  };
  createdAt: string;
  updatedAt: string;
}

/** 获取单个应用的完整代码（含前后端代码、数据库 Schema、权限配置） */
export interface VibeAppCodeDetail {
  _id: string;
  title: string;
  isFullStack: boolean;
  codeParts: {
    html: string;
    css: string;
    js: string;
    jsx?: string;
    isReact?: boolean;
    isFullHtml?: boolean;
  };
  serverParts: {
    model: string;
    route: string;
    service: string;
    middleware: string;
    envTemplate: string;
  } | null;
  dbSchema: {
    collections: string;
    indexes: string;
    seedData: string;
  } | null;
  menuConfig: {
    menus: string;
    permissions: string;
    roles: string;
  } | null;
}

export const fetchAdminVibeApps = async (params?: { page?: number; limit?: number; search?: string; isActive?: string }) => {
  const { data } = await api.get<{ success: boolean; data: VibeAppAdmin[]; pagination: { page: number; limit: number; total: number } }>('/vibe-apps', { params });
  return data;
};

export const updateAdminVibeApp = async (id: string, body: Partial<Omit<VibeAppAdmin, '_id' | 'createdAt' | 'updatedAt'>>) => {
  const { data } = await api.put<{ success: boolean; data: VibeAppAdmin }>(`/vibe-apps/${id}`, body);
  return data.data;
};

export const deleteAdminVibeApp = async (id: string) => {
  await api.delete(`/vibe-apps/${id}`);
};

/** 获取单个应用的完整代码（Admin 代码编辑器使用） */
export const fetchAdminVibeAppCode = async (id: string): Promise<VibeAppCodeDetail> => {
  const { data } = await api.get<{ success: boolean; data: VibeAppCodeDetail }>(`/vibe-apps/${id}/code`);
  return data.data;
};

// ─── Vibe App Runtime（动态后端部署）────────────────────────────────────────────

// 注意：Runtime API 不走 /api/admin 前缀，需要单独创建 axios 实例
const runtimeApi = axios.create({ baseURL: '/api', timeout: 60_000 });

export interface RuntimeDeployResult {
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

/** 部署 Vibe App 后端 */
export const deployVibeAppRuntime = async (appId: string): Promise<RuntimeDeployResult> => {
  const { data } = await runtimeApi.post<{ success: boolean; data: RuntimeDeployResult }>(`/vibe-runtime/${appId}/deploy`);
  return data.data;
};

/** 卸载 Vibe App 后端 */
export const undeployVibeAppRuntime = async (appId: string): Promise<void> => {
  await runtimeApi.delete(`/vibe-runtime/${appId}/deploy`);
};

/** 查询 Vibe App 部署状态 */
export const fetchVibeAppRuntimeStatus = async (appId: string): Promise<RuntimeStatus> => {
  const { data } = await runtimeApi.get<{ success: boolean; data: RuntimeStatus }>(`/vibe-runtime/${appId}/status`);
  return data.data;
};

/** 获取所有已部署的 Vibe App 列表 */
export const fetchDeployedVibeApps = async (): Promise<Array<{ appId: string; title: string; basePath: string; collectionCount: number; deployedAt: string }>> => {
  const { data } = await runtimeApi.get<{ success: boolean; data: Array<{ appId: string; title: string; basePath: string; collectionCount: number; deployedAt: string }> }>('/vibe-runtime/apps');
  return data.data;
};

// ─── MCP（Model Context Protocol）管理 ───────────────────────────────────────

export interface McpToolParam {
  name: string;
  type: string;
  description: string;
  required: boolean;
  enum?: string[];
}

export interface McpTool {
  name: string;
  description: string;
  parameters: McpToolParam[];
  inputSchema: Record<string, unknown>;
}

export interface McpServerConfig {
  _id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  transportType: 'stdio' | 'sse';
  stdioConfig?: {
    command: string;
    args: string[];
    env?: Record<string, string>;
    cwd?: string;
  };
  sseConfig?: {
    url: string;
    headers?: Record<string, string>;
  };
  tools: McpTool[];
  status: 'connected' | 'disconnected' | 'error';
  lastConnectedAt?: string;
  lastError?: string;
  isActive: boolean;
  isConnected: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** 获取所有 MCP Server 列表 */
export const fetchMcpServers = async (): Promise<McpServerConfig[]> => {
  const { data } = await runtimeApi.get<{ success: boolean; data: McpServerConfig[] }>('/mcp/servers');
  return data.data;
};

/** 创建 MCP Server 配置 */
export const createMcpServer = async (body: {
  key: string;
  name: string;
  description?: string;
  icon?: string;
  transportType: 'stdio' | 'sse';
  stdioConfig?: { command: string; args: string[]; env?: Record<string, string>; cwd?: string };
  sseConfig?: { url: string; headers?: Record<string, string> };
}): Promise<McpServerConfig> => {
  const { data } = await runtimeApi.post<{ success: boolean; data: McpServerConfig }>('/mcp/servers', body);
  return data.data;
};

/** 更新 MCP Server 配置 */
export const updateMcpServer = async (key: string, body: Partial<{
  name: string;
  description: string;
  icon: string;
  transportType: 'stdio' | 'sse';
  stdioConfig: { command: string; args: string[]; env?: Record<string, string>; cwd?: string };
  sseConfig: { url: string; headers?: Record<string, string> };
  isActive: boolean;
  sortOrder: number;
}>): Promise<McpServerConfig> => {
  const { data } = await runtimeApi.put<{ success: boolean; data: McpServerConfig }>(`/mcp/servers/${key}`, body);
  return data.data;
};

/** 删除 MCP Server 配置 */
export const deleteMcpServer = async (key: string): Promise<void> => {
  await runtimeApi.delete(`/mcp/servers/${key}`);
};

/** 连接 MCP Server（发现工具） */
export const connectMcpServer = async (key: string): Promise<{
  status: string;
  toolCount: number;
  tools: Array<{ name: string; description: string }>;
}> => {
  const { data } = await runtimeApi.post<{ success: boolean; data: { status: string; toolCount: number; tools: Array<{ name: string; description: string }> } }>(`/mcp/servers/${key}/connect`);
  return data.data;
};

/** 断开 MCP Server 连接 */
export const disconnectMcpServer = async (key: string): Promise<void> => {
  await runtimeApi.post(`/mcp/servers/${key}/disconnect`);
};

/** 获取所有可用 MCP 工具 */
export const fetchMcpTools = async (): Promise<{ total: number; tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }> }> => {
  const { data } = await runtimeApi.get<{ success: boolean; data: { total: number; tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }> } }>('/mcp/tools');
  return data.data;
};

// ─── Skill 管理 ──────────────────────────────────────────────────────────────

export interface SkillStep {
  id: string;
  type: string;
  label: string;
  toolName?: string;
  promptKey?: string;
  promptTemplate?: string;
  outputKey: string;
  optional: boolean;
}

export interface SkillTrigger {
  keywords: string[];
  patterns: string[];
  contextRules: string[];
  intentDescription: string;
}

export interface SkillConfig {
  timeout: number;
  retryCount: number;
  cacheTTL: number;
  concurrency: number;
  streamOutput: boolean;
}

export interface SkillVersion {
  version: string;
  changelog: string;
  createdAt: string;
}

export interface Skill {
  _id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  isActive: boolean;
  isBuiltin: boolean;
  version: string;
  usageCount: number;
  avgDuration: number;
  successRate: number;
  steps: SkillStep[];
  triggers: SkillTrigger;
  config: SkillConfig;
  dependsOn: string[];
  versions: SkillVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface SkillStats {
  skillKey: string;
  skillName: string;
  totalExecutions: number;
  recentSuccessRate: number;
  avgDuration: number;
  avgTokens: number;
  stepFailRates: Array<{ stepId: string; failRate: number; totalRuns: number }>;
}

export interface SkillOverviewStats {
  totalSkills: number;
  activeSkills: number;
  totalExecutions: number;
  recentSuccessRate: number;
  avgDuration: number;
  topSkills: Array<{ key: string; count: number }>;
}

export interface SkillExecutionResult {
  executionId: string;
  skillKey: string;
  success: boolean;
  output: unknown;
  error?: string;
  totalDuration: number;
  totalTokens: number;
  stepResults: Array<{ stepId: string; status: string; duration: number; outputSummary: string }>;
}

export interface SkillMatchResult {
  matched: boolean;
  skillKey?: string;
  skillName?: string;
  confidence?: number;
  method?: string;
  matchedTrigger?: string;
}

/** 获取 Skill 列表 */
export const fetchSkills = async (params?: { page?: number; limit?: number; category?: string; search?: string; sort?: string }) => {
  const { data } = await runtimeApi.get<{ success: boolean; data: Skill[]; pagination: { page: number; limit: number; total: number } }>('/skills', { params });
  return data;
};

/** 获取 Skill 详情 */
export const fetchSkillDetail = async (key: string) => {
  const { data } = await runtimeApi.get<{ success: boolean; data: Skill }>(`/skills/${key}`);
  return data.data;
};

/** 创建 Skill */
export const createSkill = async (body: Partial<Skill>) => {
  const { data } = await runtimeApi.post<{ success: boolean; data: Skill }>('/skills', body);
  return data.data;
};

/** 更新 Skill */
export const updateSkill = async (key: string, body: Partial<Skill>) => {
  const { data } = await runtimeApi.put<{ success: boolean; data: Skill }>(`/skills/${key}`, body);
  return data.data;
};

/** 删除 Skill */
export const deleteSkill = async (key: string) => {
  await runtimeApi.delete(`/skills/${key}`);
};

/** 启用/禁用 Skill */
export const toggleSkill = async (key: string) => {
  const { data } = await runtimeApi.post<{ success: boolean; data: { key: string; isActive: boolean } }>(`/skills/${key}/toggle`);
  return data.data;
};

/** 手动执行 Skill（测试台） */
export const executeSkill = async (key: string, input: Record<string, unknown>) => {
  const { data } = await runtimeApi.post<{ success: boolean; data: SkillExecutionResult }>(`/skills/${key}/execute`, { input });
  return data;
};

/** 获取 Skill 执行历史 */
export const fetchSkillExecutions = async (key: string, page = 1, limit = 10) => {
  const { data } = await runtimeApi.get<{ success: boolean; data: { executions: any[]; total: number } }>(`/skills/${key}/executions`, { params: { page, limit } });
  return data.data;
};

/** 获取 Skill 统计 */
export const fetchSkillStats = async (key: string) => {
  const { data } = await runtimeApi.get<{ success: boolean; data: SkillStats }>(`/skills/${key}/stats`);
  return data.data;
};

/** 版本回退 */
export const rollbackSkill = async (key: string, targetVersion: string) => {
  const { data } = await runtimeApi.post<{ success: boolean; data: Skill; message: string }>(`/skills/${key}/rollback`, { targetVersion });
  return data;
};

/** 测试路由匹配 */
export const testSkillMatch = async (message: string, useLLM = false) => {
  const { data } = await runtimeApi.post<{ success: boolean; data: SkillMatchResult }>('/skills/match', { message, useLLM });
  return data.data;
};

/** 获取 Skill 全局统计概览 */
export const fetchSkillOverviewStats = async () => {
  const { data } = await runtimeApi.get<{ success: boolean; data: SkillOverviewStats }>('/skills/overview/stats');
  return data.data;
};
