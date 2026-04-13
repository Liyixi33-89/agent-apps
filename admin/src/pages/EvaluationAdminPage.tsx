/**
 * @file pages/EvaluationAdminPage.tsx
 * @description Agent 评估统计仪表盘 — 查看各 Agent 的用户评分、自动质量评估和 A/B 对比
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Star, BarChart3, MessageSquare, Loader2, RefreshCw, Search,
  TrendingUp, Award, ThumbsUp, GitCompare, Play, ArrowRight,
} from 'lucide-react';

// 使用 runtimeApi 调用评估 API
import axios from 'axios';

const runtimeApi = axios.create({ baseURL: '/api', timeout: 120_000 });

interface AgentOption {
  _id: string;
  slug: string;
  name: { zh: string; en: string };
  emoji: string;
}

interface EvalStats {
  userRating: { avgRating: number; totalRatings: number };
  autoQuality: { avgOverall: number; totalEvals: number };
  recentFeedback: Array<{ feedback: string; rating: number; createdAt: string }>;
}

interface CompareResult {
  agentSlug: string;
  agentName: string;
  emoji: string;
  output: string;
  duration: number;
  status: 'pending' | 'running' | 'done' | 'error';
  error?: string;
}

const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <Star
        key={s}
        className={`w-3.5 h-3.5 ${s <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`}
      />
    ))}
    <span className="text-xs text-slate-600 ml-1 font-mono">{rating.toFixed(1)}</span>
  </div>
);

// ─── A/B 对比面板 ────────────────────────────────────────────────────────────

interface CompareTabProps {
  agents: AgentOption[];
}

const CompareTab = ({ agents }: CompareTabProps) => {
  const [agentA, setAgentA] = useState('');
  const [agentB, setAgentB] = useState('');
  const [testPrompt, setTestPrompt] = useState('');
  const [comparing, setComparing] = useState(false);
  const [results, setResults] = useState<CompareResult[]>([]);

  const handleCompare = useCallback(async () => {
    if (!agentA || !agentB || !testPrompt.trim()) return;
    setComparing(true);
    setResults([
      { agentSlug: agentA, agentName: agents.find(a => a.slug === agentA)?.name.zh || agentA, emoji: agents.find(a => a.slug === agentA)?.emoji || '🤖', output: '', duration: 0, status: 'running' },
      { agentSlug: agentB, agentName: agents.find(a => a.slug === agentB)?.name.zh || agentB, emoji: agents.find(a => a.slug === agentB)?.emoji || '🤖', output: '', duration: 0, status: 'running' },
    ]);

    try {
      // 并行调用两个 Agent
      const callAgent = async (slug: string): Promise<{ output: string; duration: number }> => {
        const start = Date.now();
        try {
          const { data } = await runtimeApi.post('/multi-agent/execute', {
            mode: 'parallel',
            userPrompt: testPrompt,
            agents: [slug],
            options: {},
          });
          const output = data.data?.results?.[0]?.output || data.data?.finalOutput || '无输出';
          return { output, duration: Date.now() - start };
        } catch (err: unknown) {
          return { output: `错误: ${err instanceof Error ? err.message : '调用失败'}`, duration: Date.now() - start };
        }
      };

      const [resultA, resultB] = await Promise.all([callAgent(agentA), callAgent(agentB)]);

      setResults([
        {
          agentSlug: agentA,
          agentName: agents.find(a => a.slug === agentA)?.name.zh || agentA,
          emoji: agents.find(a => a.slug === agentA)?.emoji || '🤖',
          output: resultA.output,
          duration: resultA.duration,
          status: 'done',
        },
        {
          agentSlug: agentB,
          agentName: agents.find(a => a.slug === agentB)?.name.zh || agentB,
          emoji: agents.find(a => a.slug === agentB)?.emoji || '🤖',
          output: resultB.output,
          duration: resultB.duration,
          status: 'done',
        },
      ]);
    } catch {
      setResults((prev) => prev.map((r) => ({ ...r, status: 'error' as const, error: '对比执行失败' })));
    } finally {
      setComparing(false);
    }
  }, [agentA, agentB, testPrompt, agents]);

  return (
    <div className="space-y-4">
      {/* 对比配置 */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-violet-500" />
          A/B 对比测试
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Agent A</label>
            <select
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
              value={agentA}
              onChange={(e) => setAgentA(e.target.value)}
              aria-label="选择 Agent A"
            >
              <option value="">选择 Agent...</option>
              {agents.map((a) => (
                <option key={a.slug} value={a.slug}>{a.emoji} {a.name.zh || a.name.en}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Agent B</label>
            <select
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
              value={agentB}
              onChange={(e) => setAgentB(e.target.value)}
              aria-label="选择 Agent B"
            >
              <option value="">选择 Agent...</option>
              {agents.filter(a => a.slug !== agentA).map((a) => (
                <option key={a.slug} value={a.slug}>{a.emoji} {a.name.zh || a.name.en}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mb-4">
          <label className="text-xs text-slate-500 mb-1 block">测试问题</label>
          <textarea
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white resize-none"
            rows={3}
            placeholder="输入要同时发送给两个 Agent 的问题..."
            value={testPrompt}
            onChange={(e) => setTestPrompt(e.target.value)}
            aria-label="测试问题"
          />
        </div>
        <button
          className="btn-primary text-sm flex items-center gap-2"
          onClick={handleCompare}
          disabled={comparing || !agentA || !agentB || !testPrompt.trim()}
          aria-label="开始对比"
          tabIndex={0}
        >
          {comparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {comparing ? '对比中...' : '开始对比'}
        </button>
      </div>

      {/* 对比结果 */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {results.map((r) => (
            <div key={r.agentSlug} className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{r.emoji}</span>
                  <span className="text-sm font-semibold text-slate-800">{r.agentName}</span>
                </div>
                <div className="flex items-center gap-2">
                  {r.status === 'running' && (
                    <span className="flex items-center gap-1 text-xs text-sky-500">
                      <Loader2 className="w-3 h-3 animate-spin" /> 生成中...
                    </span>
                  )}
                  {r.status === 'done' && (
                    <span className="text-[10px] text-slate-400 font-mono">{(r.duration / 1000).toFixed(1)}s</span>
                  )}
                  {r.status === 'done' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  )}
                  {r.status === 'error' && (
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                  )}
                </div>
              </div>
              <div className="p-4 max-h-[400px] overflow-y-auto">
                {r.status === 'running' ? (
                  <div className="flex items-center justify-center py-8 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> 等待响应...
                  </div>
                ) : (
                  <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {r.output || r.error || '无输出'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── 主页面 ──────────────────────────────────────────────────────────────────

const EvaluationAdminPage = () => {
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [stats, setStats] = useState<EvalStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stats' | 'compare'>('stats');

  // 加载 Agent 列表
  useEffect(() => {
    runtimeApi.get('/multi-agent/agents')
      .then((res) => {
        const data = res.data.data || [];
        setAgents(data);
        if (data.length > 0) setSelectedAgent(data[0].slug);
      })
      .catch(() => {})
      .finally(() => setAgentsLoading(false));
  }, []);

  // 加载评估统计
  const loadStats = useCallback(async () => {
    if (!selectedAgent) return;
    setLoading(true);
    try {
      const { data } = await runtimeApi.get(`/evaluations/${selectedAgent}/stats`);
      setStats(data.data);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [selectedAgent]);

  useEffect(() => { loadStats(); }, [loadStats]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Award className="w-6 h-6 text-amber-500" />
          评估统计
        </h1>
        <div className="flex items-center gap-2">
          {/* Tab 切换 */}
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button
              className={`px-3 py-1 text-xs rounded-md transition-colors ${activeTab === 'stats' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('stats')}
              aria-label="评估统计"
              tabIndex={0}
            >
              📊 评估统计
            </button>
            <button
              className={`px-3 py-1 text-xs rounded-md transition-colors ${activeTab === 'compare' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('compare')}
              aria-label="A/B 对比"
              tabIndex={0}
            >
              ⚖️ A/B 对比
            </button>
          </div>
          {activeTab === 'stats' && (
            <>
              <select
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                disabled={agentsLoading}
                aria-label="选择Agent"
              >
                {agentsLoading && <option>加载中...</option>}
                {agents.map((a) => (
                  <option key={a.slug} value={a.slug}>{a.emoji} {a.name.zh || a.name.en}</option>
                ))}
              </select>
              <button className="btn-secondary text-xs" onClick={loadStats} disabled={loading} aria-label="刷新" tabIndex={0}>
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* A/B 对比 Tab */}
      {activeTab === 'compare' && <CompareTab agents={agents} />}

      {/* 评估统计 Tab */}
      {activeTab === 'stats' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> 加载评估数据...
            </div>
          ) : !stats ? (
            <div className="text-center py-20 text-slate-400">
              <Award className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">暂无评估数据</p>
              <p className="text-xs mt-1">用户在聊天中对 AI 回答评分后，数据将在此展示</p>
            </div>
          ) : (
            <>
              {/* 统计卡片 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="card p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                      <Star className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">用户平均评分</div>
                      <div className="text-2xl font-bold text-slate-800">{stats.userRating.avgRating.toFixed(1)}</div>
                    </div>
                  </div>
                  <StarRating rating={stats.userRating.avgRating} />
                  <div className="text-xs text-slate-400 mt-2">共 {stats.userRating.totalRatings} 次评分</div>
                </div>

                <div className="card p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-sky-500" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">LLM 自动评分</div>
                      <div className="text-2xl font-bold text-slate-800">{stats.autoQuality.avgOverall.toFixed(1)}</div>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 to-sky-600 rounded-full"
                      style={{ width: `${(stats.autoQuality.avgOverall / 5) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-400 mt-2">共 {stats.autoQuality.totalEvals} 次自动评估</div>
                </div>

                <div className="card p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <ThumbsUp className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">反馈数量</div>
                      <div className="text-2xl font-bold text-slate-800">{stats.recentFeedback.length}</div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">最近的文字反馈</div>
                </div>
              </div>

              {/* 最近反馈列表 */}
              <div className="card p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-slate-500" />
                  <h2 className="text-sm font-semibold text-slate-800">最近反馈</h2>
                </div>
                {stats.recentFeedback.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">暂无文字反馈</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {stats.recentFeedback.map((fb, i) => (
                      <div key={i} className="px-4 py-3 flex items-start gap-3">
                        <StarRating rating={fb.rating} />
                        <p className="text-sm text-slate-600 flex-1">{fb.feedback}</p>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {new Date(fb.createdAt).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default EvaluationAdminPage;
