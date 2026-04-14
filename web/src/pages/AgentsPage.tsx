import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Input, Card, Row, Col, Tag, Typography, Pagination, Empty, Spin,
  Space, Segmented,
} from 'antd';
import {
  SearchOutlined, RobotOutlined, EyeOutlined, MessageOutlined, FilterOutlined,
  StarOutlined, StarFilled,
} from '@ant-design/icons';
import { fetchAgents, fetchCategories, fetchFavorites, checkFavorites } from '../api';
import { useLang } from '../store';
import FavoriteButton from '../components/FavoriteButton';
import type { Agent, Category, FavoriteItem } from '../types';

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
  const [sortBy, setSortBy] = useState('');

  // ─── 收藏相关状态 ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [favoriteMap, setFavoriteMap] = useState<Record<string, boolean>>({});
  const [favLoading, setFavLoading] = useState(false);
  const [favTotal, setFavTotal] = useState(0);
  const isLoggedIn = !!localStorage.getItem('token');

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
        sort: sortBy || undefined,
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
  }, [selectedCategory, searchQuery, modelFilter, sortBy, page]);

  // 加载收藏列表
  const loadFavorites = useCallback(async () => {
    if (!isLoggedIn) return;
    setFavLoading(true);
    try {
      const result = await fetchFavorites({ page: 1, limit: 50 });
      setFavoriteItems(result.items);
      setFavTotal(result.total);
    } catch (err) {
      console.error('Failed to load favorites', err);
    } finally {
      setFavLoading(false);
    }
  }, [isLoggedIn]);

  // 批量检查收藏状态
  const loadFavoriteStatus = useCallback(async (agentList: Agent[]) => {
    if (!isLoggedIn || agentList.length === 0) return;
    try {
      const ids = agentList.map((a) => a._id);
      const statusMap = await checkFavorites(ids);
      setFavoriteMap((prev) => ({ ...prev, ...statusMap }));
    } catch (err) {
      console.error('Failed to check favorites', err);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  // Agent 列表加载后，批量检查收藏状态
  useEffect(() => {
    if (agents.length > 0) loadFavoriteStatus(agents);
  }, [agents, loadFavoriteStatus]);

  // 切换到收藏 Tab 时加载收藏列表
  useEffect(() => {
    if (activeTab === 'favorites') loadFavorites();
  }, [activeTab, loadFavorites]);

  // 收藏/取消收藏后刷新状态
  const handleFavoriteToggle = useCallback((agentId: string, favorited: boolean) => {
    setFavoriteMap((prev) => ({ ...prev, [agentId]: favorited }));
    setFavTotal((prev) => prev + (favorited ? 1 : -1));
    // 如果在收藏 Tab，取消收藏后从列表移除
    if (!favorited && activeTab === 'favorites') {
      setFavoriteItems((prev) => prev.filter((item) => item.agent._id !== agentId));
    }
  }, [activeTab]);

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

      {/* Tab 切换：全部 / 收藏 */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1 max-w-xs">
        <button
          className={`flex-1 py-2 px-4 text-sm rounded-md transition-colors font-medium ${
            activeTab === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('all')}
        >
          {lang === 'zh' ? '全部' : 'All'}
        </button>
        <button
          className={`flex-1 py-2 px-4 text-sm rounded-md transition-colors font-medium flex items-center justify-center gap-1.5 ${
            activeTab === 'favorites' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('favorites')}
        >
          <StarOutlined className="text-xs" />
          {lang === 'zh' ? '收藏' : 'Favorites'}
          {isLoggedIn && favTotal > 0 && (
            <span className="ml-1 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
              {favTotal}
            </span>
          )}
        </button>
      </div>

      {/* 搜索和过滤（仅在全部 Tab 显示） */}
      <div className={`flex flex-col lg:flex-row gap-3 mb-6 ${activeTab !== 'all' ? 'hidden' : ''}`}>
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
        <Segmented
          options={[
            { label: lang === 'zh' ? '默认排序' : 'Default', value: '' },
            { label: <Space size={4}><StarFilled style={{ color: '#fadb14' }} />{lang === 'zh' ? '按评分' : 'By Rating'}</Space>, value: 'rating' },
          ]}
          value={sortBy}
          onChange={(v) => { setSortBy(v as string); setPage(1); }}
          aria-label="排序方式"
        />
      </div>

      {/* ─── 收藏 Tab 内容 ──────────────────────────────────────────────── */}
      {activeTab === 'favorites' && (
        <div className="min-w-0">
          {!isLoggedIn ? (
            <Empty
              image={<StarOutlined style={{ fontSize: 48, color: '#cbd5e1' }} />}
              description={lang === 'zh' ? '请先登录后查看收藏' : 'Please login to view favorites'}
            />
          ) : favLoading ? (
            <div className="flex justify-center py-20">
              <Spin size="large" tip="加载中..." />
            </div>
          ) : favoriteItems.length === 0 ? (
            <Empty
              image={<StarOutlined style={{ fontSize: 48, color: '#fbbf24' }} />}
              description={
                <div>
                  <p className="text-slate-500 mb-2">
                    {lang === 'zh' ? '还没有收藏的 Agent' : 'No favorites yet'}
                  </p>
                  <button
                    className="text-sky-500 hover:text-sky-600 text-sm hover:underline"
                    onClick={() => setActiveTab('all')}
                  >
                    {lang === 'zh' ? '去看看全部 Agent →' : 'Browse all agents →'}
                  </button>
                </div>
              }
            />
          ) : (
            <Row gutter={[12, 12]}>
              {favoriteItems.map((item) => {
                const agent = item.agent;
                const tagColor = colorMap[agent.color] || 'default';
                return (
                  <Col key={agent._id} xs={24} sm={12} xl={8}>
                    <Link to={`/agents/${agent.slug}`}>
                      <Card
                        hoverable
                        size="small"
                        className="h-full border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-sky-200 transition-all duration-200"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-xl flex-shrink-0">
                            {agent.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <Text strong className="text-sm block truncate">
                                {lang === 'zh' ? agent.name.zh : agent.name.en}
                              </Text>
                              <FavoriteButton
                                agentId={agent._id}
                                initialFavorited={true}
                                initialCount={agent.favoriteCount ?? 0}
                                showCount
                                size="small"
                                onToggle={(fav) => handleFavoriteToggle(agent._id, fav)}
                              />
                            </div>
                            <Paragraph
                              ellipsis={{ rows: 2 }}
                              className="!mb-0 text-xs text-slate-500 mt-0.5"
                            >
                              {lang === 'zh' ? agent.description.zh : agent.description.en}
                            </Paragraph>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2 flex-wrap">
                          <Tag color={tagColor} className="text-xs">{agent.categoryKey}</Tag>
                          <Text type="secondary" className="text-xs ml-auto">
                            {lang === 'zh' ? '收藏于 ' : 'Saved '}
                            {new Date(item.createdAt).toLocaleDateString()}
                          </Text>
                        </div>
                      </Card>
                    </Link>
                  </Col>
                );
              })}
            </Row>
          )}
        </div>
      )}

      {/* ─── 全部 Tab 内容 ──────────────────────────────────────────────── */}
      <div className={`flex gap-6 ${activeTab !== 'all' ? 'hidden' : ''}`}>
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
                              <div className="flex items-center justify-between">
                                <Text strong className="text-sm block truncate">
                                  {lang === 'zh' ? agent.name.zh : agent.name.en}
                                </Text>
                                <FavoriteButton
                                  agentId={agent._id}
                                  initialFavorited={!!favoriteMap[agent._id]}
                                  initialCount={agent.favoriteCount ?? 0}
                                  showCount
                                  size="small"
                                  onToggle={(fav) => handleFavoriteToggle(agent._id, fav)}
                                />
                              </div>
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
                            {/* 评分显示（v1.3.0） */}
                            {agent.ratingStats && agent.ratingStats.totalReviews > 0 ? (
                              <span className="flex items-center gap-1 text-xs text-gray-500 ml-auto">
                                <StarFilled style={{ color: '#fadb14', fontSize: 12 }} />
                                <span className="font-medium text-gray-700">{agent.ratingStats.avgRating.toFixed(1)}</span>
                                <span className="text-gray-400">({agent.ratingStats.totalReviews})</span>
                              </span>
                            ) : (
                              <Text type="secondary" className="text-xs ml-auto">
                                {agent.stats.wordCount.toLocaleString()} words
                              </Text>
                            )}
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
