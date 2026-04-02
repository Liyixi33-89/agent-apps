import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import { analyzeTaskComplexity, executeAgentPlan, executeFullStackPipeline } from '../../api';
import type { FullStackPipelineSSEEvent } from '../../api';
import type { PlanSSEEvent } from '../../types';
import type { PipelineStep, CodeParts, ServerParts, DbSchema } from './types';
import { extractCodeParts, extractReactCodeParts } from './utils';
import type { VibeSessionContext } from './useVibeSession';

/**
 * useVibePipeline — 提取 Pipeline 相关的 3 种执行策略 + 智能入口
 */
export const useVibePipeline = (
  ctx: VibeSessionContext,
  handleVibeStream: (content: string, currentHtml?: string, skipUserMsg?: boolean) => Promise<void>,
  handleSendWithContent: (content: string, skipUserMsg?: boolean) => Promise<void>,
) => {
  const {
    lang,
    messages, setMessages,
    provider, modelType,
    isReactMode, isFullStackMode,
    setServerParts, setDbSchema,
    setRuntimeApiBase,
    setDeployedAppId,
    setCodeParts, setIsFromPreviousSession,
    setPipelineSteps, setPipelineRunning,
    setPlanComplexity, setPlanGoal,
    setAgentPlanSteps, setIsAgentPlanMode,
    planComplexity,
    abortRef, agentPlanAbortRef, fullStackAbortRef,
    streaming, pipelineRunning, input, setInput,
    handleSaveHistory,
  } = ctx;

  // ─── 固定 4 步 Pipeline ─────────────────────────────────────────────────────

  const runFixedPipeline = useCallback(async (trimmed: string) => {
    const initialSteps: PipelineStep[] = [
      { step: 1, total: 4, title: '📋 需求分析', status: 'pending' },
      { step: 2, total: 4, title: '🎨 UI 设计', status: 'pending' },
      { step: 3, total: 4, title: '⚡ 代码生成', status: 'pending' },
      { step: 4, total: 4, title: '🔧 质检优化', status: 'pending' },
    ];
    setPipelineSteps(initialSteps);
    setIsAgentPlanMode(false);

    abortRef.current = new AbortController();

    try {
      const response = await fetch('/api/vibe/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed, provider, modelType }),
        signal: abortRef.current.signal,
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.type === 'step') {
              setPipelineSteps((prev) =>
                prev.map((s) =>
                  s.step === parsed.step
                    ? { ...s, title: parsed.title, status: parsed.status, content: parsed.content }
                    : s
                )
              );
            } else if (parsed.type === 'done' && parsed.content) {
              const parts = isReactMode
                ? extractReactCodeParts(parsed.content)
                : extractCodeParts(parsed.content);
              if (parts.jsx || parts.html || parts.css || parts.js || parts.isFullHtml) {
                setCodeParts(parts);
                setIsFromPreviousSession(false);
                handleSaveHistory(trimmed, parts);
              }
              const analysisPreview = parsed.analysis
                ? parsed.analysis.slice(0, 200) + (parsed.analysis.length > 200 ? '...' : '')
                : '';
              const designPreview = parsed.design
                ? '\n\n🎨 **设计规范**\n' + parsed.design.slice(0, 200) + (parsed.design.length > 200 ? '...' : '')
                : '';
              setMessages((prev) => [
                ...prev,
                {
                  role: 'assistant' as const,
                  content: `✅ Pipeline 完成！已通过 4 个 Agent 协作生成完整应用。\n\n${analysisPreview}${designPreview}`,
                  timestamp: new Date().toISOString(),
                  provider,
                },
              ]);
            } else if (parsed.type === 'error') {
              setMessages((prev) => [
                ...prev,
                {
                  role: 'assistant' as const,
                  content: `❌ Pipeline 失败：${parsed.message}`,
                  timestamp: new Date().toISOString(),
                },
              ]);
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant' as const,
            content: lang === 'zh' ? '❌ Pipeline 执行失败，请检查服务连接' : '❌ Pipeline failed',
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    }
  }, [lang, provider, modelType, isReactMode, abortRef, setPipelineSteps, setIsAgentPlanMode, setMessages, setCodeParts, setIsFromPreviousSession, handleSaveHistory]);

  // ─── 全栈 5 步 Pipeline ─────────────────────────────────────────────────────

  const runFullStackPipeline = useCallback((trimmed: string) => {
    const initialSteps: PipelineStep[] = [
      { step: 1, total: 6, title: '📋 全栈需求分析', status: 'pending' },
      { step: 2, total: 6, title: '🗄️ 数据库架构', status: 'pending' },
      { step: 3, total: 6, title: '⚙️ 后端代码', status: 'pending' },
      { step: 4, total: 6, title: '🎨 前端代码', status: 'pending' },
      { step: 5, total: 6, title: '🎯 UI/UX 设计', status: 'pending' },
      { step: 6, total: 6, title: '🔧 质检整合', status: 'pending' },
    ];
    setPipelineSteps(initialSteps);
    setIsAgentPlanMode(false);

    const cleanup = executeFullStackPipeline(
      trimmed,
      { provider, modelType },
      (event: FullStackPipelineSSEEvent) => {
        if (event.type === 'step') {
          setPipelineSteps((prev) =>
            prev.map((s) =>
              s.step === event.step
                ? { ...s, title: event.title || s.title, status: event.status || s.status, content: event.content }
                : s
            )
          );
        } else if (event.type === 'done') {
          console.info('[VibeCoding] done 事件:', {
            hasRuntimeApiBase: !!event.runtimeApiBase,
            runtimeApiBase: event.runtimeApiBase,
            hasCodeParts: !!event.codeParts,
            hasJsx: !!event.codeParts?.jsx,
          });

          if (event.serverParts) {
            setServerParts(event.serverParts as ServerParts);
          }
          if (event.dbSchema) {
            setDbSchema(event.dbSchema as DbSchema);
          }

          // 使用 flushSync 确保 runtimeApiBase 和 codeParts 在同一次同步渲染中更新
          flushSync(() => {
            if (event.runtimeApiBase) {
              setRuntimeApiBase(event.runtimeApiBase);
            }
            if (event.appId) {
              setDeployedAppId(event.appId);
            }

            if (event.codeParts) {
              const parts: CodeParts = {
                html: event.codeParts.html || '',
                css: event.codeParts.css || '',
                js: event.codeParts.js || '',
                jsx: event.codeParts.jsx || '',
                isReact: event.codeParts.isReact ?? true,
                isFullHtml: event.codeParts.isFullHtml ?? false,
              };
              setCodeParts(parts);
              setIsFromPreviousSession(false);
              handleSaveHistory(trimmed, parts);
            }
          });

          const analysisPreview = event.analysis
            ? event.analysis.slice(0, 300) + (event.analysis.length > 300 ? '...' : '')
            : '';

          const deployStatus = event.runtimeApiBase
            ? `\n- ✅ 后端已自动部署到 \`${event.runtimeApiBase}\``
            : '\n- ⚠️ 后端自动部署失败，可稍后在 Admin 后台手动部署';
          const appIdInfo = event.appId
            ? `\n- 📦 应用 ID: \`${event.appId}\``
            : '';

          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant' as const,
              content: `✅ 全栈 Pipeline 完成！已通过 6 个 Agent 协作生成完整全栈应用。\n\n📋 **需求分析摘要**\n${analysisPreview}\n\n🗂️ 生成内容：\n- ✅ MongoDB 数据库 Schema\n- ✅ Koa 后端路由 + Service\n- ✅ React 前端页面\n- ✅ UI/UX 设计增强${deployStatus}${appIdInfo}\n\n💡 前端代码已在右侧预览面板中展示，后端代码可在 Admin 后台查看和编辑。`,
              timestamp: new Date().toISOString(),
              provider,
            },
          ]);
          setPipelineRunning(false);
        } else if (event.type === 'error') {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant' as const,
              content: `❌ 全栈 Pipeline 失败：${event.message}`,
              timestamp: new Date().toISOString(),
            },
          ]);
          setPipelineRunning(false);
        }
      },
      (err) => {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant' as const,
            content: `❌ 连接失败：${err.message}`,
            timestamp: new Date().toISOString(),
          },
        ]);
        setPipelineRunning(false);
      }
    );

    fullStackAbortRef.current = cleanup;
  }, [provider, modelType, setPipelineSteps, setIsAgentPlanMode, setMessages, setServerParts, setDbSchema, setRuntimeApiBase, setDeployedAppId, setCodeParts, setIsFromPreviousSession, handleSaveHistory, setPipelineRunning, fullStackAbortRef]);

  // ─── Agent Plan-Execute 流程 ────────────────────────────────────────────────

  const runAgentPlan = useCallback((trimmed: string) => {
    setIsAgentPlanMode(true);
    setAgentPlanSteps([]);
    setPlanGoal('');

    const cleanup = executeAgentPlan(
      trimmed,
      { provider, modelType, ...(isReactMode ? { isReact: true } : {}) },
      (event: PlanSSEEvent) => {
        switch (event.type) {
          case 'analyze':
            setPlanComplexity(event.complexity);
            break;

          case 'plan_ready':
            setPlanGoal(event.plan.goal);
            setAgentPlanSteps(
              event.plan.steps.map((s) => ({
                id: s.id,
                index: s.index,
                title: s.title,
                status: s.status,
              }))
            );
            break;

          case 'step_update':
            setAgentPlanSteps((prev) => {
              const exists = prev.some((s) => s.id === event.step.id);
              const updated = {
                id: event.step.id,
                index: event.step.index,
                title: event.step.title,
                status: event.step.status,
                toolResults: event.step.toolResults,
                error: event.step.error,
              };
              return exists
                ? prev.map((s) => (s.id === event.step.id ? updated : s))
                : [...prev, updated];
            });
            break;

          case 'done': {
            setAgentPlanSteps((prev) =>
              prev.map((s) => {
                const finalStep = event.plan.steps.find((ps) => ps.id === s.id);
                return finalStep ? { ...s, status: finalStep.status } : s;
              })
            );
            const CODE_BLOCK_RE = isReactMode
              ? /```(?:jsx|tsx)[\s\S]*?```/i
              : /```html[\s\S]*?```|<!DOCTYPE\s+html[\s\S]*?<\/html>/i;
            const codeSource =
              (event.finalResult && CODE_BLOCK_RE.test(event.finalResult))
                ? event.finalResult
                : event.plan.steps
                    .slice()
                    .reverse()
                    .find((s) => s.result && CODE_BLOCK_RE.test(s.result))?.result ?? event.finalResult;

            if (codeSource) {
              const parts = isReactMode
                ? extractReactCodeParts(codeSource)
                : extractCodeParts(codeSource);
              if (parts.jsx || parts.html || parts.css || parts.js || parts.isFullHtml) {
                setCodeParts(parts);
                setIsFromPreviousSession(false);
                handleSaveHistory(trimmed, parts);
              }
            }
            const complexityLabel = { simple: '简单', moderate: '中等', complex: '复杂' }[planComplexity ?? 'moderate'];
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant' as const,
                content: event.success
                  ? `✅ Agent 规划完成！复杂度：${complexityLabel}，共执行 ${event.plan.steps.length} 个步骤。`
                  : `⚠️ Agent 规划部分完成，部分步骤失败，请查看步骤详情。`,
                timestamp: new Date().toISOString(),
                provider,
              },
            ]);
            setPipelineRunning(false);
            break;
          }

          case 'error':
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant' as const,
                content: `❌ Agent 规划失败：${event.message}`,
                timestamp: new Date().toISOString(),
              },
            ]);
            setPipelineRunning(false);
            break;
        }
      },
      (err) => {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant' as const,
            content: `❌ 连接失败：${err.message}`,
            timestamp: new Date().toISOString(),
          },
        ]);
        setPipelineRunning(false);
      }
    );

    agentPlanAbortRef.current = cleanup;
  }, [provider, modelType, isReactMode, planComplexity, setIsAgentPlanMode, setAgentPlanSteps, setPlanGoal, setPlanComplexity, setMessages, setCodeParts, setIsFromPreviousSession, handleSaveHistory, setPipelineRunning, agentPlanAbortRef]);

  // ─── 智能 Pipeline 入口 ─────────────────────────────────────────────────────

  const handlePipeline = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || pipelineRunning || streaming) return;

    setInput('');
    setPipelineRunning(true);
    setPipelineSteps([]);
    setAgentPlanSteps([]);
    setPlanComplexity(null);
    setPlanGoal('');

    const userMsg = {
      role: 'user' as const,
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const analysis = await analyzeTaskComplexity(trimmed);
      setPlanComplexity(analysis.complexity);

      if (analysis.complexity === 'simple') {
        setPipelineRunning(false);
        setIsAgentPlanMode(false);
        if (analysis.intent === 'qa') {
          handleSendWithContent(trimmed, true);
        } else {
          handleVibeStream(trimmed, undefined, true);
        }
        return;
      }

      if (analysis.complexity === 'moderate') {
        if (isFullStackMode) {
          runFullStackPipeline(trimmed);
        } else {
          await runFixedPipeline(trimmed);
          setPipelineRunning(false);
        }
      } else {
        if (isFullStackMode) {
          runFullStackPipeline(trimmed);
        } else {
          runAgentPlan(trimmed);
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant' as const,
          content: lang === 'zh' ? '❌ 智能分析失败，请检查服务连接' : '❌ Analysis failed',
          timestamp: new Date().toISOString(),
        },
      ]);
      setPipelineRunning(false);
    }
  }, [input, pipelineRunning, streaming, lang, isFullStackMode, setInput, setPipelineRunning, setPipelineSteps, setAgentPlanSteps, setPlanComplexity, setPlanGoal, setMessages, setIsAgentPlanMode, runFixedPipeline, runFullStackPipeline, runAgentPlan, handleVibeStream, handleSendWithContent]);

  return {
    handlePipeline,
    runFixedPipeline,
    runFullStackPipeline,
    runAgentPlan,
  };
};
