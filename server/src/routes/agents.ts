import Router from '@koa/router';
import { Agent } from '../models/Agent.js';
import { Category } from '../models/Category.js';
import { Pipeline } from '../models/Pipeline.js';
import { Chat } from '../models/Chat.js';
import { KnowledgeBase } from '../models/KnowledgeBase.js';
import { SystemPrompt } from '../models/SystemPrompt.js';
import type { ISystemPrompt } from '../models/SystemPrompt.js';
import { ingestAgentsFromMarkdown } from '../services/agentIngestionService.js';
import type { IAgent } from '../models/Agent.js';
import { callLLM, streamLLM } from '../services/llmService.js';
import { searchKnowledge, ragQuery } from '../services/knowledgeService.js';
import { env } from '../config/env.js';
import { v4 as uuidv4 } from 'uuid';

// ─── Prompt 读取工具 ───────────────────────────────────────────────────────────

/**
 * 从数据库读取指定 key 的系统提示词内容
 * 若数据库中不存在（未初始化），返回 fallback 默认值
 */
const getPrompt = async (key: string, fallback = ''): Promise<string> => {
  const doc = await SystemPrompt.findOne<ISystemPrompt>({ key, isActive: true }).lean();
  return doc?.content ?? fallback;
};

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

// ─── 导入 Agents（需要 x-admin-key 请求头验证，防止未授权触发）────────────────

agentsRouter.post('/ingest', async (ctx) => {
  // 简单的 API Key 校验，防止公网随意触发导入
  const adminKey = ctx.headers['x-admin-key'];
  if (!adminKey || adminKey !== env.jwtSecret) {
    ctx.status = 401;
    ctx.body = { success: false, message: '未授权，请通过管理后台触发导入' };
    return;
  }
  const result = await ingestAgentsFromMarkdown(env.ingestRoot);
  ctx.body = { success: true, data: result };
});

// ─── Chat 会话管理 ─────────────────────────────────────────────────────────────

agentsRouter.post('/chat/session', async (ctx) => {
  const { agentSlug, provider = env.activeProvider, modelType = 'text', sessionType } = ctx.request.body as Record<string, string>;

  let systemPrompt = '你是一个专业的 AI Agent 助手，帮助用户完成各种任务。';
  let agentName = 'AI Assistant';

  // Vibe Coding 专用系统提示（UI 生成器）—— 从数据库读取，支持后台热更新
  if (sessionType === 'vibe') {
    systemPrompt = await getPrompt('vibe_chat', '你是一个专业的 UI/UX 设计师兼前端工程师，根据用户描述生成完整可运行的 HTML 界面。');
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

// 各步骤 Agent 的系统提示 —— 运行时从数据库读取，支持后台热更新
// 内置 fallback 仅在数据库未初始化时使用（建议先调用 POST /api/admin/prompts/seed）
const getPipelineAgents = async () => ({
  analyst:      await getPrompt('pipeline_analyst',      '你是一个资深需求分析师，请输出结构化功能分析报告。'),
  uiBuilder:    await getPrompt('pipeline_ui_builder',    '你是一个顶级 UI 设计师，请生成完整 HTML 骨架。'),
  logicBuilder: await getPrompt('pipeline_logic_builder', '你是一个资深前端工程师，请填充完整 JS 业务逻辑。'),
  integrator:   await getPrompt('pipeline_integrator',    '你是一个代码整合专家，请做最终检查和优化。'),
});

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
    // 从数据库加载最新提示词（每次请求都读取，支持热更新）
    const PIPELINE_AGENTS = await getPipelineAgents();

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
