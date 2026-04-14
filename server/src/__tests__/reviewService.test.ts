/**
 * @file __tests__/reviewService.test.ts
 * @description reviewService 单元测试
 *
 * 来源：v1.3.0 Story 1.2
 * 测试框架：Vitest（项目约定）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock 依赖 ─────────────────────────────────────────────────────────────────

// Mock AgentReview Model
const mockFindOneAndUpdate = vi.fn();
const mockFindOneAndDelete = vi.fn();
const mockFindOne = vi.fn();
const mockFind = vi.fn();
const mockCountDocuments = vi.fn();
const mockAggregate = vi.fn();

vi.mock('../models/AgentReview.js', () => ({
  AgentReview: {
    findOneAndUpdate: (...args: unknown[]) => mockFindOneAndUpdate(...args),
    findOneAndDelete: (...args: unknown[]) => mockFindOneAndDelete(...args),
    findOne: (...args: unknown[]) => ({ lean: () => mockFindOne(...args) }),
    find: (...args: unknown[]) => ({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            lean: () => mockFind(...args),
          }),
        }),
      }),
    }),
    countDocuments: (...args: unknown[]) => mockCountDocuments(...args),
    aggregate: (...args: unknown[]) => mockAggregate(...args),
  },
}));

// Mock Agent Model
const mockAgentFindOne = vi.fn();
const mockAgentFindOneAndUpdate = vi.fn();

vi.mock('../models/Agent.js', () => ({
  Agent: {
    findOne: (...args: unknown[]) => ({ select: () => ({ lean: () => mockAgentFindOne(...args) }) }),
    findOneAndUpdate: (...args: unknown[]) => mockAgentFindOneAndUpdate(...args),
  },
}));

// ─── 导入被测模块 ──────────────────────────────────────────────────────────────

import {
  submitReview,
  deleteReview,
  getReviews,
  getMyReview,
  recalculateRatingStats,
} from '../services/reviewService.js';

// ─── 测试用例 ──────────────────────────────────────────────────────────────────

describe('reviewService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('submitReview', () => {
    it('应该创建新评价并更新统计', async () => {
      const mockReview = {
        _id: 'review1',
        agentSlug: 'test-agent',
        userId: 'user1',
        username: 'testuser',
        rating: 5,
        content: '非常好用',
      };

      mockFindOneAndUpdate.mockResolvedValue(mockReview);
      mockAggregate.mockResolvedValue([{
        avgRating: 5,
        totalReviews: 1,
        dist1: 0, dist2: 0, dist3: 0, dist4: 0, dist5: 1,
      }]);
      mockAgentFindOneAndUpdate.mockResolvedValue({});

      const result = await submitReview('test-agent', 'user1', 'testuser', 5, '非常好用');

      expect(result).toEqual(mockReview);
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { agentSlug: 'test-agent', userId: 'user1' },
        { agentSlug: 'test-agent', userId: 'user1', username: 'testuser', rating: 5, content: '非常好用' },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    });

    it('应该在不提供 content 时使用空字符串', async () => {
      mockFindOneAndUpdate.mockResolvedValue({ rating: 4 });
      mockAggregate.mockResolvedValue([{
        avgRating: 4, totalReviews: 1,
        dist1: 0, dist2: 0, dist3: 0, dist4: 1, dist5: 0,
      }]);
      mockAgentFindOneAndUpdate.mockResolvedValue({});

      await submitReview('test-agent', 'user1', 'testuser', 4);

      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ content: '' }),
        expect.anything()
      );
    });
  });

  describe('deleteReview', () => {
    it('应该删除评价并更新统计', async () => {
      mockFindOneAndDelete.mockResolvedValue({});
      mockAggregate.mockResolvedValue([]);
      mockAgentFindOneAndUpdate.mockResolvedValue({});

      await deleteReview('test-agent', 'user1');

      expect(mockFindOneAndDelete).toHaveBeenCalledWith({
        agentSlug: 'test-agent',
        userId: 'user1',
      });
    });
  });

  describe('getReviews', () => {
    it('应该返回评价列表和统计信息', async () => {
      mockAgentFindOne.mockResolvedValue({
        ratingStats: { avgRating: 4.5, totalReviews: 10, distribution: [0, 1, 2, 3, 4] },
      });
      mockFind.mockResolvedValue([
        { _id: 'r1', rating: 5, username: 'user1', content: '好' },
        { _id: 'r2', rating: 4, username: 'user2', content: '不错' },
      ]);
      mockCountDocuments.mockResolvedValue(10);

      const result = await getReviews('test-agent', 1, 10);

      expect(result.stats.avgRating).toBe(4.5);
      expect(result.stats.totalReviews).toBe(10);
      expect(result.reviews).toHaveLength(2);
      expect(result.total).toBe(10);
    });

    it('Agent 不存在时应返回默认统计', async () => {
      mockAgentFindOne.mockResolvedValue(null);
      mockFind.mockResolvedValue([]);
      mockCountDocuments.mockResolvedValue(0);

      const result = await getReviews('nonexistent', 1, 10);

      expect(result.stats.avgRating).toBe(0);
      expect(result.stats.totalReviews).toBe(0);
      expect(result.reviews).toHaveLength(0);
    });
  });

  describe('getMyReview', () => {
    it('应该返回当前用户的评价', async () => {
      const mockReview = { _id: 'r1', rating: 5, content: '好' };
      mockFindOne.mockResolvedValue(mockReview);

      const result = await getMyReview('test-agent', 'user1');

      expect(result).toEqual(mockReview);
    });

    it('用户未评价时应返回 null', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await getMyReview('test-agent', 'user1');

      expect(result).toBeNull();
    });
  });

  describe('recalculateRatingStats', () => {
    it('应该正确计算平均分和分布', async () => {
      mockAggregate.mockResolvedValue([{
        avgRating: 4.333333,
        totalReviews: 3,
        dist1: 0, dist2: 0, dist3: 1, dist4: 1, dist5: 1,
      }]);
      mockAgentFindOneAndUpdate.mockResolvedValue({});

      await recalculateRatingStats('test-agent');

      expect(mockAgentFindOneAndUpdate).toHaveBeenCalledWith(
        { slug: 'test-agent' },
        {
          ratingStats: {
            avgRating: 4.3, // 保留一位小数
            totalReviews: 3,
            distribution: [0, 0, 1, 1, 1],
          },
        }
      );
    });

    it('无评价时应重置统计', async () => {
      mockAggregate.mockResolvedValue([]);
      mockAgentFindOneAndUpdate.mockResolvedValue({});

      await recalculateRatingStats('test-agent');

      expect(mockAgentFindOneAndUpdate).toHaveBeenCalledWith(
        { slug: 'test-agent' },
        {
          ratingStats: {
            avgRating: 0,
            totalReviews: 0,
            distribution: [0, 0, 0, 0, 0],
          },
        }
      );
    });
  });
});
