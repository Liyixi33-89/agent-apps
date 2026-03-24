import mongoose, { Document, Schema } from 'mongoose';

/**
 * SystemPrompt — 系统提示词配置表
 *
 * key 命名规范：
 *   vibe_chat              → Vibe Coding 单轮对话系统提示
 *   pipeline_analyst       → Pipeline Step1 需求分析 Agent
 *   pipeline_ui_builder    → Pipeline Step2 UI 骨架 Agent
 *   pipeline_logic_builder → Pipeline Step3 业务逻辑 Agent
 *   pipeline_integrator    → Pipeline Step4 整合优化 Agent
 */
export interface ISystemPrompt extends Document {
  /** 唯一标识，程序内部引用 */
  key: string;
  /** 分类：vibe | pipeline */
  category: 'vibe' | 'pipeline';
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

const systemPromptSchema = new Schema<ISystemPrompt>(
  {
    key:         { type: String, required: true, unique: true, trim: true },
    category:    { type: String, enum: ['vibe', 'pipeline'], required: true },
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
