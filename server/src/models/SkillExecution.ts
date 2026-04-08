/**
 * @file models/SkillExecution.ts
 * @description Skill 执行记录模型 — 可观测性（维度 10）
 *
 * 每次 Skill 执行生成一条记录，包含：
 *   - 输入参数
 *   - 每个步骤的执行详情（工具调用、LLM 调用、耗时、token 消耗）
 *   - 最终输出
 *   - 总耗时和状态
 *
 * 用途：
 *   1. 执行链路追踪和调试
 *   2. 性能分析（哪个步骤最慢）
 *   3. 成功率统计（哪个步骤最容易失败）
 *   4. Token 消耗统计（成本控制）
 *   5. Prompt 优化依据（对比不同版本的效果）
 */

import mongoose, { Document, Schema } from 'mongoose';

// =============================================================================
// 类型定义
// =============================================================================

/** 步骤执行状态 */
export type StepExecStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'timeout';

/** 整体执行状态 */
export type ExecStatus = 'running' | 'success' | 'failed' | 'timeout' | 'cancelled';

/** 触发方式 */
export type TriggerMethod = 'keyword' | 'pattern' | 'context_rule' | 'llm_classify' | 'manual' | 'api';

/** 步骤执行详情 */
export interface IStepExecution {
  /** 步骤 ID */
  stepId: string;
  /** 步骤类型 */
  stepType: string;
  /** 步骤标签 */
  stepLabel: string;
  /** 执行状态 */
  status: StepExecStatus;
  /** 开始时间 */
  startedAt: Date;
  /** 结束时间 */
  finishedAt?: Date;
  /** 耗时（ms） */
  duration: number;

  // ── 工具调用详情 ──
  /** 调用的工具名称 */
  toolName?: string;
  /** 工具输入参数 */
  toolInput?: Record<string, unknown>;
  /** 工具是否调用成功 */
  toolSuccess?: boolean;

  // ── LLM 调用详情 ──
  /** 使用的 Prompt key 或模板摘要 */
  promptUsed?: string;
  /** Token 消耗 */
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** LLM 提供商 */
  llmProvider?: string;
  /** LLM 模型 */
  llmModel?: string;

  // ── 通用 ──
  /** 输入数据大小（字符数） */
  inputSize: number;
  /** 输出数据大小（字符数） */
  outputSize: number;
  /** 输出数据摘要（前 500 字符） */
  outputSummary: string;
  /** 错误信息 */
  error?: string;
  /** 重试次数 */
  retryCount: number;
}

/** Skill 执行记录文档 */
export interface ISkillExecution extends Document {
  /** 执行唯一 ID */
  executionId: string;
  /** Skill key */
  skillKey: string;
  /** Skill 名称（冗余存储，方便查询） */
  skillName: string;
  /** Skill 版本号 */
  skillVersion: string;
  /** A/B 测试分组 */
  abTestGroup: string;

  /** 触发方式 */
  triggerMethod: TriggerMethod;
  /** 触发匹配的关键词/模式 */
  triggerMatch: string;

  /** 关联的会话 ID（如果从 Chat 触发） */
  sessionId?: string;
  /** 用户标识 */
  userId?: string;

  /** 输入参数 */
  input: Record<string, unknown>;
  /** 最终输出（前 2000 字符） */
  output: string;

  /** 每个步骤的执行详情 */
  stepExecutions: IStepExecution[];

  /** 整体状态 */
  status: ExecStatus;
  /** 总耗时（ms） */
  totalDuration: number;
  /** 总 Token 消耗 */
  totalTokens: number;
  /** 总步骤数 */
  totalSteps: number;
  /** 成功步骤数 */
  successSteps: number;
  /** 失败步骤数 */
  failedSteps: number;

  /** 错误信息（整体失败时） */
  error?: string;

  createdAt: Date;
}

// =============================================================================
// Mongoose Schema
// =============================================================================

const stepExecutionSchema = new Schema<IStepExecution>(
  {
    stepId:       { type: String, required: true },
    stepType:     { type: String, required: true },
    stepLabel:    { type: String, default: '' },
    status:       { type: String, enum: ['pending', 'running', 'success', 'failed', 'skipped', 'timeout'], default: 'pending' },
    startedAt:    { type: Date },
    finishedAt:   { type: Date },
    duration:     { type: Number, default: 0 },
    toolName:     { type: String },
    toolInput:    { type: Schema.Types.Mixed },
    toolSuccess:  { type: Boolean },
    promptUsed:   { type: String },
    tokenUsage:   {
      promptTokens:     { type: Number, default: 0 },
      completionTokens: { type: Number, default: 0 },
      totalTokens:      { type: Number, default: 0 },
    },
    llmProvider:  { type: String },
    llmModel:     { type: String },
    inputSize:    { type: Number, default: 0 },
    outputSize:   { type: Number, default: 0 },
    outputSummary:{ type: String, default: '' },
    error:        { type: String },
    retryCount:   { type: Number, default: 0 },
  },
  { _id: false }
);

const skillExecutionSchema = new Schema<ISkillExecution>(
  {
    executionId:    { type: String, required: true, unique: true },
    skillKey:       { type: String, required: true, index: true },
    skillName:      { type: String, default: '' },
    skillVersion:   { type: String, default: '1.0.0' },
    abTestGroup:    { type: String, default: '' },
    triggerMethod:  { type: String, enum: ['keyword', 'pattern', 'context_rule', 'llm_classify', 'manual', 'api'], default: 'manual' },
    triggerMatch:   { type: String, default: '' },
    sessionId:      { type: String },
    userId:         { type: String },
    input:          { type: Schema.Types.Mixed, default: {} },
    output:         { type: String, default: '' },
    stepExecutions: { type: [stepExecutionSchema], default: [] },
    status:         { type: String, enum: ['running', 'success', 'failed', 'timeout', 'cancelled'], default: 'running' },
    totalDuration:  { type: Number, default: 0 },
    totalTokens:    { type: Number, default: 0 },
    totalSteps:     { type: Number, default: 0 },
    successSteps:   { type: Number, default: 0 },
    failedSteps:    { type: Number, default: 0 },
    error:          { type: String },
  },
  { timestamps: true }
);

// 索引：按时间倒序查询 + 按 Skill 统计
skillExecutionSchema.index({ createdAt: -1 });
skillExecutionSchema.index({ skillKey: 1, createdAt: -1 });
skillExecutionSchema.index({ sessionId: 1 });
// TTL 索引：自动清理 30 天前的执行记录
skillExecutionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

export const SkillExecution =
  mongoose.models.SkillExecution ||
  mongoose.model<ISkillExecution>('SkillExecution', skillExecutionSchema);
