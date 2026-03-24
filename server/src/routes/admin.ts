import Router from '@koa/router';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Agent } from '../models/Agent.js';
import { Category } from '../models/Category.js';
import { Pipeline } from '../models/Pipeline.js';
import { KnowledgeBase } from '../models/KnowledgeBase.js';
import { Chat } from '../models/Chat.js';
import { User } from '../models/User.js';
import { ingestAgentsFromMarkdown } from '../services/agentIngestionService.js';
import { createKnowledgeEntry } from '../services/knowledgeService.js';
import { env } from '../config/env.js';

export const adminRouter = new Router({ prefix: '/api/admin' });

// ─── 认证中间件 ────────────────────────────────────────────────────────────────

const requireAdmin = async (ctx: any, next: () => Promise<void>) => {
  const token = ctx.headers.authorization?.replace('Bearer ', '');
  if (!token) { ctx.status = 401; ctx.body = { success: false, message: '未授权' }; return; }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as { userId: string; role: string };
    if (decoded.role !== 'admin') { ctx.status = 403; ctx.body = { success: false, message: '权限不足' }; return; }
    ctx.state.user = decoded;
    await next();
  } catch {
    ctx.status = 401;
    ctx.body = { success: false, message: 'Token 无效或已过期' };
  }
};

// ─── 登录 ──────────────────────────────────────────────────────────────────────

adminRouter.post('/login', async (ctx) => {
  const { username, password } = ctx.request.body as { username: string; password: string };

  // 首次使用时自动创建管理员账号
  let user = await User.findOne({ username });
  if (!user) {
    const hash = await bcrypt.hash(password, 10);
    user = await User.create({ username, email: `${username}@agency.local`, passwordHash: hash, role: 'admin' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) { ctx.status = 401; ctx.body = { success: false, message: '密码错误' }; return; }

  user.lastLoginAt = new Date();
  await user.save();

  const token = jwt.sign({ userId: user._id, username: user.username, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as any);
  ctx.body = { success: true, data: { token, username: user.username, role: user.role } };
});

// ─── 仪表盘统计 ────────────────────────────────────────────────────────────────

adminRouter.get('/dashboard', requireAdmin, async (ctx) => {
  const [agentCount, categoryCount, pipelineCount, knowledgeCount, chatCount, recentChats] = await Promise.all([
    Agent.countDocuments(),
    Category.countDocuments(),
    Pipeline.countDocuments(),
    KnowledgeBase.countDocuments({ isActive: true }),
    Chat.countDocuments(),
    Chat.find({}, { messages: { $slice: -1 }, sessionId: 1, agentName: 1, updatedAt: 1 }).sort({ updatedAt: -1 }).limit(10).lean()
  ]);

  ctx.body = {
    success: true,
    data: {
      stats: { agentCount, categoryCount, pipelineCount, knowledgeCount, chatCount },
      recentChats,
      provider: { active: env.activeProvider, ollama: env.ollamaTextModel, codebuddy: env.codebuddyTextModel }
    }
  };
});

// ─── Agent 管理 ────────────────────────────────────────────────────────────────

adminRouter.get('/agents', requireAdmin, async (ctx) => {
  const { page = '1', limit = '20', category, search } = ctx.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (category) filter.categoryKey = category;
  if (search) filter.$or = [{ 'name.zh': { $regex: search, $options: 'i' } }, { 'name.en': { $regex: search, $options: 'i' } }];

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit));
  const [agents, total] = await Promise.all([
    Agent.find(filter).sort({ categoryKey: 1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
    Agent.countDocuments(filter)
  ]);

  ctx.body = { success: true, data: agents, pagination: { page: pageNum, limit: limitNum, total } };
});

adminRouter.put('/agents/:id', requireAdmin, async (ctx) => {
  const update = ctx.request.body as Record<string, unknown>;
  const agent = await Agent.findByIdAndUpdate(ctx.params.id, { $set: update }, { new: true });
  if (!agent) { ctx.status = 404; ctx.body = { success: false, message: 'Agent not found' }; return; }
  ctx.body = { success: true, data: agent };
});

adminRouter.delete('/agents/:id', requireAdmin, async (ctx) => {
  await Agent.findByIdAndDelete(ctx.params.id);
  ctx.body = { success: true, message: 'Agent deleted' };
});

// ─── 知识库管理 ────────────────────────────────────────────────────────────────

adminRouter.get('/knowledge', requireAdmin, async (ctx) => {
  const { page = '1', limit = '20' } = ctx.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, parseInt(limit));
  const [items, total] = await Promise.all([
    KnowledgeBase.find({}, { chunks: 0 }).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
    KnowledgeBase.countDocuments()
  ]);
  ctx.body = { success: true, data: items, pagination: { page: pageNum, limit: limitNum, total } };
});

adminRouter.post('/knowledge', requireAdmin, async (ctx) => {
  const body = ctx.request.body as {
    titleZh: string; titleEn: string; content: string;
    sourceType: 'markdown' | 'text' | 'url'; categoryKey?: string;
    agentSlug?: string; tags?: string[]; translate?: boolean;
  };
  const entry = await createKnowledgeEntry(body);
  ctx.body = { success: true, data: entry };
});

adminRouter.delete('/knowledge/:id', requireAdmin, async (ctx) => {
  await KnowledgeBase.findByIdAndDelete(ctx.params.id);
  ctx.body = { success: true, message: 'Knowledge entry deleted' };
});

// ─── 导入管理 ──────────────────────────────────────────────────────────────────

adminRouter.post('/ingest', requireAdmin, async (ctx) => {
  const { translate = false } = (ctx.request.body as { translate?: boolean }) || {};
  const result = await ingestAgentsFromMarkdown(env.ingestRoot, Boolean(translate));
  ctx.body = { success: true, data: result };
});

// ─── Pipeline 管理 ─────────────────────────────────────────────────────────────

adminRouter.get('/pipelines', requireAdmin, async (ctx) => {
  const pipelines = await Pipeline.find().sort({ createdAt: -1 }).lean();
  ctx.body = { success: true, data: pipelines };
});

adminRouter.post('/pipelines', requireAdmin, async (ctx) => {
  const body = ctx.request.body as Record<string, unknown>;
  const pipeline = await Pipeline.create(body);
  ctx.body = { success: true, data: pipeline };
});

adminRouter.put('/pipelines/:id', requireAdmin, async (ctx) => {
  const pipeline = await Pipeline.findByIdAndUpdate(ctx.params.id, { $set: ctx.request.body as Record<string, unknown> }, { new: true });
  ctx.body = { success: true, data: pipeline };
});

adminRouter.delete('/pipelines/:id', requireAdmin, async (ctx) => {
  await Pipeline.findByIdAndDelete(ctx.params.id);
  ctx.body = { success: true, message: 'Pipeline deleted' };
});

// ─── 系统设置 ──────────────────────────────────────────────────────────────────

adminRouter.get('/settings', requireAdmin, async (ctx) => {
  ctx.body = {
    success: true,
    data: {
      activeProvider: env.activeProvider,
      ollama: { baseUrl: env.ollamaBaseUrl, textModel: env.ollamaTextModel, visionModel: env.ollamaVisionModel },
      codebuddy: { baseUrl: env.codebuddyBaseUrl, textModel: env.codebuddyTextModel, visionModel: env.codebuddyVisionModel }
    }
  };
});

// ─── 对话管理 ──────────────────────────────────────────────────────────────────

adminRouter.get('/chats', requireAdmin, async (ctx) => {
  const { page = '1', limit = '20' } = ctx.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, parseInt(limit));
  const [chats, total] = await Promise.all([
    Chat.find({}, { messages: { $slice: -1 } }).sort({ updatedAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
    Chat.countDocuments()
  ]);
  ctx.body = { success: true, data: chats, pagination: { page: pageNum, limit: limitNum, total } };
});

adminRouter.delete('/chats/:id', requireAdmin, async (ctx) => {
  await Chat.findByIdAndDelete(ctx.params.id);
  ctx.body = { success: true, message: 'Chat deleted' };
});
