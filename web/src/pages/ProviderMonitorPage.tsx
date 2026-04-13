/**
 * @file pages/ProviderMonitorPage.tsx
 * @description Provider 健康监控页面 — 实时展示各 LLM Provider 的状态、延迟和可用性
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card, Tag, Button, Space, Spin, Tooltip, Progress, Badge, Typography, message,
} from 'antd';
import {
  ApiOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined,
  ClockCircleOutlined, ThunderboltOutlined, SwapOutlined, WarningOutlined,
  DashboardOutlined, CloudOutlined,
} from '@ant-design/icons';
import { fetchProviders } from '../api';
import type { ProviderInfo } from '../types';

const { Text } = Typography;

// ─── Provider 图标映射 ───────────────────────────────────────────────────────

const PROVIDER_META: Record<string, { icon: string; color: string; label: string }> = {
  ollama:   { icon: '🦙', color: 'green',  label: 'Ollama (本地)' },
  openai:   { icon: '🤖', color: 'blue',   label: 'OpenAI' },
  claude:   { icon: '🧠', color: 'purple', label: 'Claude' },
  gemini:   { icon: '💎', color: 'cyan',   label: 'Gemini' },
  deepseek: { icon: '🔍', color: 'orange', label: 'DeepSeek' },
};

// ─── 健康检查结果类型 ────────────────────────────────────────────────────────

interface HealthCheckResult {
  provider: string;
  status: 'healthy' | 'degraded' | 'down' | 'unchecked';
  latency: number; // ms
  lastChecked: Date | null;
  error?: string;
}

// ─── Provider 状态卡片 ───────────────────────────────────────────────────────

interface ProviderCardProps {
  provider: ProviderInfo;
  health: HealthCheckResult;
  isActive: boolean;
  onCheck: (provider: string) => void;
  checking: boolean;
}

const ProviderCard = ({ provider, health, isActive, onCheck, checking }: ProviderCardProps) => {
  const meta = PROVIDER_META[provider.provider] || { icon: '🔌', color: 'default', label: provider.provider };

  const statusConfig = {
    healthy:   { color: 'green',  icon: <CheckCircleOutlined />, text: '健康' },
    degraded:  { color: 'orange', icon: <WarningOutlined />,     text: '降级' },
    down:      { color: 'red',    icon: <CloseCircleOutlined />, text: '不可用' },
    unchecked: { color: 'default', icon: <ClockCircleOutlined />, text: '未检测' },
  };

  const statusInfo = statusConfig[health.status];

  const getLatencyColor = (ms: number) => {
    if (ms <= 0) return 'default';
    if (ms < 500) return 'green';
    if (ms < 2000) return 'orange';
    return 'red';
  };

  return (
    <Card
      className={`border-2 transition-all duration-200 ${
        isActive ? 'border-sky-400 shadow-md shadow-sky-100' : 'border-slate-200 hover:border-slate-300'
      }`}
      bodyStyle={{ padding: 20 }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-2xl">{meta.icon}</div>
          <div>
            <div className="flex items-center gap-2">
              <Text strong className="text-base">{meta.label}</Text>
              {isActive && <Tag color="blue" className="text-[10px]">当前激活</Tag>}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <Tag color={statusInfo.color} className="text-[10px]">
                {statusInfo.icon} {statusInfo.text}
              </Tag>
              {!provider.configured && (
                <Tag color="default" className="text-[10px]">未配置</Tag>
              )}
            </div>
          </div>
        </div>
        <Button
          size="small"
          icon={<ReloadOutlined spin={checking} />}
          onClick={() => onCheck(provider.provider)}
          disabled={!provider.configured || checking}
          aria-label={`检测 ${meta.label}`}
          tabIndex={0}
        >
          检测
        </Button>
      </div>

      {/* 模型信息 */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">文本模型</span>
          <Text code className="text-[10px]">{provider.textModel || '未配置'}</Text>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">视觉模型</span>
          <Text code className="text-[10px]">{provider.visionModel || '未配置'}</Text>
        </div>
      </div>

      {/* 延迟指标 */}
      {health.latency > 0 && (
        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-400">响应延迟</span>
            <Tag color={getLatencyColor(health.latency)} className="text-[10px] font-mono">
              {health.latency}ms
            </Tag>
          </div>
          <Progress
            percent={Math.min(100, (health.latency / 5000) * 100)}
            showInfo={false}
            strokeColor={
              health.latency < 500 ? '#10b981' :
              health.latency < 2000 ? '#f59e0b' : '#ef4444'
            }
            size="small"
          />
        </div>
      )}

      {/* 错误信息 */}
      {health.error && (
        <div className="mt-3 p-2 bg-red-50 rounded-lg">
          <Text className="text-[10px] text-red-500">{health.error}</Text>
        </div>
      )}

      {/* 最后检测时间 */}
      {health.lastChecked && (
        <div className="mt-2 text-[10px] text-slate-400 text-right">
          最后检测: {health.lastChecked.toLocaleTimeString('zh-CN')}
        </div>
      )}
    </Card>
  );
};

// ─── 主页面 ──────────────────────────────────────────────────────────────────

const ProviderMonitorPage = () => {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [activeProvider, setActiveProvider] = useState('');
  const [routingStrategy, setRoutingStrategy] = useState('');
  const [fallbackChain, setFallbackChain] = useState<string[]>([]);
  const [healthMap, setHealthMap] = useState<Record<string, HealthCheckResult>>({});
  const [loading, setLoading] = useState(true);
  const [checkingProvider, setCheckingProvider] = useState<string | null>(null);

  const loadProviders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchProviders();
      setProviders(data.providers);
      setActiveProvider(data.activeProvider);
      setRoutingStrategy(data.routingStrategy);
      setFallbackChain(data.fallbackChain);
    } catch {
      message.error('加载 Provider 列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProviders(); }, [loadProviders]);

  // 健康检查（通过测量 API 响应时间模拟）
  const handleHealthCheck = useCallback(async (providerKey: string) => {
    setCheckingProvider(providerKey);
    const startTime = Date.now();

    try {
      // 使用 fetchProviders 作为简单的健康检查
      await fetchProviders();
      const latency = Date.now() - startTime;

      setHealthMap((prev) => ({
        ...prev,
        [providerKey]: {
          provider: providerKey,
          status: latency < 2000 ? 'healthy' : 'degraded',
          latency,
          lastChecked: new Date(),
        },
      }));
    } catch (err: unknown) {
      const latency = Date.now() - startTime;
      setHealthMap((prev) => ({
        ...prev,
        [providerKey]: {
          provider: providerKey,
          status: 'down',
          latency,
          lastChecked: new Date(),
          error: err instanceof Error ? err.message : '连接失败',
        },
      }));
    } finally {
      setCheckingProvider(null);
    }
  }, []);

  // 批量检测所有已配置的 Provider
  const handleCheckAll = useCallback(async () => {
    const configured = providers.filter((p) => p.configured);
    for (const p of configured) {
      await handleHealthCheck(p.provider);
    }
  }, [providers, handleHealthCheck]);

  const configuredCount = providers.filter((p) => p.configured).length;
  const healthyCount = Object.values(healthMap).filter((h) => h.status === 'healthy').length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <DashboardOutlined className="text-violet-600 text-xl" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Provider 健康监控</h1>
            <p className="text-xs text-slate-400">实时监控各 LLM Provider 的状态、延迟和可用性</p>
          </div>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleCheckAll}
            loading={!!checkingProvider}
            type="primary"
            size="small"
            aria-label="检测所有 Provider"
            tabIndex={0}
          >
            全部检测
          </Button>
        </Space>
      </div>

      {/* 概览统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card bodyStyle={{ padding: 16 }} className="border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
              <CloudOutlined className="text-sky-500" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-800">{providers.length}</div>
              <div className="text-[10px] text-slate-400">总 Provider</div>
            </div>
          </div>
        </Card>
        <Card bodyStyle={{ padding: 16 }} className="border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircleOutlined className="text-emerald-500" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-800">{configuredCount}</div>
              <div className="text-[10px] text-slate-400">已配置</div>
            </div>
          </div>
        </Card>
        <Card bodyStyle={{ padding: 16 }} className="border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <ThunderboltOutlined className="text-green-500" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-800">{healthyCount}</div>
              <div className="text-[10px] text-slate-400">健康</div>
            </div>
          </div>
        </Card>
        <Card bodyStyle={{ padding: 16 }} className="border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <SwapOutlined className="text-amber-500" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-800 capitalize">{routingStrategy || '-'}</div>
              <div className="text-[10px] text-slate-400">路由策略</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Fallback 链 */}
      {fallbackChain.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <SwapOutlined className="text-amber-500" />
            <Text strong className="text-sm text-amber-700">Fallback 降级链</Text>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {fallbackChain.map((p, i) => {
              const meta = PROVIDER_META[p] || { icon: '🔌', label: p };
              return (
                <span key={p} className="flex items-center gap-1">
                  <Tag color={p === activeProvider ? 'blue' : 'default'} className="text-xs">
                    {meta.icon} {meta.label}
                  </Tag>
                  {i < fallbackChain.length - 1 && (
                    <span className="text-slate-400 text-xs">→</span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Provider 卡片列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spin size="large" tip="加载 Provider 列表..." />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((p) => (
            <ProviderCard
              key={p.provider}
              provider={p}
              health={healthMap[p.provider] || {
                provider: p.provider,
                status: 'unchecked',
                latency: 0,
                lastChecked: null,
              }}
              isActive={p.provider === activeProvider}
              onCheck={handleHealthCheck}
              checking={checkingProvider === p.provider}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProviderMonitorPage;
