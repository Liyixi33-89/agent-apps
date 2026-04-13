/**
 * @file pages/MemoryPage.tsx
 * @description Agent 记忆系统管理页面 — 查看、搜索、管理 Agent 记忆
 */

import { useState, useCallback, useEffect } from 'react';
import { Brain, Search, Plus, Trash2, RefreshCw, Loader2, Tag, Clock, Zap, Archive } from 'lucide-react';
import { Typography, Input, Select, Empty, Spin, message } from 'antd';
import {
  addAgentMemory, fetchAgentMemories, searchAgentMemories,
  deleteAgentMemory, consolidateAgentMemories, fetchCollaborationAgents,
} from '../api';
import { useLang } from '../store';
import type { MemoryEntry } from '../types';

const { Text } = Typography;

const MEMORY_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  session:   { label: '会话记忆', color: 'bg-sky-100 text-sky-700',     icon: '💬' },
  long_term: { label: '长期记忆', color: 'bg-violet-100 text-violet-700', icon: '🧠' },
  working:   { label: '工作记忆', color: 'bg-amber-100 text-amber-700',   icon: '⚡' },
};

const MemoryPage = () => {
  const lang = useLang();
  const userId = localStorage.getItem('username') || 'anonymous';

  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [agents, setAgents] = useState<Array<{ slug: string; name: { zh: string; en: string }; emoji: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<MemoryEntry & { score: number }> | null>(null);
  const [searching, setSearching] = useState(false);
  const [consolidating, setConsolidating] = useState(false);

  // 新建记忆
  const [showAdd, setShowAdd] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState<'session' | 'long_term' | 'working'>('long_term');
  const [adding, setAdding] = useState(false);

  // 加载 Agent 列表
  useEffect(() => {
    fetchCollaborationAgents()
      .then((data) => setAgents(data))
      .catch(() => {});
  }, []);

  // 加载记忆列表
  const loadMemories = useCallback(async () => {
    setLoading(true);
    setSearchResults(null);
    try {
      const data = await fetchAgentMemories({
        userId,
        agentSlug: selectedAgent || undefined,
        type: selectedType || undefined,
        limit: 50,
      });
      setMemories(data);
    } catch {
      message.error('加载记忆失败');
    } finally {
      setLoading(false);
    }
  }, [userId, selectedAgent, selectedType]);

  useEffect(() => { loadMemories(); }, [loadMemories]);

  // 搜索记忆
  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const results = await searchAgentMemories({
        userId,
        query: searchQuery.trim(),
        agentSlug: selectedAgent || undefined,
        limit: 20,
      });
      setSearchResults(results);
    } catch {
      message.error('搜索失败');
    } finally {
      setSearching(false);
    }
  };

  // 添加记忆
  const handleAdd = async () => {
    if (!newContent.trim()) return;
    setAdding(true);
    try {
      await addAgentMemory({
        userId,
        agentSlug: selectedAgent || undefined,
        content: newContent.trim(),
        type: newType,
      });
      setNewContent('');
      setShowAdd(false);
      message.success('记忆已添加');
      await loadMemories();
    } catch {
      message.error('添加失败');
    } finally {
      setAdding(false);
    }
  };

  // 删除记忆
  const handleDelete = async (memoryId: string) => {
    try {
      await deleteAgentMemory(memoryId, userId);
      message.success('记忆已删除');
      await loadMemories();
    } catch {
      message.error('删除失败');
    }
  };

  // 整合记忆
  const handleConsolidate = async () => {
    setConsolidating(true);
    try {
      const result = await consolidateAgentMemories(userId, selectedAgent || undefined);
      message.success(`整合完成：${result.consolidated} 条短期记忆 → ${result.newLongTermMemories} 条长期记忆`);
      await loadMemories();
    } catch {
      message.error('整合失败');
    } finally {
      setConsolidating(false);
    }
  };

  const displayList = searchResults ?? memories;

  return (
    <div className="h-full flex flex-col">
      {/* 顶部标题 */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center gap-3">
        <Brain className="w-5 h-5 text-violet-600" />
        <h1 className="text-lg font-bold text-slate-800">
          {lang === 'zh' ? 'Agent 记忆系统' : 'Agent Memory System'}
        </h1>
        <Text type="secondary" className="text-xs">
          {lang === 'zh' ? '管理 AI 的短期、长期和工作记忆' : 'Manage AI short-term, long-term and working memory'}
        </Text>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">

          {/* 筛选栏 */}
          <div className="flex items-center gap-3 flex-wrap">
            <Select
              placeholder="选择 Agent"
              allowClear
              value={selectedAgent || undefined}
              onChange={(v) => setSelectedAgent(v || '')}
              className="w-40"
              size="small"
              options={[
                ...agents.map((a) => ({ label: `${a.emoji} ${a.name.zh || a.name.en}`, value: a.slug })),
              ]}
              aria-label="选择Agent"
            />
            <Select
              placeholder="记忆类型"
              allowClear
              value={selectedType || undefined}
              onChange={(v) => setSelectedType(v || '')}
              className="w-32"
              size="small"
              options={Object.entries(MEMORY_TYPE_CONFIG).map(([k, v]) => ({ label: `${v.icon} ${v.label}`, value: k }))}
              aria-label="记忆类型"
            />
            <div className="flex-1 flex items-center gap-2">
              <Input.Search
                placeholder="语义搜索记忆..."
                size="small"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onSearch={handleSearch}
                loading={searching}
                allowClear
                onClear={() => setSearchResults(null)}
                className="max-w-xs"
                aria-label="搜索记忆"
              />
            </div>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors"
              onClick={() => setShowAdd(true)}
              aria-label="添加记忆"
              tabIndex={0}
            >
              <Plus className="w-3.5 h-3.5" /> 添加记忆
            </button>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              onClick={handleConsolidate}
              disabled={consolidating}
              aria-label="整合记忆"
              tabIndex={0}
              title="将短期会话记忆整合为长期记忆"
            >
              {consolidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
              整合记忆
            </button>
          </div>

          {/* 添加记忆弹窗 */}
          {showAdd && (
            <div className="rounded-xl border-2 border-violet-200 bg-violet-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-violet-700">添加新记忆</span>
                <button className="text-slate-400 hover:text-slate-600" onClick={() => setShowAdd(false)} aria-label="关闭" tabIndex={0}>✕</button>
              </div>
              <textarea
                className="w-full h-20 px-3 py-2 rounded-lg border border-violet-200 bg-white text-sm resize-none focus:outline-none focus:border-violet-400"
                placeholder="输入要记住的内容..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                aria-label="记忆内容"
              />
              <div className="flex items-center gap-3">
                <Select
                  value={newType}
                  onChange={setNewType}
                  size="small"
                  className="w-32"
                  options={Object.entries(MEMORY_TYPE_CONFIG).map(([k, v]) => ({ label: `${v.icon} ${v.label}`, value: k }))}
                  aria-label="记忆类型"
                />
                <button
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
                  onClick={handleAdd}
                  disabled={adding || !newContent.trim()}
                  aria-label="保存记忆"
                  tabIndex={0}
                >
                  {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  保存
                </button>
              </div>
            </div>
          )}

          {/* 搜索结果提示 */}
          {searchResults && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Search className="w-3.5 h-3.5" />
              搜索到 {searchResults.length} 条相关记忆
              <button className="text-sky-500 hover:underline" onClick={() => { setSearchResults(null); setSearchQuery(''); }} tabIndex={0}>清除搜索</button>
            </div>
          )}

          {/* 记忆列表 */}
          {loading ? (
            <div className="flex items-center justify-center py-16"><Spin size="large" /></div>
          ) : displayList.length === 0 ? (
            <Empty description={lang === 'zh' ? '暂无记忆数据' : 'No memories yet'} className="py-16" />
          ) : (
            <div className="space-y-2">
              {displayList.map((mem) => {
                const typeCfg = MEMORY_TYPE_CONFIG[mem.type] || MEMORY_TYPE_CONFIG.session;
                const score = 'score' in mem ? (mem as MemoryEntry & { score: number }).score : null;
                return (
                  <div key={mem.memoryId} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300 transition-colors group">
                    <div className="flex items-start gap-3">
                      <span className="text-lg flex-shrink-0">{typeCfg.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{mem.content}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${typeCfg.color}`}>{typeCfg.label}</span>
                          {mem.agentSlug && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-500">{mem.agentSlug}</span>
                          )}
                          {mem.importance && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-50 text-amber-600">重要度: {mem.importance}</span>
                          )}
                          {score !== null && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-600">相关度: {score.toFixed(2)}</span>
                          )}
                          {mem.tags && mem.tags.length > 0 && mem.tags.map((t) => (
                            <span key={t} className="px-2 py-0.5 rounded-full text-[10px] bg-slate-50 text-slate-400">#{t}</span>
                          ))}
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(mem.createdAt).toLocaleString('zh-CN')}
                          </span>
                        </div>
                      </div>
                      <button
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                        onClick={() => handleDelete(mem.memoryId)}
                        aria-label="删除记忆"
                        tabIndex={0}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MemoryPage;
