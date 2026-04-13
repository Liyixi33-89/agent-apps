/**
 * @file pages/MultiAgentPage.tsx
 * @description Multi-Agent 协作页面 — 选择多个 Agent 协作完成任务
 */

import { useState, useEffect, useCallback } from 'react';
import { Users, Play, Loader2, RotateCcw, CheckCircle2, AlertCircle, MessageSquare } from 'lucide-react';
import { Typography, Tag, Spin } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchCollaborationAgents, executeMultiAgent } from '../api';
import { useAppStoreShallow } from '../store';
import type { CollaborationMode } from '../types';

const { Text } = Typography;

interface AgentOption {
  _id: string;
  slug: string;
  name: { zh: string; en: string };
  description: { zh: string; en: string };
  emoji: string;
  categoryKey: string;
}

const MODE_CONFIG: Record<CollaborationMode, { label: string; desc: string; icon: string; color: string }> = {
  sequential: { label: '顺序协作', desc: 'Agent 依次处理，前一个的输出作为下一个的输入', icon: '🔗', color: 'bg-sky-50 border-sky-200 text-sky-700' },
  parallel:   { label: '并行协作', desc: '所有 Agent 同时处理，最后合并结果', icon: '⚡', color: 'bg-amber-50 border-amber-200 text-amber-700' },
  debate:     { label: '辩论模式', desc: 'Agent 之间多轮辩论，最终达成共识', icon: '🗣️', color: 'bg-violet-50 border-violet-200 text-violet-700' },
};

const MultiAgentPage = () => {
  const { lang, activeProvider } = useAppStoreShallow((s) => ({ lang: s.lang, activeProvider: s.activeProvider }));
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [mode, setMode] = useState<CollaborationMode>('sequential');
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    taskId: string;
    results?: Array<{ agentSlug: string; output: string; duration: number }>;
    finalOutput?: string;
    rounds?: Array<{ round: number; arguments: Array<{ agentSlug: string; output: string }> }>;
    verdict?: string;
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCollaborationAgents()
      .then((data) => setAgents(data))
      .catch(() => {})
      .finally(() => setAgentsLoading(false));
  }, []);

  const toggleAgent = (slug: string) => {
    setSelectedAgents((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleExecute = useCallback(async () => {
    if (!prompt.trim() || selectedAgents.length < 2 || running) return;
    setRunning(true);
    setResult(null);
    setError('');
    try {
      const data = await executeMultiAgent({
        mode,
        userPrompt: prompt.trim(),
        agents: selectedAgents,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '协作执行失败');
    } finally {
      setRunning(false);
    }
  }, [prompt, selectedAgents, mode, running]);

  const handleReset = () => {
    setResult(null);
    setError('');
    setPrompt('');
    setSelectedAgents([]);
  };

  const remarkPlugins = [remarkGfm];

  // Agent 搜索过滤
  const [agentSearch, setAgentSearch] = useState('');
  const filteredAgents = agentSearch.trim()
    ? agents.filter((a) =>
        a.name.zh.includes(agentSearch) ||
        a.name.en.toLowerCase().includes(agentSearch.toLowerCase()) ||
        a.categoryKey.includes(agentSearch)
      )
    : agents;

  return (
    <div className="h-full flex flex-col">
      {/* 顶部标题栏 */}
      <div className="px-6 py-3 border-b border-slate-200 bg-white flex items-center gap-3 flex-shrink-0">
        <Users className="w-5 h-5 text-violet-600" />
        <h1 className="text-lg font-bold text-slate-800">
          {lang === 'zh' ? 'Multi-Agent 协作' : 'Multi-Agent Collaboration'}
        </h1>
        <Text type="secondary" className="text-xs hidden sm:inline">
          {lang === 'zh' ? '选择多个 Agent 协作完成复杂任务' : 'Select multiple agents to collaborate'}
        </Text>
        {/* 已选 Agent 标签（顶栏快速预览） */}
        {selectedAgents.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5">
            {selectedAgents.slice(0, 3).map((slug) => {
              const a = agents.find((ag) => ag.slug === slug);
              return a ? (
                <span key={slug} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-medium">
                  {a.emoji} {a.name.zh || a.name.en}
                </span>
              ) : null;
            })}
            {selectedAgents.length > 3 && (
              <span className="text-[10px] text-slate-400">+{selectedAgents.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {/* 主体：左右分栏 */}
      <div className="flex-1 flex overflow-hidden">

        {/* ─── 左侧面板：配置区 ─── */}
        <div className="w-72 lg:w-80 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">

          {/* 协作模式 */}
          <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex-shrink-0">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">协作模式</label>
            <div className="space-y-1.5">
              {(Object.entries(MODE_CONFIG) as [CollaborationMode, typeof MODE_CONFIG[CollaborationMode]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  className={`w-full p-2.5 rounded-lg border text-left transition-all ${
                    mode === key
                      ? cfg.color + ' border-current shadow-sm'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                  }`}
                  onClick={() => setMode(key)}
                  aria-label={cfg.label}
                  tabIndex={0}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{cfg.icon}</span>
                    <span className="text-xs font-semibold">{cfg.label}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{cfg.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Agent 选择 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 pt-3 pb-2 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">选择 Agent</label>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                  selectedAgents.length >= 2 ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  {selectedAgents.length} 已选
                </span>
              </div>
              {/* 搜索框 */}
              <input
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs placeholder-slate-400 focus:outline-none focus:border-violet-300 focus:bg-white"
                placeholder="搜索 Agent..."
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                aria-label="搜索Agent"
              />
            </div>

            {/* Agent 列表（可滚动） */}
            <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-1">
              {agentsLoading ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <Spin size="small" /><span className="ml-2 text-xs">加载中...</span>
                </div>
              ) : filteredAgents.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">无匹配 Agent</div>
              ) : (
                filteredAgents.map((agent) => {
                  const selected = selectedAgents.includes(agent.slug);
                  return (
                    <button
                      key={agent.slug}
                      className={`w-full p-2 rounded-lg border text-left transition-all ${
                        selected
                          ? 'border-violet-300 bg-violet-50'
                          : 'border-transparent bg-slate-50 hover:bg-slate-100 hover:border-slate-200'
                      }`}
                      onClick={() => toggleAgent(agent.slug)}
                      aria-label={`选择 ${agent.name.zh}`}
                      tabIndex={0}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base flex-shrink-0">{agent.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-slate-700 truncate">{agent.name.zh || agent.name.en}</div>
                          <div className="text-[10px] text-slate-400 truncate">{agent.categoryKey}</div>
                        </div>
                        {selected && <CheckCircle2 className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ─── 右侧主区域：输入 + 结果 ─── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* 任务输入区（固定在顶部） */}
          <div className="px-5 pt-4 pb-3 border-b border-slate-100 bg-white flex-shrink-0">
            <div className="flex gap-3">
              <textarea
                className="flex-1 h-20 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-400 resize-none"
                placeholder={lang === 'zh' ? '描述你希望多个 Agent 协作完成的任务...' : 'Describe the task for agents to collaborate on...'}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={running}
                aria-label="任务描述"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleExecute();
                }}
              />
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all h-10 ${
                    running || selectedAgents.length < 2 || !prompt.trim()
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm'
                  }`}
                  onClick={handleExecute}
                  disabled={running || selectedAgents.length < 2 || !prompt.trim()}
                  aria-label="开始协作"
                  tabIndex={0}
                >
                  {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {running ? '协作中...' : '开始协作'}
                </button>
                {(result || error) && (
                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors h-8 justify-center"
                    onClick={handleReset}
                    aria-label="重置"
                    tabIndex={0}
                  >
                    <RotateCcw className="w-3 h-3" /> 重置
                  </button>
                )}
              </div>
            </div>
            {/* 快捷提示 */}
            <div className="flex items-center gap-3 mt-2">
              {selectedAgents.length < 2 && (
                <span className="text-[10px] text-amber-500">← 请在左侧选择至少 2 个 Agent</span>
              )}
              <span className="text-[10px] text-slate-400 ml-auto">Ctrl+Enter 发送</span>
            </div>
          </div>

          {/* 结果展示区（可滚动） */}
          <div className="flex-1 overflow-y-auto">
            {/* 空状态 */}
            {!result && !error && !running && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 px-6">
                <Users className="w-12 h-12 mb-3 text-slate-200" />
                <p className="text-sm font-medium text-slate-500">
                  {lang === 'zh' ? '选择 Agent 并输入任务开始协作' : 'Select agents and enter a task to start'}
                </p>
                <p className="text-xs mt-1 text-slate-400">
                  {lang === 'zh' ? '支持顺序协作、并行协作和辩论模式' : 'Supports sequential, parallel, and debate modes'}
                </p>
              </div>
            )}

            {/* 运行中 */}
            {running && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-violet-400 mb-3" />
                <p className="text-sm font-medium text-slate-600">
                  {mode === 'debate' ? '辩论进行中，请耐心等待...' : '协作执行中...'}
                </p>
                <p className="text-xs mt-1 text-slate-400">
                  {mode === 'debate' ? '辩论模式需要多轮 LLM 调用，可能需要 30-60 秒' : '正在调用 AI 模型处理任务'}
                </p>
              </div>
            )}

            {/* 错误提示 */}
            {error && (
              <div className="p-5">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              </div>
            )}

            {/* 结果内容 */}
            {result && (
              <div className="p-5 space-y-4">
                {/* 各 Agent 输出（sequential / parallel） */}
                {result.results && result.results.map((r, i) => {
                  const agent = agents.find((a) => a.slug === r.agentSlug);
                  return (
                    <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{agent?.emoji || '🤖'}</span>
                        <span className="text-sm font-semibold text-slate-700">{agent?.name.zh || r.agentSlug}</span>
                        <Tag color="default" className="text-[10px]">{r.duration}ms</Tag>
                      </div>
                      <div className="prose-dark text-sm">
                        <ReactMarkdown remarkPlugins={remarkPlugins}>{r.output}</ReactMarkdown>
                      </div>
                    </div>
                  );
                })}

                {/* 辩论轮次 */}
                {result.rounds && result.rounds.map((round) => (
                  <div key={round.round} className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
                    <div className="text-xs font-semibold text-violet-600 mb-3 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                      第 {round.round} 轮辩论
                    </div>
                    <div className="space-y-3">
                      {round.arguments.map((arg, j) => {
                        const agent = agents.find((a) => a.slug === arg.agentSlug);
                        return (
                          <div key={j} className="bg-white rounded-lg p-3 border border-violet-100">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span>{agent?.emoji || '🤖'}</span>
                              <span className="text-xs font-medium text-slate-700">{agent?.name.zh || arg.agentSlug}</span>
                            </div>
                            <div className="prose-dark text-sm">
                              <ReactMarkdown remarkPlugins={remarkPlugins}>{arg.output}</ReactMarkdown>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* 最终输出 */}
                {(result.finalOutput || result.verdict) && (
                  <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm font-semibold text-emerald-700">最终结果</span>
                    </div>
                    <div className="prose-dark text-sm">
                      <ReactMarkdown remarkPlugins={remarkPlugins}>{result.finalOutput || result.verdict || ''}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiAgentPage;
