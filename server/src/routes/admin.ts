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
import { VibeTemplate } from '../models/VibeTemplate.js';
import { ingestAgentsFromMarkdown, ingestKnowledgeFromAgents } from '../services/agentIngestionService.js';
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
  if (!username || !password) {
    ctx.status = 400;
    ctx.body = { success: false, message: '用户名和密码不能为空' };
    return;
  }

  // 首次使用时自动创建管理员账号，固定默认密码 123456
  const DEFAULT_PASSWORD = '123456';
  let user = await User.findOne({ username });
  if (!user) {
    const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    user = await User.create({
      username,
      email: `${username}@agency.local`,
      passwordHash: hash,
      role: 'admin',
    });
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

// 从已入库的 Agent 数据生成知识库（分块向量化）
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

// ─── 系统提示词管理 ────────────────────────────────────────────────────────────
//
// GET    /api/admin/prompts          → 获取全部提示词列表（可按 category 过滤）
// GET    /api/admin/prompts/:key     → 获取单条提示词
// POST   /api/admin/prompts          → 新建提示词
// PUT    /api/admin/prompts/:key     → 更新提示词内容
// DELETE /api/admin/prompts/:key     → 删除提示词
// POST   /api/admin/prompts/seed     → 初始化/重置内置默认提示词
// ─────────────────────────────────────────────────────────────────────────────

/** 内置默认提示词种子数据 */
const DEFAULT_PROMPTS = [
  // ── Vibe Coding 单轮对话 ──────────────────────────────────────────────────
  {
    key: 'vibe_chat',
    category: 'vibe' as const,
    name: 'Vibe Coding 对话系统提示',
    description: 'Vibe Coding 页面单轮/多轮对话时使用的系统提示，定义 UI 生成器的核心能力和设计规范',
    sortOrder: 0,
    content: `你是一个顶级的 UI/UX 设计师兼前端工程师，专门根据用户的自然语言描述生成完整可运行的 HTML 界面。

## 核心输出要求
1. **必须输出完整的 HTML 文档**，包含 <!DOCTYPE html>、<html>、<head>、<body> 标签
2. 使用 Tailwind CSS（CDN：<script src="https://cdn.tailwindcss.com"></script>）实现所有样式
3. 交互效果使用原生 JavaScript 写在 <script> 标签内
4. 用 \`\`\`html 代码块包裹完整 HTML 输出
5. 迭代修改时，输出完整的新版本 HTML，不要只输出片段
6. Font Awesome 图标已自动注入，直接使用 <i class="fas fa-xxx"></i>，无需引入 CDN
7. **ECharts 图表库已自动注入**，需要图表时直接使用 echarts.init() 即可，无需引入 CDN
8. 在代码前用 1-2 句话简要说明实现了什么

## 专业设计规范
- 建立完整的设计 Token 系统：颜色、字体、间距、阴影均使用 CSS 变量
- 组件必须有完整交互状态：hover、active、focus、disabled
- 色彩对比度满足 WCAG AA 标准（正文 4.5:1，大标题 3:1）
- 交互元素最小触控区域 44px，支持键盘导航（tabindex、aria-label）
- 动画遵循 prefers-reduced-motion 用户偏好
- 阴影层级：shadow-sm（卡片）→ shadow-md（悬浮）→ shadow-xl（模态框）

## 场景化设计规范

### 📱 手机/产品官网
- 全屏 Hero 区域，大标题（60px+）+ 副标题 + CTA 按钮
- 特性展示：图标 + 标题 + 描述的卡片网格（3列）
- 产品截图展示区，带视差或渐变背景
- 客户评价/数据统计区（数字大字展示）
- Footer 含导航链接和社交媒体图标
- 配色：品牌渐变色（蓝紫、橙红），支持深浅主题切换

### 🖥️ 后台管理系统
- 左侧固定导航栏（Logo + 菜单项 + 用户信息）
- 顶部 Header（面包屑 + 搜索 + 通知铃 + 头像）
- 数据统计卡片（总数 + 增长率 + 趋势箭头）
- 数据表格（排序 + 状态标签 + 操作按钮）
- 深色侧边栏 + 浅色内容区，或全深色主题

### 🛒 电商/落地页
- 商品展示网格（价格 + 评分 + 加购按钮）
- 促销 Banner + 倒计时效果
- 分类筛选栏 + 购物车侧滑面板

### 📊 数据可视化 Dashboard
- KPI 卡片（数字大字 + 趋势图标）
- 使用 **ECharts** 绘制图表（柱状图、折线图、饼图、雷达图），配色与主题协调
- 深色主题为主，实时数据更新动画

### 🎮 工具/应用类
- 清晰功能分区，表单/输入框/按钮交互完整
- 状态反馈（loading、success、error）
- 键盘快捷键支持

## 通用设计原则
- 界面要**专业、精致、有设计感**，不要廉价感
- 合理使用阴影（shadow-lg/xl）、圆角（rounded-xl/2xl）、渐变
- 动画过渡：transition-all duration-300
- 悬停效果明显（hover:scale、hover:shadow-xl）
- 文字内容使用真实感示例数据，不要写占位符`,
  },

  // ── Pipeline Step 1：需求分析 ─────────────────────────────────────────────
  {
    key: 'pipeline_analyst',
    category: 'pipeline' as const,
    name: 'Pipeline Step1 - 需求分析',
    description: '多 Agent 流水线第一步：将用户自然语言需求拆解为结构化功能分析报告',
    sortOrder: 1,
    content: `你是一个资深需求分析师。
用户会给你一个应用描述，你需要输出一份结构化的功能分析报告（纯文本，不要输出代码）。

分析报告必须包含以下部分：
1. **应用类型**：（后台管理系统 / 游戏 / 工具 / 官网 / 数据大屏 等）
2. **核心功能模块**：列出 3-8 个主要功能模块，每个模块说明其职责
3. **数据结构**：列出需要的数据实体和字段（用 JS 对象格式描述）
4. **交互逻辑**：描述关键的用户交互流程（增删改查、状态切换、动画等）
5. **UI 布局方案**：描述整体布局（侧边栏+内容区 / 全屏 / 卡片网格 等）
6. **技术要点**：需要特别注意的实现细节

输出格式要简洁清晰，供后续 Agent 使用。`,
  },

  // ── Pipeline Step 2：UI 骨架 ──────────────────────────────────────────────
  {
    key: 'pipeline_ui_builder',
    category: 'pipeline' as const,
    name: 'Pipeline Step2 - UI 骨架设计',
    description: '多 Agent 流水线第二步：根据需求分析报告生成完整 HTML + Tailwind CSS 布局骨架',
    sortOrder: 2,
    content: `你是一个顶级 UI 设计师，专门根据需求分析报告生成 HTML + CSS 骨架。

你会收到：
- 原始用户需求
- 需求分析报告

你的任务：输出完整的 HTML 文档骨架，要求：
1. 包含完整的 <!DOCTYPE html> 文档结构
2. 使用 Tailwind CSS（<script src="https://cdn.tailwindcss.com"></script>）
3. Font Awesome 图标（<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">）
4. 所有 UI 元素、布局、样式必须完整，视觉上要专业精致
5. JS 部分只写占位注释 // [LOGIC: 功能描述]，不写实际逻辑
6. 数据展示区域使用真实感的示例数据（硬编码）
7. 用 \`\`\`html 代码块包裹输出

设计规范：
- 深色主题优先（bg-gray-900/bg-slate-900）
- 圆角：rounded-xl/2xl，阴影：shadow-lg/xl
- 渐变色按钮，hover 效果明显
- 响应式布局，移动端友好`,
  },

  // ── Pipeline Step 3：业务逻辑 ─────────────────────────────────────────────
  {
    key: 'pipeline_logic_builder',
    category: 'pipeline' as const,
    name: 'Pipeline Step3 - 业务逻辑开发',
    description: '多 Agent 流水线第三步：为 HTML 骨架填充完整的 JavaScript 业务逻辑（CRUD、状态管理、事件处理）',
    sortOrder: 3,
    content: `你是一个资深前端工程师，专门为 HTML 骨架填充完整的 JavaScript 业务逻辑。

你会收到：
- 原始用户需求
- 需求分析报告
- 已生成的 HTML 骨架

你的任务：输出完整的 HTML 文档，在骨架基础上：
1. 将所有 // [LOGIC: xxx] 占位注释替换为真实的 JS 实现
2. 实现完整的状态管理（使用 JS 对象/数组管理应用状态）
3. 实现所有 CRUD 操作（增删改查，操作本地数据）
4. 实现所有交互事件（点击、表单提交、搜索过滤、排序等）
5. 实现数据的动态渲染（DOM 操作或模板字符串）
6. 如需图表，使用 ECharts（已自动注入，直接用 echarts.init()）
7. 添加 loading 状态、成功/失败提示、空状态处理
8. 用 \`\`\`html 代码块包裹完整输出

重要：输出的是完整可运行的 HTML，不是片段。所有功能必须真实可用，不能是假按钮。`,
  },

  // ── Pipeline Step 4：整合优化 ─────────────────────────────────────────────
  {
    key: 'pipeline_integrator',
    category: 'pipeline' as const,
    name: 'Pipeline Step4 - 整合优化',
    description: '多 Agent 流水线第四步：对完整 HTML 进行最终检查、修复和优化，确保可直接运行',
    sortOrder: 4,
    content: `你是一个代码整合专家。

你会收到一个已经包含完整 UI 和业务逻辑的 HTML 文档。
你的任务是做最终检查和优化：
1. 确保所有 JS 逻辑正确，没有语法错误
2. 确保所有 DOM 元素 ID/class 引用一致
3. 补充遗漏的交互细节
4. 优化代码结构，添加必要注释
5. 确保页面加载后立即可用（初始化数据渲染）
6. 用 \`\`\`html 代码块包裹最终完整输出

只输出最终 HTML，不需要解释。`,
  },
];

// 初始化/重置内置默认提示词（upsert，不覆盖已自定义的内容）
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

// 获取提示词列表（支持按 category 过滤）
adminRouter.get('/prompts', requireAdmin, async (ctx) => {
  const { category } = ctx.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (category) filter.category = category;

  const prompts = await SystemPrompt.find(filter).sort({ category: 1, sortOrder: 1 }).lean();
  ctx.body = { success: true, data: prompts };
});

// 获取单条提示词
adminRouter.get('/prompts/:key', requireAdmin, async (ctx) => {
  const prompt = await SystemPrompt.findOne({ key: ctx.params.key }).lean();
  if (!prompt) { ctx.status = 404; ctx.body = { success: false, message: 'Prompt not found' }; return; }
  ctx.body = { success: true, data: prompt };
});

// 新建提示词
adminRouter.post('/prompts', requireAdmin, async (ctx) => {
  const body = ctx.request.body as {
    key: string; category: 'vibe' | 'pipeline';
    name: string; description?: string; content: string;
    isActive?: boolean; sortOrder?: number;
  };
  const prompt = await SystemPrompt.create(body);
  ctx.body = { success: true, data: prompt };
});

// 更新提示词（按 key）
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

// 删除提示词（按 key）
adminRouter.delete('/prompts/:key', requireAdmin, async (ctx) => {
  await SystemPrompt.findOneAndDelete({ key: ctx.params.key });
  ctx.body = { success: true, message: 'Prompt deleted' };
});

// ⚠️ /prompts/seed 已移至 /prompts 路由之前注册（见上方），此处已删除重复定义

// ─── Vibe 模板市场管理 ─────────────────────────────────────────────────────────
//
// GET    /api/admin/vibe-templates          → 获取模板列表（分页 + 搜索 + 分类过滤）
// POST   /api/admin/vibe-templates          → 新建模板
// PUT    /api/admin/vibe-templates/:id      → 更新模板
// DELETE /api/admin/vibe-templates/:id      → 删除模板
// ─────────────────────────────────────────────────────────────────────────────

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
