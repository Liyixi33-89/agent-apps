import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Tabs, Input, Card, Tag, Typography, Spin, Empty, Button, Space,
  List, Pagination, Select, message as antMessage,
} from 'antd';
import {
  BookOutlined, SearchOutlined, MessageOutlined, DatabaseOutlined,
  RobotOutlined, LinkOutlined, CopyOutlined, FilterOutlined,
} from '@ant-design/icons';
import { Sender } from '@ant-design/x';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchKnowledge, searchKnowledge, ragQuery, fetchCategories } from '../api';
import { useAppStoreShallow } from '../store';
import type { KnowledgeBase, Category } from '../types';
import type { RagSource } from '../api';

const { Text, Paragraph, Title } = Typography;

interface RagHistoryItem {
  role: 'user' | 'assistant';
  content: string;
  sources?: RagSource[];
}

const KnowledgePage = () => {
  const [searchParams] = useSearchParams();
  const { lang, activeProvider } = useAppStoreShallow((s) => ({ lang: s.lang, activeProvider: s.activeProvider }));
  const [knowledge, setKnowledge] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [ragQuestion, setRagQuestion] = useState('');
  const [ragLoading, setRagLoading] = useState(false);
  const [ragHistory, setRagHistory] = useState<RagHistoryItem[]>([]);
  const [searchResults, setSearchResults] = useState<Array<{ title: { zh: string; en: string }; content: { zh: string; en: string }; chunkId: string }>>([]);
  const [activeTab, setActiveTab] = useState('browse');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const agentSlug = searchParams.get('agent') || undefined;

  // 加载分类列表
  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  // 加载知识库列表（支持分页和分类筛选）
  const loadKnowledge = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchKnowledge({
        agentSlug,
        categoryKey: selectedCategory || undefined,
        page,
        limit: pageSize,
      });
      setKnowledge(r.data);
      setTotal(r.pagination.total);
    } catch {
      // 拦截器已处理
    } finally {
      setLoading(false);
    }
  }, [agentSlug, selectedCategory, page, pageSize]);

  useEffect(() => {
    loadKnowledge();
  }, [loadKnowledge]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const results = await searchKnowledge(searchQuery, { agentSlug, lang, limit: 10 });
      setSearchResults(results);
    } catch {
      // 拦截器已处理
    }
  };

  const handleRagQuery = async (question?: string) => {
    const q = (question ?? ragQuestion).trim();
    if (!q) return;
    setRagLoading(true);

    // 添加用户消息到历史
    const newHistory: RagHistoryItem[] = [...ragHistory, { role: 'user', content: q }];
    setRagHistory(newHistory);
    setRagQuestion('');

    try {
      // 构建多轮对话历史
      const historyForApi = newHistory
        .filter((h) => h.role === 'user' || h.role === 'assistant')
        .map((h) => ({ role: h.role, content: h.content }));

      const result = await ragQuery(q, {
        agentSlug,
        provider: activeProvider,
        lang,
        history: historyForApi.slice(-10), // 最近 5 轮
        rewrite: historyForApi.length > 2, // 多轮时启用问题改写
      });

      setRagHistory((prev) => [
        ...prev,
        { role: 'assistant', content: result.answer, sources: result.sources },
      ]);
    } catch {
      setRagHistory((prev) => [
        ...prev,
        { role: 'assistant', content: '❌ 查询失败，请检查服务连接' },
      ]);
    } finally {
      setRagLoading(false);
    }
  };

  const handleClearRagHistory = () => {
    setRagHistory([]);
  };

  const handleCopyAnswer = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      antMessage.success('已复制');
    });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setPage(1);
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
          {/* 分类筛选 */}
          <div className="flex items-center gap-3 mb-4">
            <FilterOutlined className="text-slate-400" />
            <Select
              value={selectedCategory}
              onChange={handleCategoryChange}
              placeholder={lang === 'zh' ? '按分类筛选' : 'Filter by category'}
              allowClear
              className="w-48"
              size="small"
              aria-label="分类筛选"
            >
              <Select.Option value="">{lang === 'zh' ? '全部分类' : 'All Categories'}</Select.Option>
              {categories.map((cat) => (
                <Select.Option key={cat.key} value={cat.key}>
                  {cat.icon} {lang === 'zh' ? cat.name.zh : cat.name.en}
                </Select.Option>
              ))}
            </Select>
            <Text type="secondary" className="text-xs ml-auto">
              {lang === 'zh' ? `共 ${total} 条` : `${total} entries`}
            </Text>
          </div>

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
                  <a
                    href={`${window.location.protocol}//${window.location.hostname}:5174/knowledge`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button type="primary" icon={<BookOutlined />}>
                      {lang === 'zh' ? '前往管理后台' : 'Go to Admin Panel'}
                    </Button>
                  </a>
                </div>
              }
            />
          ) : (
            <>
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
              {/* 分页 */}
              {total > pageSize && (
                <div className="flex justify-center mt-4">
                  <Pagination
                    current={page}
                    pageSize={pageSize}
                    total={total}
                    onChange={handlePageChange}
                    showTotal={(t) => lang === 'zh' ? `共 ${t} 条` : `${t} total`}
                    size="small"
                    showSizeChanger={false}
                  />
                </div>
              )}
            </>
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
          {/* 多轮对话历史 */}
          {ragHistory.length > 0 && (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {ragHistory.map((item, i) => (
                <div key={i}>
                  {item.role === 'user' ? (
                    <div className="flex justify-end">
                      <div className="bg-sky-600 text-white px-4 py-2 rounded-2xl rounded-tr-sm max-w-[80%] text-sm">
                        {item.content}
                      </div>
                    </div>
                  ) : (
                    <Card
                      className="border-emerald-200 bg-emerald-50 rounded-xl shadow-sm"
                      size="small"
                      title={
                        <div className="flex items-center justify-between">
                          <Space>
                            <MessageOutlined className="text-emerald-600" />
                            <Text className="text-emerald-700 font-medium text-sm">RAG 回答</Text>
                          </Space>
                          <Button
                            type="text"
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => handleCopyAnswer(item.content)}
                            className="text-emerald-500"
                            aria-label="复制回答"
                          />
                        </div>
                      }
                    >
                      <div className="prose-dark text-sm">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown>
                      </div>

                      {/* 来源引用 */}
                      {item.sources && item.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-emerald-200">
                          <Text type="secondary" className="text-xs block mb-2">
                            <LinkOutlined className="mr-1" />
                            {lang === 'zh' ? '参考来源' : 'Sources'}
                          </Text>
                          <div className="flex flex-wrap gap-1.5">
                            {item.sources.map((src, j) => (
                              <Tag
                                key={j}
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
              ))}
            </div>
          )}

          {ragLoading && (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Spin size="small" />
              <span>{lang === 'zh' ? '正在检索知识库并生成回答...' : 'Searching knowledge base...'}</span>
            </div>
          )}

          {/* 操作栏 */}
          {ragHistory.length > 0 && (
            <div className="flex justify-end">
              <Button
                size="small"
                onClick={handleClearRagHistory}
                aria-label="清空对话"
              >
                {lang === 'zh' ? '清空对话' : 'Clear'}
              </Button>
            </div>
          )}

          {/* 输入框 */}
          <Sender
            value={ragQuestion}
            onChange={setRagQuestion}
            onSubmit={(val) => handleRagQuery(val)}
            loading={ragLoading}
            placeholder={lang === 'zh' ? '基于知识库提问（支持多轮对话）...' : 'Ask questions (multi-turn supported)...'}
            submitType="enter"
            aria-label="RAG 问题输入"
          />
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
            ? `共 ${total} 条知识条目，支持语义搜索和 RAG 多轮问答`
            : `${total} knowledge entries with semantic search and multi-turn RAG Q&A`}
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
