/**
 * @file routes/chat.ts
 * @description § 5  Chat 路由 — 创建会话 / 会话列表 / 会话详情 / 流式聊天 / 普通聊天
 *
 * 路由列表：
 *   POST /api/chat/session          → 创建会话
 *   GET  /api/chat/sessions         → 会话列表
 *   GET  /api/chat/session/:id      → 会话详情
 *   POST /api/chat/stream           → 流式聊天（SSE）
 *   POST /api/chat/message          → 普通聊天（非流式）
 */

import Router from '@koa/router';
import { Agent } from '../models/Agent.js';
import { Chat } from '../models/Chat.js';
import { SystemPrompt } from '../models/SystemPrompt.js';
import type { ISystemPrompt } from '../models/SystemPrompt.js';
import type { IAgent } from '../models/Agent.js';
import { callLLM } from '../services/llmService.js';
import { env } from '../config/env.js';
import { v4 as uuidv4 } from 'uuid';
import { buildMemoryMessages, streamWithContinuation } from '../lib/llmUtils.js';

export const chatRouter = new Router({ prefix: '/api' });

// ─── 工具：从数据库读取 Prompt ────────────────────────────────────────────────

const getPrompt = async (key: string, fallback = ''): Promise<string> => {
  const doc = await SystemPrompt.findOne<ISystemPrompt>({ key, isActive: true }).lean();
  return doc?.content ?? fallback;
};

// ─── 创建会话  POST /api/chat/session ────────────────────────────────────────

chatRouter.post('/chat/session', async (ctx) => {
  const { agentSlug, provider = env.activeProvider, modelType = 'text', sessionType } = ctx.request.body as Record<string, string>;

  let systemPrompt = '你是一个专业的 AI Agent 助手，帮助用户完成各种任务。';
  let agentName = 'AI Assistant';

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

// ─── 会话列表  GET /api/chat/sessions ────────────────────────────────────────

chatRouter.get('/chat/sessions', async (ctx) => {
  const sessions = await Chat.find(
    {},
    { messages: { $slice: -1 }, sessionId: 1, agentName: 1, title: 1, provider: 1, modelType: 1, updatedAt: 1 }
  )
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();
  ctx.body = { success: true, data: sessions };
});

// ─── 会话详情  GET /api/chat/session/:sessionId ──────────────────────────────

chatRouter.get('/chat/session/:sessionId', async (ctx) => {
  const chat = await Chat.findOne({ sessionId: ctx.params.sessionId }).lean();
  if (!chat) { ctx.status = 404; ctx.body = { success: false, message: 'Session not found' }; return; }
  ctx.body = { success: true, data: chat };
});

// ─── 流式聊天  POST /api/chat/stream ─────────────────────────────────────────

chatRouter.post('/chat/stream', async (ctx) => {
  const { sessionId, message, imageUrl } = ctx.request.body as { sessionId: string; message: string; imageUrl?: string };

  const chat = await Chat.findOne({ sessionId });
  if (!chat) { ctx.status = 404; ctx.body = { success: false, message: 'Session not found' }; return; }

  chat.messages.push({ role: 'user', content: message, timestamp: new Date(), imageUrl });
  await chat.save();

  const recentMessages = buildMemoryMessages(chat.messages.slice(-30)).map((m: any) => ({
    role: m.role as 'system' | 'user' | 'assistant',
    content: m.imageUrl
      ? [
          { type: 'text' as const, text: m.content },
          { type: 'image_url' as const, image_url: { url: m.imageUrl } }
        ]
      : m.content
  }));

  ctx.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  ctx.status = 200;

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

  chat.messages.push({ role: 'assistant', content: fullContent, timestamp: new Date(), provider: chat.provider, modelType: chat.modelType });
  await chat.save();

  res.write(`data: ${JSON.stringify({ type: 'done', content: fullContent })}\n\n`);
  res.end();
});

// ─── 普通聊天（非流式）  POST /api/chat/message ──────────────────────────────

chatRouter.post('/chat/message', async (ctx) => {
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
