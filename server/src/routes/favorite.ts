/**
 * @file routes/favorite.ts
 * @description 收藏相关 API 路由
 *
 * v1.3.0 新增：Agent 收藏功能
 *
 * 端点：
 *   POST   /api/favorites       — 收藏 Agent
 *   DELETE /api/favorites/:agentId — 取消收藏
 *   GET    /api/favorites       — 获取我的收藏列表
 *   GET    /api/favorites/check — 批量检查收藏状态
 */

import Router from '@koa/router';
import { Favorite } from '../models/Favorite.js';
import { Agent } from '../models/Agent.js';
import { requireAuth, type AuthUser } from '../middleware/auth.js';
import mongoose from 'mongoose';

const router = new Router({ prefix: '/api/favorites' });

// ─── POST /api/favorites — 收藏 Agent ──────────────────────────────────────────

router.post('/', requireAuth, async (ctx) => {
  const user = ctx.state.user as AuthUser;
  const { agentId } = ctx.request.body as { agentId?: string };

  if (!agentId) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少 agentId 参数' };
    return;
  }

  // 验证 Agent 存在
  const agent = await Agent.findById(agentId).lean();
  if (!agent) {
    ctx.status = 404;
    ctx.body = { success: false, message: 'Agent 不存在' };
    return;
  }

  try {
    // 创建收藏记录
    const favorite = await Favorite.create({
      userId: new mongoose.Types.ObjectId(user.userId),
      agentId: new mongoose.Types.ObjectId(agentId),
    });

    // 原子递增收藏数
    await Agent.findByIdAndUpdate(agentId, { $inc: { favoriteCount: 1 } });

    ctx.status = 201;
    ctx.body = {
      success: true,
      data: {
        favoriteId: favorite._id,
        agentId,
        createdAt: favorite.createdAt,
      },
    };
  } catch (err: any) {
    // 联合唯一索引冲突 → 已收藏
    if (err.code === 11000) {
      ctx.status = 409;
      ctx.body = { success: false, message: '已收藏该 Agent' };
      return;
    }
    throw err;
  }
});

// ─── DELETE /api/favorites/:agentId — 取消收藏 ─────────────────────────────────

router.delete('/:agentId', requireAuth, async (ctx) => {
  const user = ctx.state.user as AuthUser;
  const { agentId } = ctx.params;

  const result = await Favorite.findOneAndDelete({
    userId: new mongoose.Types.ObjectId(user.userId),
    agentId: new mongoose.Types.ObjectId(agentId),
  });

  if (!result) {
    ctx.status = 404;
    ctx.body = { success: false, message: '未收藏该 Agent' };
    return;
  }

  // 原子递减收藏数（防止负数）
  await Agent.findByIdAndUpdate(agentId, {
    $inc: { favoriteCount: -1 },
  });
  // 修正可能的负数
  await Agent.updateOne(
    { _id: agentId, favoriteCount: { $lt: 0 } },
    { $set: { favoriteCount: 0 } }
  );

  ctx.body = { success: true };
});

// ─── GET /api/favorites — 获取我的收藏列表 ──────────────────────────────────────

router.get('/', requireAuth, async (ctx) => {
  const user = ctx.state.user as AuthUser;
  const page = Math.max(1, Number(ctx.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(ctx.query.limit) || 20));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Favorite.find({ userId: new mongoose.Types.ObjectId(user.userId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('agentId', 'slug name description emoji color tags favoriteCount')
      .lean(),
    Favorite.countDocuments({ userId: new mongoose.Types.ObjectId(user.userId) }),
  ]);

  ctx.body = {
    success: true,
    data: {
      items: items.map((item: any) => ({
        favoriteId: item._id,
        agent: item.agentId,
        createdAt: item.createdAt,
      })),
      total,
      page,
      limit,
    },
  };
});

// ─── GET /api/favorites/check — 批量检查收藏状态 ────────────────────────────────

router.get('/check', requireAuth, async (ctx) => {
  const user = ctx.state.user as AuthUser;
  const agentIdsStr = (ctx.query.agentIds as string) || '';

  if (!agentIdsStr) {
    ctx.body = { success: true, data: {} };
    return;
  }

  const agentIds = agentIdsStr.split(',').filter(Boolean);
  const favorites = await Favorite.find({
    userId: new mongoose.Types.ObjectId(user.userId),
    agentId: { $in: agentIds.map(id => new mongoose.Types.ObjectId(id)) },
  }).lean();

  const favoriteSet = new Set(favorites.map((f: any) => f.agentId.toString()));
  const result: Record<string, boolean> = {};
  for (const id of agentIds) {
    result[id] = favoriteSet.has(id);
  }

  ctx.body = { success: true, data: result };
});

export const favoriteRouter = router;
