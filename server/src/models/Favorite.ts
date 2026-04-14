/**
 * @file models/Favorite.ts
 * @description 用户收藏 Agent 的数据模型
 *
 * v1.3.0 新增：Agent 收藏功能
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IFavorite extends Document {
  userId: mongoose.Types.ObjectId;
  agentId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const favoriteSchema = new Schema<IFavorite>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'Agent', required: true },
  },
  { timestamps: true }
);

// ─── 索引 ──────────────────────────────────────────────────────────────────────
// 联合唯一索引：防止重复收藏
favoriteSchema.index({ userId: 1, agentId: 1 }, { unique: true });
// 查询用户收藏列表（按时间倒序）
favoriteSchema.index({ userId: 1, createdAt: -1 });
// 统计 Agent 收藏数
favoriteSchema.index({ agentId: 1 });

export const Favorite = mongoose.models.Favorite || mongoose.model<IFavorite>('Favorite', favoriteSchema);
