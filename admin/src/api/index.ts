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

// =============================================================================
// 扩展功能 API
// =============================================================================

// ─── 多 Provider 管理 ─────────────────────────────────────────────────────────

export interface ProviderInfo {
  provider: string;
  configured: boolean;
  textModel: string;
  visionModel: string;
}

/** 获取所有可用的 LLM Provider */
export const fetchProviders = async () => {
  const { data } = await runtimeApi.get<{ success: boolean; data: {
    activeProvider: string;
    providers: ProviderInfo[];
    routingStrategy: string;
    fallbackChain: string[];
  } }>('/providers');
  return data.data;
};

// ─── Token 用量统计 ──────────────────────────────────────────────────────────

export interface TokenUsageOverview {
  totalTokens: number;
  totalCost: number;
  callCount: number;
  avgDuration: number;
  successRate: number;
  budget: number;
  remaining: number;
}

/** 获取今日 Token 用量 */
export const fetchTokenUsageToday = async (): Promise<TokenUsageOverview> => {
  const { data } = await runtimeApi.get<{ success: boolean; data: TokenUsageOverview }>('/token-usage/today');
  return data.data;
};

/** 获取 Token 用量统计 */
export const fetchTokenUsageStats = async (params?: {
  startDate?: string; endDate?: string; groupBy?: string;
}) => {
  const { data } = await runtimeApi.get<{ success: boolean; data: Array<Record<string, unknown>> }>('/token-usage/stats', { params });
  return data.data;
};

/** 获取 Token 用量历史 */
export const fetchTokenUsageHistory = async (params?: {
  page?: number; limit?: number; provider?: string; callType?: string;
}) => {
  const { data } = await runtimeApi.get<{ success: boolean; data: Array<Record<string, unknown>>; pagination: { page: number; limit: number; total: number } }>('/token-usage/history', { params });
  return data;
};

// ─── RBAC 角色管理 ──────────────────────────────────────────────────────────

export interface RoleConfig {
  _id: string;
  key: string;
  name: string;
  description: string;
  permissions: Array<{ resource: string; actions: string[] }>;
  isBuiltin: boolean;
  isActive: boolean;
}

/** 获取所有角色 */
export const fetchRoles = async (): Promise<RoleConfig[]> => {
  const { data } = await api.get<{ success: boolean; data: RoleConfig[] }>('/roles');
  return data.data;
};

/** 创建角色 */
export const createRole = async (body: { key: string; name: string; description?: string; permissions: Array<{ resource: string; actions: string[] }> }) => {
  const { data } = await api.post<{ success: boolean; data: RoleConfig }>('/roles', body);
  return data.data;
};

/** 更新角色 */
export const updateRole = async (key: string, body: Partial<RoleConfig>) => {
  const { data } = await api.put<{ success: boolean; data: RoleConfig }>(`/roles/${key}`, body);
  return data.data;
};

/** 删除角色 */
export const deleteRole = async (key: string) => {
  await api.delete(`/roles/${key}`);
};

/** 初始化内置角色 */
export const seedRoles = async () => {
  const { data } = await api.post<{ success: boolean; message: string }>('/roles/seed');
  return data;
};

// ─── 用户管理（含角色） ──────────────────────────────────────────────────────

export interface UserAdmin {
  _id: string;
  username: string;
  email: string;
  role: string;
  avatar?: string;
  tenantId?: string;
  dailyTokenQuota: number;
  todayTokenUsed: number;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

/** 获取用户列表 */
export const fetchUsers = async (params?: { page?: number; limit?: number; role?: string; search?: string }) => {
  const { data } = await api.get<{ success: boolean; data: UserAdmin[]; pagination: { page: number; limit: number; total: number } }>('/users', { params });
  return data;
};

/** 更新用户角色 */
export const updateUserRole = async (id: string, role: string) => {
  const { data } = await api.put<{ success: boolean; data: UserAdmin }>(`/users/${id}/role`, { role });
  return data.data;
};

/** 更新用户 Token 配额 */
export const updateUserQuota = async (id: string, dailyTokenQuota: number) => {
  const { data } = await api.put<{ success: boolean; data: UserAdmin }>(`/users/${id}/quota`, { dailyTokenQuota });
  return data.data;
};

// ─── RAG 向量索引 ────────────────────────────────────────────────────────────

/** 构建单个知识库的向量索引 */
export const buildKnowledgeEmbeddings = async (id: string) => {
  const { data } = await api.post<{ success: boolean; data: { totalChunks: number; embeddedChunks: number; errors: number } }>(`/knowledge/${id}/build-embeddings`);
  return data.data;
};

/** 构建所有知识库的向量索引 */
export const buildAllKnowledgeEmbeddings = async () => {
  const { data } = await api.post<{ success: boolean; data: { totalKBs: number; totalChunks: number; embeddedChunks: number; errors: number } }>('/knowledge/build-all-embeddings');
  return data.data;
};

// ─── MCP 工具市场 ────────────────────────────────────────────────────────────

export interface McpTemplateInfo {
  key: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  transportType: 'stdio' | 'sse';
  installGuide: string;
  expectedTools: Array<{ name: string; description: string }>;
}

/** 获取 MCP 模板列表 */
export const fetchMcpTemplates = async (category?: string) => {
  const { data } = await runtimeApi.get<{ success: boolean; data: {
    templates: McpTemplateInfo[];
    categories: Array<{ key: string; name: string; count: number }>;
    total: number;
  } }>('/mcp/templates', { params: category ? { category } : undefined });
  return data.data;
};

/** 从模板安装 MCP Server */
export const installMcpTemplate = async (key: string, overrides?: Record<string, unknown>) => {
  const { data } = await runtimeApi.post<{ success: boolean; data: unknown; message: string }>(`/mcp/templates/${key}/install`, { overrides });
  return data;
};

/** 调用 MCP 工具（测试台） */
export const callMcpTool = async (name: string, args: Record<string, unknown> = {}): Promise<{ success: boolean; content?: unknown; error?: string }> => {
  const { data } = await runtimeApi.post<{ success: boolean; content?: unknown; error?: string }>('/mcp/tools/call', { name, arguments: args });
  return data;
};

// ─── 文档上传 ────────────────────────────────────────────────────────────────

/** 上传文档并解析（PDF/Word/Excel/TXT） */
export const uploadDocument = async (file: File) => {
  const formData = new FormData();
  formData.append('document', file);
  const { data } = await runtimeApi.post<{ success: boolean; data: {
    fileName: string; fileType: string; content: string;
    wordCount: number; pageCount?: number; parseTime: number;
    contentPreview: string;
  } }>('/upload/document', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
  });
  return data.data;
};

/** 上传文档并导入知识库 */
export const uploadDocumentToKnowledge = async (
  file: File,
  options?: { categoryKey?: string; agentSlug?: string; tags?: string; maxChunkSize?: number }
) => {
  const formData = new FormData();
  formData.append('document', file);
  if (options?.categoryKey) formData.append('categoryKey', options.categoryKey);
  if (options?.agentSlug) formData.append('agentSlug', options.agentSlug);
  if (options?.tags) formData.append('tags', options.tags);
  if (options?.maxChunkSize) formData.append('maxChunkSize', String(options.maxChunkSize));
  const { data } = await runtimeApi.post<{ success: boolean; data: {
    knowledgeId: string; title: string; fileType: string;
    wordCount: number; chunkCount: number; pageCount?: number; parseTime: number;
  }; message: string }>('/upload/document-to-knowledge', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
  });
  return data;
};

// ─── 扩展功能状态 ────────────────────────────────────────────────────────────

/** 获取扩展功能状态 */
export const fetchExtensionsStatus = async () => {
  const { data } = await runtimeApi.get<{ success: boolean; data: Record<string, unknown> }>('/extensions/status');
  return data.data;
};

// ─── 知识库 URL 刷新 ────────────────────────────────────────────────────────

/** 刷新单个 URL 知识源 */
export const refreshUrlKnowledge = async (id: string) => {
  const { data } = await api.post<{ success: boolean; data: {
    knowledgeId: string; title: string; url: string;
    status: 'updated' | 'unchanged' | 'error'; message?: string;
    newWordCount?: number; newChunkCount?: number;
  } }>(`/knowledge/${id}/refresh-url`);
  return data.data;
};

/** 刷新所有 URL 知识源 */
export const refreshAllUrlKnowledge = async () => {
  const { data } = await api.post<{ success: boolean; data: {
    total: number; updated: number; unchanged: number; errors: number;
  } }>('/knowledge/refresh-all-urls');
  return data.data;
};

// ─── 内置 Agent Tools ────────────────────────────────────────────────────────

export interface AgentToolParam {
  type: string;
  description: string;
  enum?: string[];
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, AgentToolParam>;
    required: string[];
  };
}

/** 获取所有内置 Agent 工具定义 */
export const fetchAgentTools = async (): Promise<{ total: number; tools: AgentToolDefinition[] }> => {
  const { data } = await runtimeApi.get<{ success: boolean; data: { total: number; tools: AgentToolDefinition[] } }>('/agent/tools');
  return data.data;
};

/** 调用内置 Agent 工具（测试台） */
export const callAgentTool = async (name: string, args: Record<string, unknown> = {}): Promise<{ success: boolean; data?: unknown; error?: string }> => {
  const { data } = await runtimeApi.post<{ success: boolean; data?: unknown; error?: string }>('/agent/tool', { name, arguments: args });
  return data;
};
