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
import { useAppStore } from '../store';
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
  const { lang, activeProvider } = useAppStore();
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

  return (
    <div className="h-full flex flex-col">
      {/* 顶部标题 */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center gap-3">
        <Users className="w-5 h-5 text-violet-600" />
        <h1 className="text-lg font-bold text-slate-800">
          {lang === 'zh' ? 'Multi-Agent 协作' : 'Multi-Agent Collaboration'}
        </h1>
        <Text type="secondary" className="text-xs">
          {lang === 'zh' ? '选择多个 Agent 协作完成复杂任务' : 'Select multiple agents to collaborate'}
        </Text>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">

          {/* 协作模式选择 */}
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">协作模式</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(Object.entries(MODE_CONFIG) as [CollaborationMode, typeof MODE_CONFIG[CollaborationMode]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    mode === key ? cfg.color + ' border-current' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                  onClick={() => setMode(key)}
                  aria-label={cfg.label}
                  tabIndex={0}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{cfg.icon}</span>
                    <span className="text-sm font-semibold">{cfg.label}</span>
                  </div>
                  <p className="text-xs text-slate-500">{cfg.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Agent 选择 */}
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">
              选择 Agent（至少 2 个）
              <span className="text-xs text-slate-400 ml-2">已选 {selectedAgents.length} 个</span>
            </label>
            {agentsLoading ? (
              <div className="flex items-center justify-center py-8 text-slate-400"><Spin size="small" /><span className="ml-2 text-sm">加载 Agent 列表...</span></div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {agents.map((agent) => {
                  const selected = selectedAgents.includes(agent.slug);
                  return (
                    <button
                      key={agent.slug}
                      className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                        selected ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                      onClick={() => toggleAgent(agent.slug)}
                      aria-label={`选择 ${agent.name.zh}`}
                      tabIndex={0}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{agent.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-700 truncate">{agent.name.zh || agent.name.en}</div>
                          <div className="text-[10px] text-slate-400 truncate">{agent.categoryKey}</div>
                        </div>
                        {selected && <CheckCircle2 className="w-4 h-4 text-violet-500 flex-shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 任务输入 */}
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">任务描述</label>
            <textarea
              className="w-full h-28 px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-400 resize-none"
              placeholder="描述你希望多个 Agent 协作完成的任务..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={running}
              aria-label="任务描述"
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-3">
            <button
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
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
              <button className="btn-secondary text-xs" onClick={handleReset} aria-label="重置" tabIndex={0}>
                <RotateCcw className="w-3.5 h-3.5" /> 重置
              </button>
            )}
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* 结果展示 */}
          {result && (
            <div className="space-y-4">
              {/* 各 Agent 输出 */}
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
                <div key={round.round} className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                  <div className="text-xs font-semibold text-violet-600 mb-2">第 {round.round} 轮辩论</div>
                  {round.arguments.map((arg, j) => {
                    const agent = agents.find((a) => a.slug === arg.agentSlug);
                    return (
                      <div key={j} className="mb-3 last:mb-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span>{agent?.emoji || '🤖'}</span>
                          <span className="text-xs font-medium text-slate-700">{agent?.name.zh || arg.agentSlug}</span>
                        </div>
                        <div className="prose-dark text-sm pl-6">
                          <ReactMarkdown remarkPlugins={remarkPlugins}>{arg.output}</ReactMarkdown>
                        </div>
                      </div>
                    );
                  })}
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
  );
};

export default MultiAgentPage;
