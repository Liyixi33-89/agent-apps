import { useState, useEffect } from 'react';
import { LayoutDashboard, Bot, BookOpen, GitBranch, MessageSquare, RefreshCw, Cpu } from 'lucide-react';
import { fetchDashboard, triggerAdminIngest } from '../api';

interface DashboardData {
  stats: { agentCount: number; categoryCount: number; pipelineCount: number; knowledgeCount: number; chatCount: number };
  recentChats: Array<{ _id: string; agentName?: string; updatedAt: string }>;
  provider: { active: string; ollama: string; codebuddy: string };
}

const DashboardPage = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [ingestMsg, setIngestMsg] = useState('');

  const loadDashboard = async () => {
    try {
      const result = await fetchDashboard();
      setData(result);
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
    { label: 'Agent 总数', value: data.stats.agentCount, icon: Bot, color: 'text-sky-400' },
    { label: '知识库条目', value: data.stats.knowledgeCount, icon: BookOpen, color: 'text-emerald-400' },
    { label: '流水线', value: data.stats.pipelineCount, icon: GitBranch, color: 'text-violet-400' },
    { label: '对话记录', value: data.stats.chatCount, icon: MessageSquare, color: 'text-amber-400' }
  ] : [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-sky-400" />
            仪表盘
          </h1>
          <p className="text-gray-400 text-sm mt-1">Agency Agents 管理后台</p>
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
        <div className={`text-sm px-4 py-3 rounded-lg border ${ingestMsg.startsWith('✅') ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-400' : 'bg-red-900/30 border-red-700/50 text-red-400'}`}>
          {ingestMsg}
        </div>
      )}

      {/* Provider 状态 */}
      {data && (
        <div className="card flex items-center gap-4">
          <Cpu className="w-5 h-5 text-sky-400" />
          <div>
            <span className="text-sm text-gray-300">当前提供商：</span>
            <span className="text-white font-medium ml-1">{data.provider.active === 'ollama' ? '🦙 Ollama' : '🤖 CodeBuddy'}</span>
          </div>
          <div className="text-xs text-gray-500 ml-4">
            Ollama: {data.provider.ollama} · CodeBuddy: {data.provider.codebuddy}
          </div>
        </div>
      )}

      {/* 统计卡片 */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-8 bg-gray-800 rounded w-1/2 mb-2" />
              <div className="h-10 bg-gray-800 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-xs text-gray-500">{label}</span>
              </div>
              <div className={`text-3xl font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* 最近对话 */}
      {data && data.recentChats.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-amber-400" />
            最近对话
          </h2>
          <div className="space-y-2">
            {data.recentChats.map((chat) => (
              <div key={chat._id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <span className="text-sm text-gray-300">{chat.agentName || 'AI Assistant'}</span>
                <span className="text-xs text-gray-600">{new Date(chat.updatedAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
