/**
 * @file components/ContextUsageIndicator.tsx
 * @description Context 使用量可视化指示器 — 展示当前对话的 Token 使用情况
 */

import { useMemo } from 'react';
import { Tooltip, Progress, Tag } from 'antd';
import {
  DashboardOutlined, CompressOutlined, WarningOutlined,
} from '@ant-design/icons';
import type { ChatMessage } from '../types';

interface ContextUsageIndicatorProps {
  messages: ChatMessage[];
  /** 模型的最大上下文窗口（Token 数），默认 128000 */
  maxContextTokens?: number;
  /** 是否启用了压缩 */
  compressionEnabled?: boolean;
  className?: string;
}

// 粗略估算 Token 数（中文约 1.5 token/字，英文约 0.75 token/word）
const estimateTokens = (text: string): number => {
  if (!text) return 0;
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 1.5 + otherChars * 0.4);
};

const ContextUsageIndicator = ({
  messages,
  maxContextTokens = 128000,
  compressionEnabled = true,
  className = '',
}: ContextUsageIndicatorProps) => {
  const stats = useMemo(() => {
    let totalTokens = 0;
    let systemTokens = 0;
    let userTokens = 0;
    let assistantTokens = 0;
    let compressedCount = 0;

    for (const msg of messages) {
      const tokens = estimateTokens(msg.content);
      totalTokens += tokens;

      switch (msg.role) {
        case 'system':
          systemTokens += tokens;
          break;
        case 'user':
          userTokens += tokens;
          break;
        case 'assistant':
          assistantTokens += tokens;
          // 检测是否被压缩过
          if (msg.content.includes('[HTML代码已压缩存储]') || msg.content.includes('[代码已压缩]')) {
            compressedCount++;
          }
          break;
      }
    }

    const usagePercent = Math.min(100, (totalTokens / maxContextTokens) * 100);
    const remaining = Math.max(0, maxContextTokens - totalTokens);
    const isWarning = usagePercent > 70;
    const isDanger = usagePercent > 90;

    return {
      totalTokens,
      systemTokens,
      userTokens,
      assistantTokens,
      compressedCount,
      usagePercent,
      remaining,
      isWarning,
      isDanger,
      messageCount: messages.length,
      roundCount: Math.floor(messages.filter(m => m.role === 'user').length),
    };
  }, [messages, maxContextTokens]);

  const getProgressColor = () => {
    if (stats.isDanger) return '#ef4444';
    if (stats.isWarning) return '#f59e0b';
    return '#10b981';
  };

  const formatTokens = (n: number): string => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  return (
    <Tooltip
      title={
        <div className="space-y-1.5 text-xs">
          <div className="font-semibold mb-2">Context 使用详情</div>
          <div className="flex justify-between gap-4">
            <span>System Prompt:</span>
            <span className="font-mono">{formatTokens(stats.systemTokens)} tokens</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>用户消息:</span>
            <span className="font-mono">{formatTokens(stats.userTokens)} tokens</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>AI 回复:</span>
            <span className="font-mono">{formatTokens(stats.assistantTokens)} tokens</span>
          </div>
          <div className="border-t border-slate-600 pt-1 flex justify-between gap-4 font-semibold">
            <span>总计:</span>
            <span className="font-mono">{formatTokens(stats.totalTokens)} / {formatTokens(maxContextTokens)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>对话轮次:</span>
            <span>{stats.roundCount} 轮 ({stats.messageCount} 条消息)</span>
          </div>
          {stats.compressedCount > 0 && (
            <div className="flex justify-between gap-4 text-sky-300">
              <span>已压缩消息:</span>
              <span>{stats.compressedCount} 条</span>
            </div>
          )}
          {stats.isDanger && (
            <div className="text-red-300 mt-1">⚠️ Context 即将用尽，建议开启新对话</div>
          )}
        </div>
      }
      placement="bottomRight"
    >
      <div
        className={`flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 cursor-help hover:border-slate-300 transition-colors ${className}`}
        role="status"
        aria-label={`Context 使用量: ${stats.usagePercent.toFixed(0)}%`}
        tabIndex={0}
      >
        <DashboardOutlined className={`text-xs ${
          stats.isDanger ? 'text-red-500' : stats.isWarning ? 'text-amber-500' : 'text-emerald-500'
        }`} />

        <Progress
          percent={stats.usagePercent}
          showInfo={false}
          strokeColor={getProgressColor()}
          trailColor="#e2e8f0"
          size="small"
          className="w-16 m-0"
        />

        <span className={`text-[10px] font-mono ${
          stats.isDanger ? 'text-red-500' : stats.isWarning ? 'text-amber-500' : 'text-slate-500'
        }`}>
          {formatTokens(stats.totalTokens)}
        </span>

        {stats.compressedCount > 0 && (
          <CompressOutlined className="text-[10px] text-sky-400" />
        )}

        {stats.isDanger && (
          <WarningOutlined className="text-[10px] text-red-500 animate-pulse" />
        )}
      </div>
    </Tooltip>
  );
};

export default ContextUsageIndicator;
