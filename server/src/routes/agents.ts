import Router from '@koa/router';
import multer from '@koa/multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Agent } from '../models/Agent.js';
import { Category } from '../models/Category.js';
import { Pipeline } from '../models/Pipeline.js';
import { Chat } from '../models/Chat.js';
import { KnowledgeBase } from '../models/KnowledgeBase.js';
import { SystemPrompt } from '../models/SystemPrompt.js';
import type { ISystemPrompt } from '../models/SystemPrompt.js';
import { VibeTemplate } from '../models/VibeTemplate.js';
import { ingestAgentsFromMarkdown } from '../services/agentIngestionService.js';
import type { IAgent } from '../models/Agent.js';
import { callLLM, streamLLM } from '../services/llmService.js';
import { searchKnowledge, ragQuery } from '../services/knowledgeService.js';
import { env } from '../config/env.js';
import { v4 as uuidv4 } from 'uuid';

// ─── 文件上传配置 ───────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('只支持图片文件'));
  },
});

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
 * 检测 LLM 输出是否被 token 限制截断
 *
 * 策略 1 — 代码块 / 标签结构完整性检查
 *   检查 ```html 是否有对应的 ``` 闭合；<script> 是否有 </script>；
 *   HTML 标签尖括号是否配对；花括号 {} 是否配对。
 *
 * 策略 2 — 末尾不完整 JSON / 代码特征检查
 *   文本末尾是逗号、冒号、引号未闭合、属性名未完成、反斜杠转义未完成等
 *   常见截断模式。
 *
 * 策略 3 — 文本长度接近 token 上限
 *   假设 1 token ≈ 2~3 字符（中文），16384 tokens ≈ 32000~50000 字符。
 *   若文本长度超过阈值且 finishReason 不是明确的 'stop'，视为可能截断。
 */
const isLikelyTruncated = (text: string, finishReason?: string): boolean => {
  // 已明确正常结束，不需要续写
  if (finishReason === 'stop') return false;

  const trimmed = text.trimEnd();
  if (!trimmed) return false;

  // ── 策略 1：代码块 / 标签结构完整性 ──────────────────────────────────────

  // 检查 ```html 代码块是否闭合
  const codeBlockOpenCount = (text.match(/```/g) || []).length;
  if (codeBlockOpenCount % 2 !== 0) {
    // 奇数个 ``` 说明有未闭合的代码块
    return true;
  }

  // 检查 <script> 标签是否配对
  const scriptOpenCount = (text.match(/<script[\s>]/gi) || []).length;
  const scriptCloseCount = (text.match(/<\/script>/gi) || []).length;
  if (scriptOpenCount > scriptCloseCount) return true;

  // 检查 <style> 标签是否配对
  const styleOpenCount = (text.match(/<style[\s>]/gi) || []).length;
  const styleCloseCount = (text.match(/<\/style>/gi) || []).length;
  if (styleOpenCount > styleCloseCount) return true;

  // 检查花括号是否配对（JS 代码中常见截断点）
  // 仅在文本包含代码块时做此检查，避免误判纯文本
  if (text.includes('```')) {
    let braceDepth = 0;
    for (const ch of text) {
      if (ch === '{') braceDepth++;
      else if (ch === '}') braceDepth--;
    }
    if (braceDepth > 2) {
      // 允许少量不配对（模板字符串等边界情况），超过 2 层视为截断
      return true;
    }
  }

  // ── 策略 2：末尾不完整特征检查 ────────────────────────────────────────────

  // 末尾是逗号或冒号（JSON/JS 对象属性未完成）
  if (/[,:]$/.test(trimmed)) return true;

  // 末尾是未闭合的字符串引号（单引号或双引号，且行内引号数量为奇数）
  const lastLine = trimmed.split('\n').pop() || '';
  const singleQuoteCount = (lastLine.match(/(?<!\\)'/g) || []).length;
  const doubleQuoteCount = (lastLine.match(/(?<!\\)"/g) || []).length;
  if (singleQuoteCount % 2 !== 0 || doubleQuoteCount % 2 !== 0) return true;

  // 末尾是反斜杠（转义字符未完成）
  if (/\\$/.test(trimmed)) return true;

  // 末尾是未完成的 HTML 标签（< 开了但没有 >）
  if (/<[^>]*$/.test(trimmed)) return true;

  // 末尾是未完成的属性名或关键字（字母/数字结尾但上下文是 JSON/代码）
  // 检查最后一行是否像一个未完成的 key: 或 function 声明
  if (/^\s*("|')?[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(lastLine)) {
    // 最后一行只有一个标识符，没有值，可能是截断的属性名
    return true;
  }

  // ── 策略 3：文本长度接近 token 上限 ──────────────────────────────────────

  // 16384 tokens × 2 字符/token = 32768 字符（保守估计）
  // 超过 30000 字符且 finishReason 不是 stop，视为可能截断
  const TOKEN_LENGTH_THRESHOLD = 30_000;
  if (text.length >= TOKEN_LENGTH_THRESHOLD && finishReason !== 'stop') {
    return true;
  }

  return false;
};

/**
 * 流式请求并自动续写
 * 触发续写的条件（满足任一即续写）：
 *   1. finish_reason === 'length'（模型明确报告 token 超出）
 *   2. isLikelyTruncated() 检测到截断特征（应对模型不正确上报 finish_reason 的情况）
 * 最多续写 MAX_CONTINUATIONS 次
 */
const MAX_CONTINUATIONS = 5;

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

    // 达到续写上限，强制结束
    if (continuationCount >= MAX_CONTINUATIONS) break;

    // 判断是否需要续写：
    //   条件 1 — 模型明确报告 token 超出
    //   条件 2 — 截断检测发现输出不完整（应对模型未正确上报的情况）
    const needContinuation =
      finishReason === 'length' ||
      isLikelyTruncated(accumulatedContent, finishReason);

    if (!needContinuation) break;

    // 发送续写心跳，保持 SSE 连接
    continuationCount++;
    yield { delta: '', done: false };

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
// 执行顺序（4 步，保留 UI 设计链路，提升生成样式质量）：
//   Step 1 - 需求分析 Agent  → 拆解功能模块、数据结构、交互逻辑（纯文本）
//   Step 2 - UI 设计 Agent   → 输出设计规范：配色、布局、组件风格、字体层级
//   Step 3 - 代码生成 Agent  → 参考设计规范生成完整单文件 HTML（含 CSS + JS）
//   Step 4 - 质检 Agent      → 检查并修复代码问题，输出最终可运行 HTML
//
// 每步通过 SSE 推送 { type: 'step', step, title, status } 进度事件
// 最终通过 { type: 'done', content } 推送完整代码
// ─────────────────────────────────────────────────────────────────────────────

// 内置完整 Pipeline Prompt（不依赖数据库 seed，确保开箱即用）
// 数据库中若有对应 key 则优先使用（支持后台热更新）
const FALLBACK_ANALYST_PROMPT = `你是一个资深全栈架构师。
请对用户的应用需求进行简洁的结构化分析，输出以下内容（纯文本，不要写代码）：
1. 应用类型判断（游戏 / 工具 / 管理系统 / 展示页面 / 其他）
2. 核心功能点列表（每个功能一行，按需求原文列出，不要增减）
3. 主要数据实体（如有，列出关键数据结构）
4. 关键交互流程（3-5 条，根据应用类型描述）
5. 推荐的 UI 布局方案（根据应用类型推荐：游戏→全屏画布、工具→单页简洁、管理系统→侧边栏导航、展示→卡片列表）

要求：简洁精炼，总字数不超过 500 字。`;

const FALLBACK_DESIGNER_PROMPT = `你是一个顶级 UI/UX 设计师，专精于现代 Web 应用的视觉设计。
请根据需求分析，输出一份完整的 UI 设计规范（纯文本，不要写代码），包含以下内容：

1. 【整体风格】
   - 设计风格：现代简约 / 科技感 / 商务专业 / 活泼清新（选一种并说明）
   - 整体色调：深色模式 / 浅色模式（选一种）

2. 【配色方案】
   - 主色（Primary）：给出具体 hex 值，如 #6366f1
   - 辅助色（Secondary）：给出具体 hex 值
   - 背景色（Background）：给出具体 hex 值
   - 卡片/面板背景色：给出具体 hex 值
   - 文字主色：给出具体 hex 值
   - 文字次色：给出具体 hex 值
   - 边框色：给出具体 hex 值
   - 成功/警告/危险色：给出具体 hex 值

3. 【布局结构】
   - 根据应用类型描述布局（游戏→全屏画布尺寸/网格大小；工具→单页居中布局；管理系统→侧边栏宽度/顶部栏高度；展示→卡片间距）
   - 内容区：描述主要区域的间距规范（如 gap-4、p-6）
   - 响应式：是否需要移动端适配

4. 【组件风格】
   - 按钮：圆角大小、主按钮/次按钮/危险按钮的具体样式
   - 输入框：边框样式、聚焦态、圆角
   - 表格：行高、斑马纹、悬停效果
   - 卡片：圆角、阴影、边框
   - 徽章/标签：状态色对应关系
   - 弹窗/模态框：遮罩、圆角、动画

5. 【字体层级】
   - 页面标题：字号、字重
   - 模块标题：字号、字重
   - 正文：字号
   - 辅助文字：字号、颜色

6. 【交互细节】
   - 过渡动画：transition 时长建议
   - 悬停效果：颜色变化描述
   - 加载状态：骨架屏 / 旋转图标

要求：设计规范要具体、可执行，配色要协调美观，风格要统一。总字数不超过 800 字。`;

const FALLBACK_BUILDER_PROMPT = `你是一个顶级全栈前端工程师，专精于生成完整可运行的单文件 HTML 应用。

【核心要求 - 必须严格遵守】
1. 输出格式：必须且只能输出一个完整的 HTML 文件，用 \`\`\`html 和 \`\`\` 包裹
2. 文件结构：<!DOCTYPE html> 开头，包含完整的 <head> 和 <body>
3. 样式策略（根据应用类型选择）：
   - 游戏类：使用 <style> 内联 CSS，禁止引入 Tailwind（游戏元素位置/尺寸由 JS/Canvas 动态控制，Tailwind 无法胜任）
   - 工具/管理系统/展示类：使用 Tailwind CSS CDN（<script src="https://cdn.tailwindcss.com"></script>）
4. 脚本：所有 JavaScript 写在 <script> 标签内，使用原生 JS（不依赖 Node.js/npm）
5. 功能完整性：需求中列出的每一个功能点都必须实现，一个都不能遗漏
6. 布局与渲染策略（根据需求类型严格选择）：
   - 【游戏类】必须使用 Canvas 2D API 渲染游戏画面：
     * 用 <canvas> 元素作为游戏主画布，通过 getContext('2d') 绘制所有游戏元素
     * 游戏循环必须使用 requestAnimationFrame（禁止用 setInterval 驱动渲染）
     * 键盘/触摸事件监听挂载到 document 或 canvas 上
     * 音效使用 Web Audio API（AudioContext）生成，无需外部音频文件
     * UI 控件（分数、按钮、难度选择）用 HTML+CSS 覆盖在 canvas 上方（position: absolute）
   - 【工具类】简洁单页布局，突出核心功能，Tailwind 布局
   - 【管理系统类】侧边栏导航 + 内容区，多模块切换，Tailwind 布局
   - 【展示类】卡片/列表布局，美观呈现，Tailwind 布局
7. 数据：如需模拟数据，使用 JavaScript 数组/对象（至少 8-15 条示例数据）
8. 图表（仅管理系统/数据展示类需要）：使用 ECharts CDN（https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js）
   - 图表容器必须设置明确的高度（如 height: 300px）
   - 初始化后必须调用 window.addEventListener('resize', () => chart.resize()) 实现自适应
9. 完整性：代码必须完整，不能有省略号、TODO、占位符或未完成的部分
10. 可运行：生成的 HTML 文件可以直接在浏览器中打开并正常使用

【禁止事项】
- 禁止使用 require()、import from（ES Module 除外）、Node.js API
- 禁止输出多个代码块
- 禁止在代码中留下 "// TODO"、"// 待实现"、"..." 等未完成标记
- 禁止使用需要后端 API 的功能（所有数据用前端模拟）
- 禁止只实现部分功能，必须实现需求中的全部功能
- 【重要】禁止使用 <form> 标签！所有表单布局必须用 <div> 替代，输入框直接使用 <input>/<select>/<textarea>，提交操作通过按钮的 onclick 事件处理，绝对不能出现 <form>、</form>、form.onsubmit、document.querySelector('form') 等任何与 form 相关的代码
- 【重要】严格根据用户需求决定布局，不要把游戏、工具等非管理系统需求做成后台管理系统的侧边栏+CRUD 形式
- 【重要】游戏类禁止用 div 网格模拟游戏画面，必须用 Canvas 2D 绘制；禁止用 setInterval 驱动游戏主循环，必须用 requestAnimationFrame`
const FALLBACK_REVIEWER_PROMPT = `你是一个代码质检专家，专门检查和修复 HTML 应用代码。

【检查项目 - 必须逐项执行】
1. 语法检查：修复所有 JS/HTML/CSS 语法错误，包括：
   - 不完整的语句（如 'const a' 后面没有赋值、函数体未闭合、括号不匹配）
   - 截断的代码（代码在中间突然结束，必须补全）
   - 多余的或缺失的花括号/圆括号/方括号
   - 将所有 <form> 标签替换为 <div>，将 </form> 替换为 </div>，删除所有 form.onsubmit、document.querySelector('form')、document.getElementById('xxx-form').onsubmit 等 form 相关 JS 代码
2. 函数定义顺序检查（重点！）：
   - 找出所有在 bindEvents、init、DOMContentLoaded 等初始化函数中调用的函数名
   - 确认这些函数在调用前已经定义（使用 function 声明而非 const 箭头函数，因为 function 声明会提升）
   - 如果发现 'const xxx = () =>' 定义的函数被在定义之前调用，必须将其改为 'function xxx()' 声明形式
   - 特别检查：addXxx、deleteXxx、editXxx、updateXxx、renderXxx、showXxx、hideXxx 等常见函数名
3. 未定义引用检查：搜索所有函数调用，确认每个被调用的函数都有对应的定义
4. 游戏类专项检查（如果代码包含 <canvas> 或游戏逻辑）：
   - 确认使用了 requestAnimationFrame 驱动游戏主循环，如果用了 setInterval 驱动渲染帧，必须改为 requestAnimationFrame
   - 确认 canvas 有明确的宽高设置（width/height 属性或 CSS）
   - 确认键盘事件监听正确绑定（document.addEventListener('keydown', ...)）
   - 确认游戏结束后能正确停止循环（cancelAnimationFrame）
5. 功能完整性：对照原始需求，确认每一个功能点都有对应的实现，缺失的必须补全
6. 交互完整性：确保所有按钮、控件、交互都有对应的实现，不能有空函数或未绑定事件
7. 数据完整性：如需模拟数据，确保有足够的示例数据（至少 8 条）
8. 代码完整性：删除所有 TODO、占位符、省略号，补全所有未完成的代码
9. 图表自适应：检查所有 ECharts 图表是否绑定了 resize 事件，未绑定的必须补充：
   window.addEventListener('resize', () => chartInstance.resize())
10. CDN 可用性：确保使用的 CDN 链接正确

【输出要求】
- 必须输出完整的修复后 HTML 文件，用 \`\`\`html 和 \`\`\` 包裹
- 如果代码已经完整正确，直接原样输出（仍需用代码块包裹）
- 不要输出任何解释文字，只输出代码块`;

const getPipelineAgents = async () => ({
  analyst:  await getPrompt('pipeline_analyst',  FALLBACK_ANALYST_PROMPT),
  designer: await getPrompt('pipeline_designer', FALLBACK_DESIGNER_PROMPT),
  builder:  await getPrompt('pipeline_builder',  FALLBACK_BUILDER_PROMPT),
  reviewer: await getPrompt('pipeline_reviewer', FALLBACK_REVIEWER_PROMPT),
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

/** 从 LLM 输出中提取 HTML 代码块内容 */
const extractHtmlFromResult = (raw: string): string => {
  // 优先匹配完整的 ```html ... ``` 块
  const fullMatch = raw.match(/```html\s*\n([\s\S]*?)\n?```/i);
  if (fullMatch) return fullMatch[1].trim();
  // 匹配未闭合的 ```html ... （截断情况）
  const openMatch = raw.match(/```html\s*\n([\s\S]+)$/i);
  if (openMatch) return openMatch[1].trim();
  // 匹配直接以 <!DOCTYPE 开头的内容
  const doctypeMatch = raw.match(/(<!DOCTYPE[\s\S]+)/i);
  if (doctypeMatch) return doctypeMatch[1].trim();
  return raw.trim();
};

/**
 * 修复 LLM 生成的 HTML 中常见的 JS 错误：
 *  1. 截断语句清理：移除末尾不完整的语句（const/let/var/function 后面没有完整定义）
 *  2. 将 <script> 块中所有 const/let 箭头函数提升为 function 声明，解决调用顺序问题
 */
const repairJsErrors = (html: string): string => {
  // ── HTML 层：将所有 <form> 标签替换为 <div>（彻底消除 form 元素）──────────
  let result = html.replace(/<form(\s[^>]*)?>/gi, (_m, attrs = '') => `<div${attrs}>`);
  result = result.replace(/<\/form>/gi, '</div>');

  // ── Script 层：修复 JS 代码中的常见错误 ─────────────────────────────────
  result = result.replace(/(<script(?:\s[^>]*)?>)([\s\S]*?)(<\/script>)/gi, (_match, open, body, close) => {
    let fixed = body;

    // ── 1. 清理末尾截断的不完整语句 ─────────────────────────────────────────
    // 移除末尾以 const/let/var/function 开头但没有完整赋值/函数体的行
    fixed = fixed.replace(/\n[ \t]*(const|let|var|function)\s+\w*\s*[=({]?\s*$/gm, '');
    // 移除末尾孤立的标识符（如 `a` 单独一行，由截断的 `const a` 续写拼接产生）
    fixed = fixed.replace(/\n[ \t]*[a-zA-Z_$][a-zA-Z0-9_$]*\s*$/m, '');

    // ── 2. 将 const/let 箭头函数/普通函数表达式提升为 function 声明 ──────────
    // 匹配：const fnName = (params) => { ... } 或 const fnName = function(params) { ... }
    // 替换为：function fnName(params) { ... }
    // 注意：只处理顶层（非嵌套）的函数定义，避免破坏对象字面量
    fixed = fixed.replace(
      /^([ \t]*)(const|let)[ \t]+(\w+)[ \t]*=[ \t]*(?:function[ \t]*)?\(([^)]*)\)[ \t]*(?:=>[ \t]*)?\{/gm,
      (_m: string, indent: string, _kw: string, name: string, params: string) =>
        `${indent}function ${name}(${params}) {`
    );

    // ── 3. 清理 form 相关 JS 代码（防止操作不存在的 form 元素导致 null 报错）──
    // 移除 xxx.onsubmit = ... 赋值语句
    fixed = fixed.replace(/[\w$.]+\.onsubmit\s*=\s*[^;]+;?/g, '// [vibe: form.onsubmit removed]');
    // 将 document.querySelector('form...') 替换为 null，避免操作不存在元素
    fixed = fixed.replace(/document\.querySelector\s*\(\s*['"]form[^'"]*['"]\s*\)/g, 'null');
    // 将 document.getElementById('xxx-form') 替换为 null
    fixed = fixed.replace(/document\.getElementById\s*\(\s*['"][^'"]*-?form[^'"]*['"]\s*\)/g, 'null');
    fixed = fixed.replace(/document\.getElementsByTagName\s*\(\s*['"]form['"]\s*\)/g, '[]');

    return `${open}${fixed}${close}`;
  });

  return result;
};

/**
 * 全面净化 LLM 生成的 HTML，使其在严格沙箱 iframe（仅 allow-scripts allow-same-origin）
 * 中安全运行，不依赖任何额外沙箱权限。
 *
 * 处理的沙箱受限 API：
 *  ① allow-forms    — form submit 拦截，submit 按钮改为 button + DOM Toast 反馈
 *  ② allow-modals   — alert/confirm/prompt 替换为内置 DOM Toast 实现
 *  ③ allow-popups   — window.open / <a target="_blank"> 拦截
 *  ④ allow-top-nav  — <a href="http..."> 外链改为 preventDefault + Toast 提示
 */
const sanitizeHtmlForSandbox = (html: string): string => {
  // ── 1. 净化 <form> 标签：移除 action / method / enctype ─────────────────
  let result = html.replace(/<form(\s[^>]*)?>/gi, (_match, attrs = '') => {
    let sanitized = (attrs as string)
      .replace(/\s+action\s*=\s*"[^"]*"/gi, '')
      .replace(/\s+action\s*=\s*'[^']*'/gi, '')
      .replace(/\s+action\s*=\s*[^\s>]*/gi, '')
      .replace(/\s+method\s*=\s*"[^"]*"/gi, '')
      .replace(/\s+method\s*=\s*'[^']*'/gi, '')
      .replace(/\s+method\s*=\s*[^\s>]*/gi, '')
      .replace(/\s+enctype\s*=\s*"[^"]*"/gi, '')
      .replace(/\s+enctype\s*=\s*'[^']*'/gi, '');

    const onsubmitMatch = sanitized.match(/onsubmit\s*=\s*"([^"]*)"/i);
    if (onsubmitMatch) {
      const existing = onsubmitMatch[1].trimEnd();
      const patched = existing.endsWith(';') ? `${existing} return false;` : `${existing}; return false;`;
      sanitized = sanitized.replace(/onsubmit\s*=\s*"[^"]*"/i, `onsubmit="${patched}"`);
    } else {
      sanitized += ' onsubmit="return false;"';
    }
    return `<form${sanitized}>`;
  });

  // ── 2. <button type="submit"> → type="button" + click 收集数据 ──────────
  // 使用 __vibeToast 替代 alert（在步骤 5 的注入脚本中定义）
  result = result.replace(/<button([^>]*)\btype\s*=\s*["']submit["']([^>]*)>/gi, (_m, before, after) => {
    const combined = `${before}${after}`;
    if (/\bonclick\s*=/i.test(combined)) return `<button${before}type="button"${after}>`;
    const handler = `(function(btn){var f=btn.closest('form');if(!f)return;var d={};f.querySelectorAll('[name]').forEach(function(el){d[el.name]=el.value;});window.__vibeToast('📋 表单数据\\n'+JSON.stringify(d,null,2));})(this)`;
    return `<button${before}type="button"${after} onclick="${handler}">`;
  });

  // ── 3. <input type="submit"> → type="button" + click 收集数据 ───────────
  result = result.replace(/<input([^>]*)\btype\s*=\s*["']submit["']([^>]*)\/?>/gi, (_m, before, after) => {
    const combined = `${before}${after}`;
    if (/\bonclick\s*=/i.test(combined)) return `<input${before}type="button"${after}>`;
    const handler = `(function(btn){var f=btn.closest('form');if(!f)return;var d={};f.querySelectorAll('[name]').forEach(function(el){d[el.name]=el.value;});window.__vibeToast('📋 表单数据\\n'+JSON.stringify(d,null,2));})(this)`;
    return `<input${before}type="button"${after} onclick="${handler}">`;
  });

  // ── 4. <input type="reset"> → type="button" + 手动 reset ────────────────
  result = result.replace(/<input([^>]*)\btype\s*=\s*["']reset["']([^>]*)\/?>/gi, (_m, before, after) => {
    const combined = `${before}${after}`;
    if (/\bonclick\s*=/i.test(combined)) return `<input${before}type="button"${after}>`;
    return `<input${before}type="button"${after} onclick="(function(btn){var f=btn.closest('form');if(f)f.reset();})(this)">`;
  });

  // ── 5. <a target="_blank"> → 移除 target，改为 Toast 提示 ───────────────
  result = result.replace(/<a([^>]*)\btarget\s*=\s*["']_blank["']([^>]*)>/gi, (_m, before, after) => {
    return `<a${before}${after}>`;
  });

  // ── 6. 注入运行时沙箱兜底脚本 ────────────────────────────────────────────
  // 替换 alert/confirm/prompt 为 DOM Toast；拦截 form submit / window.open / 外链跳转
  const sandboxGuardScript = `<script>
/* ===== [vibe-sandbox-guard] ===== */
(function () {
  /* --- 全局 JS 运行时错误捕获（Toast 显示，不静默失败） --- */
  window.onerror = function (msg, src, line, col, err) {
    var detail = err ? (err.message || String(err)) : String(msg);
    window.__vibeToast('⚠️ JS错误：' + detail + (line ? ' (行' + line + ')' : ''), 5000);
    return true; // 阻止控制台默认报错（可选，保留控制台报错则改为 false）
  };
  window.addEventListener('unhandledrejection', function (e) {
    var reason = e.reason ? (e.reason.message || String(e.reason)) : 'Promise rejected';
    window.__vibeToast('⚠️ 异步错误：' + reason, 5000);
  });

  /* --- DOM Toast 实现（替代 alert/confirm/prompt） --- */
  var _toastContainer = null;
  function getToastContainer() {
    if (_toastContainer) return _toastContainer;
    _toastContainer = document.createElement('div');
    _toastContainer.id = '__vibe_toast_container';
    Object.assign(_toastContainer.style, {
      position: 'fixed', top: '16px', right: '16px', zIndex: '2147483647',
      display: 'flex', flexDirection: 'column', gap: '8px',
      maxWidth: '360px', fontFamily: 'system-ui,sans-serif', pointerEvents: 'none'
    });
    document.body.appendChild(_toastContainer);
    return _toastContainer;
  }

  window.__vibeToast = function (msg, duration) {
    var container = getToastContainer();
    var toast = document.createElement('div');
    Object.assign(toast.style, {
      background: 'rgba(30,30,40,0.95)', color: '#e2e8f0',
      padding: '10px 14px', borderRadius: '8px',
      fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre-wrap',
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      border: '1px solid rgba(139,92,246,0.4)',
      pointerEvents: 'auto', wordBreak: 'break-all',
      maxHeight: '200px', overflowY: 'auto',
      opacity: '0', transition: 'opacity 0.2s'
    });
    toast.textContent = msg;
    container.appendChild(toast);
    requestAnimationFrame(function () { toast.style.opacity = '1'; });
    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 250);
    }, duration || 3500);
  };

  /* --- 替换 alert / confirm / prompt --- */
  window.alert   = function (msg) { window.__vibeToast('ℹ️ ' + msg); };
  window.confirm = function (msg) { window.__vibeToast('❓ ' + msg); return true; };
  window.prompt  = function (msg) { window.__vibeToast('✏️ ' + msg); return ''; };

  /* --- 拦截 window.open --- */
  window.open = function (url) {
    window.__vibeToast('🔗 链接：' + (url || ''));
    return null;
  };

  /* --- 拦截所有 form submit 事件（兜底） --- */
  document.addEventListener('submit', function (e) { e.preventDefault(); }, true);

  /* --- 拦截外链 <a> 跳转（等 DOM ready 后处理） --- */
  var patchLinks = function () {
    try {
      var anchors = document.querySelectorAll('a[href]');
      if (!anchors || !anchors.length) return;
      anchors.forEach(function (el) {
        try {
          if (!el || el.nodeType !== 1) return;
          var a = /** @type {HTMLAnchorElement} */ (el);
          var href = a.getAttribute('href');
          if (!href || typeof href !== 'string') return;
          href = href.trim();
          if (!href) return;
          if (/^https?:\/\//i.test(href) || /^\/\//i.test(href)) {
            a.removeAttribute('href');
            if (a.style) a.style.cursor = 'pointer';
            a.addEventListener('click', function (e) {
              if (e) e.preventDefault();
              if (window.__vibeToast) window.__vibeToast('🔗 外链：' + href);
            });
          }
        } catch (innerErr) { /* 单个元素处理失败不影响其他元素 */ }
      });
    } catch (err) { /* patchLinks 整体异常兜底 */ }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchLinks);
  } else {
    patchLinks();
  }

  /* --- ECharts 全局 resize 守卫 ---
   * 兜底：即使 LLM 生成的代码未绑定 resize，也能自适应容器尺寸变化。
   * 原理：拦截 echarts.init()，将返回的实例注册到全局列表，
   *       window resize 时统一调用所有实例的 resize()。
   * 同时用 ResizeObserver 监听每个图表容器的尺寸变化（更精准）。
   */
  (function patchECharts() {
    var _registeredCharts = [];
    var _resizeTimer = null;

    // 统一 resize 所有已注册图表
    function resizeAll() {
      _registeredCharts = _registeredCharts.filter(function (c) {
        try { return !c.isDisposed(); } catch (e) { return false; }
      });
      _registeredCharts.forEach(function (c) {
        try { c.resize(); } catch (e) {}
      });
    }

    window.addEventListener('resize', function () {
      clearTimeout(_resizeTimer);
      _resizeTimer = setTimeout(resizeAll, 100);
    });

    // 等 echarts 加载完成后再拦截 init
    function tryPatchEchartsInit() {
      if (typeof window.echarts === 'undefined') {
        setTimeout(tryPatchEchartsInit, 200);
        return;
      }
      var _originalInit = window.echarts.init.bind(window.echarts);
      window.echarts.init = function (dom, theme, opts) {
        var chart = _originalInit(dom, theme, opts);
        _registeredCharts.push(chart);
        // 用 ResizeObserver 监听容器尺寸变化
        if (dom && typeof ResizeObserver !== 'undefined') {
          var ro = new ResizeObserver(function () {
            clearTimeout(_resizeTimer);
            _resizeTimer = setTimeout(function () {
              try { if (!chart.isDisposed()) chart.resize(); } catch (e) {}
            }, 60);
          });
          ro.observe(dom);
        }
        return chart;
      };
    }
    tryPatchEchartsInit();
  })();
})();
</script>`;

  // 插入到 </body> 前；若无 </body> 则追加到末尾
  if (/<\/body>/i.test(result)) {
    result = result.replace(/<\/body>/i, `${sandboxGuardScript}\n</body>`);
  } else {
    result += `\n${sandboxGuardScript}`;
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
    const PIPELINE_AGENTS = await getPipelineAgents();

    // ── Step 1: 需求分析（纯文本，快速完成）────────────────────────────────────
    send({ type: 'step', step: 1, total: 4, title: '📋 需求分析中...', status: 'running' });

    const analysisResult = await runPipelineStep([
      { role: 'system', content: PIPELINE_AGENTS.analyst },
      { role: 'user', content: `请分析以下应用需求：\n\n${prompt}` }
    ], opts);

    send({ type: 'step', step: 1, total: 4, title: '📋 需求分析完成', status: 'done', content: analysisResult });

    // ── Step 2: UI 设计规范 ───────────────────────────────────────────────────
    send({ type: 'step', step: 2, total: 4, title: '🎨 UI 设计中...', status: 'running' });

    const designResult = await runPipelineStep([
      { role: 'system', content: PIPELINE_AGENTS.designer },
      {
        role: 'user',
        content: `请根据以下应用需求和需求分析，输出完整的 UI 设计规范。\n\n【原始需求】\n${prompt}\n\n【需求分析】\n${analysisResult}`
      }
    ], opts);

    send({ type: 'step', step: 2, total: 4, title: '🎨 UI 设计完成', status: 'done', content: designResult });

    // ── Step 3: 完整代码生成 ──────────────────────────────────────────────────
    send({ type: 'step', step: 3, total: 4, title: '⚡ 代码生成中...', status: 'running' });

    const buildResult = await runPipelineStep([
      { role: 'system', content: PIPELINE_AGENTS.builder },
      {
        role: 'user',
        content: `请根据以下需求和设计规范生成完整的单文件 HTML 应用。

【原始需求】
${prompt}

【需求分析】
${analysisResult}

【UI 设计规范 - 必须严格遵守】
${designResult}

【强制要求】
- 上述需求分析中列出的每一个功能模块都必须实现，一个都不能遗漏
- 必须严格按照 UI 设计规范中的配色方案、组件风格、布局结构实现，不能使用默认的灰白色调
- 根据需求类型选择合适的布局（游戏用全屏画布、工具用单页、管理系统用侧边栏），不要把游戏/工具类需求做成后台管理系统
- 【游戏类专项】如果需求是游戏，必须：① 用 <canvas> + Canvas 2D API 渲染游戏画面；② 用 requestAnimationFrame 驱动游戏主循环；③ 用 <style> 内联 CSS，不引入 Tailwind；④ 音效用 Web Audio API（AudioContext）生成
- 每个功能点都要有真实可交互的实现
- 如有图表，所有 ECharts 图表必须绑定 window resize 事件实现自适应，图表配色要与整体设计规范一致
- 代码必须完整，不能截断，不能有 TODO 或省略号

请直接输出完整的 HTML 代码，用 \`\`\`html 包裹。`
      }
    ], opts);

    send({ type: 'step', step: 3, total: 4, title: '⚡ 代码生成完成', status: 'done' });

    // ── Step 4: 代码质检与修复 ────────────────────────────────────────────────
    send({ type: 'step', step: 4, total: 4, title: '🔧 质检优化中...', status: 'running' });

    const builtHtml = sanitizeHtmlForSandbox(repairJsErrors(extractHtmlFromResult(buildResult)));

    const reviewResult = await runPipelineStep([
      { role: 'system', content: PIPELINE_AGENTS.reviewer },
      {
        role: 'user',
        content: `请检查并修复以下 HTML 应用代码：\n\n\`\`\`html\n${builtHtml}\n\`\`\``
      }
    ], opts);

    send({ type: 'step', step: 4, total: 4, title: '🔧 质检完成', status: 'done' });

    // ── 提取最终 HTML 并推送 ──────────────────────────────────────────────────
    const finalHtml = sanitizeHtmlForSandbox(repairJsErrors(extractHtmlFromResult(reviewResult)));
    // 包装为标准代码块格式，确保前端 extractCodeParts 能正确解析
    const finalContent = `\`\`\`html\n${finalHtml}\n\`\`\``;

    send({ type: 'done', content: finalContent, analysis: analysisResult, design: designResult });

  } catch (err: any) {
    send({ type: 'error', message: err?.message || '生成失败，请重试' });
  } finally {
    res.end();
  }
});

// ─── 图片上传接口 ─────────────────────────────────────────────────────────────
// POST /api/upload/image  → 上传图片，返回可访问的 URL
// ─────────────────────────────────────────────────────────────────────────────

agentsRouter.post('/upload/image', upload.single('image'), async (ctx) => {
  const file = (ctx as any).file as Express.Multer.File | undefined;
  if (!file) {
    ctx.status = 400;
    ctx.body = { success: false, message: '未收到图片文件' };
    return;
  }
  // 重命名为带扩展名的文件
  const ext = file.originalname.split('.').pop()?.toLowerCase() ?? 'jpg';
  const newName = `${uuidv4()}.${ext}`;
  const newPath = path.join(UPLOADS_DIR, newName);
  fs.renameSync(file.path, newPath);

  const baseUrl = `http://localhost:${env.port}`;
  ctx.body = { success: true, url: `${baseUrl}/uploads/${newName}` };
});

// ─── Vibe 模板市场（前端公开接口）────────────────────────────────────────────
//
// GET  /api/vibe/templates          → 获取模板列表（分页 + 分类过滤）
// GET  /api/vibe/templates/:id      → 获取单个模板（含代码）
// POST /api/vibe/templates          → 发布新模板
// ─────────────────────────────────────────────────────────────────────────────

agentsRouter.get('/vibe/templates', async (ctx) => {
  const { page = '1', limit = '20', category } = ctx.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, parseInt(limit));

  const filter: Record<string, unknown> = { isActive: true };
  if (category) filter.category = category;

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

agentsRouter.get('/vibe/templates/:id', async (ctx) => {
  const template = await VibeTemplate.findById(ctx.params.id).lean();
  if (!template || !template.isActive) {
    ctx.status = 404;
    ctx.body = { success: false, message: '模板不存在' };
    return;
  }
  // 增加浏览次数
  await VibeTemplate.findByIdAndUpdate(ctx.params.id, { $inc: { viewCount: 1 } });
  ctx.body = { success: true, data: template };
});

agentsRouter.post('/vibe/templates', async (ctx) => {
  const body = ctx.request.body as {
    title: string; description?: string; category?: string;
    author?: string; codeParts: object; thumbnail?: string; tags?: string[];
  };
  if (!body.title || !body.codeParts) {
    ctx.status = 400;
    ctx.body = { success: false, message: 'title 和 codeParts 为必填项' };
    return;
  }
  const template = await VibeTemplate.create({ ...body, publishedAt: new Date() });
  ctx.body = { success: true, data: template };
});
