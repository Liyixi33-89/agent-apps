/**
 * @file routes/review.ts
 * @description Agent 评价路由 — 评分评价的 CRUD API
 *
 * 来源：v1.3.0 PRD 功能模块 1, 2
 * 设计文档：version-doc/v1.3.0/design/be-agent-review.md
 *
 * 端点：
 *   GET    /api/agents/:slug/reviews       — 获取评价列表 + 统计
 *   POST   /api/agents/:slug/reviews       — 提交/更新评价（需认证）
 *   GET    /api/agents/:slug/reviews/mine   — 获取当前用户的评价（需认证）
 *   DELETE /api/agents/:slug/reviews       — 删除当前用户的评价（需认证）
 */

import Router from '@koa/router';
import { Agent } from '../models/Agent.js';
import { requireAuth, type AuthUser } from '../middleware/auth.js';
import * as reviewService from '../services/reviewService.js';

export const reviewRouter = new Router();

/**
 * XSS 过滤：移除 HTML 标签和潜在的脚本注入内容
 * 评价内容为纯文本，不允许任何 HTML
 */
const sanitizeReviewContent = (text: string): string => {
  return text
    .replace(/<[^>]*>/g, '')           // 移除所有 HTML 标签
    .replace(/&(?:#x?[0-9a-f]+|\w+);/gi, '') // 移除 HTML 实体编码
    .replace(/javascript:/gi, '')       // 移除 javascript: 协议
    .replace(/on\w+\s*=/gi, '')         // 移除事件处理器属性（onerror=, onclick= 等）
    .trim();
};

// ─── 获取评价列表 + 统计  GET /api/agents/:slug/reviews ──────────────────────

reviewRouter.get('/agents/:slug/reviews', async (ctx) => {
  try {
    const { slug } = ctx.params;
    const { page = '1', limit = '10' } = ctx.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

    const { stats, reviews, total } = await reviewService.getReviews(slug, pageNum, limitNum);

    ctx.body = {
      success: true,
      data: { stats, reviews },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    };
  } catch (err: unknown) {
    ctx.status = 500;
    ctx.body = { success: false, message: (err as Error).message };
  }
});

// ─── 提交/更新评价  POST /api/agents/:slug/reviews ───────────────────────────

reviewRouter.post('/agents/:slug/reviews', requireAuth, async (ctx) => {
  try {
    const { slug } = ctx.params;
    const { rating, content } = ctx.request.body as { rating?: number; content?: string };
    const user = ctx.state.user as AuthUser;

    // 校验评分
    if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      ctx.status = 400;
      ctx.body = { success: false, message: '评分必须在 1-5 之间的整数' };
      return;
    }

    // 校验评价内容长度
    if (content && content.length > 500) {
      ctx.status = 400;
      ctx.body = { success: false, message: '评价内容不能超过 500 字' };
      return;
    }

    // XSS 过滤：移除 HTML 标签和危险字符
    const sanitizedContent = content ? sanitizeReviewContent(content) : undefined;

    // 校验 Agent 是否存在
    const agent = await Agent.findOne({ slug }).lean();
    if (!agent) {
      ctx.status = 404;
      ctx.body = { success: false, message: 'Agent not found' };
      return;
    }

    const review = await reviewService.submitReview(
      slug,
      user.userId,
      user.username,
      rating,
      sanitizedContent
    );

    ctx.body = { success: true, data: review };
  } catch (err: unknown) {
    ctx.status = 500;
    ctx.body = { success: false, message: (err as Error).message };
  }
});

// ─── 获取当前用户的评价  GET /api/agents/:slug/reviews/mine ──────────────────

reviewRouter.get('/agents/:slug/reviews/mine', requireAuth, async (ctx) => {
  try {
    const { slug } = ctx.params;
    const user = ctx.state.user as AuthUser;

    const review = await reviewService.getMyReview(slug, user.userId);

    ctx.body = { success: true, data: review };
  } catch (err: unknown) {
    ctx.status = 500;
    ctx.body = { success: false, message: (err as Error).message };
  }
});

// ─── 删除当前用户的评价  DELETE /api/agents/:slug/reviews ────────────────────

reviewRouter.delete('/agents/:slug/reviews', requireAuth, async (ctx) => {
  try {
    const { slug } = ctx.params;
    const user = ctx.state.user as AuthUser;

    await reviewService.deleteReview(slug, user.userId);

    ctx.body = { success: true, message: '评价已删除' };
  } catch (err: unknown) {
    ctx.status = 500;
    ctx.body = { success: false, message: (err as Error).message };
  }
});
