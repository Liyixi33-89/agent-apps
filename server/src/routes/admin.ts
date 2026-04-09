import Router from '@koa/router';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Agent } from '../models/Agent.js';
import { Category } from '../models/Category.js';
import { Pipeline } from '../models/Pipeline.js';
import { KnowledgeBase } from '../models/KnowledgeBase.js';
import { Chat } from '../models/Chat.js';
import { User } from '../models/User.js';
import { SystemPrompt } from '../models/SystemPrompt.js';
import type { PromptCategory } from '../models/SystemPrompt.js';
import { DEFAULT_PROMPTS } from '../config/defaultPrompts.js';
import { VibeTemplate } from '../models/VibeTemplate.js';
import { ingestAgentsFromMarkdown, ingestKnowledgeFromAgents, getTranslateStatus, translateAgentsInBackground, processMarkdownFile, syncCategories } from '../services/agentIngestionService.js';
import { createKnowledgeEntry } from '../services/knowledgeService.js';
import { env } from '../config/env.js';
import multer from '@koa/multer';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// ─── MD 文件上传配置 ──────────────────────────────────────────────────────────

const mdUpload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.originalname.endsWith('.md') || file.mimetype === 'text/markdown' || file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('只支持 .md 文件'));
    }
  },
});

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
  if (!username || !password) {
    ctx.status = 400;
    ctx.body = { success: false, message: '用户名和密码不能为空' };
    return;
  }

  let user = await User.findOne({ username });

  // 仅当数据库中完全没有任何 admin 用户时，才允许通过默认密码创建首个管理员
  // 一旦系统中存在至少一个 admin，则不再自动创建
  if (!user) {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount === 0) {
      const INIT_PASSWORD = process.env.ADMIN_INIT_PASSWORD || '123456';
      if (password !== INIT_PASSWORD) {
        ctx.status = 401;
        ctx.body = { success: false, message: '初始密码不正确' };
        return;
      }
      const hash = await bcrypt.hash(password, 10);
      user = await User.create({
        username,
        email: `${username}@agency.local`,
        passwordHash: hash,
        role: 'admin',
      });
      console.log(`[Admin] 🔐 首个管理员账户已创建: ${username}`);
    } else {
      ctx.status = 401;
      ctx.body = { success: false, message: '用户不存在' };
      return;
    }
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) { ctx.status = 401; ctx.body = { success: false, message: '密码错误' }; return; }

  if (!user.isActive) { ctx.status = 403; ctx.body = { success: false, message: '账号已被禁用' }; return; }

  user.lastLoginAt = new Date();
  await user.save();

  const token = jwt.sign(
    { userId: user._id, username: user.username, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn } as any
  );
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
      provider: { active: env.activeProvider, ollama: env.ollamaTextModel, openai: env.openaiTextModel }
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

adminRouter.post('/agents/upload-md', requireAdmin, mdUpload.single('file'), async (ctx) => {
  const file = (ctx as any).file as Express.Multer.File | undefined;
  if (!file) {
    ctx.status = 400;
    ctx.body = { success: false, message: '未收到 MD 文件' };
    return;
  }

  try {
    const tmpDir = path.dirname(file.path);
    const mdPath = file.path + '.md';
    fs.renameSync(file.path, mdPath);

    const agentData = await processMarkdownFile(mdPath, tmpDir, true);

    try { fs.unlinkSync(mdPath); } catch { /* ignore */ }

    const originalName = path.basename(file.originalname, '.md');
    if (!agentData.slug || agentData.slug === path.basename(mdPath, '.md')) {
      const slugify = (await import('slugify')).default;
      agentData.slug = slugify(agentData.name?.en || agentData.name?.zh || originalName, {
        lower: true, strict: true, locale: 'en',
      }) || originalName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    }

    const existing = await Agent.findOne({ slug: agentData.slug });
    let agent;
    let action: 'created' | 'updated';

    if (existing) {
      agent = await Agent.findOneAndUpdate(
        { slug: agentData.slug },
        { $set: agentData },
        { new: true }
      );
      action = 'updated';
    } else {
      agent = await Agent.create(agentData);
      action = 'created';
    }

    await syncCategories([agentData.categoryKey]);

    ctx.body = {
      success: true,
      data: {
        agent,
        action,
        message: action === 'created'
          ? `成功创建 Agent「${agentData.name.zh}」`
          : `已更新 Agent「${agentData.name.zh}」（slug: ${agentData.slug}）`,
      },
    };
  } catch (err: any) {
    try { fs.unlinkSync(file.path); } catch { /* ignore */ }
    try { fs.unlinkSync(file.path + '.md'); } catch { /* ignore */ }

    ctx.status = 400;
    ctx.body = {
      success: false,
      message: `MD 文件解析失败：${err?.message || String(err)}`,
    };
  }
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
  ctx.body = {
    success: true,
    data: result,
    ...(translate ? { message: '导入完成，LLM 翻译任务已在后台启动，可通过 /api/admin/ingest/translate-status 查询进度' } : {}),
  };
});

adminRouter.get('/ingest/translate-status', requireAdmin, async (ctx) => {
  ctx.body = { success: true, data: getTranslateStatus() };
});

adminRouter.post('/ingest/translate', requireAdmin, async (ctx) => {
  translateAgentsInBackground().catch((err) =>
    console.error('❌ 后台翻译任务异常：', err)
  );
  ctx.body = { success: true, message: 'LLM 翻译任务已在后台启动，可通过 /api/admin/ingest/translate-status 查询进度' };
});

adminRouter.post('/ingest/knowledge', requireAdmin, async (ctx) => {
  const result = await ingestKnowledgeFromAgents();
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
      openai: { baseUrl: env.openaiBaseUrl, textModel: env.openaiTextModel, visionModel: env.openaiVisionModel }
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

// ─── 系统提示词管理（Skill 库）─────────────────────────────────────────────────
//
// DEFAULT_PROMPTS 已从 config/defaultPrompts.ts 导入
// 包含所有分类的 Prompt 种子数据：vibe / pipeline / fullstack_pipeline / agent_plan / knowledge / system
//
// GET    /api/admin/prompts          → 获取全部提示词列表（可按 category 过滤）
// GET    /api/admin/prompts/:key     → 获取单条提示词
// POST   /api/admin/prompts          → 新建提示词
// PUT    /api/admin/prompts/:key     → 更新提示词内容
// DELETE /api/admin/prompts/:key     → 删除提示词
// POST   /api/admin/prompts/seed     → 初始化/重置内置默认提示词
// ─────────────────────────────────────────────────────────────────────────────

// ⚠️ 必须在 /prompts/:key 之前注册，否则 'seed' 会被当作 key 参数
adminRouter.post('/prompts/seed', requireAdmin, async (ctx) => {
  const { force = false } = (ctx.request.body as { force?: boolean }) || {};

  const results = await Promise.all(
    DEFAULT_PROMPTS.map(async (p) => {
      const exists = await SystemPrompt.findOne({ key: p.key });
      if (exists && !force) {
        return { key: p.key, action: 'skipped' };
      }
      await SystemPrompt.findOneAndUpdate(
        { key: p.key },
        { $set: p },
        { upsert: true, new: true }
      );
      return { key: p.key, action: exists ? 'reset' : 'created' };
    })
  );

  ctx.body = { success: true, data: results };
});

adminRouter.get('/prompts', requireAdmin, async (ctx) => {
  const { category } = ctx.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (category) filter.category = category;

  const prompts = await SystemPrompt.find(filter).sort({ category: 1, sortOrder: 1 }).lean();
  ctx.body = { success: true, data: prompts };
});

adminRouter.get('/prompts/:key', requireAdmin, async (ctx) => {
  const prompt = await SystemPrompt.findOne({ key: ctx.params.key }).lean();
  if (!prompt) { ctx.status = 404; ctx.body = { success: false, message: 'Prompt not found' }; return; }
  ctx.body = { success: true, data: prompt };
});

adminRouter.post('/prompts', requireAdmin, async (ctx) => {
  const body = ctx.request.body as {
    key: string; category: PromptCategory;
    name: string; description?: string; content: string;
    isActive?: boolean; sortOrder?: number;
  };
  const prompt = await SystemPrompt.create(body);
  ctx.body = { success: true, data: prompt };
});

adminRouter.put('/prompts/:key', requireAdmin, async (ctx) => {
  const update = ctx.request.body as Record<string, unknown>;
  const prompt = await SystemPrompt.findOneAndUpdate(
    { key: ctx.params.key },
    { $set: update },
    { new: true }
  );
  if (!prompt) { ctx.status = 404; ctx.body = { success: false, message: 'Prompt not found' }; return; }
  ctx.body = { success: true, data: prompt };
});

adminRouter.delete('/prompts/:key', requireAdmin, async (ctx) => {
  await SystemPrompt.findOneAndDelete({ key: ctx.params.key });
  ctx.body = { success: true, message: 'Prompt deleted' };
});

// ─── Vibe 模板市场管理 ─────────────────────────────────────────────────────────

adminRouter.get('/vibe-templates', requireAdmin, async (ctx) => {
  const { page = '1', limit = '20', category, search } = ctx.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit));

  const filter: Record<string, unknown> = {};
  if (category) filter.category = category;
  if (search) filter.$or = [
    { title: { $regex: search, $options: 'i' } },
    { description: { $regex: search, $options: 'i' } },
    { tags: { $regex: search, $options: 'i' } },
  ];

  const [templates, total] = await Promise.all([
    VibeTemplate.find(filter, { 'codeParts.html': 0, 'codeParts.css': 0, 'codeParts.js': 0 })
      .sort({ publishedAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    VibeTemplate.countDocuments(filter),
  ]);

  ctx.body = { success: true, data: templates, pagination: { page: pageNum, limit: limitNum, total } };
});

adminRouter.post('/vibe-templates', requireAdmin, async (ctx) => {
  const body = ctx.request.body as {
    title: string; description?: string; category?: string;
    author?: string; codeParts: object; thumbnail?: string;
    tags?: string[]; isActive?: boolean;
  };
  const template = await VibeTemplate.create({ ...body, publishedAt: new Date() });
  ctx.body = { success: true, data: template };
});

adminRouter.put('/vibe-templates/:id', requireAdmin, async (ctx) => {
  const update = ctx.request.body as Record<string, unknown>;
  const template = await VibeTemplate.findByIdAndUpdate(
    ctx.params.id,
    { $set: update },
    { new: true }
  );
  if (!template) { ctx.status = 404; ctx.body = { success: false, message: '模板不存在' }; return; }
  ctx.body = { success: true, data: template };
});

adminRouter.delete('/vibe-templates/:id', requireAdmin, async (ctx) => {
  await VibeTemplate.findByIdAndDelete(ctx.params.id);
  ctx.body = { success: true, message: '模板已删除' };
});

// ─── Vibe 已发布应用管理 ──────────────────────────────────────────────────────

adminRouter.get('/vibe-apps', requireAdmin, async (ctx) => {
  const { page = '1', limit = '20', search, isActive } = ctx.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit));

  const filter: Record<string, unknown> = {};
  if (search) filter.$or = [
    { title: { $regex: search, $options: 'i' } },
    { author: { $regex: search, $options: 'i' } },
    { description: { $regex: search, $options: 'i' } },
  ];
  if (isActive === 'true') filter.isActive = true;
  else if (isActive === 'false') filter.isActive = false;

  const [apps, total] = await Promise.all([
    VibeTemplate.find(filter, { 'codeParts.html': 0, 'codeParts.css': 0, 'codeParts.js': 0, 'codeParts.jsx': 0 })
      .sort({ publishedAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    VibeTemplate.countDocuments(filter),
  ]);

  ctx.body = { success: true, data: apps, pagination: { page: pageNum, limit: limitNum, total } };
});

adminRouter.get('/vibe-apps/:id/code', requireAdmin, async (ctx) => {
  const app = await VibeTemplate.findById(ctx.params.id).lean();
  if (!app) { ctx.status = 404; ctx.body = { success: false, message: '应用不存在' }; return; }
  ctx.body = {
    success: true,
    data: {
      _id: app._id,
      title: app.title,
      isFullStack: app.isFullStack ?? false,
      codeParts: app.codeParts,
      serverParts: app.serverParts ?? null,
      dbSchema: app.dbSchema ?? null,
      menuConfig: app.menuConfig ?? null,
    },
  };
});

adminRouter.put('/vibe-apps/:id', requireAdmin, async (ctx) => {
  const update = ctx.request.body as Record<string, unknown>;
  const app = await VibeTemplate.findByIdAndUpdate(
    ctx.params.id,
    { $set: update },
    { new: true }
  );
  if (!app) { ctx.status = 404; ctx.body = { success: false, message: '应用不存在' }; return; }
  ctx.body = { success: true, data: app };
});

adminRouter.delete('/vibe-apps/:id', requireAdmin, async (ctx) => {
  await VibeTemplate.findByIdAndDelete(ctx.params.id);
  ctx.body = { success: true, message: '应用已删除' };
});