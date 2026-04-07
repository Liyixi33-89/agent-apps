import mongoose, { Document, Schema } from 'mongoose';

/** Prompt 分类类型 */
export type PromptCategory =
  | 'vibe'               // Vibe Coding 对话/流式生成
  | 'pipeline'           // 固定 4 步 Pipeline
  | 'fullstack_pipeline' // 全栈 6 步 Pipeline
  | 'agent_plan'         // Agent 任务规划与执行
  | 'knowledge'          // 知识库 RAG
  | 'system';            // 通用系统级 Prompt

/**
 * SystemPrompt — 系统提示词配置表（Skill 管理）
 *
 * key 命名规范：
 *   vibe_chat                → Vibe Coding 多轮对话系统提示
 *   vibe_stream_react        → Vibe 流式生成（React 模式）
 *   vibe_stream_modify       → Vibe 流式生成（修改模式）
 *   vibe_stream_generate     → Vibe 流式生成（生成模式）
 *   pipeline_analyst         → Pipeline Step1 需求分析 Agent
 *   pipeline_designer        → Pipeline Step2 UI 设计 Agent
 *   pipeline_builder         → Pipeline Step3 代码生成 Agent
 *   pipeline_reviewer        → Pipeline Step4 质检优化 Agent
 *   fs_pipeline_analyst      → 全栈 Pipeline 需求分析
 *   fs_pipeline_db_architect → 全栈 Pipeline 数据库架构
 *   fs_pipeline_backend      → 全栈 Pipeline 后端工程
 *   fs_pipeline_frontend     → 全栈 Pipeline 前端工程
 *   fs_pipeline_reviewer     → 全栈 Pipeline 质检整合
 *   agent_planner            → Agent 任务规划师
 *   agent_executor           → Agent 步骤执行器
 *   agent_executor_react     → Agent 执行器（React 模式）
 *   agent_executor_html      → Agent 执行器（HTML 模式）
 *   knowledge_rag            → 知识库 RAG 问答
 *   knowledge_translate_en   → 知识库翻译（中→英）
 *   knowledge_translate_zh   → 知识库翻译（英→中）
 */
export interface ISystemPrompt extends Document {
  /** 唯一标识，程序内部引用 */
  key: string;
  /** 分类 */
  category: PromptCategory;
  /** 显示名称（中文） */
  name: string;
  /** 描述说明 */
  description: string;
  /** 提示词正文 */
  content: string;
  /** 是否启用 */
  isActive: boolean;
  /** 排序权重（同分类内升序） */
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const PROMPT_CATEGORIES: PromptCategory[] = [
  'vibe', 'pipeline', 'fullstack_pipeline', 'agent_plan', 'knowledge', 'system',
];

const systemPromptSchema = new Schema<ISystemPrompt>(
  {
    key:         { type: String, required: true, unique: true, trim: true },
    category:    { type: String, enum: PROMPT_CATEGORIES, required: true },
    name:        { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    content:     { type: String, required: true },
    isActive:    { type: Boolean, default: true },
    sortOrder:   { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const SystemPrompt =
  mongoose.models.SystemPrompt ||
  mongoose.model<ISystemPrompt>('SystemPrompt', systemPromptSchema);
