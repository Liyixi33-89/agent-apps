/**
 * @file components/ReviewForm.tsx
 * @description 评价提交表单组件 — 用户打分和写评价
 *
 * 来源：v1.3.0 PRD 功能模块 1
 */

import { useState, useEffect, useCallback } from 'react';
import { Rate, Input, Button, message, Popconfirm } from 'antd';
import { fetchMyReview, submitAgentReview, deleteAgentReview } from '../api';
import type { AgentReview } from '../types';

interface ReviewFormProps {
  agentSlug: string;
  onSubmitSuccess: () => void;
}

const ReviewForm: React.FC<ReviewFormProps> = ({ agentSlug, onSubmitSuccess }) => {
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [myReview, setMyReview] = useState<AgentReview | null>(null);
  const [loadingReview, setLoadingReview] = useState(true);

  const isLoggedIn = !!localStorage.getItem('token');

  // 加载已有评价
  const handleLoadMyReview = useCallback(async () => {
    if (!isLoggedIn) {
      setLoadingReview(false);
      return;
    }
    try {
      const review = await fetchMyReview(agentSlug);
      if (review) {
        setMyReview(review);
        setRating(review.rating);
        setContent(review.content || '');
      }
    } catch {
      // 未登录或无评价，忽略
    } finally {
      setLoadingReview(false);
    }
  }, [agentSlug, isLoggedIn]);

  useEffect(() => {
    handleLoadMyReview();
  }, [handleLoadMyReview]);

  // 提交评价
  const handleSubmit = async () => {
    if (rating === 0) {
      message.warning('请先选择评分');
      return;
    }
    setLoading(true);
    try {
      await submitAgentReview(agentSlug, { rating, content: content.trim() || undefined });
      message.success(myReview ? '评价已更新' : '评价提交成功');
      // 刷新我的评价
      const updated = await fetchMyReview(agentSlug);
      if (updated) setMyReview(updated);
      onSubmitSuccess();
    } catch {
      message.error('提交失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 删除评价
  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteAgentReview(agentSlug);
      message.success('评价已删除');
      setMyReview(null);
      setRating(0);
      setContent('');
      onSubmitSuccess();
    } catch {
      message.error('删除失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 未登录提示
  if (!isLoggedIn) {
    return (
      <div className="p-6 bg-white rounded-lg border border-gray-100 mt-4 text-center">
        <p className="text-gray-500 py-4">请先登录后评价</p>
      </div>
    );
  }

  if (loadingReview) {
    return (
      <div className="p-6 bg-white rounded-lg border border-gray-100 mt-4">
        <div className="animate-pulse h-20 bg-gray-100 rounded" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg border border-gray-100 mt-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {myReview ? '修改你的评价' : '写下你的评价'}
      </h3>

      {/* 评分选择 */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-600">评分：</span>
        <Rate
          value={rating}
          onChange={setRating}
          disabled={loading}
          className="text-lg"
        />
        {rating > 0 && (
          <span className="text-sm text-gray-400">
            {['', '很差', '较差', '一般', '不错', '非常好'][rating]}
          </span>
        )}
      </div>

      {/* 评价内容 */}
      <Input.TextArea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="写下你的使用感受...（可选）"
        maxLength={500}
        showCount
        rows={4}
        disabled={loading}
        className="mb-4"
      />

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        <Button
          type="primary"
          onClick={handleSubmit}
          loading={loading}
          disabled={rating === 0}
        >
          {myReview ? '更新评价' : '提交评价'}
        </Button>

        {myReview && (
          <Popconfirm
            title="确定删除评价？"
            description="删除后不可恢复"
            onConfirm={handleDelete}
            okText="确定"
            cancelText="取消"
          >
            <Button danger disabled={loading}>
              删除
            </Button>
          </Popconfirm>
        )}
      </div>
    </div>
  );
};

export default ReviewForm;
