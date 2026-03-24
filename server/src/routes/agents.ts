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

  // Vibe Coding 专用系统提示
  if (sessionType === 'vibe') {
    systemPrompt = `你是一个专业的 Vibe Coding 助手，擅长根据用户的自然语言描述生成和迭代优化代码。

工作原则：
1. 代码要完整可运行，不留占位符
2. 使用现代最佳实践和设计模式
3. 添加必要的中文注释
4. 考虑错误处理和边界情况
5. 代码风格保持一致
6. 每次修改都基于上一版本进行迭代
7. 如果用户要求修改，只修改相关部分，保持其他代码不变
8. 用 Markdown 代码块包裹代码，并标注语言类型`;
    agentName = 'Vibe Coder';
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

  // 构建消息历史（最近20条）
  const recentMessages = chat.messages.slice(-20).map((m: any) => ({
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

  const stream = streamLLM(recentMessages, { provider: chat.provider, modelType: chat.modelType });
  let fullContent = '';

  const res = ctx.res;
  res.write('data: {"type":"start"}\n\n');

  for await (const chunk of stream) {
    fullContent += chunk.delta;
    res.write(`data: ${JSON.stringify({ type: 'delta', delta: chunk.delta })}\n\n`);
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

  const stream = streamLLM(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
    { provider: provider as 'ollama' | 'codebuddy', modelType: modelType as 'text' | 'vision' }
  );

  const res = ctx.res;
  res.write('data: {"type":"start"}\n\n');

  for await (const chunk of stream) {
    res.write(`data: ${JSON.stringify({ type: 'delta', delta: chunk.delta })}\n\n`);
    if (chunk.done) break;
  }

  res.write('data: {"type":"done"}\n\n');
  res.end();
});
