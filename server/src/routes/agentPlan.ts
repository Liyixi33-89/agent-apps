/**
 * @file routes/agentPlan.ts
 * @description § 10  Agent 规划器路由
 *
 * 路由列表：
 *   POST /api/agent/analyze          → 分析任务复杂度（不执行）
 *   POST /api/agent/plan             → 生成执行计划（不执行）
 *   POST /api/agent/execute          → Plan-Execute 完整流程（SSE 流式推送进度）
 *   POST /api/agent/tool             → 单独调用工具（调试/测试用）
 *   GET  /api/agent/tools            → 获取所有可用工具定义
 */

import Router from '@koa/router';
import { env } from '../config/env.js';
import {
  analyzeComplexity,
  generatePlan,
  planAndExecute,
} from '../lib/agentPlanner.js';
import type { PlanStep, StepExecutionResult } from '../lib/agentPlanner.js';
import { AGENT_TOOLS, executeTool } from '../lib/agentTools.js';
import type { ToolCallRequest } from '../lib/agentTools.js';

export const agentPlanRouter = new Router();

// ─── 分析任务复杂度  POST /api/agent/analyze ─────────────────────────────────

agentPlanRouter.post('/agent/analyze', async (ctx) => {
  const { prompt } = ctx.request.body as { prompt: string };

  if (!prompt?.trim()) {
    ctx.status = 400;
    ctx.body = { success: false, message: '请提供任务描述' };
    return;
  }

  const { complexity, reason, intent } = analyzeComplexity(prompt);

  ctx.body = {
    success: true,
    data: {
      prompt,
      complexity,
      reason,
      intent,
      description: {
        simple: intent === 'qa' ? '问答任务：查询/解释/分析 → 对话模式直接回答' : '简单任务：修改样式/属性 → 单步直出',
        moderate: '中等任务：创建单个页面 → 生成 + 验证（2-3步）',
        complex: '复杂任务：多页面系统/复杂应用 → 多步规划（3-6步）',
      }[complexity],
    },
  };
});

// ─── 生成执行计划  POST /api/agent/plan ──────────────────────────────────────

agentPlanRouter.post('/agent/plan', async (ctx) => {
  const {
    prompt,
    provider = env.activeProvider,
    modelType = 'text',
  } = ctx.request.body as { prompt: string; provider?: string; modelType?: string };

  if (!prompt?.trim()) {
    ctx.status = 400;
    ctx.body = { success: false, message: '请提供任务描述' };
    return;
  }

  const { complexity, reason } = analyzeComplexity(prompt);
  const plan = await generatePlan(prompt, complexity, { provider, modelType });
  plan.complexityReason = reason;

  ctx.body = { success: true, data: plan };
});

// ─── Plan-Execute 完整流程（SSE）  POST /api/agent/execute ───────────────────

agentPlanRouter.post('/agent/execute', async (ctx) => {
  const {
    prompt,
    provider = env.activeProvider,
    modelType = 'text',
  } = ctx.request.body as { prompt: string; provider?: string; modelType?: string };

  if (!prompt?.trim()) {
    ctx.status = 400;
    ctx.body = { success: false, message: '请提供任务描述' };
    return;
  }

  ctx.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  ctx.status = 200;

  const res = ctx.res;

  const send = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send({ type: 'start', message: '开始分析任务...' });

  try {
    // ── 1. 分析复杂度并推送 ────────────────────────────────────────────────────
    const { complexity, reason, intent } = analyzeComplexity(prompt);
    send({ type: 'analyze', complexity, reason, intent });

    // ── 2. 生成计划并推送 ──────────────────────────────────────────────────────
    send({ type: 'planning', message: '正在生成执行计划...' });
    const plan = await generatePlan(prompt, complexity, { provider, modelType });
    plan.complexityReason = reason;

    send({
      type: 'plan_ready',
      plan: {
        planId: plan.planId,
        complexity: plan.complexity,
        goal: plan.goal,
        totalSteps: plan.totalSteps,
        steps: plan.steps.map((s) => ({
          id: s.id,
          index: s.index,
          title: s.title,
          description: s.description,
          tools: s.tools,
          status: s.status,
        })),
      },
    });

    // ── 3. 逐步执行并推送进度 ──────────────────────────────────────────────────
    const { finalResult, success } = await planAndExecute(prompt, {
      provider,
      modelType,
      onStepUpdate: (step: PlanStep, result: StepExecutionResult) => {
        send({
          type: 'step_update',
          step: {
            id: step.id,
            index: step.index,
            title: step.title,
            status: step.status,
            result: result.result?.slice(0, 1000), // 截断避免 SSE 包过大
            toolResults: result.toolResults?.map((t) => ({
              toolName: t.toolName,
              success: t.success,
              summary: t.success
                ? JSON.stringify(t.data).slice(0, 200)
                : t.error,
            })),
            error: step.error,
            retryCount: step.retryCount,
          },
        });
      },
    });

    // ── 4. 推送最终结果 ────────────────────────────────────────────────────────
    const HTML_CODE_RE = /```html[\s\S]*?```|<!DOCTYPE\s+html[\s\S]*?<\/html>/i;
    send({
      type: 'done',
      success,
      finalResult,
      plan: {
        planId: plan.planId,
        steps: plan.steps.map((s) => ({
          id: s.id,
          index: s.index,
          title: s.title,
          status: s.status,
          // 含 HTML 代码的步骤完整传输，其他步骤截断到 500 字
          result: s.result && HTML_CODE_RE.test(s.result) ? s.result : s.result?.slice(0, 500),
          error: s.error,
          retryCount: s.retryCount,
        })),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    send({ type: 'error', message });
  } finally {
    res.end();
  }
});

// ─── 单独调用工具  POST /api/agent/tool ──────────────────────────────────────

agentPlanRouter.post('/agent/tool', async (ctx) => {
  const { name, arguments: args = {} } = ctx.request.body as ToolCallRequest;

  if (!name) {
    ctx.status = 400;
    ctx.body = { success: false, message: '请提供工具名称 (name)' };
    return;
  }

  const validTool = AGENT_TOOLS.find((t) => t.function.name === name);
  if (!validTool) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      message: `工具 "${name}" 不存在`,
      availableTools: AGENT_TOOLS.map((t) => t.function.name),
    };
    return;
  }

  const result = await executeTool({ name, arguments: args });
  ctx.body = { success: result.success, data: result.data, error: result.error };
});

// ─── 获取所有工具定义  GET /api/agent/tools ──────────────────────────────────

agentPlanRouter.get('/agent/tools', async (ctx) => {
  ctx.body = {
    success: true,
    data: {
      total: AGENT_TOOLS.length,
      tools: AGENT_TOOLS.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      })),
    },
  };
});
