/**
 * @file components/FavoriteButton.tsx
 * @description 收藏按钮组件 — 支持收藏/取消收藏 Agent
 *
 * v1.3.0 新增：Agent 收藏功能
 *
 * 修复 CR-002: 添加 useEffect 同步 props 变化
 * 修复 CR-004: 使用项目统一的 API 封装（api/index.ts）
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StarOutlined, StarFilled, LoadingOutlined } from '@ant-design/icons';
import { message } from 'antd';
import { addFavorite, removeFavorite } from '../api';

// ─── 收藏数格式化 ──────────────────────────────────────────────────────────────

export const formatFavoriteCount = (count: number): string => {
  if (count <= 0) return '';
  if (count < 1000) return String(count);
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  return `${Math.floor(count / 1000)}k`;
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

  // 修复 CR-002: 同步 props 变化
  useEffect(() => {
    setIsFavorited(initialFavorited);
  }, [initialFavorited]);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  // 使用 localStorage 判断登录状态（与项目 api 拦截器一致）
  const isLoggedIn = !!localStorage.getItem('token');

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
    setCount((prev) => Math.max(0, prev + (nextFavorited ? 1 : -1)));
    setIsLoading(true);

    try {
      if (nextFavorited) {
        await addFavorite(agentId);
      } else {
        await removeFavorite(agentId);
      }
      onToggle?.(nextFavorited);
    } catch {
      // 回滚（API 层的 axios 拦截器已处理错误提示）
      setIsFavorited(!nextFavorited);
      setCount((prev) => prev + (nextFavorited ? -1 : 1));
    } finally {
      setIsLoading(false);
    }
  }, [isFavorited, isLoggedIn, agentId, onToggle]);

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
