/**
 * @file models/AgentReview.ts
 * @description Agent 评价数据模型 — 用户对 Agent 的评分和文字评价
 *
 * 来源：v1.3.0 PRD 功能模块 1
 * 设计文档：version-doc/v1.3.0/design/be-agent-review.md
 */

import mongoose, { Document, Schema } from 'mongoose';

// ─── 接口定义 ──────────────────────────────────────────────────────────────────

export interface IAgentReview extends Document {
  agentSlug: string;
  userId: string;
  username: string;
  rating: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema 定义 ───────────────────────────────────────────────────────────────

const agentReviewSchema = new Schema<IAgentReview>(
  {
    agentSlug: { type: String, required: true, trim: true, index: true },
    userId: { type: String, required: true },
    username: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    content: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true }
);

// ─── 索引 ──────────────────────────────────────────────────────────────────────

// 唯一复合索引：一个用户对一个 Agent 只能有一条评价
agentReviewSchema.index({ agentSlug: 1, userId: 1 }, { unique: true });
// 查询索引：按时间倒序获取某个 Agent 的评价列表
agentReviewSchema.index({ agentSlug: 1, createdAt: -1 });

// ─── 导出 Model ────────────────────────────────────────────────────────────────

export const AgentReview =
  mongoose.models.AgentReview || mongoose.model<IAgentReview>('AgentReview', agentReviewSchema);
