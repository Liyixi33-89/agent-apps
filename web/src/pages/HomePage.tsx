import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Zap, MessageSquare, BookOpen, GitBranch, ArrowRight, RefreshCw, TrendingUp } from 'lucide-react';
import { fetchOverview, triggerIngest } from '../api';
import { useAppStore } from '../store';
import type { Agent, Category } from '../types';

const colorMap: Record<string, string> = {
  sky: 'bg-sky-600/20 text-sky-400 border-sky-600/30',
  violet: 'bg-violet-600/20 text-violet-400 border-violet-600/30',
  emerald: 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30',
  rose: 'bg-rose-600/20 text-rose-400 border-rose-600/30',
  amber: 'bg-amber-600/20 text-amber-400 border-amber-600/30',
  pink: 'bg-pink-600/20 text-pink-400 border-pink-600/30',
  cyan: 'bg-cyan-600/20 text-cyan-400 border-cyan-600/30',
  orange: 'bg-orange-600/20 text-orange-400 border-orange-600/30',
  lime: 'bg-lime-600/20 text-lime-400 border-lime-600/30',
  indigo: 'bg-indigo-600/20 text-indigo-400 border-indigo-600/30',
  teal: 'bg-teal-600/20 text-teal-400 border-teal-600/30',
  blue: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
  fuchsia: 'bg-fuchsia-600/20 text-fuchsia-400 border-fuchsia-600/30',
  slate: 'bg-slate-600/20 text-slate-400 border-slate-600/30'
};

const AgentCard = ({ agent, lang }: { agent: Agent; lang: 'zh' | 'en' }) => {
  const colorClass = colorMap[agent.color] || colorMap.slate;
  return (
    <Link
      to={`/agents/${agent.slug}`}
      className="card-hover group animate-fade-in"
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg border flex items-center justify-center text-xl flex-shrink-0 ${colorClass}`}>
          {agent.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-100 text-sm truncate group-hover:text-sky-400 transition-colors">
            {lang === 'zh' ? agent.name.zh : agent.name.en}
          </div>
          <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
            {lang === 'zh' ? agent.description.zh : agent.description.en}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className={`badge border ${colorClass} text-xs`}>
          {agent.categoryKey}
        </span>
        <span className="badge bg-gray-800 text-gray-500 text-xs">
          {agent.modelPreferences.primary === 'vision' ? '👁️ Vision' : '💬 Text'}
        </span>
      </div>
    </Link>
  );
};

const CategoryCard = ({ category, lang }: { category: Category; lang: 'zh' | 'en' }) => {
  const colorClass = colorMap[category.color] || colorMap.slate;
  return (
    <Link
      to={`/agents?category=${category.key}`}
      className="card-hover flex items-center gap-3"
    >
      <div className={`w-10 h-10 rounded-lg border flex items-center justify-center text-xl flex-shrink-0 ${colorClass}`}>
        {category.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-100 text-sm">
          {lang === 'zh' ? category.name.zh : category.name.en}
        </div>
        <div className="text-xs text-gray-500">{category.stats.agentCount} agents</div>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
    </Link>
  );
};

const HomePage = () => {
  const { lang, activeProvider } = useAppStore();
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
    { to: '/vibe', icon: Zap, label: { zh: 'Vibe Coding', en: 'Vibe Coding' }, desc: { zh: '自然语言生成代码', en: 'Generate code from natural language' }, color: 'text-yellow-400' },
    { to: '/chat', icon: MessageSquare, label: { zh: '开始对话', en: 'Start Chat' }, desc: { zh: '与 Agent 实时交流', en: 'Chat with agents in real-time' }, color: 'text-sky-400' },
    { to: '/knowledge', icon: BookOpen, label: { zh: '知识库', en: 'Knowledge' }, desc: { zh: '浏览 RAG 知识库', en: 'Browse RAG knowledge base' }, color: 'text-emerald-400' },
    { to: '/pipelines', icon: GitBranch, label: { zh: '流水线', en: 'Pipelines' }, desc: { zh: '查看工作流编排', en: 'View workflow pipelines' }, color: 'text-violet-400' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* 头部 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {lang === 'zh' ? '🤖 Agency Agents 平台' : '🤖 Agency Agents Platform'}
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            {lang === 'zh'
              ? '探索、构建和部署 AI Agent，支持 Vibe Coding 与知识库问答'
              : 'Explore, build and deploy AI Agents with Vibe Coding and RAG knowledge base'}
          </p>
        </div>
        <button
          className="btn-secondary text-sm"
          onClick={handleIngest}
          disabled={ingesting}
          aria-label="同步 Agent 数据"
        >
          <RefreshCw className={`w-4 h-4 ${ingesting ? 'animate-spin' : ''}`} />
          {ingesting ? '同步中...' : '同步数据'}
        </button>
      </div>

      {/* 同步结果提示 */}
      {ingestResult && (
        <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-lg px-4 py-3 text-sm text-emerald-400">
          ✅ 同步完成：导入 {ingestResult.totalAgents} 个 Agent，{ingestResult.totalCategories} 个分类
        </div>
      )}

      {/* 统计卡片 */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: { zh: 'Agent 总数', en: 'Total Agents' }, value: overview.stats.agentCount, icon: '🤖', color: 'text-sky-400' },
            { label: { zh: '分类数量', en: 'Categories' }, value: overview.stats.categoryCount, icon: '📂', color: 'text-violet-400' },
            { label: { zh: '流水线', en: 'Pipelines' }, value: overview.stats.pipelineCount, icon: '⚡', color: 'text-amber-400' },
            { label: { zh: '知识库', en: 'Knowledge' }, value: overview.stats.knowledgeCount, icon: '📚', color: 'text-emerald-400' }
          ].map((stat) => (
            <div key={stat.label.zh} className="card">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{stat.icon}</span>
                <span className="text-xs text-gray-500">{lang === 'zh' ? stat.label.zh : stat.label.en}</span>
              </div>
              <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Provider 状态 */}
      <div className="card flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm text-gray-300">
            {lang === 'zh' ? '当前提供商' : 'Active Provider'}：
            <span className="text-white font-medium ml-1">
              {activeProvider === 'ollama' ? '🦙 Ollama' : '🤖 CodeBuddy'}
            </span>
          </span>
        </div>
        {overview && (
          <div className="text-xs text-gray-500">
            Text: {activeProvider === 'ollama' ? overview.providers.ollama.textModel : overview.providers.codebuddy.textModel}
            {' · '}
            Vision: {activeProvider === 'ollama' ? overview.providers.ollama.visionModel : overview.providers.codebuddy.visionModel}
          </div>
        )}
      </div>

      {/* 快捷入口 */}
      <div>
        <h2 className="text-base font-semibold text-gray-200 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-sky-400" />
          {lang === 'zh' ? '快捷入口' : 'Quick Access'}
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickLinks.map(({ to, icon: Icon, label, desc, color }) => (
            <Link key={to} to={to} className="card-hover">
              <Icon className={`w-6 h-6 ${color} mb-2`} />
              <div className="font-medium text-gray-100 text-sm">{lang === 'zh' ? label.zh : label.en}</div>
              <div className="text-xs text-gray-500 mt-0.5">{lang === 'zh' ? desc.zh : desc.en}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* 精选 Agents */}
      {overview && overview.featuredAgents.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-200 flex items-center gap-2">
              <Bot className="w-4 h-4 text-sky-400" />
              {lang === 'zh' ? '精选 Agent' : 'Featured Agents'}
            </h2>
            <Link to="/agents" className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
              {lang === 'zh' ? '查看全部' : 'View all'} <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {overview.featuredAgents.map((agent) => (
              <AgentCard key={agent._id} agent={agent} lang={lang} />
            ))}
          </div>
        </div>
      )}

      {/* 分类 */}
      {overview && overview.categories.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-200 mb-3 flex items-center gap-2">
            <span>📂</span>
            {lang === 'zh' ? '所有分类' : 'All Categories'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {overview.categories.map((cat) => (
              <CategoryCard key={cat._id} category={cat} lang={lang} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
