/**
 * @file models/AgentMemory.ts
 * @description Agent 记忆系统模型
 *
 * 支持三种记忆类型：
 *   1. 短期记忆（session）— 单次会话内的上下文
 *   2. 长期记忆（long_term）— 跨会话的用户偏好和事实
 *   3. 工作记忆（working）— 当前任务的中间状态
 */

import mongoose, { Document, Schema } from 'mongoose';

/** 记忆类型 */
export type MemoryType = 'session' | 'long_term' | 'working';

/** 记忆重要性级别 */
export type MemoryImportance = 'low' | 'medium' | 'high' | 'critical';

/** 记忆条目 */
export interface IMemoryEntry {
  /** 记忆唯一 ID */
  memoryId: string;
  /** 记忆类型 */
  type: MemoryType;
  /** 记忆内容 */
  content: string;
  /** 记忆摘要（用于快速检索） */
  summary: string;
  /** 重要性级别 */
  importance: MemoryImportance;
  /** 关联的标签 */
  tags: string[];
  /** 向量嵌入（用于语义检索） */
  embedding?: number[];
  /** 访问次数（用于遗忘曲线） */
  accessCount: number;
  /** 最后访问时间 */
  lastAccessedAt: Date;
  /** 创建时间 */
  createdAt: Date;
  /** 过期时间（null = 永不过期） */
  expiresAt?: Date;
}

/** Agent 记忆文档 */
export interface IAgentMemory extends Document {
  /** 关联的用户 ID */
  userId: string;
  /** 关联的 Agent slug（可选，全局记忆不关联特定 Agent） */
  agentSlug?: string;
  /** 关联的会话 ID（session 类型记忆） */
  sessionId?: string;
  /** 记忆条目列表 */
  memories: IMemoryEntry[];
  /** 记忆统计 */
  stats: {
    totalMemories: number;
    sessionMemories: number;
    longTermMemories: number;
    workingMemories: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const memoryEntrySchema = new Schema<IMemoryEntry>(
  {
    memoryId: { type: String, required: true },
    type: { type: String, enum: ['session', 'long_term', 'working'], required: true },
    content: { type: String, required: true },
    summary: { type: String, default: '' },
    importance: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    tags: { type: [String], default: [] },
    embedding: { type: [Number], default: undefined },
    accessCount: { type: Number, default: 0 },
    lastAccessedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
  },
  { _id: false }
);

const agentMemorySchema = new Schema<IAgentMemory>(
  {
    userId: { type: String, required: true, index: true },
    agentSlug: { type: String, index: true },
    sessionId: { type: String, index: true },
    memories: { type: [memoryEntrySchema], default: [] },
    stats: {
      totalMemories: { type: Number, default: 0 },
      sessionMemories: { type: Number, default: 0 },
      longTermMemories: { type: Number, default: 0 },
      workingMemories: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// 复合索引
agentMemorySchema.index({ userId: 1, agentSlug: 1 });
agentMemorySchema.index({ userId: 1, sessionId: 1 });
// TTL 索引：自动清理过期的 session 记忆（7 天）
agentMemorySchema.index({ 'memories.expiresAt': 1 }, { expireAfterSeconds: 0 });

export const AgentMemory = mongoose.models.AgentMemory || mongoose.model<IAgentMemory>('AgentMemory', agentMemorySchema);
