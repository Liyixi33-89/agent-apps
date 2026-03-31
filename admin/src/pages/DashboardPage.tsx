import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Button, Alert, Table, Tag, Typography, Space, Spin } from 'antd';
import {
  RobotOutlined, BookOutlined, BranchesOutlined, MessageOutlined,
  ThunderboltOutlined, ReloadOutlined, DashboardOutlined, ApiOutlined,
} from '@ant-design/icons';
import { fetchDashboard, triggerAdminIngest, fetchAdminPrompts } from '../api';

const { Title, Text } = Typography;

interface DashboardData {
  stats: { agentCount: number; categoryCount: number; pipelineCount: number; knowledgeCount: number; chatCount: number };
  recentChats: Array<{ _id: string; agentName?: string; updatedAt: string }>;
  provider: { active: string; ollama: string; codebuddy: string };
}

const DashboardPage = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [promptCount, setPromptCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [ingestMsg, setIngestMsg] = useState('');
  const [ingestSuccess, setIngestSuccess] = useState(true);

  const loadDashboard = async () => {
    try {
      const [result, prompts] = await Promise.all([
        fetchDashboard(),
        fetchAdminPrompts().catch(() => []),
      ]);
      setData(result);
      setPromptCount(prompts.length);
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
          <Text type="secondary" className="text-sm">Agency Agents 管理后台</Text>
        </div>
        {/* <Button
          icon={<ReloadOutlined spin={ingesting} />}
          onClick={handleIngest}
          loading={ingesting}
          aria-label="同步 Agent 数据"
        >
          {ingesting ? '同步中...' : '同步 Agent 数据'}
        </Button> */}
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

      {/* Provider 状态 */}
      {data && (
        <Card size="small" className="border-slate-200 rounded-xl shadow-sm">
          <Space>
            <ApiOutlined className="text-sky-600" />
            <Text type="secondary">当前提供商：</Text>
            <Tag color="blue">{data.provider.active === 'ollama' ? '🦙 Ollama' : '🤖 CodeBuddy'}</Tag>
            <Text type="secondary" className="text-xs">
              Ollama: {data.provider.ollama} · CodeBuddy: {data.provider.codebuddy}
            </Text>
          </Space>
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
