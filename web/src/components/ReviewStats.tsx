/**
 * @file components/ReviewStats.tsx
 * @description 评分统计展示组件 — 显示平均评分、评分人数和各星级分布
 *
 * 来源：v1.3.0 PRD 功能模块 2
 */

import { Rate, Progress } from 'antd';
import type { ReviewStatsData } from '../types';

interface ReviewStatsProps {
  stats: ReviewStatsData;
}

const STAR_LABELS = ['1 星', '2 星', '3 星', '4 星', '5 星'];

const ReviewStats: React.FC<ReviewStatsProps> = ({ stats }) => {
  const { avgRating, totalReviews, distribution } = stats;

  if (totalReviews === 0) return null;

  return (
    <div className="flex flex-col md:flex-row gap-6 items-start p-6 bg-white rounded-lg border border-gray-100">
      {/* 左侧：平均评分 */}
      <div className="flex flex-col items-center min-w-[120px]">
        <span className="text-5xl font-bold text-gray-900">
          {avgRating.toFixed(1)}
        </span>
        <Rate
          disabled
          allowHalf
          value={avgRating}
          className="text-sm mt-1"
        />
        <span className="text-sm text-gray-500 mt-1">
          {totalReviews} 人评价
        </span>
      </div>

      {/* 右侧：各星级分布 */}
      <div className="flex-1 w-full space-y-1.5">
        {[...distribution].reverse().map((count, reverseIndex) => {
          const starIndex = 4 - reverseIndex; // 5星→1星
          const percent = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
          return (
            <div key={starIndex} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-10 text-right">
                {STAR_LABELS[starIndex]}
              </span>
              <Progress
                percent={percent}
                showInfo={false}
                size="small"
                className="flex-1"
                strokeColor="#fadb14"
              />
              <span className="text-xs text-gray-400 w-10">
                {percent}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReviewStats;
