import Router from '@koa/router';
import { Agent } from '../models/Agent.js';
import { Category } from '../models/Category.js';
import { Pipeline } from '../models/Pipeline.js';
import { Chat } from '../models/Chat.js';
import { KnowledgeBase } from '../models/KnowledgeBase.js';
import { ingestAgentsFromMarkdown } from '../services/agentIngestionService.js';
import type { IAgent } from '../models/Agent.js';
import { callLLM, streamLLM } from '../services/llmService.js';
import { searchKnowledge, ragQuery } from '../services/knowledgeService.js';
import { env } from '../config/env.js';
import { v4 as uuidv4 } from 'uuid';

export const agentsRouter = new Router({ prefix: '/api' });

// ─── 记忆工具函数 ──────────────────────────────────────────────────────────────

/**
 * 对 assistant 消息中的 HTML 代码块进行摘要压缩
 * 保留文字说明，将完整 HTML 替换为简短摘要，避免占用大量上下文 token
 */
const compressAssistantMessage = (content: string): string => {
  // 提取代码块前的文字说明（通常是 1-2 句描述）
  const textPart = content.replace(/```[\s\S]*?```/g, '').trim();
  const summary = textPart.slice(0, 200);

  // 提取 HTML 代码块的关键信息（标签数、脚本数、大致功能）
  const htmlMatch = content.match(/```html\n([\s\S]*?)```/i)
    || content.match(/```html\n([\s\S]+)$/i);
  if (!htmlMatch) return content; // 无代码块，不压缩

  const html = htmlMatch[1];
  const scriptCount = (html.match(/<script/gi) || []).length;
  const hasEcharts = html.includes('echarts');
  const hasTailwind = html.includes('tailwind');
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const title = titleMatch?.[1] || '未命名页面';
  const lineCount = html.split('\n').length;

  return `${summary}\n\n[HTML代码已压缩存储] 页面标题：${title}，共 ${lineCount} 行，${scriptCount} 个 script 标签${hasEcharts ? '，使用 ECharts' : ''}${hasTailwind ? '，使用 Tailwind CSS' : ''}。`;
};

/**
 * 构建包含记忆压缩的消息列表，用于发送给 LLM
 * - 系统消息始终保留
 * - 最近 2 条 user/assistant 对保留原文（当前轮的上一轮）
 * - 更早的 assistant 消息进行压缩
 */
const buildMemoryMessages = (rawMessages: any[]): any[] => {
  const systemMsgs = rawMessages.filter((m: any) => m.role === 'system');
  const nonSystemMsgs = rawMessages.filter((m: any) => m.role !== 'system');

  // 最近 4 条保留原文（即最近 2 轮对话）
  const recentCount = 4;
  const recentMsgs = nonSystemMsgs.slice(-recentCount);
  const olderMsgs = nonSystemMsgs.slice(0, -recentCount);

  // 对较早的 assistant 消息进行压缩
  const compressedOlder = olderMsgs.map((m: any) => {
    if (m.role === 'assistant') {
      return { ...m, content: compressAssistantMessage(m.content) };
    }
    return m;
  });

  return [...systemMsgs, ...compressedOlder, ...recentMsgs];
};

/**
 * 流式请求并自动续写（当 finish_reason === 'length' 时）
 * 最多续写 MAX_CONTINUATIONS 次，每次将已生成内容作为 assistant 消息继续请求
 */
const MAX_CONTINUATIONS = 3;

async function* streamWithContinuation(
  messages: any[],
  options: { provider: string; modelType: string }
): AsyncGenerator<{ delta: string; done: boolean }> {
  let currentMessages = [...messages];
  let accumulatedContent = '';
  let continuationCount = 0;

  while (true) {
    let chunkContent = '';
    let finishReason: string | undefined;

    const stream = streamLLM(currentMessages, {
      provider: options.provider as 'ollama' | 'codebuddy',
      modelType: options.modelType as 'text' | 'vision',
    });

    for await (const chunk of stream) {
      if (chunk.delta) {
        chunkContent += chunk.delta;
        accumulatedContent += chunk.delta;
        yield { delta: chunk.delta, done: false };
      }
      if (chunk.done) {
        finishReason = chunk.finishReason;
        break;
      }
    }

    // 正常结束或达到续写上限
    if (finishReason !== 'length' || continuationCount >= MAX_CONTINUATIONS) {
      break;
    }

    // token 超出，发送续写信号
    continuationCount++;
    yield { delta: '', done: false }; // 心跳包，保持连接

    // 将已生成内容作为 assistant 消息加入，继续请求
    currentMessages = [
      ...currentMessages,
      { role: 'assistant', content: chunkContent },
      { role: 'user', content: '请继续输出，从上次的内容结尾处直接接着写，不要重复已有内容。' },
    ];
  }

  yield { delta: '', done: true };
}

// ─── 健康检查 ──────────────────────────────────────────────────────────────────

agentsRouter.get('/health', async (ctx) => {
  ctx.body = { success: true, message: 'Agency Agents Platform v2.0 running', timestamp: new Date() };
});

// ─── 概览统计 ──────────────────────────────────────────────────────────────────

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
        codebuddy: { baseUrl: env.codebuddyBaseUrl, textModel: env.codebuddyTextModel, visionModel: env.codebuddyVisionModel }
      },
      categories,
      featuredAgents
    }
  };
});

// ─── Agent 列表 ────────────────────────────────────────────────────────────────

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

// ─── Agent 详情 ────────────────────────────────────────────────────────────────

agentsRouter.get('/agents/:slug', async (ctx) => {
  const agent = await Agent.findOne({ slug: ctx.params.slug }).lean();
  if (!agent) { ctx.status = 404; ctx.body = { success: false, message: 'Agent not found' }; return; }
  ctx.body = { success: true, data: agent };
});

// ─── 分类列表 ──────────────────────────────────────────────────────────────────

agentsRouter.get('/categories', async (ctx) => {
  const categories = await Category.find().sort({ sortOrder: 1 }).lean();
  ctx.body = { success: true, data: categories };
});

// ─── Pipeline 列表 ─────────────────────────────────────────────────────────────

agentsRouter.get('/pipelines', async (ctx) => {
  const pipelines = await Pipeline.find().sort({ createdAt: -1 }).lean();
  ctx.body = { success: true, data: pipelines };
});

// ─── 导入 Agents ───────────────────────────────────────────────────────────────

agentsRouter.post('/ingest', async (ctx) => {
  const result = await ingestAgentsFromMarkdown(env.ingestRoot);
  ctx.body = { success: true, data: result };
});

// ─── Chat 会话管理 ─────────────────────────────────────────────────────────────

agentsRouter.post('/chat/session', async (ctx) => {
  const { agentSlug, provider = env.activeProvider, modelType = 'text', sessionType } = ctx.request.body as Record<string, string>;

  let systemPrompt = '你是一个专业的 AI Agent 助手，帮助用户完成各种任务。';
  let agentName = 'AI Assistant';

  // Vibe Coding 专用系统提示（UI 生成器）
  if (sessionType === 'vibe') {
    // 从数据库读取 UI Designer Agent 的设计规范，整合进系统提示
    const uiDesignerAgent = await Agent.findOne({ slug: 'design-ui-designer' }).lean() as IAgent | null;

    // 提取 UI Designer 核心设计规范段落
    const extractSection = (markdown: string, startKeyword: string, maxLen = 800): string => {
      const idx = markdown.indexOf(startKeyword);
      if (idx === -1) return '';
      return markdown.slice(idx, idx + maxLen).trim();
    };

    const uiTokens = uiDesignerAgent?.rawMarkdown
      ? extractSection(uiDesignerAgent.rawMarkdown, '## 🎯 Your Core Mission', 1200)
      : '';

    systemPrompt = `你是一个顶级的 UI/UX 设计师兼前端工程师，专门根据用户的自然语言描述生成完整可运行的 HTML 界面。
你的核心能力来自 UI Designer Agent（视觉设计系统）。

## 核心输出要求
1. **必须输出完整的 HTML 文档**，包含 <!DOCTYPE html>、<html>、<head>、<body> 标签
2. 使用 Tailwind CSS（CDN：<script src="https://cdn.tailwindcss.com"></script>）实现所有样式
3. 交互效果使用原生 JavaScript 写在 <script> 标签内
4. 用 \`\`\`html 代码块包裹完整 HTML 输出
5. 迭代修改时，输出完整的新版本 HTML，不要只输出片段
6. Font Awesome 图标已自动注入，直接使用 <i class="fas fa-xxx"></i>，无需引入 CDN
7. **ECharts 图表库已自动注入**，需要图表时直接使用 echarts.init() 即可，无需引入 CDN
8. 在代码前用 1-2 句话简要说明实现了什么

## 专业设计规范（来自 UI Designer Agent）
- 建立完整的设计 Token 系统：颜色、字体、间距、阴影均使用 CSS 变量
- 组件必须有完整交互状态：hover、active、focus、disabled
- 色彩对比度满足 WCAG AA 标准（正文 4.5:1，大标题 3:1）
- 交互元素最小触控区域 44px，支持键盘导航（tabindex、aria-label）
- 动画遵循 prefers-reduced-motion 用户偏好
- 阴影层级：shadow-sm（卡片）→ shadow-md（悬浮）→ shadow-xl（模态框）
${uiTokens ? `\n### UI Designer 核心能力参考\n${uiTokens}` : ''}

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
- 文字内容使用真实感示例数据，不要写占位符`;
    agentName = 'UI Generator';
  }

  if (agentSlug) {
    const agent = await Agent.findOne({ slug: agentSlug }).lean() as IAgent | null;
    if (agent) {
      agentName = agent.name.zh || agent.name.en;
      systemPrompt = agent.rawMarkdown.slice(0, 3000);
    }
  }

  const session = await Chat.create({
    sessionId: uuidv4(),
    agentSlug,
    agentName,
    title: `与 ${agentName} 的对话`,
    messages: [{ role: 'system', content: systemPrompt, timestamp: new Date() }],
    provider,
    modelType,
    systemPrompt
  });

  ctx.body = { success: true, data: { sessionId: session.sessionId, agentName, provider, modelType } };
});

agentsRouter.get('/chat/sessions', async (ctx) => {
  const sessions = await Chat.find({}, { messages: { $slice: -1 }, sessionId: 1, agentName: 1, title: 1, provider: 1, modelType: 1, updatedAt: 1 })
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();
  ctx.body = { success: true, data: sessions };
});

agentsRouter.get('/chat/session/:sessionId', async (ctx) => {
  const chat = await Chat.findOne({ sessionId: ctx.params.sessionId }).lean();
  if (!chat) { ctx.status = 404; ctx.body = { success: false, message: 'Session not found' }; return; }
  ctx.body = { success: true, data: chat };
});

// ─── 流式聊天 ──────────────────────────────────────────────────────────────────

agentsRouter.post('/chat/stream', async (ctx) => {
  const { sessionId, message, imageUrl } = ctx.request.body as { sessionId: string; message: string; imageUrl?: string };

  const chat = await Chat.findOne({ sessionId });
  if (!chat) { ctx.status = 404; ctx.body = { success: false, message: 'Session not found' }; return; }

  // 添加用户消息
  chat.messages.push({ role: 'user', content: message, timestamp: new Date(), imageUrl });
  await chat.save();

  // 构建包含记忆压缩的消息列表（最近 2 轮保留原文，更早的 assistant HTML 压缩）
  const recentMessages = buildMemoryMessages(chat.messages.slice(-30)).map((m: any) => ({
    role: m.role as 'system' | 'user' | 'assistant',
    content: m.imageUrl
      ? [
          { type: 'text' as const, text: m.content },
          { type: 'image_url' as const, image_url: { url: m.imageUrl } }
        ]
      : m.content
  }));

  // 设置 SSE 响应头
  ctx.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  ctx.status = 200;

  // 使用自动续写流
  const stream = streamWithContinuation(recentMessages, { provider: chat.provider, modelType: chat.modelType });
  let fullContent = '';

  const res = ctx.res;
  res.write('data: {"type":"start"}\n\n');

  for await (const chunk of stream) {
    if (chunk.delta) {
      fullContent += chunk.delta;
      res.write(`data: ${JSON.stringify({ type: 'delta', delta: chunk.delta })}\n\n`);
    }
    if (chunk.done) break;
  }
  // 保存助手回复
  chat.messages.push({ role: 'assistant', content: fullContent, timestamp: new Date(), provider: chat.provider, modelType: chat.modelType });
  await chat.save();

  res.write(`data: ${JSON.stringify({ type: 'done', content: fullContent })}\n\n`);
  res.end();
});

// ─── 普通聊天（非流式）────────────────────────────────────────────────────────

agentsRouter.post('/chat/message', async (ctx) => {
  const { sessionId, message } = ctx.request.body as { sessionId: string; message: string };

  const chat = await Chat.findOne({ sessionId });
  if (!chat) { ctx.status = 404; ctx.body = { success: false, message: 'Session not found' }; return; }

  chat.messages.push({ role: 'user', content: message, timestamp: new Date() });

  const recentMessages = chat.messages.slice(-20).map((m: any) => ({
    role: m.role as 'system' | 'user' | 'assistant',
    content: m.content
  }));

  const response = await callLLM(recentMessages, { provider: chat.provider, modelType: chat.modelType });

  chat.messages.push({ role: 'assistant', content: response.content, timestamp: new Date(), provider: chat.provider });
  await chat.save();

  ctx.body = { success: true, data: { content: response.content, provider: response.provider, model: response.model } };
});

// ─── 知识库 ────────────────────────────────────────────────────────────────────

agentsRouter.get('/knowledge', async (ctx) => {
  const { categoryKey, agentSlug, search, page = '1', limit = '20' } = ctx.query as Record<string, string>;
  const filter: Record<string, unknown> = { isActive: true };

  if (categoryKey) filter.categoryKey = categoryKey;
  if (agentSlug) filter.agentSlug = agentSlug;
  if (search) {
    filter.$or = [
      { 'title.zh': { $regex: search, $options: 'i' } },
      { 'title.en': { $regex: search, $options: 'i' } }
    ];
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, parseInt(limit));
  const [items, total] = await Promise.all([
    KnowledgeBase.find(filter, { chunks: 0 }).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
    KnowledgeBase.countDocuments(filter)
  ]);

  ctx.body = { success: true, data: items, pagination: { page: pageNum, limit: limitNum, total } };
});

agentsRouter.get('/knowledge/:id', async (ctx) => {
  const kb = await KnowledgeBase.findById(ctx.params.id).lean();
  if (!kb) { ctx.status = 404; ctx.body = { success: false, message: 'Knowledge not found' }; return; }
  ctx.body = { success: true, data: kb };
});

agentsRouter.post('/knowledge/search', async (ctx) => {
  const { query, categoryKey, agentSlug, lang = 'zh', limit = 5 } = ctx.request.body as Record<string, string | number>;
  const results = await searchKnowledge(String(query), { categoryKey: String(categoryKey || ''), agentSlug: String(agentSlug || ''), lang: lang as 'zh' | 'en', limit: Number(limit) });
  ctx.body = { success: true, data: results };
});

agentsRouter.post('/knowledge/rag', async (ctx) => {
  const { question, categoryKey, agentSlug, provider, lang = 'zh' } = ctx.request.body as Record<string, string>;
  const answer = await ragQuery(question, { categoryKey, agentSlug, provider: provider as 'ollama' | 'codebuddy', lang: lang as 'zh' | 'en' });
  ctx.body = { success: true, data: { answer, question } };
});

// ─── Vibe Coding ───────────────────────────────────────────────────────────────

agentsRouter.post('/vibe/generate', async (ctx) => {
  const { prompt, agentSlug, provider = env.activeProvider, modelType = 'text' } = ctx.request.body as Record<string, string>;

  let systemPrompt = `你是一个专业的 Vibe Coding 助手，擅长根据用户的自然语言描述生成高质量代码。
请遵循以下原则：
1. 代码要完整可运行
2. 使用现代最佳实践
3. 添加必要的注释
4. 考虑错误处理
5. 代码风格要一致`;

  if (agentSlug) {
    const agent = await Agent.findOne({ slug: agentSlug }).lean() as IAgent | null;
    if (agent) {
      systemPrompt = agent.rawMarkdown.slice(0, 2000) + '\n\n' + systemPrompt;
    }
  }

  const response = await callLLM(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    { provider: provider as 'ollama' | 'codebuddy', modelType: modelType as 'text' | 'vision' }
  );

  ctx.body = { success: true, data: { content: response.content, provider: response.provider, model: response.model } };
});

agentsRouter.post('/vibe/stream', async (ctx) => {
  const { prompt, agentSlug, provider = env.activeProvider, modelType = 'text' } = ctx.request.body as Record<string, string>;

  let systemPrompt = `你是一个专业的 Vibe Coding 助手，擅长根据用户的自然语言描述生成高质量代码。`;

  if (agentSlug) {
    const agent = await Agent.findOne({ slug: agentSlug }).lean() as IAgent | null;
    if (agent) systemPrompt = agent.rawMarkdown.slice(0, 2000);
  }

  ctx.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  ctx.status = 200;

  // 使用自动续写流（支持 token 超出时自动续写）
  const stream = streamWithContinuation(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
    { provider, modelType }
  );

  const res = ctx.res;
  res.write('data: {"type":"start"}\n\n');

  for await (const chunk of stream) {
    if (chunk.delta) {
      res.write(`data: ${JSON.stringify({ type: 'delta', delta: chunk.delta })}\n\n`);
    }
    if (chunk.done) break;
  }

  res.write('data: {"type":"done"}\n\n');
  res.end();
});

// ─── Vibe Pipeline（多 Agent 流水线）─────────────────────────────────────────
//
// 执行顺序：
//   Step 1 - 需求分析 Agent  → 拆解功能模块、数据结构、交互逻辑
//   Step 2 - UI 骨架 Agent   → 生成完整 HTML + Tailwind CSS 布局
//   Step 3 - 业务逻辑 Agent  → 填充真实 JS（状态管理、CRUD、事件处理）
//   Step 4 - 整合 Agent      → 合并三步结果，输出最终完整可运行 HTML
//
// 每步通过 SSE 推送 { type: 'step', step, title, status } 进度事件
// 最终通过 { type: 'done', content } 推送完整代码
// ─────────────────────────────────────────────────────────────────────────────

// 各步骤 Agent 的系统提示定义
const PIPELINE_AGENTS = {
  analyst: `你是一个资深需求分析师。
用户会给你一个应用描述，你需要输出一份结构化的功能分析报告（纯文本，不要输出代码）。

分析报告必须包含以下部分：
1. **应用类型**：（后台管理系统 / 游戏 / 工具 / 官网 / 数据大屏 等）
2. **核心功能模块**：列出 3-8 个主要功能模块，每个模块说明其职责
3. **数据结构**：列出需要的数据实体和字段（用 JS 对象格式描述）
4. **交互逻辑**：描述关键的用户交互流程（增删改查、状态切换、动画等）
5. **UI 布局方案**：描述整体布局（侧边栏+内容区 / 全屏 / 卡片网格 等）
6. **技术要点**：需要特别注意的实现细节

输出格式要简洁清晰，供后续 Agent 使用。`,

  uiBuilder: `你是一个顶级 UI 设计师，专门根据需求分析报告生成 HTML + CSS 骨架。

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

  logicBuilder: `你是一个资深前端工程师，专门为 HTML 骨架填充完整的 JavaScript 业务逻辑。

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

  integrator: `你是一个代码整合专家。

你会收到一个已经包含完整 UI 和业务逻辑的 HTML 文档。
你的任务是做最终检查和优化：
1. 确保所有 JS 逻辑正确，没有语法错误
2. 确保所有 DOM 元素 ID/class 引用一致
3. 补充遗漏的交互细节
4. 优化代码结构，添加必要注释
5. 确保页面加载后立即可用（初始化数据渲染）
6. 用 \`\`\`html 代码块包裹最终完整输出

只输出最终 HTML，不需要解释。`
};

// 执行单个 Pipeline 步骤（非流式，返回完整内容）
const runPipelineStep = async (
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: { provider: string; modelType: string }
): Promise<string> => {
  let result = '';
  const stream = streamWithContinuation(messages, options);
  for await (const chunk of stream) {
    if (chunk.delta) result += chunk.delta;
    if (chunk.done) break;
  }
  return result;
};

agentsRouter.post('/vibe/pipeline', async (ctx) => {
  const { prompt, provider = env.activeProvider, modelType = 'text' } = ctx.request.body as Record<string, string>;

  if (!prompt?.trim()) {
    ctx.status = 400;
    ctx.body = { success: false, message: '请提供需求描述' };
    return;
  }

  ctx.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  ctx.status = 200;

  const res = ctx.res;
  const opts = { provider, modelType };

  // SSE 推送工具函数
  const send = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send({ type: 'start' });

  try {
    // ── Step 1: 需求分析 ──────────────────────────────────────────────────────
    send({ type: 'step', step: 1, total: 4, title: '📋 需求分析中...', status: 'running' });

    const analysisResult = await runPipelineStep([
      { role: 'system', content: PIPELINE_AGENTS.analyst },
      { role: 'user', content: `请分析以下应用需求：\n\n${prompt}` }
    ], opts);

    send({ type: 'step', step: 1, total: 4, title: '📋 需求分析完成', status: 'done', content: analysisResult });

    // ── Step 2: UI 骨架生成 ───────────────────────────────────────────────────
    send({ type: 'step', step: 2, total: 4, title: '🎨 UI 设计中...', status: 'running' });

    const uiResult = await runPipelineStep([
      { role: 'system', content: PIPELINE_AGENTS.uiBuilder },
      {
        role: 'user',
        content: `原始需求：${prompt}\n\n需求分析报告：\n${analysisResult}\n\n请生成完整的 HTML UI 骨架。`
      }
    ], opts);

    send({ type: 'step', step: 2, total: 4, title: '🎨 UI 骨架完成', status: 'done' });

    // ── Step 3: 业务逻辑填充 ──────────────────────────────────────────────────
    send({ type: 'step', step: 3, total: 4, title: '⚙️ 业务逻辑开发中...', status: 'running' });

    // 从 UI 结果中提取 HTML 代码块
    const htmlMatch = uiResult.match(/```html\n([\s\S]*?)```/i) || uiResult.match(/```html\n([\s\S]+)$/i);
    const uiHtml = htmlMatch ? htmlMatch[1] : uiResult;

    const logicResult = await runPipelineStep([
      { role: 'system', content: PIPELINE_AGENTS.logicBuilder },
      {
        role: 'user',
        content: `原始需求：${prompt}\n\n需求分析报告：\n${analysisResult}\n\nHTML 骨架：\n\`\`\`html\n${uiHtml}\n\`\`\`\n\n请填充完整的 JavaScript 业务逻辑，输出完整可运行的 HTML。`
      }
    ], opts);

    send({ type: 'step', step: 3, total: 4, title: '⚙️ 业务逻辑完成', status: 'done' });

    // ── Step 4: 整合优化 ──────────────────────────────────────────────────────
    send({ type: 'step', step: 4, total: 4, title: '🔧 整合优化中...', status: 'running' });

    const logicHtmlMatch = logicResult.match(/```html\n([\s\S]*?)```/i) || logicResult.match(/```html\n([\s\S]+)$/i);
    const logicHtml = logicHtmlMatch ? logicHtmlMatch[1] : logicResult;

    const finalResult = await runPipelineStep([
      { role: 'system', content: PIPELINE_AGENTS.integrator },
      {
        role: 'user',
        content: `请对以下 HTML 进行最终检查和优化：\n\`\`\`html\n${logicHtml}\n\`\`\``
      }
    ], opts);

    send({ type: 'step', step: 4, total: 4, title: '🔧 整合完成', status: 'done' });

    // ── 推送最终结果 ──────────────────────────────────────────────────────────
    send({ type: 'done', content: finalResult, analysis: analysisResult });

  } catch (err: any) {
    send({ type: 'error', message: err?.message || '生成失败，请重试' });
  } finally {
    res.end();
  }
});
