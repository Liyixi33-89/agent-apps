/**
 * @file routes/market.ts
 * @description § 9  模板市场路由 — 列表查询 / 详情获取 / 发布模板
 *
 * 路由列表：
 *   GET  /api/vibe/templates        → 模板列表（分页 + 分类过滤，不含代码体）
 *   GET  /api/vibe/templates/:id    → 模板详情（含完整 codeParts，浏览数 +1）
 *   POST /api/vibe/templates        → 发布新模板（title + codeParts 必填）
 */

import Router from '@koa/router';
import { VibeTemplate } from '../models/VibeTemplate.js';

export const marketRouter = new Router();

// ─── 模板列表  GET /api/vibe/templates ───────────────────────────────────────

marketRouter.get('/vibe/templates', async (ctx) => {
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

// ─── 模板详情  GET /api/vibe/templates/:id ───────────────────────────────────

marketRouter.get('/vibe/templates/:id', async (ctx) => {
  const template = await VibeTemplate.findById(ctx.params.id).lean();
  if (!template || !template.isActive) {
    ctx.status = 404;
    ctx.body = { success: false, message: '模板不存在' };
    return;
  }
  await VibeTemplate.findByIdAndUpdate(ctx.params.id, { $inc: { viewCount: 1 } });
  ctx.body = { success: true, data: template };
});

// ─── 保存应用（不发布到市场）  POST /api/vibe/apps ─────────────────────────

marketRouter.post('/vibe/apps', async (ctx) => {
  const body = ctx.request.body as {
    title: string; description?: string; category?: string;
    author?: string; codeParts: object; thumbnail?: string; tags?: string[];
    // 全栈模式扩展字段
    isFullStack?: boolean;
    serverParts?: object;
    dbSchema?: object;
    menuConfig?: object;
  };
  if (!body.title || !body.codeParts) {
    ctx.status = 400;
    ctx.body = { success: false, message: 'title 和 codeParts 为必填项' };
    return;
  }
  // isActive 为 false，表示仅保存、不在模板市场展示
  const template = await VibeTemplate.create({ ...body, isActive: false, publishedAt: new Date() });
  ctx.body = { success: true, data: template };
});

// ─── 获取已保存的应用  GET /api/vibe/apps/:id ────────────────────────────────

marketRouter.get('/vibe/apps/:id', async (ctx) => {
  const template = await VibeTemplate.findById(ctx.params.id).lean();
  if (!template) {
    ctx.status = 404;
    ctx.body = { success: false, message: '应用不存在' };
    return;
  }
  ctx.body = { success: true, data: template };
});

// ─── 发布模板  POST /api/vibe/templates ──────────────────────────────────────

marketRouter.post('/vibe/templates', async (ctx) => {
  const body = ctx.request.body as {
    title: string; description?: string; category?: string;
    author?: string; codeParts: object; thumbnail?: string; tags?: string[];
    // 全栈模式扩展字段
    isFullStack?: boolean;
    serverParts?: object;
    dbSchema?: object;
    menuConfig?: object;
  };
  if (!body.title || !body.codeParts) {
    ctx.status = 400;
    ctx.body = { success: false, message: 'title 和 codeParts 为必填项' };
    return;
  }
  const template = await VibeTemplate.create({ ...body, publishedAt: new Date() });
  ctx.body = { success: true, data: template };
});
