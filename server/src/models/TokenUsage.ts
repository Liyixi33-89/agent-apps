/**
 * @file models/TokenUsage.ts
 * @description Token 用量统计模型 — 持久化的 Token 消耗记录
 *
 * 用途：
 *   1. Token 用量仪表盘
 *   2. 成本分析（按 Provider / 模型 / 用户统计）
 *   3. 配额管理
 *   4. 趋势分析
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface ITokenUsage extends Document {
  /** 用户 ID */
  userId?: string;
  /** 用户名（冗余存储） */
  username?: string;
  /** 租户 ID */
  tenantId?: string;
  /** LLM Provider */
  provider: string;
  /** 模型名称 */
  modelName: string;
  /** 调用类型 */
  callType: 'chat' | 'skill' | 'pipeline' | 'vibe' | 'embedding' | 'agent_plan' | 'multi_agent' | 'other';
  /** Prompt Token 数 */
  promptTokens: number;
  /** Completion Token 数 */
  completionTokens: number;
  /** 总 Token 数 */
  totalTokens: number;
  /** 估算成本（美元） */
  estimatedCost: number;
  /** 关联的会话 ID */
  sessionId?: string;
  /** 关联的 Skill key */
  skillKey?: string;
  /** 请求耗时（ms） */
  duration: number;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  errorMessage?: string;
}

const tokenUsageSchema = new Schema<ITokenUsage>(
  {
    userId: { type: String, index: true },
    username: { type: String },
    tenantId: { type: String, index: true },
    provider: { type: String, required: true, index: true },
    modelName: { type: String, required: true },
    callType: {
      type: String,
      enum: ['chat', 'skill', 'pipeline', 'vibe', 'embedding', 'agent_plan', 'multi_agent', 'other'],
      default: 'other',
    },
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    estimatedCost: { type: Number, default: 0 },
    sessionId: { type: String },
    skillKey: { type: String },
    duration: { type: Number, default: 0 },
    success: { type: Boolean, default: true },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

// 索引
tokenUsageSchema.index({ createdAt: -1 });
tokenUsageSchema.index({ provider: 1, createdAt: -1 });
tokenUsageSchema.index({ userId: 1, createdAt: -1 });
tokenUsageSchema.index({ callType: 1, createdAt: -1 });
// TTL 索引：自动清理 90 天前的记录
tokenUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

export const TokenUsage = mongoose.models.TokenUsage || mongoose.model<ITokenUsage>('TokenUsage', tokenUsageSchema);

// =============================================================================
// 成本估算
// =============================================================================

/** 模型定价（每 1K token，美元） */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  // Claude
  'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
  'claude-3-5-haiku-20241022': { input: 0.0008, output: 0.004 },
  // Gemini
  'gemini-2.5-flash': { input: 0.00015, output: 0.0006 },
  'gemini-2.5-pro': { input: 0.00125, output: 0.005 },
  // DeepSeek
  'deepseek-chat': { input: 0.00014, output: 0.00028 },
  'deepseek-reasoner': { input: 0.00055, output: 0.00219 },
  // Embedding
  'text-embedding-3-small': { input: 0.00002, output: 0 },
  'text-embedding-3-large': { input: 0.00013, output: 0 },
};

/** 估算 Token 成本 */
export const estimateTokenCost = (model: string, promptTokens: number, completionTokens: number): number => {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (promptTokens / 1000) * pricing.input + (completionTokens / 1000) * pricing.output;
};

// =============================================================================
// 统计查询
// =============================================================================

/** 获取指定时间范围的 Token 用量统计 */
export const getTokenUsageStats = async (params: {
  startDate: Date;
  endDate: Date;
  userId?: string;
  tenantId?: string;
  groupBy?: 'provider' | 'model' | 'callType' | 'day';
}) => {
  const { startDate, endDate, userId, tenantId, groupBy = 'provider' } = params;

  const match: Record<string, unknown> = {
    createdAt: { $gte: startDate, $lte: endDate },
  };
  if (userId) match.userId = userId;
  if (tenantId) match.tenantId = tenantId;

  const groupField = groupBy === 'day'
    ? { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
    : `$${groupBy}`;

  const result = await TokenUsage.aggregate([
    { $match: match },
    {
      $group: {
        _id: groupField,
        totalTokens: { $sum: '$totalTokens' },
        promptTokens: { $sum: '$promptTokens' },
        completionTokens: { $sum: '$completionTokens' },
        totalCost: { $sum: '$estimatedCost' },
        callCount: { $sum: 1 },
        avgDuration: { $avg: '$duration' },
        successCount: { $sum: { $cond: ['$success', 1, 0] } },
      },
    },
    { $sort: { totalTokens: -1 } },
  ]);

  return result;
};

/** 获取今日 Token 用量概览 */
export const getTodayTokenOverview = async (tenantId?: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const match: Record<string, unknown> = {
    createdAt: { $gte: today, $lt: tomorrow },
  };
  if (tenantId) match.tenantId = tenantId;

  const [overview] = await TokenUsage.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalTokens: { $sum: '$totalTokens' },
        totalCost: { $sum: '$estimatedCost' },
        callCount: { $sum: 1 },
        avgDuration: { $avg: '$duration' },
        successRate: { $avg: { $cond: ['$success', 1, 0] } },
      },
    },
  ]);

  return overview || { totalTokens: 0, totalCost: 0, callCount: 0, avgDuration: 0, successRate: 1 };
};
