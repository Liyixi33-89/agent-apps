import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Tabs, Input, Card, Tag, Typography, Spin, Empty, Button, Space,
  List, Alert,
} from 'antd';
import {
  BookOutlined, SearchOutlined, MessageOutlined, DatabaseOutlined,
  RobotOutlined, LinkOutlined,
} from '@ant-design/icons';
import { Sender } from '@ant-design/x';
import { fetchKnowledge, searchKnowledge, ragQuery } from '../api';
import { useAppStore } from '../store';
import type { KnowledgeBase } from '../types';

const { Text, Paragraph, Title } = Typography;

const KnowledgePage = () => {
  const [searchParams] = useSearchParams();
  const { lang, activeProvider } = useAppStore();
  const [knowledge, setKnowledge] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [ragQuestion, setRagQuestion] = useState('');
  const [ragAnswer, setRagAnswer] = useState('');
  const [ragSources, setRagSources] = useState<Array<{ type: string; name: string; score?: number }>>([]);
  const [ragLoading, setRagLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ title: { zh: string; en: string }; content: { zh: string; en: string }; chunkId: string }>>([]);
  const [activeTab, setActiveTab] = useState('browse');

  const agentSlug = searchParams.get('agent') || undefined;

  useEffect(() => {
    setLoading(true);
    fetchKnowledge({ agentSlug, limit: 20 })
      .then((r) => { setKnowledge(r.data); setTotal(r.pagination.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [agentSlug]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const results = await searchKnowledge(searchQuery, { agentSlug, lang, limit: 10 });
      setSearchResults(results);
    } catch (err) {
      console.error('Search failed', err);
    }
  };

  const handleRagQuery = async (question?: string) => {
    const q = (question ?? ragQuestion).trim();
    if (!q) return;
    setRagLoading(true);
    setRagAnswer('');
    setRagSources([]);
    try {
      const result = await ragQuery(q, { agentSlug, provider: activeProvider, lang });
      setRagAnswer(result.answer);
      if (result.sources) setRagSources(result.sources);
    } catch (err) {
      console.error('RAG query failed', err);
      setRagAnswer('❌ 查询失败，请检查服务连接');
    } finally {
      setRagLoading(false);
    }
  };

  const tabItems = [
    {
      key: 'browse',
      label: (
        <Space size={4}>
          <BookOutlined />
          {lang === 'zh' ? '浏览' : 'Browse'}
        </Space>
      ),
      children: (
        <div>
          {loading ? (
            <div className="flex justify-center py-12">
              <Spin size="large" tip="加载中..." />
            </div>
          ) : knowledge.length === 0 ? (
            <Empty
              image={<DatabaseOutlined style={{ fontSize: 48, color: '#a7f3d0' }} />}
              description={
                <div className="text-center">
                  <Text className="text-slate-600 font-medium block mb-1">
                    {lang === 'zh' ? '知识库暂无数据' : 'No knowledge data yet'}
                  </Text>
                  <Text type="secondary" className="text-sm block mb-4">
                    {lang === 'zh'
                      ? '请前往管理后台同步 Agent 数据，或手动添加知识条目'
                      : 'Please go to the admin panel to sync agent data'}
                  </Text>
                  <a href="http://127.0.0.1:5174/knowledge" target="_blank" rel="noopener noreferrer">
                    <Button type="primary" icon={<BookOutlined />}>
                      {lang === 'zh' ? '前往管理后台' : 'Go to Admin Panel'}
                    </Button>
                  </a>
                </div>
              }
            />
          ) : (
            <List
              dataSource={knowledge}
              renderItem={(kb) => (
                <List.Item key={kb._id} className="!px-0">
                  <Card size="small" className="w-full border-slate-200 rounded-xl shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <Text strong className="text-sm block">
                          {lang === 'zh' ? kb.title.zh : kb.title.en}
                        </Text>
                        <Paragraph ellipsis={{ rows: 2 }} className="!mb-0 text-xs text-slate-500 mt-1">
                          {lang === 'zh' ? kb.description.zh : kb.description.en}
                        </Paragraph>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <Tag color="default" className="text-xs">{kb.sourceType}</Tag>
                        <Text type="secondary" className="text-xs">{kb.stats.chunkCount} chunks</Text>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {kb.categoryKey && <Tag color="blue" className="text-xs">{kb.categoryKey}</Tag>}
                      {kb.tags.slice(0, 5).map((tag) => (
                        <Tag key={tag} className="text-xs">{tag}</Tag>
                      ))}
                    </div>
                  </Card>
                </List.Item>
              )}
            />
          )}
        </div>
      ),
    },
    {
      key: 'search',
      label: (
        <Space size={4}>
          <SearchOutlined />
          {lang === 'zh' ? '语义搜索' : 'Search'}
        </Space>
      ),
      children: (
        <div className="space-y-4">
          <Input.Search
            prefix={<SearchOutlined className="text-slate-400" />}
            placeholder={lang === 'zh' ? '搜索知识库...' : 'Search knowledge base...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onSearch={handleSearch}
            enterButton={lang === 'zh' ? '搜索' : 'Search'}
            size="large"
            aria-label="搜索知识库"
          />

          {searchResults.length > 0 && (
            <div className="space-y-3">
              <Text type="secondary" className="text-xs">
                {lang === 'zh' ? `找到 ${searchResults.length} 条相关内容` : `Found ${searchResults.length} relevant results`}
              </Text>
              {searchResults.map((result) => (
                <Card key={result.chunkId} size="small" className="border-slate-200 rounded-xl shadow-sm">
                  <Text strong className="text-sm block mb-2">
                    {lang === 'zh' ? result.title.zh : result.title.en}
                  </Text>
                  <Paragraph ellipsis={{ rows: 4 }} className="!mb-0 text-xs text-slate-500">
                    {lang === 'zh' ? result.content.zh : result.content.en}
                  </Paragraph>
                </Card>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'rag',
      label: (
        <Space size={4}>
          <RobotOutlined />
          RAG 问答
        </Space>
      ),
      children: (
        <div className="space-y-4">
          {/* 使用 Ant Design X Sender */}
          <Sender
            value={ragQuestion}
            onChange={setRagQuestion}
            onSubmit={(val) => handleRagQuery(val)}
            loading={ragLoading}
            placeholder={lang === 'zh' ? '基于知识库提问...' : 'Ask questions based on knowledge base...'}
            submitType="enter"
            aria-label="RAG 问题输入"
          />

          {ragLoading && (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Spin size="small" />
              <span>{lang === 'zh' ? '正在检索知识库并生成回答...' : 'Searching knowledge base...'}</span>
            </div>
          )}

          {ragAnswer && (
            <Card
              className="border-emerald-200 bg-emerald-50 rounded-xl shadow-sm"
              size="small"
              title={
                <Space>
                  <MessageOutlined className="text-emerald-600" />
                  <Text className="text-emerald-700 font-medium text-sm">RAG 回答</Text>
                </Space>
              }
            >
              <Paragraph className="text-sm text-slate-700 whitespace-pre-wrap !mb-0">
                {ragAnswer}
              </Paragraph>

              {/* 来源引用 */}
              {ragSources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-emerald-200">
                  <Text type="secondary" className="text-xs block mb-2">
                    <LinkOutlined className="mr-1" />
                    {lang === 'zh' ? '参考来源' : 'Sources'}
                  </Text>
                  <div className="flex flex-wrap gap-1.5">
                    {ragSources.map((src, i) => (
                      <Tag
                        key={i}
                        color={src.type === 'agent' ? 'blue' : 'green'}
                        className="text-xs"
                      >
                        {src.type === 'agent' ? '🤖' : '📚'} {src.name}
                        {src.score !== undefined && (
                          <span className="ml-1 opacity-60">{(src.score * 100).toFixed(0)}%</span>
                        )}
                      </Tag>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* 头部 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BookOutlined className="text-emerald-600 text-xl" />
          <Title level={3} className="!mb-0">
            {lang === 'zh' ? '知识库' : 'Knowledge Base'}
          </Title>
        </div>
        <Text type="secondary" className="text-sm">
          {lang === 'zh'
            ? `共 ${total} 条知识条目，支持语义搜索和 RAG 问答`
            : `${total} knowledge entries with semantic search and RAG Q&A`}
        </Text>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        className="knowledge-tabs"
      />
    </div>
  );
};

export default KnowledgePage;
