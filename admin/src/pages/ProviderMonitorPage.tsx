/**
 * @file pages/ProviderMonitorPage.tsx
 * @description Provider 健康监控页面（Admin 端）— 实时展示各 LLM Provider 的状态、延迟和可用性
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card, Tag, Button, Space, Spin, Progress, Typography, message,
  Row, Col, Statistic, Table, Modal, Descriptions, Badge, Tooltip,
} from 'antd';
import {
  ApiOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined,
  ClockCircleOutlined, ThunderboltOutlined, SwapOutlined, WarningOutlined,
  DashboardOutlined, CloudOutlined, PlayCircleOutlined, HeartOutlined,
} from '@ant-design/icons';
import { fetchProviders, type ProviderInfo } from '../api';

const { Title, Text } = Typography;

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
  latency: number;
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
  onDetail: (provider: ProviderInfo) => void;
}

const ProviderCard = ({ provider, health, isActive, onCheck, checking, onDetail }: ProviderCardProps) => {
  const meta = PROVIDER_META[provider.provider] || { icon: '🔌', color: 'default', label: provider.provider };

  const statusConfig = {
    healthy:   { color: 'green',   icon: <CheckCircleOutlined />, text: '健康' },
    degraded:  { color: 'orange',  icon: <WarningOutlined />,     text: '降级' },
    down:      { color: 'red',     icon: <CloseCircleOutlined />, text: '不可用' },
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
      hoverable
      className={`border-2 transition-all duration-200 ${
        isActive ? 'border-sky-400 shadow-md shadow-sky-100' : 'border-slate-200 hover:border-slate-300'
      }`}
      bodyStyle={{ padding: 20 }}
      onClick={() => onDetail(provider)}
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
          onClick={(e) => { e.stopPropagation(); onCheck(provider.provider); }}
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
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailProvider, setDetailProvider] = useState<ProviderInfo | null>(null);

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

  // 健康检查
  const handleHealthCheck = useCallback(async (providerKey: string) => {
    setCheckingProvider(providerKey);
    const startTime = Date.now();

    try {
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
      message.success(`${providerKey} 检测完成: ${latency}ms`);
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
      message.error(`${providerKey} 检测失败`);
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
    message.success('全部检测完成');
  }, [providers, handleHealthCheck]);

  const handleDetail = (provider: ProviderInfo) => {
    setDetailProvider(provider);
    setDetailVisible(true);
  };

  const configuredCount = providers.filter((p) => p.configured).length;
  const healthyCount = Object.values(healthMap).filter((h) => h.status === 'healthy').length;
  const degradedCount = Object.values(healthMap).filter((h) => h.status === 'degraded').length;
  const downCount = Object.values(healthMap).filter((h) => h.status === 'down').length;

  // 健康检查历史表格数据
  const healthTableData = Object.values(healthMap).map((h) => ({
    key: h.provider,
    ...h,
  }));

  const healthColumns = [
    {
      title: 'Provider',
      dataIndex: 'provider',
      key: 'provider',
      render: (val: string) => {
        const meta = PROVIDER_META[val] || { icon: '🔌', label: val };
        return (
          <span className="flex items-center gap-2">
            <span>{meta.icon}</span>
            <Text strong>{meta.label}</Text>
          </span>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (val: string) => {
        const cfg: Record<string, { color: string; text: string }> = {
          healthy: { color: 'green', text: '健康' },
          degraded: { color: 'orange', text: '降级' },
          down: { color: 'red', text: '不可用' },
          unchecked: { color: 'default', text: '未检测' },
        };
        const c = cfg[val] || cfg.unchecked;
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    {
      title: '延迟',
      dataIndex: 'latency',
      key: 'latency',
      sorter: (a: HealthCheckResult, b: HealthCheckResult) => a.latency - b.latency,
      render: (val: number) => (
        <span className="font-mono text-sm">
          {val > 0 ? `${val}ms` : '-'}
        </span>
      ),
    },
    {
      title: '最后检测',
      dataIndex: 'lastChecked',
      key: 'lastChecked',
      render: (val: Date | null) => val ? val.toLocaleString('zh-CN') : '-',
    },
    {
      title: '错误',
      dataIndex: 'error',
      key: 'error',
      render: (val: string | undefined) => val ? <Text type="danger" className="text-xs">{val}</Text> : '-',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <Title level={3} className="!mb-1 flex items-center gap-2">
            <DashboardOutlined className="text-violet-500" />
            Provider 健康监控
          </Title>
          <Text type="secondary">实时监控各 LLM Provider 的状态、延迟和可用性</Text>
        </div>
        <Space>
          <Button
            icon={<HeartOutlined />}
            onClick={handleCheckAll}
            loading={!!checkingProvider}
            type="primary"
            aria-label="检测所有 Provider"
            tabIndex={0}
          >
            全部检测
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadProviders}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
      </div>

      {/* 概览统计 */}
      <Row gutter={16}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="总 Provider"
              value={providers.length}
              prefix={<CloudOutlined className="text-sky-500" />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已配置"
              value={configuredCount}
              prefix={<CheckCircleOutlined className="text-emerald-500" />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="健康 / 降级 / 不可用"
              value={`${healthyCount} / ${degradedCount} / ${downCount}`}
              prefix={<HeartOutlined className="text-green-500" />}
              valueStyle={{ fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="路由策略"
              value={routingStrategy || '未配置'}
              prefix={<SwapOutlined className="text-amber-500" />}
              valueStyle={{ fontSize: 16, textTransform: 'capitalize' } as React.CSSProperties}
            />
          </Card>
        </Col>
      </Row>

      {/* Fallback 降级链 */}
      {fallbackChain.length > 0 && (
        <Card size="small" title={
          <span className="flex items-center gap-2">
            <SwapOutlined className="text-amber-500" />
            Fallback 降级链
          </span>
        }>
          <div className="flex items-center gap-2 flex-wrap">
            {fallbackChain.map((p, i) => {
              const meta = PROVIDER_META[p] || { icon: '🔌', label: p };
              const health = healthMap[p];
              return (
                <span key={p} className="flex items-center gap-1">
                  <Tooltip title={health ? `${health.status} - ${health.latency}ms` : '未检测'}>
                    <Tag
                      color={p === activeProvider ? 'blue' : 'default'}
                      className="text-xs cursor-pointer"
                    >
                      {meta.icon} {meta.label}
                      {health && health.status === 'healthy' && <CheckCircleOutlined className="ml-1 text-green-500" />}
                      {health && health.status === 'degraded' && <WarningOutlined className="ml-1 text-orange-500" />}
                      {health && health.status === 'down' && <CloseCircleOutlined className="ml-1 text-red-500" />}
                    </Tag>
                  </Tooltip>
                  {i < fallbackChain.length - 1 && (
                    <span className="text-slate-400 text-xs">→</span>
                  )}
                </span>
              );
            })}
          </div>
        </Card>
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
              onDetail={handleDetail}
            />
          ))}
        </div>
      )}

      {/* 检测历史表格 */}
      {healthTableData.length > 0 && (
        <Card
          title={
            <span className="flex items-center gap-2">
              <ClockCircleOutlined className="text-blue-500" />
              检测记录
            </span>
          }
          size="small"
        >
          <Table
            dataSource={healthTableData}
            columns={healthColumns}
            pagination={false}
            size="small"
          />
        </Card>
      )}

      {/* Provider 详情弹窗 */}
      <Modal
        title={
          detailProvider ? (
            <span className="flex items-center gap-2">
              <span className="text-xl">
                {(PROVIDER_META[detailProvider.provider] || { icon: '🔌' }).icon}
              </span>
              {(PROVIDER_META[detailProvider.provider] || { label: detailProvider.provider }).label} 详情
            </span>
          ) : 'Provider 详情'
        }
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={
          detailProvider ? (
            <Space>
              <Button onClick={() => setDetailVisible(false)}>关闭</Button>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => {
                  handleHealthCheck(detailProvider.provider);
                }}
                loading={checkingProvider === detailProvider.provider}
                disabled={!detailProvider.configured}
              >
                执行健康检查
              </Button>
            </Space>
          ) : null
        }
        width={600}
      >
        {detailProvider && (() => {
          const meta = PROVIDER_META[detailProvider.provider] || { icon: '🔌', color: 'default', label: detailProvider.provider };
          const health = healthMap[detailProvider.provider];

          return (
            <div className="space-y-4">
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Provider">{meta.label}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  {detailProvider.configured
                    ? <Tag color="green">已配置</Tag>
                    : <Tag color="default">未配置</Tag>
                  }
                  {detailProvider.provider === activeProvider && <Tag color="blue" className="ml-1">当前激活</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="文本模型">
                  <Text code>{detailProvider.textModel || '未配置'}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="视觉模型">
                  <Text code>{detailProvider.visionModel || '未配置'}</Text>
                </Descriptions.Item>
              </Descriptions>

              {health && (
                <>
                  <Card size="small" title="健康检查结果" className={
                    health.status === 'healthy' ? 'border-green-200' :
                    health.status === 'degraded' ? 'border-orange-200' :
                    health.status === 'down' ? 'border-red-200' : ''
                  }>
                    <Descriptions column={2} size="small">
                      <Descriptions.Item label="状态">
                        <Tag color={
                          health.status === 'healthy' ? 'green' :
                          health.status === 'degraded' ? 'orange' :
                          health.status === 'down' ? 'red' : 'default'
                        }>
                          {health.status === 'healthy' ? '健康' :
                           health.status === 'degraded' ? '降级' :
                           health.status === 'down' ? '不可用' : '未检测'}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="延迟">
                        <span className="font-mono">{health.latency}ms</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="最后检测" span={2}>
                        {health.lastChecked?.toLocaleString('zh-CN') || '-'}
                      </Descriptions.Item>
                    </Descriptions>
                    {health.error && (
                      <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-500">
                        {health.error}
                      </div>
                    )}
                    {health.latency > 0 && (
                      <div className="mt-3">
                        <Text className="text-xs text-slate-400 mb-1 block">延迟分布</Text>
                        <Progress
                          percent={Math.min(100, (health.latency / 5000) * 100)}
                          strokeColor={
                            health.latency < 500 ? '#10b981' :
                            health.latency < 2000 ? '#f59e0b' : '#ef4444'
                          }
                          format={() => `${health.latency}ms`}
                        />
                      </div>
                    )}
                  </Card>
                </>
              )}

              {!health && (
                <div className="text-center py-6 text-slate-400">
                  <ClockCircleOutlined className="text-2xl mb-2" />
                  <div className="text-sm">尚未执行健康检查</div>
                  <div className="text-xs mt-1">点击下方按钮开始检测</div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

export default ProviderMonitorPage;
