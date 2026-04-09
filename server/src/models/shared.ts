/**
 * @file models/shared.ts
 * @description 共享 Mongoose Schema 和工具函数
 *
 * 解决以下重复问题：
 *   - localizedTextSchema 在 Agent/Category/Pipeline/KnowledgeBase 中重复定义 4 次
 *   - getPrompt() 在 agents/chat/vibePipeline/vibeFullStackPipeline 中重复定义 4 次
 *   - SSE 样板代码在 6 个路由文件中重复
 */

import { Schema } from 'mongoose';
import type { ServerResponse } from 'node:http';
import type Koa from 'koa';

// =============================================================================
// 共享 Mongoose Schema
// =============================================================================

export interface ILocalizedText {
  zh: string;
  en: string;
}

/** 双语文本 Schema — 所有 Model 共用，不再各自重复定义 */
export const localizedTextSchema = new Schema<ILocalizedText>(
  { zh: { type: String, default: '' }, en: { type: String, default: '' } },
  { _id: false }
);

// =============================================================================
// 共享 Prompt 读取工具
// =============================================================================

/**
 * 从数据库读取指定 key 的系统提示词内容
 * 若数据库中不存在（未初始化），返回 fallback 默认值
 *
 * 被 chat.ts / vibePipeline.ts / vibeFullStackPipeline.ts 共享使用
 */
export const getPrompt = async (key: string, fallback = ''): Promise<string> => {
  // 动态 import 避免循环依赖
  const { SystemPrompt } = await import('./SystemPrompt.js');
  const doc = await SystemPrompt.findOne({ key, isActive: true }).lean();
  return (doc as any)?.content ?? fallback;
};

// =============================================================================
// 共享 SSE 工具函数
// =============================================================================

export interface SSEContext {
  res: ServerResponse;
  send: (data: Record<string, unknown>) => void;
}

/**
 * 初始化 SSE 响应头并返回工具函数
 * 替代 6 个路由文件中重复的 SSE 样板代码
 */
export const initSSE = (ctx: Koa.Context): SSEContext => {
  ctx.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  ctx.status = 200;

  const res = ctx.res;
  const send = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  return { res, send };
};
