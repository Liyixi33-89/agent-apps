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
import { callLLM, callLLMWithTools } from '../services/llmService.js';
import { env } from '../config/env.js';
import { v4 as uuidv4 } from 'uuid';
import { buildMemoryMessages, streamWithContinuation } from '../lib/llmUtils.js';
import { AGENT_TOOLS, executeTool } from '../lib/agentTools.js';
import { getMcpToolDefinitions, executeMcpTool, parseMcpToolName } from '../services/mcpService.js';

export const chatRouter = new Router();

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
    // Vibe Coding 页面：始终使用 vibe_chat 内置 prompt，agentSlug 只作为元数据保存，不覆盖角色
    systemPrompt = await getPrompt(
      'vibe_chat',
      `你是一个专业的 Vibe Coding 助手，兼具 UI/UX 设计师和前端工程师能力，同时拥有一套强大的工具系统。

## 工具使用规则（重要）
你拥有以下工具，遇到对应场景时**必须**调用，不能凭空回答：
- **find_agent** / **list_categories**：用户询问"有哪些agent"、"调用了哪些agent"、"系统有什么能力"时必须调用
- **list_pages** / **get_page_structure** / **get_template_code**：用户询问"有哪些页面"、"页面结构"、"查看某个页面"时必须调用
- **get_design_spec**：用户询问"设计规范"、"配色方案"、"组件风格"时必须调用
- **search_knowledge**：用户询问技术问题、最佳实践、文档内容时必须调用

## 职责
1. 回答用户关于前端开发、UI设计的问题（优先使用工具获取真实数据）
2. 当用户要求修改已有页面元素时，给出精确的修改建议或代码片段
3. 当用户要求生成完整页面时，输出完整可运行的 HTML 文件（包含 <!DOCTYPE html> 到 </html>）
4. 根据上下文判断用户意图，不要把所有问题都当成"生成页面"来处理`
    );
    agentName = 'Vibe Assistant';

    // vibe session：agentSlug 只更新显示名称，不覆盖 system prompt
    if (agentSlug) {
      const agent = await Agent.findOne({ slug: agentSlug }).lean() as IAgent | null;
      if (agent) {
        agentName = agent.name.zh || agent.name.en;
        // 注意：不覆盖 systemPrompt，vibe 始终用 vibe_chat prompt
      }
    }
  } else {
    // /chat 普通对话页面：agentSlug 决定角色
    if (agentSlug) {
      const agent = await Agent.findOne({ slug: agentSlug }).lean() as IAgent | null;
      if (agent) {
        agentName = agent.name.zh || agent.name.en;
        systemPrompt = agent.rawMarkdown.slice(0, 3000);
      }
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
    systemPrompt,
    sessionType: sessionType === 'vibe' ? 'vibe' : 'chat',
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

  // 对 vibe session，每次都从数据库读取最新的 system prompt
  // 避免旧 session 使用创建时存的过期 prompt（如旧的"UI生成器"角色）
  if ((chat as any).sessionType === 'vibe') {
    const latestVibeChatPrompt = await getPrompt(
      'vibe_chat',
      `你是一个专业的 Vibe Coding 助手，兼具 UI/UX 设计师和前端工程师能力，同时拥有一套强大的工具系统。

## 工具使用规则（重要）
你拥有以下工具，遇到对应场景时**必须**调用，不能凭空回答：
- **find_agent** / **list_categories**：用户询问"有哪些agent"、"调用了哪些agent"、"系统有什么能力"时必须调用
- **list_pages** / **get_page_structure** / **get_template_code**：用户询问"有哪些页面"、"页面结构"、"查看某个页面"时必须调用
- **get_design_spec**：用户询问"设计规范"、"配色方案"、"组件风格"时必须调用
- **search_knowledge**：用户询问技术问题、最佳实践、文档内容时必须调用

## 职责
1. 回答用户关于前端开发、UI设计的问题（优先使用工具获取真实数据）
2. 当用户要求修改已有页面元素时，给出精确的修改建议或代码片段
3. 当用户要求生成完整页面时，输出完整可运行的 HTML 文件（包含 <!DOCTYPE html> 到 </html>）
4. 根据上下文判断用户意图，不要把所有问题都当成"生成页面"来处理`
    );
    chat.systemPrompt = latestVibeChatPrompt;
    if (chat.messages.length > 0 && chat.messages[0].role === 'system') {
      chat.messages[0].content = latestVibeChatPrompt;
    }
  }

  chat.messages.push({ role: 'user', content: message, timestamp: new Date(), imageUrl });
  await chat.save();

  ctx.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  ctx.status = 200;

  const res = ctx.res;
  const send = (data: Record<string, unknown>) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  send({ type: 'start' });

  try {
    // ── 构建消息列表 ────────────────────────────────────────────────────────────
    // 强制用最新的 systemPrompt 覆盖数据库里可能过期的 system 消息
    const rawMessages = buildMemoryMessages(chat.messages.slice(-30));
    const recentMessages = rawMessages.map((m: any, idx: number) => {
      // 第一条 system 消息始终使用最新的 systemPrompt
      if (idx === 0 && m.role === 'system' && chat.systemPrompt) {
        return { role: 'system' as const, content: chat.systemPrompt };
      }
      return {
        role: m.role as 'system' | 'user' | 'assistant' | 'tool',
        content: m.imageUrl
          ? [
              { type: 'text' as const, text: m.content },
              { type: 'image_url' as const, image_url: { url: m.imageUrl } }
            ]
          : m.content,
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
        ...(m.name ? { name: m.name } : {}),
      };
    });

    // ── 合并内置工具 + MCP 工具 ──────────────────────────────────────────────
    let allTools = [...AGENT_TOOLS];
    try {
      const mcpTools = await getMcpToolDefinitions();
      if (mcpTools.length > 0) {
        allTools = [...allTools, ...mcpTools];
        console.log(`[Chat] 已加载 ${mcpTools.length} 个 MCP 工具`);
      }
    } catch (mcpErr) {
      console.warn('[Chat] 加载 MCP 工具失败（不影响内置工具）:', mcpErr instanceof Error ? mcpErr.message : String(mcpErr));
    }

    // ── Tool Calling 循环（最多 3 轮工具调用）──────────────────────────────────
    const MAX_TOOL_ROUNDS = 3;
    let toolMessages = [...recentMessages];
    let toolRound = 0;
    let toolCallingSupported = true; // 标记模型是否支持 tool calling

    while (toolRound < MAX_TOOL_ROUNDS && toolCallingSupported) {
      // 第一轮：携带工具定义（内置 + MCP），询问 LLM 是否需要调用工具
      let toolResponse;
      try {
        toolResponse = await callLLMWithTools(toolMessages, allTools, {
          provider: chat.provider as 'ollama' | 'openai',
          modelType: chat.modelType as 'text' | 'vision',
        });
      } catch (toolErr: unknown) {
        // 模型不支持 tool calling（400/422 等错误）→ 降级到普通流式对话
        toolCallingSupported = false;
        break;
      }

      // 没有 tool_calls → 直接流式输出这个回答
      if (!toolResponse.toolCalls || toolResponse.toolCalls.length === 0) {
        // 如果有文字内容直接流式推送
        if (toolResponse.content) {
          // 逐字符模拟流式（非流式调用的结果转为流式推送）
          const chunkSize = 8;
          for (let i = 0; i < toolResponse.content.length; i += chunkSize) {
            const delta = toolResponse.content.slice(i, i + chunkSize);
            send({ type: 'delta', delta });
          }
        }
        // 保存并结束
        chat.messages.push({ role: 'assistant', content: toolResponse.content, timestamp: new Date(), provider: chat.provider, modelType: chat.modelType });
        await chat.save();
        send({ type: 'done', content: toolResponse.content });
        res.end();
        return;
      }

      // 有 tool_calls → 推送工具调用事件，执行工具
      send({
        type: 'tool_calls_start',
        toolCalls: toolResponse.toolCalls.map((tc) => ({
          name: tc.function.name,
          arguments: tc.function.arguments,
        })),
      });

      // 将 assistant 的 tool_calls 消息加入上下文
      toolMessages.push({
        role: 'assistant' as const,
        content: toolResponse.content || '',
        tool_calls: toolResponse.toolCalls,
      } as any);

      // 并行执行所有工具
      const toolResults = await Promise.all(
        toolResponse.toolCalls.map(async (tc) => {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.function.arguments); } catch { /* 忽略解析错误 */ }

          send({ type: 'tool_executing', toolName: tc.function.name });

          // 判断是内置工具还是 MCP 工具
          const mcpInfo = parseMcpToolName(tc.function.name);
          let result;
          if (mcpInfo.isMcp && mcpInfo.toolName) {
            // MCP 工具：通过 MCP 协议调用
            result = await executeMcpTool(mcpInfo.toolName, args);
          } else {
            // 内置工具：直接调用
            result = await executeTool({ name: tc.function.name, arguments: args });
          }

          send({
            type: 'tool_result',
            toolName: tc.function.name,
            success: result.success,
            summary: result.success
              ? JSON.stringify(result.data).slice(0, 300)
              : result.error,
          });

          return { tc, result };
        })
      );

      // 将工具结果注入消息（tool role）
      for (const { tc, result } of toolResults) {
        toolMessages.push({
          role: 'tool' as const,
          tool_call_id: tc.id || tc.function.name,
          name: tc.function.name,
          content: result.success
            ? JSON.stringify(result.data)
            : `工具调用失败：${result.error}`,
        } as any);
      }

      toolRound++;
    }

    // ── 工具调用完毕，流式生成最终回答 ─────────────────────────────────────────
    send({ type: 'generating' });

    // 将 tool role 消息转换为 user role（Ollama 流式接口不支持 tool role）
    const streamMessages = toolMessages.map((m: any) => {
      if (m.role === 'tool') {
        return {
          role: 'user' as const,
          content: `[工具 ${m.name} 返回结果]\n${m.content}`,
        };
      }
      // 移除 assistant 消息中的 tool_calls 字段（流式接口不需要）
      if (m.role === 'assistant' && m.tool_calls) {
        return { role: 'assistant' as const, content: m.content || '' };
      }
      return m;
    });

    const stream = streamWithContinuation(streamMessages, { provider: chat.provider, modelType: chat.modelType });
    let fullContent = '';

    for await (const chunk of stream) {
      if (chunk.delta) {
        fullContent += chunk.delta;
        send({ type: 'delta', delta: chunk.delta });
      }
      if (chunk.done) break;
    }

    chat.messages.push({ role: 'assistant', content: fullContent, timestamp: new Date(), provider: chat.provider, modelType: chat.modelType });
    await chat.save();

    send({ type: 'done', content: fullContent });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    send({ type: 'error', message: errMsg });
  } finally {
    res.end();
  }
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

// ─── 删除会话  DELETE /api/chat/session/:sessionId ───────────────────────────

chatRouter.delete('/chat/session/:sessionId', async (ctx) => {
  const result = await Chat.deleteOne({ sessionId: ctx.params.sessionId });
  if (result.deletedCount === 0) {
    ctx.status = 404;
    ctx.body = { success: false, message: 'Session not found' };
    return;
  }
  ctx.body = { success: true, message: '会话已删除' };
});

// ─── 重命名会话  PATCH /api/chat/session/:sessionId ─────────────────────────

chatRouter.patch('/chat/session/:sessionId', async (ctx) => {
  const { title } = ctx.request.body as { title: string };
  if (!title?.trim()) {
    ctx.status = 400;
    ctx.body = { success: false, message: '标题不能为空' };
    return;
  }
  const chat = await Chat.findOneAndUpdate(
    { sessionId: ctx.params.sessionId },
    { title: title.trim() },
    { new: true }
  );
  if (!chat) {
    ctx.status = 404;
    ctx.body = { success: false, message: 'Session not found' };
    return;
  }
  ctx.body = { success: true, data: { sessionId: chat.sessionId, title: chat.title } };
});
