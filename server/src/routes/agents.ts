/**
 * @file routes/agents.ts
 * @description Agency Agents Platform — 路由入口文件
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  路由分区总览                                                               │
 * ├──────────────────────────┬──────────────────────────────────────────────────┤
 * │  § 1  基础设施            │  Prompt 读取工具、Router 实例                    │
 * │  § 3  系统路由            │  健康检查 / 概览统计 / 数据导入                   │
 * │  § 4  Agent / 分类路由    │  Agent 列表/详情、分类列表、Pipeline 列表          │
 * ├──────────────────────────┼──────────────────────────────────────────────────┤
 * │  子路由文件               │  说明                                            │
 * ├──────────────────────────┼──────────────────────────────────────────────────┤
 * │  routes/chat.ts          │  § 5  Chat 路由（会话管理 / 流式聊天）             │
 * │  routes/knowledge.ts     │  § 6  知识库路由（CRUD / 语义搜索 / RAG）          │
 * │  routes/vibe.ts          │  § 7  Vibe 单步/流式生成                          │
 * │  routes/vibePipeline.ts  │  § 7  Vibe Pipeline（4步多Agent流水线）            │
 * │  routes/upload.ts        │  § 8  文件上传（图片，5MB 限制）                   │
 * │  routes/market.ts        │  § 9  模板市场（列表 / 详情 / 发布）               │
 * │  routes/agentPlan.ts     │  § 10 Agent 规划器（分析/规划/执行/工具调用）        │
 * ├──────────────────────────┼──────────────────────────────────────────────────┤
 * │  lib/llmUtils.ts         │  LLM 工具函数（记忆压缩 / 截断检测 / 流式续写）     │
 * │  lib/agentPlanner.ts     │  Plan-Execute 规划器（复杂度分析 / 计划生成 / 执行）│
 * │  lib/agentTools.ts       │  Agent 工具系统（8个工具定义 + 执行器）             │
 * └──────────────────────────┴──────────────────────────────────────────────────┘
 *
 * 路由前缀：/api
 * 认证方式：/api/ingest 需要 x-admin-key 请求头
 */

// ─── 依赖导入 ──────────────────────────────────────────────────────────────────

import Router from '@koa/router';
import { Agent } from '../models/Agent.js';
import { Category } from '../models/Category.js';
import { Pipeline } from '../models/Pipeline.js';
import { KnowledgeBase } from '../models/KnowledgeBase.js';
import { ingestAgentsFromMarkdown } from '../services/agentIngestionService.js';
import { env } from '../config/env.js';

// ─── 子路由导入 ───────────────────────────────────────────────────────────────

import { chatRouter } from './chat.js';
import { knowledgeRouter } from './knowledge.js';
import { vibeRouter } from './vibe.js';
import { vibePipelineRouter } from './vibePipeline.js';
import { vibeFullStackPipelineRouter } from './vibeFullStackPipeline.js';
import { uploadRouter } from './upload.js';
import { marketRouter } from './market.js';
import { agentPlanRouter } from './agentPlan.js';
import { vibeAppRuntimeRouter } from './vibeAppRuntime.js';
import { compileRouter } from './compile.js';
import { mcpRouter } from './mcp.js';
import { skillRouter } from './skill.js';

// =============================================================================
// § 1  基础设施 — Prompt 读取工具 / Router 实例
// =============================================================================

export const agentsRouter = new Router({ prefix: '/api' });

// =============================================================================
// § 3  系统路由 — 健康检查 / 概览统计 / 数据导入
// =============================================================================

// ─── 健康检查  GET /api/health ────────────────────────────────────────────────

agentsRouter.get('/health', async (ctx) => {
  ctx.body = { success: true, message: 'Agency Agents Platform v2.0 running', timestamp: new Date() };
});

// ─── 概览统计  GET /api/overview ─────────────────────────────────────────────

agentsRouter.get('/overview', async (ctx) => {
  const [agentCount, categoryCount, pipelineCount, knowledgeCount, featuredAgents, categories] = await Promise.all([
    Agent.countDocuments(),
    Category.countDocuments(),
    Pipeline.countDocuments(),
    KnowledgeBase.countDocuments({ isActive: true }),
    Agent.find().sort({ 'stats.wordCount': -1 }).limit(6).lean(),
    Category.find().sort({ sortOrder: 1 }).lean()
  ]);

  ctx.body = {
    success: true,
    data: {
      stats: { agentCount, categoryCount, pipelineCount, knowledgeCount },
      providers: {
        active: env.activeProvider,
        ollama: { baseUrl: env.ollamaBaseUrl, textModel: env.ollamaTextModel, visionModel: env.ollamaVisionModel },
        openai: { baseUrl: env.openaiBaseUrl, textModel: env.openaiTextModel, visionModel: env.openaiVisionModel }
      },
      categories,
      featuredAgents
    }
  };
});

// =============================================================================
// § 4  Agent / 分类 / Pipeline 路由
// =============================================================================

// ─── Agent 列表  GET /api/agents ─────────────────────────────────────────────

agentsRouter.get('/agents', async (ctx) => {
  const { category, search = '', modelType, page = '1', limit = '20' } = ctx.query as Record<string, string>;
  const query: Record<string, unknown> = {};

  if (category) query.categoryKey = category;
  if (modelType) query['modelPreferences.primary'] = modelType;
  if (search) {
    query.$or = [
      { 'name.zh': { $regex: search, $options: 'i' } },
      { 'name.en': { $regex: search, $options: 'i' } },
      { 'description.en': { $regex: search, $options: 'i' } },
      { tags: { $in: [search] } }
    ];
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const [agents, total] = await Promise.all([
    Agent.find(query).sort({ categoryKey: 1, 'name.en': 1 }).skip(skip).limit(limitNum).lean(),
    Agent.countDocuments(query)
  ]);

  ctx.body = { success: true, data: agents, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } };
});

// ─── Agent 详情  GET /api/agents/:slug ───────────────────────────────────────

agentsRouter.get('/agents/:slug', async (ctx) => {
  const agent = await Agent.findOne({ slug: ctx.params.slug }).lean();
  if (!agent) { ctx.status = 404; ctx.body = { success: false, message: 'Agent not found' }; return; }
  ctx.body = { success: true, data: agent };
});

// ─── 分类列表  GET /api/categories ───────────────────────────────────────────

agentsRouter.get('/categories', async (ctx) => {
  const categories = await Category.find().sort({ sortOrder: 1 }).lean();
  ctx.body = { success: true, data: categories };
});

// ─── Pipeline 列表  GET /api/pipelines ───────────────────────────────────────

agentsRouter.get('/pipelines', async (ctx) => {
  const pipelines = await Pipeline.find().sort({ createdAt: -1 }).lean();
  ctx.body = { success: true, data: pipelines };
});

// ─── 数据导入  POST /api/ingest（需要 x-admin-key 请求头验证）────────────────

agentsRouter.post('/ingest', async (ctx) => {
  const adminKey = ctx.headers['x-admin-key'];
  if (!adminKey || adminKey !== env.jwtSecret) {
    ctx.status = 401;
    ctx.body = { success: false, message: '未授权，请通过管理后台触发导入' };
    return;
  }
  const result = await ingestAgentsFromMarkdown(env.ingestRoot);
  ctx.body = { success: true, data: result };
});

// =============================================================================
// 挂载子路由（将各分区路由合并到 agentsRouter）
// =============================================================================

agentsRouter.use(chatRouter.routes(), chatRouter.allowedMethods());
agentsRouter.use(knowledgeRouter.routes(), knowledgeRouter.allowedMethods());
agentsRouter.use(vibeRouter.routes(), vibeRouter.allowedMethods());
agentsRouter.use(vibePipelineRouter.routes(), vibePipelineRouter.allowedMethods());
agentsRouter.use(vibeFullStackPipelineRouter.routes(), vibeFullStackPipelineRouter.allowedMethods());
agentsRouter.use(uploadRouter.routes(), uploadRouter.allowedMethods());
agentsRouter.use(marketRouter.routes(), marketRouter.allowedMethods());
agentsRouter.use(agentPlanRouter.routes(), agentPlanRouter.allowedMethods());
agentsRouter.use(vibeAppRuntimeRouter.routes(), vibeAppRuntimeRouter.allowedMethods());
agentsRouter.use(compileRouter.routes(), compileRouter.allowedMethods());
agentsRouter.use(mcpRouter.routes(), mcpRouter.allowedMethods());
agentsRouter.use(skillRouter.routes(), skillRouter.allowedMethods());
