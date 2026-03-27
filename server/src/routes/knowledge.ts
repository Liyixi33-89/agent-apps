/**
 * @file routes/knowledge.ts
 * @description § 6  知识库路由 — 列表查询 / 详情获取 / 语义搜索 / RAG 问答 / RAG 流式问答
 *
 * 路由列表：
 *   GET  /api/knowledge             → 知识库列表（分页 + 过滤）
 *   GET  /api/knowledge/:id         → 知识库详情
 *   POST /api/knowledge/search      → 语义搜索
 *   POST /api/knowledge/rag         → RAG 问答（非流式，含来源引用）
 *   POST /api/knowledge/rag/stream  → RAG 流式问答（SSE，含来源引用）
 */

import Router from '@koa/router';
import { KnowledgeBase } from '../models/KnowledgeBase.js';
import { searchKnowledge, ragQuery, ragQueryStream } from '../services/knowledgeService.js';

export const knowledgeRouter = new Router();

// ─── 知识库列表  GET /api/knowledge ──────────────────────────────────────────

knowledgeRouter.get('/knowledge', async (ctx) => {
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

// ─── 知识库详情  GET /api/knowledge/:id ──────────────────────────────────────

knowledgeRouter.get('/knowledge/:id', async (ctx) => {
  const kb = await KnowledgeBase.findById(ctx.params.id).lean();
  if (!kb) { ctx.status = 404; ctx.body = { success: false, message: 'Knowledge not found' }; return; }
  ctx.body = { success: true, data: kb };
});

// ─── 语义搜索  POST /api/knowledge/search ────────────────────────────────────

knowledgeRouter.post('/knowledge/search', async (ctx) => {
  const { query, categoryKey, agentSlug, lang = 'zh', limit = 5 } = ctx.request.body as Record<string, string | number>;
  const results = await searchKnowledge(String(query), {
    categoryKey: String(categoryKey || ''),
    agentSlug: String(agentSlug || ''),
    lang: lang as 'zh' | 'en',
    limit: Number(limit)
  });
  ctx.body = { success: true, data: results };
});

// ─── RAG 问答  POST /api/knowledge/rag ───────────────────────────────────────

knowledgeRouter.post('/knowledge/rag', async (ctx) => {
  const {
    question,
    categoryKey,
    agentSlug,
    provider,
    lang = 'zh',
    history,
    rewrite,
  } = ctx.request.body as Record<string, any>;

  const result = await ragQuery(question, {
    categoryKey,
    agentSlug,
    provider: provider as 'ollama' | 'codebuddy',
    lang: lang as 'zh' | 'en',
    history: Array.isArray(history) ? history : [],
    rewrite: rewrite !== false,
  });

  ctx.body = {
    success: true,
    data: {
      answer: result.answer,
      question,
      rewrittenQuestion: result.rewrittenQuestion,
      sources: result.sources,
    },
  };
});

// ─── RAG 流式问答  POST /api/knowledge/rag/stream ────────────────────────────

knowledgeRouter.post('/knowledge/rag/stream', async (ctx) => {
  const {
    question,
    categoryKey,
    agentSlug,
    provider,
    lang = 'zh',
    history,
    rewrite,
  } = ctx.request.body as Record<string, any>;

  ctx.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  ctx.status = 200;

  const res = ctx.res;
  const send = (data: Record<string, unknown>) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  send({ type: 'start', question });

  try {
    const stream = ragQueryStream(question, {
      categoryKey,
      agentSlug,
      provider: provider as 'ollama' | 'codebuddy',
      lang: lang as 'zh' | 'en',
      history: Array.isArray(history) ? history : [],
      rewrite: rewrite !== false,
    });

    for await (const event of stream) {
      send(event);
      if (event.type === 'done' || event.type === 'error') break;
    }
  } catch (err: unknown) {
    send({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  } finally {
    res.end();
  }
});
