/**
 * @file routes/extensions.ts
 * @description 扩展功能路由 — 所有新增功能的 API 端点
 *
 * 包含：
 *   1. 多 Provider 管理
 *   2. Token 用量统计仪表盘
 *   3. RBAC 角色权限管理
 *   4. RAG 向量检索
 *   5. Agent 记忆系统
 *   6. Multi-Agent 协作
 *   7. MCP 工具市场
 */

import Router from '@koa/router';
import { env, type LLMProvider } from '../config/env.js';
import { getAvailableProviders } from '../services/llmService.js';
import { getDailyTokenStats } from '../services/providerRegistry.js';
import { TokenUsage, getTokenUsageStats, getTodayTokenOverview, estimateTokenCost } from '../models/TokenUsage.js';
import { Role, seedBuiltinRoles, BUILTIN_ROLES } from '../models/Role.js';
import { User } from '../models/User.js';
import { requireAdmin } from '../middleware/auth.js';
import { semanticSearch, hybridSearch, buildKnowledgeEmbeddings, buildAllKnowledgeEmbeddings } from '../services/embeddingService.js';
import { addMemory, getMemories, deleteMemory, searchMemories, consolidateMemories, getMemoryContext } from '../services/memoryService.js';
import { sequentialCollaboration, parallelCollaboration, debateCollaboration, type CollaborationMode } from '../services/multiAgentService.js';
import { MCP_TEMPLATES, getTemplatesByCategory, getTemplateCategories } from '../config/mcpTemplates.js';

export const extensionsRouter = new Router({ prefix: '/api' });

// =============================================================================
// 1. 多 Provider 管理
// =============================================================================

/** 获取所有可用的 LLM Provider 列表 */
extensionsRouter.get('/providers', async (ctx) => {
  const providers = getAvailableProviders();
  ctx.body = {
    success: true,
    data: {
      activeProvider: env.activeProvider,
      providers,
      routingStrategy: env.modelRoutingStrategy,
      fallbackChain: env.fallbackProviders,
    },
  };
});

// =============================================================================
// 2. Token 用量统计仪表盘
// =============================================================================

/** 获取今日 Token 用量概览 */
extensionsRouter.get('/token-usage/today', async (ctx) => {
  const overview = await getTodayTokenOverview();
  const memoryStats = getDailyTokenStats();
  ctx.body = {
    success: true,
    data: {
      ...overview,
      budget: env.dailyTokenBudget,
      remaining: env.dailyTokenBudget > 0 ? Math.max(0, env.dailyTokenBudget - (overview.totalTokens || 0)) : -1,
      memoryStats,
    },
  };
});

/** 获取 Token 用量统计（按时间范围） */
extensionsRouter.get('/token-usage/stats', async (ctx) => {
  const { startDate, endDate, groupBy = 'provider', userId } = ctx.query as Record<string, string>;

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 3600_000);
  const end = endDate ? new Date(endDate) : new Date();

  const stats = await getTokenUsageStats({
    startDate: start,
    endDate: end,
    userId,
    groupBy: groupBy as 'provider' | 'model' | 'callType' | 'day',
  });

  ctx.body = { success: true, data: stats };
});

/** 获取 Token 用量历史记录 */
extensionsRouter.get('/token-usage/history', async (ctx) => {
  const { page = '1', limit = '20', provider, callType } = ctx.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit));

  const filter: Record<string, unknown> = {};
  if (provider) filter.provider = provider;
  if (callType) filter.callType = callType;

  const [records, total] = await Promise.all([
    TokenUsage.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
    TokenUsage.countDocuments(filter),
  ]);

  ctx.body = { success: true, data: records, pagination: { page: pageNum, limit: limitNum, total } };
});

// =============================================================================
// 3. RBAC 角色权限管理
// =============================================================================

/** 获取所有角色 */
extensionsRouter.get('/admin/roles', requireAdmin, async (ctx) => {
  const roles = await Role.find().sort({ isBuiltin: -1, key: 1 }).lean();
  ctx.body = { success: true, data: roles };
});

/** 创建自定义角色 */
extensionsRouter.post('/admin/roles', requireAdmin, async (ctx) => {
  const body = ctx.request.body as { key: string; name: string; description?: string; permissions: Array<{ resource: string; actions: string[] }> };
  const role = await Role.create({ ...body, isBuiltin: false });
  ctx.body = { success: true, data: role };
});

/** 更新角色权限 */
extensionsRouter.put('/admin/roles/:key', requireAdmin, async (ctx) => {
  const role = await Role.findOne({ key: ctx.params.key });
  if (!role) { ctx.status = 404; ctx.body = { success: false, message: '角色不存在' }; return; }

  const update = ctx.request.body as Record<string, unknown>;
  // 内置角色只允许修改权限，不允许修改 key 和 isBuiltin
  if (role.isBuiltin) {
    delete update.key;
    delete update.isBuiltin;
  }

  const updated = await Role.findOneAndUpdate({ key: ctx.params.key }, { $set: update }, { new: true });
  ctx.body = { success: true, data: updated };
});

/** 删除自定义角色 */
extensionsRouter.delete('/admin/roles/:key', requireAdmin, async (ctx) => {
  const role = await Role.findOne({ key: ctx.params.key });
  if (!role) { ctx.status = 404; ctx.body = { success: false, message: '角色不存在' }; return; }
  if (role.isBuiltin) { ctx.status = 400; ctx.body = { success: false, message: '内置角色不可删除' }; return; }

  await Role.findOneAndDelete({ key: ctx.params.key });
  ctx.body = { success: true, message: '角色已删除' };
});

/** 初始化内置角色 */
extensionsRouter.post('/admin/roles/seed', requireAdmin, async (ctx) => {
  await seedBuiltinRoles();
  ctx.body = { success: true, message: '内置角色初始化完成' };
});

/** 获取用户列表（含角色信息） */
extensionsRouter.get('/admin/users', requireAdmin, async (ctx) => {
  const { page = '1', limit = '20', role, search } = ctx.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit));

  const filter: Record<string, unknown> = {};
  if (role) filter.role = role;
  if (search) filter.$or = [
    { username: { $regex: search, $options: 'i' } },
    { email: { $regex: search, $options: 'i' } },
  ];

  const [users, total] = await Promise.all([
    User.find(filter, { passwordHash: 0 }).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
    User.countDocuments(filter),
  ]);

  ctx.body = { success: true, data: users, pagination: { page: pageNum, limit: limitNum, total } };
});

/** 更新用户角色 */
extensionsRouter.put('/admin/users/:id/role', requireAdmin, async (ctx) => {
  const { role } = ctx.request.body as { role: string };
  const roleDoc = await Role.findOne({ key: role });
  if (!roleDoc) { ctx.status = 400; ctx.body = { success: false, message: '角色不存在' }; return; }

  const user = await User.findByIdAndUpdate(ctx.params.id, { role }, { new: true, select: '-passwordHash' });
  if (!user) { ctx.status = 404; ctx.body = { success: false, message: '用户不存在' }; return; }

  ctx.body = { success: true, data: user };
});

/** 更新用户 Token 配额 */
extensionsRouter.put('/admin/users/:id/quota', requireAdmin, async (ctx) => {
  const { dailyTokenQuota } = ctx.request.body as { dailyTokenQuota: number };
  const user = await User.findByIdAndUpdate(ctx.params.id, { dailyTokenQuota }, { new: true, select: '-passwordHash' });
  if (!user) { ctx.status = 404; ctx.body = { success: false, message: '用户不存在' }; return; }
  ctx.body = { success: true, data: user };
});

// =============================================================================
// 4. RAG 向量检索
// =============================================================================

/** 语义搜索知识库 */
extensionsRouter.post('/knowledge/semantic-search', async (ctx) => {
  const { query, categoryKey, agentSlug, limit = 5, minScore = 0.3 } = ctx.request.body as {
    query: string; categoryKey?: string; agentSlug?: string; limit?: number; minScore?: number;
  };

  if (!query) { ctx.status = 400; ctx.body = { success: false, message: '查询内容不能为空' }; return; }

  const results = await semanticSearch(query, { categoryKey, agentSlug, limit, minScore });
  ctx.body = { success: true, data: results };
});

/** 混合搜索（关键词 + 语义） */
extensionsRouter.post('/knowledge/hybrid-search', async (ctx) => {
  const { query, categoryKey, agentSlug, limit = 5 } = ctx.request.body as {
    query: string; categoryKey?: string; agentSlug?: string; limit?: number;
  };

  if (!query) { ctx.status = 400; ctx.body = { success: false, message: '查询内容不能为空' }; return; }

  const results = await hybridSearch(query, { categoryKey, agentSlug, limit });
  ctx.body = { success: true, data: results };
});

/** 构建单个知识库的向量索引 */
extensionsRouter.post('/admin/knowledge/:id/build-embeddings', requireAdmin, async (ctx) => {
  const result = await buildKnowledgeEmbeddings(ctx.params.id);
  ctx.body = { success: true, data: result };
});

/** 构建所有知识库的向量索引 */
extensionsRouter.post('/admin/knowledge/build-all-embeddings', requireAdmin, async (ctx) => {
  const result = await buildAllKnowledgeEmbeddings();
  ctx.body = { success: true, data: result };
});

// =============================================================================
// 5. Agent 记忆系统
// =============================================================================

/** 添加记忆 */
extensionsRouter.post('/memory', async (ctx) => {
  const body = ctx.request.body as {
    userId: string; agentSlug?: string; sessionId?: string;
    content: string; type: 'session' | 'long_term' | 'working';
    importance?: string; tags?: string[]; ttlHours?: number;
  };

  if (!body.userId || !body.content) {
    ctx.status = 400;
    ctx.body = { success: false, message: 'userId 和 content 不能为空' };
    return;
  }

  const memory = await addMemory(body as any);
  ctx.body = { success: true, data: memory };
});

/** 获取记忆列表 */
extensionsRouter.get('/memory', async (ctx) => {
  const { userId, agentSlug, type, limit } = ctx.query as Record<string, string>;
  if (!userId) { ctx.status = 400; ctx.body = { success: false, message: 'userId 不能为空' }; return; }

  const memories = await getMemories({
    userId,
    agentSlug,
    type: type as any,
    limit: limit ? parseInt(limit) : undefined,
  });

  ctx.body = { success: true, data: memories };
});

/** 搜索记忆 */
extensionsRouter.post('/memory/search', async (ctx) => {
  const { userId, query, agentSlug, type, limit, minScore } = ctx.request.body as {
    userId: string; query: string; agentSlug?: string; type?: string; limit?: number; minScore?: number;
  };

  if (!userId || !query) {
    ctx.status = 400;
    ctx.body = { success: false, message: 'userId 和 query 不能为空' };
    return;
  }

  const results = await searchMemories({ userId, query, agentSlug, type: type as any, limit, minScore });
  ctx.body = { success: true, data: results };
});

/** 删除记忆 */
extensionsRouter.delete('/memory/:memoryId', async (ctx) => {
  const { userId, agentSlug } = ctx.query as Record<string, string>;
  if (!userId) { ctx.status = 400; ctx.body = { success: false, message: 'userId 不能为空' }; return; }

  const success = await deleteMemory(userId, ctx.params.memoryId, agentSlug);
  ctx.body = { success, message: success ? '记忆已删除' : '记忆不存在' };
});

/** 整合记忆（短期 → 长期） */
extensionsRouter.post('/memory/consolidate', async (ctx) => {
  const { userId, agentSlug } = ctx.request.body as { userId: string; agentSlug?: string };
  if (!userId) { ctx.status = 400; ctx.body = { success: false, message: 'userId 不能为空' }; return; }

  const result = await consolidateMemories({ userId, agentSlug });
  ctx.body = { success: true, data: result };
});

/** 获取记忆上下文（注入 LLM） */
extensionsRouter.post('/memory/context', async (ctx) => {
  const { userId, currentMessage, agentSlug, maxMemories } = ctx.request.body as {
    userId: string; currentMessage: string; agentSlug?: string; maxMemories?: number;
  };

  if (!userId || !currentMessage) {
    ctx.status = 400;
    ctx.body = { success: false, message: 'userId 和 currentMessage 不能为空' };
    return;
  }

  const context = await getMemoryContext({ userId, currentMessage, agentSlug, maxMemories });
  ctx.body = { success: true, data: { context } };
});

// =============================================================================
// 6. Multi-Agent 协作
// =============================================================================

/** 执行 Multi-Agent 协作任务 */
extensionsRouter.post('/multi-agent/execute', async (ctx) => {
  const { mode, userPrompt, agents, options } = ctx.request.body as {
    mode: CollaborationMode;
    userPrompt: string;
    agents: string[];
    options?: { userId?: string; mergeStrategy?: string; rounds?: number };
  };

  if (!userPrompt || !agents || agents.length < 2) {
    ctx.status = 400;
    ctx.body = { success: false, message: '需要提供 userPrompt 和至少 2 个 Agent' };
    return;
  }

  // 协作任务可能耗时较长（debate 模式 5+ 次 LLM 调用），设置 5 分钟超时
  const TIMEOUT_MS = 5 * 60 * 1000;
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('协作任务超时（5分钟），请减少 Agent 数量或切换为 parallel 模式')), TIMEOUT_MS)
  );

  try {
    let taskPromise: Promise<unknown>;
    switch (mode) {
      case 'sequential':
        taskPromise = sequentialCollaboration(userPrompt, agents, { userId: options?.userId });
        break;
      case 'parallel':
        taskPromise = parallelCollaboration(userPrompt, agents, {
          userId: options?.userId,
          mergeStrategy: (options?.mergeStrategy as 'concat' | 'llm_merge') || 'llm_merge',
        });
        break;
      case 'debate':
        taskPromise = debateCollaboration(userPrompt, agents, { rounds: options?.rounds });
        break;
      default:
        taskPromise = sequentialCollaboration(userPrompt, agents, { userId: options?.userId });
    }

    const result = await Promise.race([taskPromise, timeoutPromise]);
    ctx.body = { success: true, data: result };
  } catch (err: unknown) {
    console.error('[Multi-Agent] 协作执行失败:', err);
    ctx.status = 500;
    ctx.body = { success: false, message: err instanceof Error ? err.message : '协作执行失败' };
  }
});

/** 获取可用于协作的 Agent 列表 */
extensionsRouter.get('/multi-agent/agents', async (ctx) => {
  const { Agent } = await import('../models/Agent.js');
  const agents = await Agent.find({}, { slug: 1, name: 1, description: 1, emoji: 1, categoryKey: 1 })
    .sort({ categoryKey: 1 })
    .lean();

  ctx.body = { success: true, data: agents };
});

// =============================================================================
// 7. MCP 工具市场
// =============================================================================

/** 获取 MCP 模板列表 */
extensionsRouter.get('/mcp/templates', async (ctx) => {
  const { category } = ctx.query as Record<string, string>;
  const templates = getTemplatesByCategory(category);
  const categories = getTemplateCategories();

  ctx.body = {
    success: true,
    data: {
      templates,
      categories,
      total: templates.length,
    },
  };
});

/** 获取单个 MCP 模板详情 */
extensionsRouter.get('/mcp/templates/:key', async (ctx) => {
  const template = MCP_TEMPLATES.find(t => t.key === ctx.params.key);
  if (!template) {
    ctx.status = 404;
    ctx.body = { success: false, message: '模板不存在' };
    return;
  }
  ctx.body = { success: true, data: template };
});

/** 从模板创建 MCP Server */
extensionsRouter.post('/mcp/templates/:key/install', async (ctx) => {
  const template = MCP_TEMPLATES.find(t => t.key === ctx.params.key);
  if (!template) {
    ctx.status = 404;
    ctx.body = { success: false, message: '模板不存在' };
    return;
  }

  const { overrides } = (ctx.request.body as { overrides?: Record<string, unknown> }) || {};

  // 创建 MCP Server 配置
  const { McpServer } = await import('../models/McpServer.js');
  const existing = await McpServer.findOne({ key: template.key });
  if (existing) {
    ctx.status = 409;
    ctx.body = { success: false, message: `MCP Server "${template.key}" 已存在` };
    return;
  }

  const serverConfig = {
    key: template.key,
    name: template.name,
    description: template.description,
    icon: template.icon,
    transportType: template.transportType,
    stdioConfig: template.stdioConfig ? { ...template.stdioConfig, ...overrides } : undefined,
    sseConfig: template.sseConfig ? { ...template.sseConfig, ...overrides } : undefined,
    isActive: true,
  };

  const server = await McpServer.create(serverConfig);
  ctx.body = { success: true, data: server, message: `MCP Server "${template.name}" 已创建，请连接以发现工具` };
});

// =============================================================================
// 8. 扩展设置
// =============================================================================

/** 获取扩展功能状态 */
extensionsRouter.get('/extensions/status', async (ctx) => {
  ctx.body = {
    success: true,
    data: {
      multiProvider: {
        enabled: true,
        activeProvider: env.activeProvider,
        configuredProviders: getAvailableProviders().filter(p => p.configured).map(p => p.provider),
      },
      rag: {
        enabled: true,
        embeddingProvider: env.embeddingProvider,
        embeddingModel: env.embeddingModel,
      },
      rbac: {
        enabled: true,
        builtinRoles: BUILTIN_ROLES.map(r => r.key),
      },
      multiTenant: {
        enabled: env.multiTenantEnabled,
      },
      tokenBudget: {
        enabled: env.dailyTokenBudget > 0,
        dailyBudget: env.dailyTokenBudget,
        userQuota: env.userDailyTokenQuota,
      },
      rateLimit: {
        enabled: env.rateLimitPerMinute > 0,
        perMinute: env.rateLimitPerMinute,
      },
      memory: {
        enabled: true,
      },
      multiAgent: {
        enabled: true,
        modes: ['sequential', 'parallel', 'debate'],
      },
      mcpMarket: {
        enabled: true,
        templateCount: MCP_TEMPLATES.length,
      },
      evaluation: {
        enabled: true,
      },
    },
  };
});

// =============================================================================
// 8. Agent 评估体系
// =============================================================================

import { submitUserRating, autoEvaluateQuality, getAgentEvalStats } from '../services/evaluationService.js';

/** 提交用户评分/反馈  POST /api/evaluations */
extensionsRouter.post('/evaluations', async (ctx) => {
  const body = ctx.request.body as {
    agentSlug: string;
    chatId?: string;
    messageId?: string;
    rating: number;
    feedback?: string;
    userInput: string;
    agentOutput: string;
    evaluatedBy?: string;
  };

  if (!body.agentSlug || !body.userInput || !body.agentOutput) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少必填字段：agentSlug, userInput, agentOutput' };
    return;
  }

  if (body.rating && (body.rating < 1 || body.rating > 5)) {
    ctx.status = 400;
    ctx.body = { success: false, message: '评分范围为 1-5' };
    return;
  }

  const evaluation = await submitUserRating(body);
  ctx.body = { success: true, data: evaluation };
});

/** 触发自动质量评估  POST /api/evaluations/auto */
extensionsRouter.post('/evaluations/auto', async (ctx) => {
  const body = ctx.request.body as {
    agentSlug: string;
    chatId?: string;
    messageId?: string;
    userInput: string;
    agentOutput: string;
    provider?: string;
    model?: string;
  };

  if (!body.agentSlug || !body.userInput || !body.agentOutput) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少必填字段' };
    return;
  }

  const evaluation = await autoEvaluateQuality(body);
  ctx.body = { success: true, data: evaluation };
});

/** 获取 Agent 评估统计  GET /api/evaluations/:agentSlug/stats */
extensionsRouter.get('/evaluations/:agentSlug/stats', async (ctx) => {
  const stats = await getAgentEvalStats(ctx.params.agentSlug);
  ctx.body = { success: true, data: stats };
});
