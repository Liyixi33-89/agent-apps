/**
 * @file components/ReviewList.tsx
 * @description 评价列表组件 — 展示评价列表和统计信息
 *
 * 来源：v1.3.0 PRD 功能模块 2
 */

import { useState, useEffect, useCallback } from 'react';
import { Rate, Pagination, Empty, Skeleton } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { fetchReviews } from '../api';
import ReviewStats from './ReviewStats';
import type { AgentReview, ReviewStatsData } from '../types';

interface ReviewListProps {
  agentSlug: string;
  refreshKey: number;
}

const ReviewList: React.FC<ReviewListProps> = ({ agentSlug, refreshKey }) => {
  const [reviews, setReviews] = useState<AgentReview[]>([]);
  const [stats, setStats] = useState<ReviewStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const handleLoad = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchReviews(agentSlug, { page, limit: 10 });
      setStats(result.data.stats);
      setReviews(result.data.reviews);
      setTotal(result.pagination.total);
    } catch {
      // 加载失败静默处理
    } finally {
      setLoading(false);
    }
  }, [agentSlug, page, refreshKey]);

  useEffect(() => {
    handleLoad();
  }, [handleLoad]);

  // refreshKey 变化时回到第一页
  useEffect(() => {
    setPage(1);
  }, [refreshKey]);

  if (loading && !stats) {
    return (
      <div className="mt-4 space-y-3">
        <Skeleton active paragraph={{ rows: 3 }} />
        <Skeleton active paragraph={{ rows: 2 }} />
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {/* 评分统计 */}
      {stats && stats.totalReviews > 0 && <ReviewStats stats={stats} />}

      {/* 评价列表 */}
      {reviews.length === 0 ? (
        <Empty
          description="暂无评价，成为第一个评价者吧！"
          className="py-8"
        />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div
              key={review._id}
              className="p-4 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center">
                    <UserOutlined className="text-sky-600 text-xs" />
                  </div>
                  <span className="font-medium text-gray-900 text-sm">
                    {review.username}
                  </span>
                  <Rate
                    disabled
                    value={review.rating}
                    className="text-xs"
                  />
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(review.createdAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
              {review.content && (
                <p className="text-sm text-gray-700 ml-9">
                  {review.content}
                </p>
              )}
            </div>
          ))}

          {/* 分页 */}
          {total > 10 && (
            <div className="flex justify-center pt-2">
              <Pagination
                current={page}
                pageSize={10}
                total={total}
                onChange={setPage}
                size="small"
                showTotal={(t) => `共 ${t} 条评价`}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReviewList;
