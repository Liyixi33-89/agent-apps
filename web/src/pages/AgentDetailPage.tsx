import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Zap, BookOpen, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchAgent } from '../api';
import { useLang } from '../store';
import type { Agent } from '../types';

const colorMap: Record<string, string> = {
  sky: 'bg-sky-50 text-sky-600 border-sky-200',
  violet: 'bg-violet-50 text-violet-600 border-violet-200',
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  rose: 'bg-rose-50 text-rose-600 border-rose-200',
  amber: 'bg-amber-50 text-amber-600 border-amber-200',
  pink: 'bg-pink-50 text-pink-600 border-pink-200',
  cyan: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  orange: 'bg-orange-50 text-orange-600 border-orange-200',
  lime: 'bg-lime-50 text-lime-600 border-lime-200',
  indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  teal: 'bg-teal-50 text-teal-600 border-teal-200',
  blue: 'bg-blue-50 text-blue-600 border-blue-200',
  fuchsia: 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-200',
  slate: 'bg-slate-100 text-slate-600 border-slate-200'
};

const AgentDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const lang = useLang();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));
  const [activeTab, setActiveTab] = useState<'overview' | 'workflow' | 'raw'>('overview');

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetchAgent(slug)
      .then(setAgent)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  const handleToggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
      <p className="text-slate-400">Agent 不存在</p>
        <Link to="/agents" className="btn-secondary text-sm">返回列表</Link>
      </div>
    );
  }

  const colorClass = colorMap[agent.color] || colorMap.slate;

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      {/* 返回 */}
      <button
        className="btn-ghost text-sm mb-4"
        onClick={() => navigate(-1)}
        aria-label="返回"
      >
        <ArrowLeft className="w-4 h-4" />
        {lang === 'zh' ? '返回' : 'Back'}
      </button>

      {/* Agent 头部 */}
      <div className="card mb-6">
        <div className="flex items-start gap-4">
          <div className={`w-16 h-16 rounded-xl border-2 flex items-center justify-center text-3xl flex-shrink-0 ${colorClass}`}>
            {agent.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-800">
              {lang === 'zh' ? agent.name.zh : agent.name.en}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {lang === 'zh' ? agent.description.zh : agent.description.en}
            </p>
            {agent.vibe.en && (
              <p className="text-xs text-slate-400 italic mt-2">
                "{lang === 'zh' ? agent.vibe.zh : agent.vibe.en}"
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`badge border ${colorClass}`}>{agent.categoryKey}</span>
              <span className="badge bg-slate-100 text-slate-500">
                {agent.modelPreferences.primary === 'vision' ? '👁️ Vision' : '💬 Text'}
              </span>
              <span className="badge bg-slate-100 text-slate-500">
                {agent.modelPreferences.recommendedProvider}
              </span>
              <span className="badge bg-slate-50 text-slate-400">
                {agent.stats.wordCount.toLocaleString()} words
              </span>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
          <Link
            to={`/chat?agent=${agent.slug}`}
            className="btn-primary text-sm"
          >
            <MessageSquare className="w-4 h-4" />
            {lang === 'zh' ? '开始对话' : 'Start Chat'}
          </Link>
          <Link
            to={`/vibe?agent=${agent.slug}`}
            className="btn-secondary text-sm"
          >
            <Zap className="w-4 h-4" />
            Vibe Coding
          </Link>
          <Link
            to={`/knowledge?agent=${agent.slug}`}
            className="btn-ghost text-sm"
          >
            <BookOpen className="w-4 h-4" />
            {lang === 'zh' ? '知识库' : 'Knowledge'}
          </Link>
        </div>
      </div>

      {/* 标签 */}
      {agent.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          <Tag className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
          {agent.tags.slice(0, 15).map((tag) => (
            <span key={tag} className="badge bg-slate-100 text-slate-500 text-xs">{tag}</span>
          ))}
        </div>
      )}

      {/* Tab 切换 */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1">
        {(['overview', 'workflow', 'raw'] as const).map((tab) => (
          <button
            key={tab}
            className={`flex-1 py-2 text-sm rounded-md transition-colors font-medium ${activeTab === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'overview' ? (lang === 'zh' ? '概览' : 'Overview') : tab === 'workflow' ? (lang === 'zh' ? '工作流' : 'Workflow') : (lang === 'zh' ? '原始文档' : 'Raw')}
          </button>
        ))}
      </div>

      {/* 概览 Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          {/* 能力列表 */}
          {agent.capabilities.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                {lang === 'zh' ? '核心能力' : 'Core Capabilities'}
              </h3>
              <ul className="space-y-1.5">
                {agent.capabilities.map((cap, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="text-sky-500 mt-0.5">•</span>
                    {lang === 'zh' ? cap.zh : cap.en}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 章节列表 */}
          {agent.sections.map((section) => (
            <div key={section.key} className="card">
              <button
                className="w-full flex items-center justify-between text-left"
                onClick={() => handleToggleSection(section.key)}
                aria-expanded={expandedSections.has(section.key)}
              >
                <h3 className="text-sm font-semibold text-slate-700">
                  {lang === 'zh' ? section.heading.zh : section.heading.en}
                </h3>
                {expandedSections.has(section.key)
                  ? <ChevronUp className="w-4 h-4 text-slate-400" />
                  : <ChevronDown className="w-4 h-4 text-slate-400" />
                }
              </button>
              {expandedSections.has(section.key) && (
                <div className="mt-3 prose-dark">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {lang === 'zh' ? section.markdown.zh : section.markdown.en}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 工作流 Tab */}
      {activeTab === 'workflow' && (
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            {lang === 'zh' ? agent.workflow.summary.zh : agent.workflow.summary.en}
          </h3>
          {agent.workflow.nodes.length === 0 ? (
            <p className="text-slate-400 text-sm">暂无工作流节点</p>
          ) : (
            <div className="space-y-3">
              {agent.workflow.nodes.map((node, i) => (
                <div key={node.nodeId} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-7 h-7 rounded-full bg-sky-50 border border-sky-200 flex items-center justify-center text-xs text-sky-600 font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    {i < agent.workflow.nodes.length - 1 && (
                      <div className="w-px flex-1 bg-slate-200 mt-1 min-h-[16px]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-700 text-sm">
                      {lang === 'zh' ? node.label.zh : node.label.en}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {lang === 'zh' ? node.promptHint.zh : node.promptHint.en}
                    </div>
                    <div className="flex gap-2 mt-1">
                      <span className="badge bg-slate-100 text-slate-500 text-xs">{node.type}</span>
                      <span className="badge bg-slate-100 text-slate-500 text-xs">
                        {node.modelType === 'vision' ? '👁️ Vision' : '💬 Text'}
                      </span>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 原始文档 Tab */}
      {activeTab === 'raw' && (
        <div className="card">
          <div className="prose-dark">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {agent.rawMarkdown}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentDetailPage;
