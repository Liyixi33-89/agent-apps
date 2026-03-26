/**
 * @file routes/vibe.ts
 * @description § 7  Vibe Coding 路由（单步 + 流式）
 *
 * 路由列表：
 *   POST /api/vibe/generate         → 单步生成（非流式）
 *   POST /api/vibe/stream           → 流式生成（SSE）
 *
 * Pipeline 路由（4步多Agent流水线）见 routes/vibePipeline.ts
 */

import Router from '@koa/router';
import { Agent } from '../models/Agent.js';
import type { IAgent } from '../models/Agent.js';
import { callLLM } from '../services/llmService.js';
import { env } from '../config/env.js';
import { streamWithContinuation } from '../lib/llmUtils.js';

export const vibeRouter = new Router({ prefix: '/api' });

// ─── 单步生成（非流式）  POST /api/vibe/generate ─────────────────────────────

vibeRouter.post('/vibe/generate', async (ctx) => {
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

// ─── 流式生成  POST /api/vibe/stream ─────────────────────────────────────────

vibeRouter.post('/vibe/stream', async (ctx) => {
  const { prompt, agentSlug, provider = env.activeProvider, modelType = 'text' } = ctx.request.body as Record<string, string>;

  let systemPrompt = `你是一个专业的 Vibe Coding 助手，擅长根据用户的自然语言描述生成高质量代码。`;

  if (agentSlug) {
    const agent = await Agent.findOne({ slug: agentSlug }).lean() as IAgent | null;
    if (agent) systemPrompt = agent.rawMarkdown.slice(0, 2000);
  }

  ctx.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  ctx.status = 200;

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
