import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Input, Card, Row, Col, Tag, Typography, Pagination, Empty, Spin,
  Space, Segmented,
} from 'antd';
import {
  SearchOutlined, RobotOutlined, EyeOutlined, MessageOutlined, FilterOutlined,
} from '@ant-design/icons';
import { fetchAgents, fetchCategories } from '../api';
import { useLang } from '../store';
import type { Agent, Category } from '../types';

const { Text, Paragraph } = Typography;

const colorMap: Record<string, string> = {
  sky: 'blue', violet: 'purple', emerald: 'green', rose: 'red',
  amber: 'gold', pink: 'magenta', cyan: 'cyan', orange: 'orange',
  lime: 'lime', indigo: 'geekblue', teal: 'teal', blue: 'blue',
  fuchsia: 'magenta', slate: 'default',
};

const AgentsPage = () => {
  const lang = useLang();
  const [searchParams, setSearchParams] = useSearchParams();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const selectedCategory = searchParams.get('category') || '';
  const searchQuery = searchParams.get('search') || '';
  const modelFilter = searchParams.get('model') || '';

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAgents({
        category: selectedCategory || undefined,
        search: searchQuery || undefined,
        modelType: modelFilter || undefined,
        page,
        limit: 24,
      });
      setAgents(result.data);
      setTotal(result.pagination.total);
    } catch (err) {
      console.error('Failed to load agents', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery, modelFilter, page]);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const handleSearch = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set('search', value);
    else params.delete('search');
    params.delete('page');
    setSearchParams(params);
    setPage(1);
  };

  const handleCategoryFilter = (key: string) => {
    const params = new URLSearchParams(searchParams);
    if (key) params.set('category', key);
    else params.delete('category');
    params.delete('page');
    setSearchParams(params);
    setPage(1);
  };

  const handleModelFilter = (model: string) => {
    const params = new URLSearchParams(searchParams);
    if (model) params.set('model', model);
    else params.delete('model');
    setSearchParams(params);
    setPage(1);
  };

  const modelOptions = [
    { label: lang === 'zh' ? '全部' : 'All', value: '' },
    { label: <Space size={4}><MessageOutlined />Text</Space>, value: 'text' },
    { label: <Space size={4}><EyeOutlined />Vision</Space>, value: 'vision' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 头部 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <RobotOutlined className="text-sky-600 text-xl" />
          <Text className="text-2xl font-bold text-slate-800">
            {lang === 'zh' ? 'Agent 库' : 'Agent Library'}
          </Text>
        </div>
        <Text type="secondary" className="text-sm">
          {lang === 'zh' ? `共 ${total} 个 Agent` : `${total} agents total`}
        </Text>
      </div>

      {/* 搜索和过滤 */}
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <Input
          prefix={<SearchOutlined className="text-slate-400" />}
          placeholder={lang === 'zh' ? '搜索 Agent...' : 'Search agents...'}
          defaultValue={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          allowClear
          className="flex-1 max-w-sm"
          aria-label="搜索 Agent"
        />
        <Segmented
          options={modelOptions}
          value={modelFilter}
          onChange={(v) => handleModelFilter(v as string)}
          aria-label="模型类型筛选"
        />
      </div>

      <div className="flex gap-6">
        {/* 分类侧边栏 */}
        <aside className="hidden lg:block w-48 flex-shrink-0">
          <div className="sticky top-0">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2 px-2">
              <FilterOutlined />
              {lang === 'zh' ? '分类筛选' : 'Filter by Category'}
            </div>
            <div className="space-y-0.5">
              <button
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${!selectedCategory ? 'bg-sky-50 text-sky-600 font-medium' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                onClick={() => handleCategoryFilter('')}
              >
                {lang === 'zh' ? '全部分类' : 'All Categories'}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.key}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${selectedCategory === cat.key ? 'bg-sky-50 text-sky-600 font-medium' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                  onClick={() => handleCategoryFilter(cat.key)}
                >
                  <span>{cat.icon}</span>
                  <span className="truncate">{lang === 'zh' ? cat.name.zh : cat.name.en}</span>
                  <span className="ml-auto text-xs text-slate-300">{cat.stats.agentCount}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Agent 网格 */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex justify-center py-20">
              <Spin size="large" tip="加载中..." />
            </div>
          ) : agents.length === 0 ? (
            <Empty
              image={<RobotOutlined style={{ fontSize: 48, color: '#cbd5e1' }} />}
              description={lang === 'zh' ? '没有找到匹配的 Agent' : 'No agents found'}
            />
          ) : (
            <>
              <Row gutter={[12, 12]}>
                {agents.map((agent) => {
                  const tagColor = colorMap[agent.color] || 'default';
                  return (
                    <Col key={agent._id} xs={24} sm={12} xl={8}>
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
                              <Text strong className="text-sm block truncate">
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
                          {agent.vibe?.en && (
                            <div className="mt-2 text-xs text-slate-400 italic line-clamp-1">
                              "{lang === 'zh' ? agent.vibe.zh : agent.vibe.en}"
                            </div>
                          )}
                          <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <Tag color={tagColor} className="text-xs">{agent.categoryKey}</Tag>
                            <Tag color={agent.modelPreferences.primary === 'vision' ? 'purple' : 'cyan'} className="text-xs">
                              {agent.modelPreferences.primary === 'vision' ? '👁️ Vision' : '💬 Text'}
                            </Tag>
                            <Text type="secondary" className="text-xs ml-auto">
                              {agent.stats.wordCount.toLocaleString()} words
                            </Text>
                          </div>
                        </Card>
                      </Link>
                    </Col>
                  );
                })}
              </Row>

              {/* 分页 */}
              {total > 24 && (
                <div className="flex justify-center mt-6">
                  <Pagination
                    current={page}
                    pageSize={24}
                    total={total}
                    onChange={(p) => setPage(p)}
                    showTotal={(t) => `共 ${t} 个`}
                    size="small"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentsPage;
