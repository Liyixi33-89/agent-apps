import { useState, useEffect } from 'react';
import { Card, Descriptions, Tag, Typography, Spin, Space, Alert } from 'antd';
import {
  SettingOutlined, ApiOutlined, EyeOutlined, MessageOutlined,
} from '@ant-design/icons';
import { fetchSettings } from '../api';

const { Title, Text } = Typography;

interface SettingsData {
  activeProvider: string;
  ollama: { baseUrl: string; textModel: string; visionModel: string };
  openai: { baseUrl: string; textModel: string; visionModel: string };
}

const ENV_VARS = [
  ['ACTIVE_PROVIDER', 'ollama | openai'],
  ['OLLAMA_BASE_URL', 'http://127.0.0.1:11434'],
  ['OLLAMA_TEXT_MODEL', 'gpt-oss'],
  ['OLLAMA_VISION_MODEL', 'qwen3-vl'],
  ['OPENAI_BASE_URL', 'https://api.chatanywhere.tech/v1'],
  ['OPENAI_API_KEY', 'your-api-key'],
  ['OPENAI_TEXT_MODEL', 'gpt-5.4-ca'],
  ['OPENAI_VISION_MODEL', 'gpt-4o-ca'],
  ['MONGODB_URI', 'mongodb://127.0.0.1:27017/agency_agents'],
  ['JWT_SECRET', 'your-secret-key'],
];

const SettingsPage = () => {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4 animate-fade-in">
      <div>
        <Title level={4} className="!mb-0 flex items-center gap-2">
          <SettingOutlined className="text-slate-500" />
          系统设置
        </Title>
        <Text type="secondary" className="text-sm">查看当前运行时配置</Text>
      </div>

      {settings && (
        <>
          {/* 当前提供商 */}
          <Card
            title={<Space><ApiOutlined className="text-sky-600" /><span>当前提供商</span></Space>}
            className="border-slate-200 rounded-xl shadow-sm"
            size="small"
          >
            <Space size={12}>
              <Tag
                color={settings.activeProvider === 'ollama' ? 'green' : 'default'}
                className="text-sm px-3 py-1"
              >
                🦙 Ollama
              </Tag>
              <Tag
                color={settings.activeProvider === 'openai' ? 'blue' : 'default'}
                className="text-sm px-3 py-1"
              >
                🤖 OpenAI
              </Tag>
            </Space>
            <Text type="secondary" className="text-xs block mt-3">
              通过环境变量 <code className="text-sky-600 bg-sky-50 px-1 rounded">ACTIVE_PROVIDER</code> 切换提供商（ollama / openai）
            </Text>
          </Card>

          {/* Ollama 配置 */}
          <Card
            title={<Space><span className="text-lg">🦙</span><span>Ollama 配置</span></Space>}
            className="border-slate-200 rounded-xl shadow-sm"
            size="small"
          >
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Base URL">
                <code className="text-sky-600 bg-sky-50 px-2 py-0.5 rounded text-xs">{settings.ollama.baseUrl}</code>
              </Descriptions.Item>
              <Descriptions.Item label={<Space size={4}><MessageOutlined />文本模型</Space>}>
                <code className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs">{settings.ollama.textModel}</code>
              </Descriptions.Item>
              <Descriptions.Item label={<Space size={4}><EyeOutlined />视觉模型</Space>}>
                <code className="text-violet-600 bg-violet-50 px-2 py-0.5 rounded text-xs">{settings.ollama.visionModel}</code>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* OpenAI 配置 */}
          <Card
            title={<Space><span className="text-lg">🤖</span><span>OpenAI 配置</span></Space>}
            className="border-slate-200 rounded-xl shadow-sm"
            size="small"
          >
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Base URL">
                <code className="text-sky-600 bg-sky-50 px-2 py-0.5 rounded text-xs truncate max-w-xs block">{settings.openai.baseUrl}</code>
              </Descriptions.Item>
              <Descriptions.Item label={<Space size={4}><MessageOutlined />文本模型</Space>}>
                <code className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs">{settings.openai.textModel}</code>
              </Descriptions.Item>
              <Descriptions.Item label={<Space size={4}><EyeOutlined />视觉模型</Space>}>
                <code className="text-violet-600 bg-violet-50 px-2 py-0.5 rounded text-xs">{settings.openai.visionModel}</code>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 环境变量说明 */}
          <Alert
            message="⚙️ 环境变量配置参考"
            description={
              <div className="space-y-1 mt-2">
                {ENV_VARS.map(([key, val]) => (
                  <div key={key} className="flex items-center gap-3 py-1 border-b border-amber-100 last:border-0">
                    <code className="text-sky-600 w-48 flex-shrink-0 text-xs">{key}</code>
                    <code className="text-slate-500 text-xs">{val}</code>
                  </div>
                ))}
              </div>
            }
            type="warning"
            className="rounded-xl"
          />
        </>
      )}
    </div>
  );
};

export default SettingsPage;
