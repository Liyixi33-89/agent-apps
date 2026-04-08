/**
 * @file models/Skill.ts
 * @description Skill 数据模型 — 可编排的能力单元
 *
 * Skill 是 Tool 和 Agent 之间的编排层，将多个 Tool + Prompt + 逻辑编排
 * 组合成一个可复用的业务能力单元。
 *
 * 设计维度覆盖：
 *   维度 2 — 数据模型：steps + triggers + inputSchema + config
 *   维度 8 — 版本与灰度：version + isActive + abTestGroup
 *   维度 9 — 组合与依赖：dependsOn 声明式依赖
 */

import mongoose, { Document, Schema } from 'mongoose';

// =============================================================================
// 类型定义
// =============================================================================

/** Skill 分类 */
export type SkillCategory =
  | 'research'    // 调研类：网页搜索、信息收集
  | 'coding'      // 编码类：代码生成、审查、重构
  | 'analysis'    // 分析类：数据分析、竞品分析
  | 'creative'    // 创意类：翻译、写作、设计
  | 'workflow'    // 流程类：审批、通知、集成
  | 'custom';     // 用户自定义

/** Skill 步骤类型 */
export type SkillStepType =
  | 'tool'        // 调用工具（内置 / MCP）
  | 'llm'         // 调用 LLM（流式/非流式）
  | 'condition'   // 条件分支
  | 'transform'   // 数据转换（JS 表达式）
  | 'parallel';   // 并行执行多个子步骤

/** Skill 步骤定义 */
export interface ISkillStep {
  /** 步骤唯一 ID，如 "step_1"、"fetch"、"summarize" */
  id: string;
  /** 步骤类型 */
  type: SkillStepType;
  /** 步骤显示名称 */
  label: string;

  // ── type = 'tool' ──
  /** 工具名称（内置工具名 或 MCP 工具名如 "mcp_fetch_fetch"） */
  toolName?: string;
  /** 工具参数，支持模板变量如 "{{input.url}}"、"{{steps.fetch.data}}" */
  toolArgs?: Record<string, string>;

  // ── type = 'llm' ──
  /** 引用 SystemPrompt 表的 key（优先级高于 promptTemplate） */
  promptKey?: string;
  /** 直接写 Prompt 模板，支持模板变量 */
  promptTemplate?: string;
  /** LLM 调用选项 */
  llmOptions?: {
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  };

  // ── type = 'condition' ──
  /** 条件表达式，如 "{{steps.fetch.success}} === true" */
  condition?: string;
  /** 条件为真时跳转的步骤 ID */
  ifTrue?: string;
  /** 条件为假时跳转的步骤 ID */
  ifFalse?: string;

  // ── type = 'transform' ──
  /** JS 表达式，如 "JSON.parse({{steps.fetch.data}}).slice(0, 3)" */
  transformExpr?: string;

  // ── type = 'parallel' ──
  /** 并行执行的步骤 ID 列表 */
  parallelStepIds?: string[];

  // ── 通用字段 ──
  /** 输入映射：将上下文中的值映射到本步骤的输入 */
  inputMapping?: Record<string, string>;
  /** 输出存储的 key，执行结果会存入 context.steps[outputKey] */
  outputKey: string;
  /** 失败时是否继续执行后续步骤 */
  optional: boolean;
  /** 单步超时时间（ms），0 表示使用全局配置 */
  timeout: number;
  /** 单步最大重试次数 */
  retryCount: number;
}

/** Skill 触发条件 */
export interface ISkillTrigger {
  /** 关键词触发（L1 级别，零成本） */
  keywords: string[];
  /** 正则模式触发（L2 级别，低成本） */
  patterns: string[];
  /** 上下文规则（L2 级别，如 "消息中包含URL"） */
  contextRules: string[];
  /** LLM 意图描述（L3 级别，高成本，仅在 L1/L2 不确定时使用） */
  intentDescription: string;
}

/** Skill 运行配置 */
export interface ISkillConfig {
  /** 全局超时时间（ms），默认 30000 */
  timeout: number;
  /** 全局失败重试次数，默认 1 */
  retryCount: number;
  /** 结果缓存 TTL（秒），0 = 不缓存 */
  cacheTTL: number;
  /** 最大并发步骤数，默认 3 */
  concurrency: number;
  /** 是否支持流式输出（最后一个 LLM 步骤流式推送） */
  streamOutput: boolean;
}

/** Skill 输入 Schema（JSON Schema 子集） */
export interface ISkillInputSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description: string;
    default?: unknown;
    enum?: string[];
  }>;
  required: string[];
}

/** Skill 版本信息（维度 8） */
export interface ISkillVersion {
  /** 版本号，如 "1.0.0"、"1.1.0" */
  version: string;
  /** 变更说明 */
  changelog: string;
  /** 该版本的 steps 快照（用于版本回退） */
  stepsSnapshot: ISkillStep[];
  /** 创建时间 */
  createdAt: Date;
}

/** Skill 文档接口 */
export interface ISkill extends Document {
  // ── 基础信息 ──
  /** 唯一标识，如 "web_research"、"code_review" */
  key: string;
  /** 显示名称 */
  name: string;
  /** 给 LLM 看的描述（决定何时触发） */
  description: string;
  /** 图标 emoji */
  icon: string;
  /** 分类 */
  category: SkillCategory;

  // ── 输入输出 ──
  /** 输入参数 Schema */
  inputSchema: ISkillInputSchema;
  /** 输出描述 */
  outputDescription: string;

  // ── 执行编排（维度 3）──
  /** 有序的执行步骤列表 */
  steps: ISkillStep[];

  // ── 触发条件（维度 4）──
  /** 触发条件配置 */
  triggers: ISkillTrigger;

  // ── 运行配置 ──
  /** 运行时配置 */
  config: ISkillConfig;

  // ── 组合与依赖（维度 9）──
  /** 声明式依赖：本 Skill 依赖哪些其他 Skill 的输出 */
  dependsOn: string[];

  // ── 版本与灰度（维度 8）──
  /** 当前版本号 */
  version: string;
  /** 历史版本列表（用于回退） */
  versions: ISkillVersion[];
  /** A/B 测试分组标识（空字符串 = 不参与 A/B 测试） */
  abTestGroup: string;

  // ── 元数据 ──
  /** 是否启用 */
  isActive: boolean;
  /** 是否为内置 Skill（内置 Skill 不可删除） */
  isBuiltin: boolean;
  /** 排序权重 */
  sortOrder: number;
  /** 累计调用次数 */
  usageCount: number;
  /** 平均执行耗时（ms） */
  avgDuration: number;
  /** 成功率（0-1） */
  successRate: number;

  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Mongoose Schema
// =============================================================================

const SKILL_CATEGORIES: SkillCategory[] = [
  'research', 'coding', 'analysis', 'creative', 'workflow', 'custom',
];

const STEP_TYPES: SkillStepType[] = [
  'tool', 'llm', 'condition', 'transform', 'parallel',
];

const skillStepSchema = new Schema<ISkillStep>(
  {
    id:              { type: String, required: true },
    type:            { type: String, enum: STEP_TYPES, required: true },
    label:           { type: String, required: true },
    toolName:        { type: String },
    toolArgs:        { type: Schema.Types.Mixed },
    promptKey:       { type: String },
    promptTemplate:  { type: String },
    llmOptions:      {
      temperature: { type: Number },
      maxTokens:   { type: Number },
      stream:      { type: Boolean },
    },
    condition:       { type: String },
    ifTrue:          { type: String },
    ifFalse:         { type: String },
    transformExpr:   { type: String },
    parallelStepIds: { type: [String] },
    inputMapping:    { type: Schema.Types.Mixed },
    outputKey:       { type: String, required: true },
    optional:        { type: Boolean, default: false },
    timeout:         { type: Number, default: 0 },
    retryCount:      { type: Number, default: 0 },
  },
  { _id: false }
);

const skillTriggerSchema = new Schema<ISkillTrigger>(
  {
    keywords:          { type: [String], default: [] },
    patterns:          { type: [String], default: [] },
    contextRules:      { type: [String], default: [] },
    intentDescription: { type: String, default: '' },
  },
  { _id: false }
);

const skillConfigSchema = new Schema<ISkillConfig>(
  {
    timeout:      { type: Number, default: 30000 },
    retryCount:   { type: Number, default: 1 },
    cacheTTL:     { type: Number, default: 0 },
    concurrency:  { type: Number, default: 3 },
    streamOutput: { type: Boolean, default: true },
  },
  { _id: false }
);

const skillInputSchemaSchema = new Schema(
  {
    type:       { type: String, default: 'object' },
    properties: { type: Schema.Types.Mixed, default: {} },
    required:   { type: [String], default: [] },
  },
  { _id: false }
);

const skillVersionSchema = new Schema<ISkillVersion>(
  {
    version:       { type: String, required: true },
    changelog:     { type: String, default: '' },
    stepsSnapshot: { type: [skillStepSchema], default: [] },
    createdAt:     { type: Date, default: Date.now },
  },
  { _id: false }
);

const skillSchema = new Schema<ISkill>(
  {
    key:               { type: String, required: true, unique: true, trim: true },
    name:              { type: String, required: true, trim: true },
    description:       { type: String, required: true },
    icon:              { type: String, default: '⚡' },
    category:          { type: String, enum: SKILL_CATEGORIES, required: true },
    inputSchema:       { type: skillInputSchemaSchema, default: () => ({ type: 'object', properties: {}, required: [] }) },
    outputDescription: { type: String, default: '' },
    steps:             { type: [skillStepSchema], default: [] },
    triggers:          { type: skillTriggerSchema, default: () => ({ keywords: [], patterns: [], contextRules: [], intentDescription: '' }) },
    config:            { type: skillConfigSchema, default: () => ({ timeout: 30000, retryCount: 1, cacheTTL: 0, concurrency: 3, streamOutput: true }) },
    dependsOn:         { type: [String], default: [] },
    version:           { type: String, default: '1.0.0' },
    versions:          { type: [skillVersionSchema], default: [] },
    abTestGroup:       { type: String, default: '' },
    isActive:          { type: Boolean, default: true },
    isBuiltin:         { type: Boolean, default: false },
    sortOrder:         { type: Number, default: 0 },
    usageCount:        { type: Number, default: 0 },
    avgDuration:       { type: Number, default: 0 },
    successRate:       { type: Number, default: 1 },
  },
  { timestamps: true }
);

// 索引
skillSchema.index({ category: 1, isActive: 1 });
skillSchema.index({ 'triggers.keywords': 1 });

export const Skill = mongoose.models.Skill || mongoose.model<ISkill>('Skill', skillSchema);
