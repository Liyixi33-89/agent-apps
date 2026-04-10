import { useState, useEffect } from 'react';
import { Card, Descriptions, Tag, Typography, Spin, Space, Alert, Table } from 'antd';
import {
  SettingOutlined, ApiOutlined, EyeOutlined, MessageOutlined,
  CloudOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import { fetchSettings, fetchProviders, type ProviderInfo } from '../api';

const { Title, Text } = Typography;

interface SettingsData {
  activeProvider: string;
  ollama: { baseUrl: string; textModel: string; visionModel: string };
  openai: { baseUrl: string; textModel: string; visionModel: string };
}

const PROVIDER_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  ollama: { label: 'Ollama', emoji: '🦙', color: 'green' },
  openai: { label: 'OpenAI', emoji: '🤖', color: 'blue' },
  claude: { label: 'Claude', emoji: '🧠', color: 'purple' },
  gemini: { label: 'Gemini', emoji: '💎', color: 'cyan' },
  deepseek: { label: 'DeepSeek', emoji: '🔍', color: 'orange' },
};

const ENV_VARS = [
  ['ACTIVE_PROVIDER', 'ollama | openai | claude | gemini | deepseek'],
  ['OLLAMA_BASE_URL', 'http://127.0.0.1:11434'],
  ['OLLAMA_TEXT_MODEL', 'gpt-oss'],
  ['OPENAI_BASE_URL', 'https://api.openai.com/v1'],
  ['OPENAI_API_KEY', 'your-api-key'],
  ['CLAUDE_BASE_URL', 'https://api.anthropic.com'],
  ['CLAUDE_API_KEY', 'your-claude-api-key'],
  ['GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta'],
  ['GEMINI_API_KEY', 'your-gemini-api-key'],
  ['DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1'],
  ['DEEPSEEK_API_KEY', 'your-deepseek-api-key'],
  ['MODEL_ROUTING_STRATEGY', 'manual | auto | fallback'],
  ['FALLBACK_PROVIDERS', 'openai,claude,deepseek'],
  ['DAILY_TOKEN_BUDGET', '0 (不限制)'],
  ['USER_DAILY_TOKEN_QUOTA', '0 (不限制)'],
  ['RATE_LIMIT_PER_MINUTE', '0 (不限制)'],
  ['MULTI_TENANT_ENABLED', 'false'],
  ['EMBEDDING_PROVIDER', 'openai'],
  ['EMBEDDING_MODEL', 'text-embedding-3-small'],
  ['MONGODB_URI', 'mongodb://127.0.0.1:27017/agency_agents'],
  ['JWT_SECRET', 'your-secret-key'],
];

const SettingsPage = () => {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [providers, setProviders] = useState<{ activeProvider: string; providers: ProviderInfo[]; routingStrategy: string; fallbackChain: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchSettings().catch(() => null),
      fetchProviders().catch(() => null),
    ]).then(([s, p]) => {
      if (s) setSettings(s);
      if (p) setProviders(p);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  const providerColumns = [
    {
      title: 'Provider',
      dataIndex: 'provider',
      key: 'provider',
      render: (p: string) => {
        const info = PROVIDER_LABELS[p] || { label: p, emoji: '🔌', color: 'default' };
        const isActive = p === providers?.activeProvider;
        return (
          <Space>
            <span>{info.emoji}</span>
            <Text strong={isActive}>{info.label}</Text>
            {isActive && <Tag color="blue" size="small">当前</Tag>}
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'configured',
      key: 'configured',
      render: (configured: boolean) => (
        <Tag color={configured ? 'green' : 'default'}>{configured ? '已配置' : '未配置'}</Tag>
      ),
    },
    {
      title: '文本模型',
      dataIndex: 'textModel',
      key: 'textModel',
      render: (m: string) => <code className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs">{m}</code>,
    },
    {
      title: '视觉模型',
      dataIndex: 'visionModel',
      key: 'visionModel',
      render: (m: string) => <code className="text-violet-600 bg-violet-50 px-2 py-0.5 rounded text-xs">{m}</code>,
    },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4 animate-fade-in">
      <div>
        <Title level={4} className="!mb-0 flex items-center gap-2">
          <SettingOutlined className="text-slate-500" />
          系统设置
        </Title>
        <Text type="secondary" className="text-sm">查看当前运行时配置（多 Provider 扩展版）</Text>
      </div>

      {/* 多 Provider 状态表 */}
      {providers && (
        <Card
          title={<Space><CloudOutlined className="text-sky-600" /><span>LLM Provider 配置</span></Space>}
          className="border-slate-200 rounded-xl shadow-sm"
          size="small"
        >
          <Table
            dataSource={providers.providers}
            columns={providerColumns}
            rowKey="provider"
            pagination={false}
            size="small"
          />
          <div className="mt-3 flex gap-4 text-xs text-gray-400">
            <span>路由策略: <Tag size="small">{providers.routingStrategy}</Tag></span>
            {providers.fallbackChain.length > 0 && (
              <span>Fallback 链: <Tag size="small">{providers.fallbackChain.join(' → ')}</Tag></span>
            )}
          </div>
        </Card>
      )}

      {/* 环境变量说明 */}
      <Alert
        message="⚙️ 环境变量配置参考"
        description={
          <div className="space-y-1 mt-2 max-h-80 overflow-y-auto">
            {ENV_VARS.map(([key, val]) => (
              <div key={key} className="flex items-center gap-3 py-1 border-b border-amber-100 last:border-0">
                <code className="text-sky-600 w-56 flex-shrink-0 text-xs">{key}</code>
                <code className="text-slate-500 text-xs">{val}</code>
              </div>
            ))}
          </div>
        }
        type="warning"
        className="rounded-xl"
      />
    </div>
  );
};

export default SettingsPage;
