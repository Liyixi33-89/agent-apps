import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Button, Alert, Table, Tag, Typography, Space, Spin, Progress, Tooltip } from 'antd';
import {
  RobotOutlined, BookOutlined, BranchesOutlined, MessageOutlined,
  ThunderboltOutlined, ReloadOutlined, DashboardOutlined, ApiOutlined,
  SafetyCertificateOutlined, CloudOutlined, DollarOutlined, TeamOutlined,
} from '@ant-design/icons';
import { fetchDashboard, triggerAdminIngest, fetchAdminPrompts, fetchProviders, fetchTokenUsageToday, fetchExtensionsStatus } from '../api';

const { Title, Text } = Typography;

interface DashboardData {
  stats: { agentCount: number; categoryCount: number; pipelineCount: number; knowledgeCount: number; chatCount: number };
  recentChats: Array<{ _id: string; agentName?: string; updatedAt: string }>;
  provider: { active: string; ollama: string; openai: string };
}

interface TokenOverview {
  totalTokens: number;
  totalCost: number;
  callCount: number;
  avgDuration: number;
  successRate: number;
  budget: number;
  remaining: number;
}

const PROVIDER_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  ollama: { label: 'Ollama', emoji: '🦙', color: 'green' },
  openai: { label: 'OpenAI', emoji: '🤖', color: 'blue' },
  claude: { label: 'Claude', emoji: '🧠', color: 'purple' },
  gemini: { label: 'Gemini', emoji: '💎', color: 'cyan' },
  deepseek: { label: 'DeepSeek', emoji: '🔍', color: 'orange' },
};

const DashboardPage = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [promptCount, setPromptCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [ingestMsg, setIngestMsg] = useState('');
  const [ingestSuccess, setIngestSuccess] = useState(true);
  const [providers, setProviders] = useState<{ activeProvider: string; providers: Array<{ provider: string; configured: boolean; textModel: string; visionModel: string }>; routingStrategy: string; fallbackChain: string[] } | null>(null);
  const [tokenOverview, setTokenOverview] = useState<TokenOverview | null>(null);
  const [extensions, setExtensions] = useState<Record<string, any> | null>(null);

  const loadDashboard = async () => {
    try {
      const [result, prompts, providerData, tokenData, extStatus] = await Promise.all([
        fetchDashboard(),
        fetchAdminPrompts().catch(() => []),
        fetchProviders().catch(() => null),
        fetchTokenUsageToday().catch(() => null),
        fetchExtensionsStatus().catch(() => null),
      ]);
      setData(result);
      setPromptCount(prompts.length);
      if (providerData) setProviders(providerData);
      if (tokenData) setTokenOverview(tokenData);
      if (extStatus) setExtensions(extStatus);
    } catch (err) {
      console.error('Failed to load dashboard', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, []);

  const handleIngest = async () => {
    setIngesting(true);
    setIngestMsg('');
    try {
      const result = await triggerAdminIngest();
      setIngestMsg(`同步完成：${result.totalAgents} 个 Agent，${result.totalCategories} 个分类`);
      setIngestSuccess(true);
      await loadDashboard();
    } catch {
      setIngestMsg('同步失败，请检查服务连接');
      setIngestSuccess(false);
    } finally {
      setIngesting(false);
    }
  };

  const statCards = data ? [
    { label: 'Agent 总数',  value: data.stats.agentCount,    icon: <RobotOutlined />,      color: '#0284c7' },
    { label: '知识库条目',  value: data.stats.knowledgeCount, icon: <BookOutlined />,       color: '#10b981' },
    { label: '流水线',      value: data.stats.pipelineCount,  icon: <BranchesOutlined />,   color: '#7c3aed' },
    { label: '对话记录',    value: data.stats.chatCount,      icon: <MessageOutlined />,    color: '#f59e0b' },
    { label: '系统提示词',  value: promptCount,               icon: <ThunderboltOutlined />, color: '#ec4899' },
  ] : [];

  const chatColumns = [
    {
      title: 'Agent',
      dataIndex: 'agentName',
      key: 'agentName',
      render: (name: string) => (
        <Space>
          <RobotOutlined className="text-sky-500" />
          <Text>{name || 'AI Assistant'}</Text>
        </Space>
      ),
    },
    {
      title: '时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (t: string) => <Text type="secondary" className="text-xs">{new Date(t).toLocaleString()}</Text>,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <Title level={4} className="!mb-0 flex items-center gap-2">
            <DashboardOutlined className="text-sky-600" />
            仪表盘
          </Title>
          <Text type="secondary" className="text-sm">Agency Agents 管理后台 · 全功能扩展版</Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={loadDashboard}
          aria-label="刷新数据"
        >
          刷新
        </Button>
      </div>

      {ingestMsg && (
        <Alert
          message={ingestMsg}
          type={ingestSuccess ? 'success' : 'error'}
          showIcon
          closable
          onClose={() => setIngestMsg('')}
          className="rounded-lg"
        />
      )}

      {/* Provider 状态 — 多 Provider 展示 */}
      {providers && (
        <Card size="small" className="border-slate-200 rounded-xl shadow-sm" title={
          <Space><CloudOutlined className="text-sky-600" /><span>LLM Provider 状态</span></Space>
        }>
          <div className="flex flex-wrap gap-3">
            {providers.providers.map(p => {
              const info = PROVIDER_LABELS[p.provider] || { label: p.provider, emoji: '🔌', color: 'default' };
              const isActive = p.provider === providers.activeProvider;
              return (
                <Tooltip key={p.provider} title={`Text: ${p.textModel} | Vision: ${p.visionModel}`}>
                  <Tag
                    color={isActive ? info.color : undefined}
                    className={`px-3 py-1 text-sm ${!p.configured ? 'opacity-40' : ''}`}
                  >
                    {info.emoji} {info.label}
                    {isActive && ' ✓'}
                    {!p.configured && ' (未配置)'}
                  </Tag>
                </Tooltip>
              );
            })}
          </div>
          <div className="mt-2 text-xs text-gray-400">
            路由策略: <Tag size="small">{providers.routingStrategy}</Tag>
            {providers.fallbackChain.length > 0 && (
              <span>Fallback: {providers.fallbackChain.join(' → ')}</span>
            )}
          </div>
        </Card>
      )}

      {/* 统计卡片 */}
      <Row gutter={[16, 16]}>
        {statCards.map(({ label, value, icon, color }) => (
          <Col key={label} xs={12} sm={12} md={8} lg={6} xl={4}>
            <Card className="border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow" size="small">
              <Statistic
                title={<Text type="secondary" className="text-xs">{label}</Text>}
                value={value}
                prefix={<span style={{ color }}>{icon}</span>}
                styles={{ content: { color, fontSize: 28, fontWeight: 700 } }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Token 用量概览 */}
      {tokenOverview && (
        <Card
          title={<Space><DollarOutlined className="text-green-500" /><span>今日 Token 用量</span></Space>}
          className="border-slate-200 rounded-xl shadow-sm"
          size="small"
        >
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={6}>
              <Statistic title="总 Token" value={tokenOverview.totalTokens} suffix="tokens" />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic title="估算成本" value={tokenOverview.totalCost} precision={4} prefix="$" />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic title="调用次数" value={tokenOverview.callCount} suffix="次" />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="成功率"
                value={(tokenOverview.successRate * 100)}
                precision={1}
                suffix="%"
                valueStyle={{ color: tokenOverview.successRate >= 0.95 ? '#10b981' : '#f59e0b' }}
              />
            </Col>
          </Row>
          {tokenOverview.budget > 0 && (
            <div className="mt-4">
              <Text type="secondary" className="text-xs">预算使用进度</Text>
              <Progress
                percent={Math.round((tokenOverview.totalTokens / tokenOverview.budget) * 100)}
                status={tokenOverview.remaining <= 0 ? 'exception' : 'active'}
                strokeColor={tokenOverview.remaining <= 0 ? '#ef4444' : '#3b82f6'}
              />
            </div>
          )}
        </Card>
      )}

      {/* 扩展功能状态 */}
      {extensions && (
        <Card
          title={<Space><SafetyCertificateOutlined className="text-purple-500" /><span>扩展功能状态</span></Space>}
          className="border-slate-200 rounded-xl shadow-sm"
          size="small"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: '多 Provider', enabled: extensions.multiProvider?.enabled, detail: `${extensions.multiProvider?.configuredProviders?.length || 0} 个已配置` },
              { label: 'RAG 向量检索', enabled: extensions.rag?.enabled, detail: extensions.rag?.embeddingModel },
              { label: 'RBAC 权限', enabled: extensions.rbac?.enabled, detail: `${extensions.rbac?.builtinRoles?.length || 0} 个内置角色` },
              { label: '多租户', enabled: extensions.multiTenant?.enabled, detail: extensions.multiTenant?.enabled ? '已启用' : '未启用' },
              { label: 'Token 预算', enabled: extensions.tokenBudget?.enabled, detail: extensions.tokenBudget?.dailyBudget ? `${extensions.tokenBudget.dailyBudget}/天` : '不限制' },
              { label: 'API 限流', enabled: extensions.rateLimit?.enabled, detail: extensions.rateLimit?.perMinute ? `${extensions.rateLimit.perMinute}/分钟` : '不限制' },
              { label: 'Agent 记忆', enabled: extensions.memory?.enabled, detail: '短期/长期/工作记忆' },
              { label: 'Multi-Agent', enabled: extensions.multiAgent?.enabled, detail: extensions.multiAgent?.modes?.join('/') },
              { label: 'MCP 市场', enabled: extensions.mcpMarket?.enabled, detail: `${extensions.mcpMarket?.templateCount || 0} 个模板` },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                <div className={`w-2 h-2 rounded-full ${item.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                <div>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-gray-400">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 最近对话 */}
      {data && data.recentChats.length > 0 && (
        <Card
          title={
            <Space>
              <MessageOutlined className="text-amber-500" />
              <span>最近对话</span>
            </Space>
          }
          className="border-slate-200 rounded-xl shadow-sm"
          size="small"
        >
          <Table
            dataSource={data.recentChats}
            columns={chatColumns}
            rowKey="_id"
            pagination={false}
            size="small"
            className="rounded-lg"
          />
        </Card>
      )}
    </div>
  );
};

export default DashboardPage;
