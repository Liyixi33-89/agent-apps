/**
 * @file middleware/auth.ts
 * @description 认证与权限中间件
 *
 * 功能：
 *   1. JWT Token 验证
 *   2. RBAC 权限检查
 *   3. 多租户数据隔离
 *   4. API 限流
 */

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Role, type IPermission, type ResourceType, type PermissionAction } from '../models/Role.js';
import type Koa from 'koa';

// =============================================================================
// JWT 认证中间件
// =============================================================================

export interface AuthUser {
  userId: string;
  username: string;
  role: string;
  tenantId?: string;
  permissions: IPermission[];
}

/**
 * JWT 认证中间件 — 验证 Token 并加载用户权限
 */
export const requireAuth = async (ctx: Koa.Context, next: () => Promise<void>) => {
  const token = ctx.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    ctx.status = 401;
    ctx.body = { success: false, message: '未授权，请先登录' };
    return;
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as {
      userId: string;
      username: string;
      role: string;
      tenantId?: string;
    };

    // 加载角色权限
    const role = await Role.findOne({ key: decoded.role, isActive: true }).lean();
    const permissions: IPermission[] = (role as any)?.permissions || [];

    ctx.state.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
      tenantId: decoded.tenantId,
      permissions,
    } as AuthUser;

    await next();
  } catch {
    ctx.status = 401;
    ctx.body = { success: false, message: 'Token 无效或已过期' };
  }
};

// =============================================================================
// RBAC 权限检查中间件
// =============================================================================

/**
 * 检查用户是否拥有指定资源的指定操作权限
 *
 * @example
 * router.post('/agents', requireAuth, requirePermission('agent', 'create'), handler);
 */
export const requirePermission = (resource: ResourceType, action: PermissionAction) => {
  return async (ctx: Koa.Context, next: () => Promise<void>) => {
    const user = ctx.state.user as AuthUser | undefined;
    if (!user) {
      ctx.status = 401;
      ctx.body = { success: false, message: '未授权' };
      return;
    }

    // super_admin 拥有所有权限
    if (user.role === 'super_admin') {
      await next();
      return;
    }

    const hasPermission = user.permissions.some(
      p => p.resource === resource && (p.actions.includes(action) || p.actions.includes('manage'))
    );

    if (!hasPermission) {
      ctx.status = 403;
      ctx.body = {
        success: false,
        message: `权限不足：需要 ${resource}:${action} 权限`,
      };
      return;
    }

    await next();
  };
};

/**
 * 要求管理员角色（admin 或 super_admin）
 */
export const requireAdmin = async (ctx: Koa.Context, next: () => Promise<void>) => {
  const token = ctx.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    ctx.status = 401;
    ctx.body = { success: false, message: '未授权' };
    return;
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as {
      userId: string;
      username: string;
      role: string;
      tenantId?: string;
    };

    if (decoded.role !== 'admin' && decoded.role !== 'super_admin') {
      ctx.status = 403;
      ctx.body = { success: false, message: '权限不足，需要管理员角色' };
      return;
    }

    // 加载角色权限
    const role = await Role.findOne({ key: decoded.role, isActive: true }).lean();
    const permissions: IPermission[] = (role as any)?.permissions || [];

    ctx.state.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
      tenantId: decoded.tenantId,
      permissions,
    } as AuthUser;

    await next();
  } catch {
    ctx.status = 401;
    ctx.body = { success: false, message: 'Token 无效或已过期' };
  }
};

// =============================================================================
// 多租户数据隔离中间件
// =============================================================================

/**
 * 多租户数据隔离 — 自动为查询添加 tenantId 过滤
 * 仅在 MULTI_TENANT_ENABLED=true 时生效
 */
export const tenantIsolation = async (ctx: Koa.Context, next: () => Promise<void>) => {
  if (!env.multiTenantEnabled) {
    await next();
    return;
  }

  const user = ctx.state.user as AuthUser | undefined;
  if (user?.tenantId) {
    // 将 tenantId 注入到 state 中，供路由处理函数使用
    ctx.state.tenantFilter = { tenantId: user.tenantId };
  } else {
    ctx.state.tenantFilter = {};
  }

  await next();
};

// =============================================================================
// API 限流中间件
// =============================================================================

/** 限流记录：IP -> { count, resetTime } */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

/**
 * API 限流中间件
 * 基于 IP 地址的滑动窗口限流
 */
export const rateLimit = async (ctx: Koa.Context, next: () => Promise<void>) => {
  if (env.rateLimitPerMinute <= 0) {
    await next();
    return;
  }

  const ip = ctx.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60_000; // 1 分钟窗口

  let record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + windowMs };
    rateLimitMap.set(ip, record);
  }

  record.count++;

  if (record.count > env.rateLimitPerMinute) {
    ctx.status = 429;
    ctx.set('Retry-After', String(Math.ceil((record.resetTime - now) / 1000)));
    ctx.body = {
      success: false,
      message: `请求过于频繁，请 ${Math.ceil((record.resetTime - now) / 1000)} 秒后重试`,
    };
    return;
  }

  await next();
};

// 定期清理过期的限流记录
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap) {
    if (now > record.resetTime) rateLimitMap.delete(ip);
  }
}, 60_000);

// =============================================================================
// Token 配额检查中间件
// =============================================================================

/**
 * 检查用户 Token 配额
 * 在 LLM 调用前检查用户是否还有剩余配额
 */
export const checkTokenQuota = async (ctx: Koa.Context, next: () => Promise<void>) => {
  const user = ctx.state.user as AuthUser | undefined;
  if (!user) {
    await next();
    return;
  }

  // 全局配额检查
  if (env.userDailyTokenQuota > 0) {
    const dbUser = await User.findById(user.userId).lean();
    if (dbUser) {
      const today = new Date().toDateString();
      const userDoc = dbUser as any;
      if (userDoc.tokenResetDate !== today) {
        // 重置今日用量
        await User.findByIdAndUpdate(user.userId, {
          todayTokenUsed: 0,
          tokenResetDate: today,
        });
      } else if (userDoc.todayTokenUsed >= (userDoc.dailyTokenQuota || env.userDailyTokenQuota)) {
        ctx.status = 429;
        ctx.body = {
          success: false,
          message: '今日 Token 配额已用尽，请明天再试',
        };
        return;
      }
    }
  }

  await next();
};
