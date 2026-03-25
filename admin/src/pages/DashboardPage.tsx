import { useState, useEffect } from 'react';
import { LayoutDashboard, Bot, BookOpen, GitBranch, MessageSquare, RefreshCw, Cpu, Sparkles } from 'lucide-react';
import { fetchDashboard, triggerAdminIngest, fetchAdminPrompts } from '../api';

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
      setIngestMsg(`✅ 同步完成：${result.totalAgents} 个 Agent，${result.totalCategories} 个分类`);
      await loadDashboard();
    } catch (err) {
      setIngestMsg('❌ 同步失败');
    } finally {
      setIngesting(false);
    }
  };

  const statCards = data ? [
    { label: 'Agent 总数', value: data.stats.agentCount, icon: Bot, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-100' },
    { label: '知识库条目', value: data.stats.knowledgeCount, icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: '流水线', value: data.stats.pipelineCount, icon: GitBranch, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
    { label: '对话记录', value: data.stats.chatCount, icon: MessageSquare, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
    { label: '系统提示词', value: promptCount, icon: Sparkles, color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-100' },
  ] : [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-sky-600" />
            仪表盘
          </h1>
          <p className="text-slate-400 text-sm mt-1">Agency Agents 管理后台</p>
        </div>
        <button
          className="btn-secondary"
          onClick={handleIngest}
          disabled={ingesting}
          aria-label="同步 Agent 数据"
        >
          <RefreshCw className={`w-4 h-4 ${ingesting ? 'animate-spin' : ''}`} />
          {ingesting ? '同步中...' : '同步 Agent 数据'}
        </button>
      </div>

      {ingestMsg && (
        <div className={`text-sm px-4 py-3 rounded-lg border ${ingestMsg.startsWith('✅') ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
          {ingestMsg}
        </div>
      )}

      {/* Provider 状态 */}
      {data && (
        <div className="card flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-sky-600" />
          </div>
          <div>
            <span className="text-sm text-slate-500">当前提供商：</span>
            <span className="text-slate-800 font-semibold ml-1">{data.provider.active === 'ollama' ? '🦙 Ollama' : '🤖 CodeBuddy'}</span>
          </div>
          <div className="text-xs text-slate-400 ml-4">
            Ollama: {data.provider.ollama} · CodeBuddy: {data.provider.codebuddy}
          </div>
        </div>
      )}

      {/* 统计卡片 */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-8 bg-slate-100 rounded w-1/2 mb-2" />
              <div className="h-10 bg-slate-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {statCards.map(({ label, value, icon: Icon, color, bg, border }) => (
            <div key={label} className={`card border ${border}`}>
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className={`text-3xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-slate-400 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 最近对话 */}
      {data && data.recentChats.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-amber-500" />
            最近对话
          </h2>
          <div className="space-y-1">
            {data.recentChats.map((chat) => (
              <div key={chat._id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                <span className="text-sm text-slate-700">{chat.agentName || 'AI Assistant'}</span>
                <span className="text-xs text-slate-400">{new Date(chat.updatedAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
