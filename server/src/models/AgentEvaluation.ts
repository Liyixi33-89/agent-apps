/**
 * @file models/AgentEvaluation.ts
 * @description Agent 评估模型 — 记录 Agent 输出质量评分和用户反馈
 *
 * 功能：
 *   1. 用户对 Agent 回答的评分（1-5 星）
 *   2. 用户文字反馈
 *   3. 自动质量评估（LLM 评分）
 *   4. 统计分析（平均分、趋势等）
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IAgentEvaluation extends Document {
  /** 关联的 Agent slug */
  agentSlug: string;
  /** 关联的聊天会话 ID */
  chatId?: string;
  /** 关联的消息 ID */
  messageId?: string;
  /** 评估类型 */
  evaluationType: 'user_rating' | 'user_feedback' | 'auto_quality';
  /** 用户评分（1-5） */
  rating?: number;
  /** 用户文字反馈 */
  feedback?: string;
  /** 自动评估维度分数 */
  qualityScores?: {
    /** 相关性（0-1） */
    relevance: number;
    /** 准确性（0-1） */
    accuracy: number;
    /** 完整性（0-1） */
    completeness: number;
    /** 可读性（0-1） */
    readability: number;
    /** 综合得分（0-1） */
    overall: number;
  };
  /** 用户输入（问题） */
  userInput: string;
  /** Agent 输出（回答） */
  agentOutput: string;
  /** 评估者 */
  evaluatedBy?: string;
  /** 使用的 Provider */
  provider?: string;
  /** 使用的模型 */
  model?: string;
  /** 标签 */
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const qualityScoresSchema = new Schema(
  {
    relevance: { type: Number, min: 0, max: 1, default: 0 },
    accuracy: { type: Number, min: 0, max: 1, default: 0 },
    completeness: { type: Number, min: 0, max: 1, default: 0 },
    readability: { type: Number, min: 0, max: 1, default: 0 },
    overall: { type: Number, min: 0, max: 1, default: 0 },
  },
  { _id: false }
);

const agentEvaluationSchema = new Schema<IAgentEvaluation>(
  {
    agentSlug: { type: String, required: true, index: true },
    chatId: { type: String, index: true },
    messageId: { type: String },
    evaluationType: {
      type: String,
      enum: ['user_rating', 'user_feedback', 'auto_quality'],
      required: true,
    },
    rating: { type: Number, min: 1, max: 5 },
    feedback: { type: String },
    qualityScores: { type: qualityScoresSchema },
    userInput: { type: String, required: true },
    agentOutput: { type: String, required: true },
    evaluatedBy: { type: String },
    provider: { type: String },
    model: { type: String },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

// 索引：按 Agent + 时间查询
agentEvaluationSchema.index({ agentSlug: 1, createdAt: -1 });
// TTL：90 天自动清理
agentEvaluationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

export const AgentEvaluation =
  mongoose.models.AgentEvaluation ||
  mongoose.model<IAgentEvaluation>('AgentEvaluation', agentEvaluationSchema);
