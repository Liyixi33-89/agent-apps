/**
 * @file components/FavoriteButton.tsx
 * @description 收藏按钮组件 — 支持收藏/取消收藏 Agent
 *
 * v1.3.0 新增：Agent 收藏功能
 */

import React, { useState, useCallback, useRef } from 'react';
import { StarOutlined, StarFilled, LoadingOutlined } from '@ant-design/icons';
import { message } from 'antd';
import { useStore } from '../store';

// ─── 收藏数格式化 ──────────────────────────────────────────────────────────────

const formatFavoriteCount = (count: number): string => {
  if (count <= 0) return '';
  if (count < 1000) return String(count);
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  return `${Math.floor(count / 1000)}k`;
};

// ─── API 封装 ──────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';

const favoriteApi = {
  add: async (agentId: string, token: string) => {
    const res = await fetch(`${API_BASE}/api/favorites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ agentId }),
    });
    return res.json();
  },
  remove: async (agentId: string, token: string) => {
    const res = await fetch(`${API_BASE}/api/favorites/${agentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  },
};

// ─── 组件 Props ────────────────────────────────────────────────────────────────

interface FavoriteButtonProps {
  agentId: string;
  initialFavorited?: boolean;
  initialCount?: number;
  showCount?: boolean;
  showText?: boolean;
  size?: 'small' | 'default';
  onToggle?: (favorited: boolean) => void;
}

// ─── 组件实现 ──────────────────────────────────────────────────────────────────

const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  agentId,
  initialFavorited = false,
  initialCount = 0,
  showCount = false,
  showText = false,
  size = 'small',
  onToggle,
}) => {
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [count, setCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<number>(0);

  const token = useStore((s) => s.token);
  const isLoggedIn = !!token;

  const handleToggle = useCallback(async () => {
    // 防抖：300ms 内重复点击忽略
    const now = Date.now();
    if (now - debounceRef.current < 300) return;
    debounceRef.current = now;

    // 未登录检查
    if (!isLoggedIn) {
      message.info('请先登录后再收藏');
      return;
    }

    // 乐观更新
    const nextFavorited = !isFavorited;
    setIsFavorited(nextFavorited);
    setCount((prev) => prev + (nextFavorited ? 1 : -1));
    setIsLoading(true);

    try {
      const result = nextFavorited
        ? await favoriteApi.add(agentId, token!)
        : await favoriteApi.remove(agentId, token!);

      if (!result.success) {
        // 回滚
        setIsFavorited(!nextFavorited);
        setCount((prev) => prev + (nextFavorited ? -1 : 1));
        message.error(result.message || '操作失败');
        return;
      }

      onToggle?.(nextFavorited);
    } catch {
      // 回滚
      setIsFavorited(!nextFavorited);
      setCount((prev) => prev + (nextFavorited ? -1 : 1));
      message.error('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  }, [isFavorited, isLoggedIn, agentId, token, onToggle]);

  // ─── 渲染 ──────────────────────────────────────────────────────────────────

  const iconSize = size === 'small' ? 16 : 20;
  const formattedCount = formatFavoriteCount(count);

  const renderIcon = () => {
    if (isLoading) return <LoadingOutlined style={{ fontSize: iconSize, color: '#d1d5db' }} />;
    if (isFavorited) return <StarFilled style={{ fontSize: iconSize, color: '#facc15' }} />;
    return <StarOutlined style={{ fontSize: iconSize, color: '#9ca3af' }} />;
  };

  return (
    <button
      className={`inline-flex items-center gap-1 transition-all duration-200 rounded-lg
        ${size === 'default' ? 'px-3 py-1.5 border hover:bg-gray-50' : 'px-1.5 py-1 hover:bg-gray-100'}
        ${isFavorited && size === 'default' ? 'bg-yellow-50 border-yellow-300' : ''}
      `}
      onClick={(e) => {
        e.stopPropagation();
        handleToggle();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleToggle();
        }
      }}
      aria-label={isFavorited ? '取消收藏此 Agent' : '收藏此 Agent'}
      tabIndex={0}
      disabled={isLoading}
    >
      {renderIcon()}
      {showText && (
        <span className={`text-sm ${isFavorited ? 'text-yellow-600' : 'text-gray-500'}`}>
          {isFavorited ? '已收藏' : '收藏'}
        </span>
      )}
      {showCount && formattedCount && (
        <span className="text-xs text-gray-400">{formattedCount}</span>
      )}
    </button>
  );
};

export default FavoriteButton;
