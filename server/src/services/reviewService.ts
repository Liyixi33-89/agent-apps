/**
 * @file services/reviewService.ts
 * @description Agent 评价业务逻辑 — 提交、删除、统计计算
 *
 * 来源：v1.3.0 PRD 功能模块 1, 2
 * 设计文档：version-doc/v1.3.0/design/be-agent-review.md
 */

import { AgentReview, type IAgentReview } from '../models/AgentReview.js';
import { Agent } from '../models/Agent.js';

/**
 * 提交或更新评价（upsert）
 */
export const submitReview = async (
  agentSlug: string,
  userId: string,
  username: string,
  rating: number,
  content?: string
): Promise<IAgentReview> => {
  const review = await AgentReview.findOneAndUpdate(
    { agentSlug, userId },
    { agentSlug, userId, username, rating, content: content || '' },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await recalculateRatingStats(agentSlug);
  return review;
};

/**
 * 删除评价
 */
export const deleteReview = async (agentSlug: string, userId: string): Promise<void> => {
  await AgentReview.findOneAndDelete({ agentSlug, userId });
  await recalculateRatingStats(agentSlug);
};

/**
 * 获取评价列表 + 统计信息
 */
export const getReviews = async (
  agentSlug: string,
  page: number = 1,
  limit: number = 10
): Promise<{
  stats: { avgRating: number; totalReviews: number; distribution: number[] };
  reviews: IAgentReview[];
  total: number;
}> => {
  const skip = (page - 1) * limit;

  // 从 Agent 文档读取缓存的统计信息
  const agent = await Agent.findOne({ slug: agentSlug }).select('ratingStats').lean();
  const stats = (agent as Record<string, unknown>)?.ratingStats as {
    avgRating: number;
    totalReviews: number;
    distribution: number[];
  } || { avgRating: 0, totalReviews: 0, distribution: [0, 0, 0, 0, 0] };

  // 查询评价列表
  const [reviews, total] = await Promise.all([
    AgentReview.find({ agentSlug })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AgentReview.countDocuments({ agentSlug }),
  ]);

  return { stats, reviews: reviews as unknown as IAgentReview[], total };
};

/**
 * 获取当前用户对某个 Agent 的评价
 */
export const getMyReview = async (
  agentSlug: string,
  userId: string
): Promise<IAgentReview | null> => {
  return AgentReview.findOne({ agentSlug, userId }).lean() as Promise<IAgentReview | null>;
};

/**
 * 重新计算并更新 Agent 的评分统计
 * 使用 MongoDB 聚合管道计算 avgRating、totalReviews、distribution
 */
export const recalculateRatingStats = async (agentSlug: string): Promise<void> => {
  const result = await AgentReview.aggregate([
    { $match: { agentSlug } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        dist1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
        dist2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
        dist3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
        dist4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
        dist5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
      },
    },
  ]);

  if (result.length > 0) {
    const { avgRating, totalReviews, dist1, dist2, dist3, dist4, dist5 } = result[0];
    await Agent.findOneAndUpdate(
      { slug: agentSlug },
      {
        ratingStats: {
          avgRating: Math.round(avgRating * 10) / 10, // 保留一位小数
          totalReviews,
          distribution: [dist1, dist2, dist3, dist4, dist5],
        },
      }
    );
  } else {
    // 没有评价时重置统计
    await Agent.findOneAndUpdate(
      { slug: agentSlug },
      { ratingStats: { avgRating: 0, totalReviews: 0, distribution: [0, 0, 0, 0, 0] } }
    );
  }
};
