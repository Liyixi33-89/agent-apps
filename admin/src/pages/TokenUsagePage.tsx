/**
 * @file pages/TokenUsagePage.tsx
 * @description Token 用量统计详情页 — 图表 + 历史记录
 */

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, Clock, Zap, DollarSign, TrendingUp, ChevronLeft,
  ChevronRight, Loader2, RefreshCw, Filter,
} from 'lucide-react';
import {
  fetchTokenUsageToday, fetchTokenUsageStats, fetchTokenUsageHistory,
  type TokenUsageOverview,
} from '../api';

// ─── 统计卡片 ────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}

const StatCard = ({ icon, label, value, sub, color }: StatCardProps) => (
  <div className="card p-4 flex items-center gap-3">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
      {icon}
    </div>
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-lg font-bold text-slate-800">{value}</div>
      {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
    </div>
  </div>
);

// ─── 简易柱状图 ──────────────────────────────────────────────────────────────

const SimpleBarChart = ({ data, labelKey, valueKey }: { data: Array<Record<string, unknown>>; labelKey: string; valueKey: string }) => {
  if (!data.length) return <div className="text-center py-8 text-slate-400 text-sm">暂无数据</div>;
  const maxVal = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);

  return (
    <div className="space-y-2">
      {data.map((item, i) => {
        const val = Number(item[valueKey]) || 0;
        const pct = (val / maxVal) * 100;
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-slate-500 w-24 truncate">{String(item[labelKey] || '-')}</span>
            <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-400 to-sky-600 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-slate-600 font-mono w-16 text-right">{val.toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
};

// ─── 主页面 ──────────────────────────────────────────────────────────────────

const TokenUsagePage = () => {
  const [overview, setOverview] = useState<TokenUsageOverview | null>(null);
  const [stats, setStats] = useState<Array<Record<string, unknown>>>([]);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<'provider' | 'model' | 'callType' | 'day'>('provider');
  const [providerFilter, setProviderFilter] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [todayData, statsData, historyData] = await Promise.all([
        fetchTokenUsageToday(),
        fetchTokenUsageStats({ groupBy }),
        fetchTokenUsageHistory({ page, limit: 20, provider: providerFilter || undefined }),
      ]);
      setOverview(todayData);
      setStats(statsData);
      setHistory(historyData.data);
      setHistoryTotal(historyData.pagination.total);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [groupBy, page, providerFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalPages = Math.ceil(historyTotal / 20);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-sky-600" />
          Token 用量统计
        </h1>
        <button className="btn-secondary text-xs" onClick={loadData} disabled={loading} aria-label="刷新" tabIndex={0}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          刷新
        </button>
      </div>

      {/* 今日概览 */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard icon={<Zap className="w-5 h-5 text-amber-600" />} label="今日 Token" value={overview.totalTokens?.toLocaleString() || '0'} color="bg-amber-50" />
          <StatCard icon={<DollarSign className="w-5 h-5 text-emerald-600" />} label="预估费用" value={`$${(overview.totalCost || 0).toFixed(4)}`} color="bg-emerald-50" />
          <StatCard icon={<TrendingUp className="w-5 h-5 text-sky-600" />} label="调用次数" value={String(overview.callCount || 0)} sub={`成功率 ${((overview.successRate || 1) * 100).toFixed(0)}%`} color="bg-sky-50" />
          <StatCard icon={<Clock className="w-5 h-5 text-violet-600" />} label="预算剩余" value={overview.budget > 0 ? `${((overview.remaining / overview.budget) * 100).toFixed(0)}%` : '无限制'} sub={overview.budget > 0 ? `${overview.remaining?.toLocaleString()} / ${overview.budget?.toLocaleString()}` : ''} color="bg-violet-50" />
        </div>
      )}

      {/* 分组统计 */}
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-800">用量分布</h2>
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
            {(['provider', 'model', 'callType', 'day'] as const).map((g) => (
              <button
                key={g}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                  groupBy === g ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => setGroupBy(g)}
                aria-label={`按${g}分组`}
                tabIndex={0}
              >
                {g === 'provider' ? 'Provider' : g === 'model' ? '模型' : g === 'callType' ? '调用类型' : '日期'}
              </button>
            ))}
          </div>
        </div>
        <SimpleBarChart data={stats} labelKey="_id" valueKey="totalTokens" />
      </div>

      {/* 历史记录 */}
      <div className="card overflow-hidden p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">调用历史</h2>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white"
              value={providerFilter}
              onChange={(e) => { setProviderFilter(e.target.value); setPage(1); }}
              aria-label="筛选Provider"
            >
              <option value="">全部 Provider</option>
              <option value="ollama">Ollama</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-semibold">时间</th>
                <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-semibold">Provider</th>
                <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-semibold">模型</th>
                <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-semibold">类型</th>
                <th className="text-right px-4 py-2.5 text-xs text-slate-500 font-semibold">Prompt</th>
                <th className="text-right px-4 py-2.5 text-xs text-slate-500 font-semibold">Completion</th>
                <th className="text-right px-4 py-2.5 text-xs text-slate-500 font-semibold">耗时</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-2.5"><div className="h-3.5 bg-slate-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : history.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-sm">暂无调用记录</td></tr>
              ) : history.map((record, i) => (
                <tr key={i} className="table-row">
                  <td className="px-4 py-2.5 text-xs text-slate-400">{record.createdAt ? new Date(String(record.createdAt)).toLocaleString('zh-CN') : '-'}</td>
                  <td className="px-4 py-2.5"><span className="badge bg-slate-100 text-slate-600 text-[10px]">{String(record.provider || '-')}</span></td>
                  <td className="px-4 py-2.5 text-xs text-slate-600 font-mono">{String(record.model || '-')}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{String(record.callType || '-')}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-600 text-right font-mono">{Number(record.promptTokens || 0).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-600 text-right font-mono">{Number(record.completionTokens || 0).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400 text-right">{Number(record.duration || 0)}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <span className="text-xs text-slate-400">第 {page} / {totalPages} 页，共 {historyTotal} 条</span>
            <div className="flex gap-2">
              <button className="btn-ghost text-xs px-2 py-1" disabled={page === 1} onClick={() => setPage((p) => p - 1)} aria-label="上一页" tabIndex={0}><ChevronLeft className="w-4 h-4" /></button>
              <button className="btn-ghost text-xs px-2 py-1" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="下一页" tabIndex={0}><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TokenUsagePage;
