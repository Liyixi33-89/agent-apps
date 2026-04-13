import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Card, Row, Col, Statistic, Button, Alert, Tag, Typography, Space, Spin, Badge,
} from 'antd';
import {
  RobotOutlined, ThunderboltOutlined, MessageOutlined, BookOutlined,
  BranchesOutlined, ArrowRightOutlined, ReloadOutlined, ApiOutlined,
} from '@ant-design/icons';
import { fetchOverview, triggerIngest } from '../api';
import { useAppStoreShallow } from '../store';
import type { Agent, Category } from '../types';

const { Title, Text, Paragraph } = Typography;

const colorMap: Record<string, string> = {
  sky: 'blue', violet: 'purple', emerald: 'green', rose: 'red',
  amber: 'gold', pink: 'magenta', cyan: 'cyan', orange: 'orange',
  lime: 'lime', indigo: 'geekblue', teal: 'teal', blue: 'blue',
  fuchsia: 'magenta', slate: 'default',
};

const AgentCard = ({ agent, lang }: { agent: Agent; lang: 'zh' | 'en' }) => {
  const tagColor = colorMap[agent.color] || 'default';
  return (
    <Link to={`/agents/${agent.slug}`}>
      <Card
        hoverable
        size="small"
        className="h-full border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-sky-200 transition-all duration-200 animate-fade-in"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-xl flex-shrink-0">
            {agent.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <Text strong className="text-sm block truncate group-hover:text-sky-600">
              {lang === 'zh' ? agent.name.zh : agent.name.en}
            </Text>
            <Paragraph
              ellipsis={{ rows: 2 }}
              className="!mb-0 text-xs text-slate-500 mt-0.5"
            >
              {lang === 'zh' ? agent.description.zh : agent.description.en}
            </Paragraph>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Tag color={tagColor} className="text-xs">{agent.categoryKey}</Tag>
          <Tag color={agent.modelPreferences.primary === 'vision' ? 'purple' : 'cyan'} className="text-xs">
            {agent.modelPreferences.primary === 'vision' ? '👁️ Vision' : '💬 Text'}
          </Tag>
        </div>
      </Card>
    </Link>
  );
};

const CategoryCard = ({ category, lang }: { category: Category; lang: 'zh' | 'en' }) => {
  const tagColor = colorMap[category.color] || 'default';
  return (
    <Link to={`/agents?category=${category.key}`}>
      <Card
        hoverable
        size="small"
        className="border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-sky-200 transition-all duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-xl flex-shrink-0">
            {category.icon}
          </div>
          <div className="flex-1 min-w-0">
            <Text strong className="text-sm block">
              {lang === 'zh' ? category.name.zh : category.name.en}
            </Text>
            <Tag color={tagColor} className="text-xs mt-0.5">{category.stats.agentCount} agents</Tag>
          </div>
          <ArrowRightOutlined className="text-slate-400 flex-shrink-0" />
        </div>
      </Card>
    </Link>
  );
};

const HomePage = () => {
  const { lang, activeProvider } = useAppStoreShallow((s) => ({ lang: s.lang, activeProvider: s.activeProvider }));
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof fetchOverview>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<{ totalAgents: number; totalCategories: number } | null>(null);

  useEffect(() => {
    const loadOverview = async () => {
      try {
        const data = await fetchOverview();
        setOverview(data);
      } catch (err) {
        console.error('Failed to load overview', err);
      } finally {
        setLoading(false);
      }
    };
    loadOverview();
  }, []);

  const handleIngest = async () => {
    setIngesting(true);
    try {
      const result = await triggerIngest();
      setIngestResult(result);
      const data = await fetchOverview();
      setOverview(data);
    } catch (err) {
      console.error('Ingest failed', err);
    } finally {
      setIngesting(false);
    }
  };

  const quickLinks = [
    { to: '/vibe',      icon: <ThunderboltOutlined />, labelZh: 'Vibe Coding', labelEn: 'Vibe Coding',     descZh: '自然语言生成代码',    descEn: 'Generate code from natural language', color: '#f59e0b' },
    { to: '/chat',      icon: <MessageOutlined />,     labelZh: '开始对话',    labelEn: 'Start Chat',       descZh: '与 Agent 实时交流',   descEn: 'Chat with agents in real-time',       color: '#0284c7' },
    { to: '/knowledge', icon: <BookOutlined />,        labelZh: '知识库',      labelEn: 'Knowledge',        descZh: '浏览 RAG 知识库',     descEn: 'Browse RAG knowledge base',           color: '#10b981' },
    { to: '/pipelines', icon: <BranchesOutlined />,    labelZh: '工作流',      labelEn: 'Workflows',        descZh: '应用场景一键生成',    descEn: 'One-click scenario generation',       color: '#7c3aed' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* 头部 */}
      <div className="flex items-start justify-between">
        <div>
          <Title level={3} className="!mb-1">
            🤖 {lang === 'zh' ? 'Agency Agents 平台' : 'Agency Agents Platform'}
          </Title>
          <Text type="secondary" className="text-sm">
            {lang === 'zh'
              ? '探索、构建和部署 AI Agent，支持 Vibe Coding 与知识库问答'
              : 'Explore, build and deploy AI Agents with Vibe Coding and RAG knowledge base'}
          </Text>
        </div>
        {/* <Button
          icon={<ReloadOutlined spin={ingesting} />}
          onClick={handleIngest}
          loading={ingesting}
          aria-label="同步 Agent 数据"
        >
          {ingesting ? (lang === 'zh' ? '同步中...' : 'Syncing...') : (lang === 'zh' ? '同步数据' : 'Sync Data')}
        </Button> */}
      </div>

      {/* 同步结果提示 */}
      {ingestResult && (
        <Alert
          message={`✅ 同步完成：导入 ${ingestResult.totalAgents} 个 Agent，${ingestResult.totalCategories} 个分类`}
          type="success"
          showIcon
          closable
          onClose={() => setIngestResult(null)}
          className="rounded-xl"
        />
      )}

      {/* 统计卡片 */}
      {overview && (
        <Row gutter={[16, 16]}>
          {[
            { labelZh: 'Agent 总数', labelEn: 'Total Agents', value: overview.stats.agentCount,    icon: '🤖', color: '#0284c7' },
            { labelZh: '分类数量',   labelEn: 'Categories',   value: overview.stats.categoryCount, icon: '📂', color: '#7c3aed' },
            { labelZh: '流水线',     labelEn: 'Pipelines',    value: overview.stats.pipelineCount, icon: '⚡', color: '#f59e0b' },
            { labelZh: '知识库',     labelEn: 'Knowledge',    value: overview.stats.knowledgeCount,icon: '📚', color: '#10b981' },
          ].map((stat) => (
            <Col key={stat.labelZh} xs={12} sm={12} md={6}>
              <Card size="small" className="border-slate-200 rounded-xl shadow-sm">
                <Statistic
                  title={<Text type="secondary" className="text-xs">{lang === 'zh' ? stat.labelZh : stat.labelEn}</Text>}
                  value={stat.value}
                  prefix={<span className="text-lg mr-1">{stat.icon}</span>}
                  styles={{ content: { color: stat.color, fontSize: 28, fontWeight: 700 } }}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Provider 状态 */}
      <Card size="small" className="border-slate-200 rounded-xl shadow-sm">
        <Space>
          <Badge status="success" />
          <Text type="secondary" className="text-sm">
            {lang === 'zh' ? '当前提供商' : 'Active Provider'}：
          </Text>
          <Tag icon={<ApiOutlined />} color="blue">
            {activeProvider === 'ollama' ? '🦙 Ollama' : '🤖 OpenAI'}
          </Tag>
          {overview && (
            <Text type="secondary" className="text-xs">
              Text: {activeProvider === 'ollama' ? overview.providers.ollama.textModel : overview.providers.openai.textModel}
              {' · '}
              Vision: {activeProvider === 'ollama' ? overview.providers.ollama.visionModel : overview.providers.openai.visionModel}
            </Text>
          )}
        </Space>
      </Card>

      {/* 快捷入口 */}
      <div>
        <Title level={5} className="!mb-3 flex items-center gap-2">
          <ThunderboltOutlined className="text-sky-600" />
          {lang === 'zh' ? '快捷入口' : 'Quick Access'}
        </Title>
        <Row gutter={[12, 12]}>
          {quickLinks.map(({ to, icon, labelZh, labelEn, descZh, descEn, color }) => (
            <Col key={to} xs={12} sm={12} md={6}>
              <Link to={to}>
                <Card
                  hoverable
                  size="small"
                  className="border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-sky-200 transition-all duration-200"
                >
                  <div style={{ color, fontSize: 24 }} className="mb-2">{icon}</div>
                  <Text strong className="text-sm block">{lang === 'zh' ? labelZh : labelEn}</Text>
                  <Text type="secondary" className="text-xs mt-0.5 block">{lang === 'zh' ? descZh : descEn}</Text>
                </Card>
              </Link>
            </Col>
          ))}
        </Row>
      </div>

      {/* 精选 Agents */}
      {overview && overview.featuredAgents.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <Title level={5} className="!mb-0 flex items-center gap-2">
              <RobotOutlined className="text-sky-600" />
              {lang === 'zh' ? '精选 Agent' : 'Featured Agents'}
            </Title>
            <Link to="/agents">
              <Button type="link" size="small" icon={<ArrowRightOutlined />} className="text-sky-600">
                {lang === 'zh' ? '查看全部' : 'View all'}
              </Button>
            </Link>
          </div>
          <Row gutter={[12, 12]}>
            {overview.featuredAgents.map((agent) => (
              <Col key={agent._id} xs={24} sm={12} md={8}>
                <AgentCard agent={agent} lang={lang} />
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* 分类 */}
      {overview && overview.categories.length > 0 && (
        <div>
          <Title level={5} className="!mb-3 flex items-center gap-2">
            <span>📂</span>
            {lang === 'zh' ? '所有分类' : 'All Categories'}
          </Title>
          <Row gutter={[12, 12]}>
            {overview.categories.map((cat) => (
              <Col key={cat._id} xs={24} sm={12} md={8}>
                <CategoryCard category={cat} lang={lang} />
              </Col>
            ))}
          </Row>
        </div>
      )}
    </div>
  );
};

export default HomePage;
