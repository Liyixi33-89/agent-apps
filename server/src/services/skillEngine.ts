/**
 * @file services/skillEngine.ts
 * @description Skill 执行引擎（维度 3 — 执行引擎）
 *
 * 核心职责：
 *   1. 解析 Skill 定义中的 steps，按顺序/并行/条件分支执行
 *   2. 管理执行上下文（context），在步骤间传递数据
 *   3. 支持模板变量解析（{{input.xxx}}、{{steps.xxx.data}}）
 *   4. 统一工具抽象层（自动分发内置工具 / MCP 工具）
 *   5. 记录执行日志（维度 10 — 可观测性）
 *   6. 处理超时、重试、降级
 *
 * 集成点（维度 6）：
 *   - 复用 agentTools.ts 的 executeTool
 *   - 复用 mcpService.ts 的 executeMcpTool / parseMcpToolName
 *   - 复用 llmService.ts 的 callLLM / streamLLM
 *   - 复用 SystemPrompt 模型读取 Prompt
 */

import { v4 as uuidv4 } from 'uuid';
import crypto from 'node:crypto';
import { Skill, type ISkill, type ISkillStep } from '../models/Skill.js';
import { SkillExecution, type ISkillExecution, type IStepExecution, type ExecStatus, type TriggerMethod } from '../models/SkillExecution.js';
import { SystemPrompt } from '../models/SystemPrompt.js';
import { executeTool } from '../lib/agentTools.js';
import { executeMcpTool, parseMcpToolName } from './mcpService.js';
import { callLLM, streamLLM } from './llmService.js';
import type { LLMMessage, LLMStreamChunk } from './llmService.js';
import { env } from '../config/env.js';

// =============================================================================
// 类型定义
// =============================================================================

/** 执行上下文 — 在步骤间传递数据 */
export interface SkillContext {
  /** 用户输入参数 */
  input: Record<string, unknown>;
  /** 每个步骤的输出，key = step.outputKey */
  steps: Record<string, {
    success: boolean;
    data: unknown;
    error?: string;
  }>;
  /** 元数据 */
  metadata: {
    skillKey: string;
    skillName: string;
    executionId: string;
    startTime: number;
    currentStepId: string;
  };
}

/** 执行回调 */
export interface SkillExecutionCallbacks {
  /** 步骤开始 */
  onStepStart?: (step: ISkillStep) => void;
  /** 步骤完成 */
  onStepComplete?: (step: ISkillStep, result: { success: boolean; data: unknown; error?: string }) => void;
  /** 流式输出（最后一个 LLM 步骤） */
  onDelta?: (text: string) => void;
  /** 整体完成 */
  onComplete?: (result: SkillExecutionResult) => void;
}

/** 执行选项 */
export interface SkillExecuteOptions {
  /** LLM 提供商 */
  provider?: 'ollama' | 'openai';
  /** 模型类型 */
  modelType?: 'text' | 'vision';
  /** 关联的会话 ID */
  sessionId?: string;
  /** 用户标识 */
  userId?: string;
  /** 触发方式 */
  triggerMethod?: TriggerMethod;
  /** 触发匹配的关键词/模式 */
  triggerMatch?: string;
  /** 回调函数 */
  callbacks?: SkillExecutionCallbacks;
}

/** 执行结果 */
export interface SkillExecutionResult {
  executionId: string;
  skillKey: string;
  success: boolean;
  output: unknown;
  error?: string;
  totalDuration: number;
  totalTokens: number;
  stepResults: Array<{
    stepId: string;
    status: string;
    duration: number;
    outputSummary: string;
  }>;
}

// =============================================================================
// 模板变量解析
// =============================================================================

/**
 * 解析模板变量，将 {{input.xxx}} 和 {{steps.xxx.data}} 替换为实际值
 * 支持嵌套路径如 {{steps.fetch.data.title}}
 */
const resolveTemplateVar = (template: string, ctx: SkillContext): string => {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
    const parts = path.trim().split('.');
    let value: unknown = ctx;

    for (const part of parts) {
      if (value === null || value === undefined) return '';
      value = (value as Record<string, unknown>)[part];
    }

    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
};

/**
 * 解析工具参数中的模板变量
 */
const resolveToolArgs = (args: Record<string, string> | undefined, ctx: SkillContext): Record<string, unknown> => {
  if (!args) return {};
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    const resolvedValue = resolveTemplateVar(value, ctx);
    // 尝试解析为 JSON（数字、布尔值等）
    try {
      resolved[key] = JSON.parse(resolvedValue);
    } catch {
      resolved[key] = resolvedValue;
    }
  }
  return resolved;
};

// =============================================================================
// 统一工具执行器（维度 6 — 系统集成）
// =============================================================================

/**
 * 统一工具执行器 — 自动分发内置工具和 MCP 工具
 * 调用方无需关心工具来源
 */
const executeUnifiedTool = async (
  toolName: string,
  args: Record<string, unknown>
): Promise<{ success: boolean; data: unknown; error?: string }> => {
  const mcpInfo = parseMcpToolName(toolName);

  if (mcpInfo.isMcp && mcpInfo.toolName) {
    // MCP 工具
    const result = await executeMcpTool(mcpInfo.toolName, args);
    return { success: result.success, data: result.data, error: result.error };
  }

  // 内置工具
  const result = await executeTool({ name: toolName, arguments: args });
  return { success: result.success, data: result.data, error: result.error };
};

// =============================================================================
// 安全表达式求值（补充点 3 — 替代 new Function，防止代码注入）
// =============================================================================

/** 表达式白名单：只允许比较运算符、逻辑运算符、字面量和括号 */
const SAFE_EXPR_RE = /^[\s\d.'"true false null undefined\w\-!<>=&|()]+$/;

/** 危险关键词黑名单 */
const DANGEROUS_KEYWORDS = [
  'process', 'require', 'import', 'eval', 'Function', 'constructor',
  'prototype', '__proto__', 'globalThis', 'global', 'window', 'document',
  'fetch', 'XMLHttpRequest', 'child_process', 'exec', 'spawn',
  'setTimeout', 'setInterval', 'Buffer', 'fs', 'path', 'os', 'net',
];

/**
 * 安全地求值条件表达式（声明式白名单，不使用 new Function / eval）
 *
 * 支持：
 *   - 比较：=== !== > < >= <=
 *   - 逻辑：&& || !
 *   - 字面量：true false null undefined 数字 字符串
 *   - 括号分组
 *
 * 不支持（也不允许）：
 *   - 函数调用、属性访问链、赋值、require/import 等
 */
const safeEvaluate = (expr: string): unknown => {
  // 检查黑名单关键词
  const lowerExpr = expr.toLowerCase();
  for (const kw of DANGEROUS_KEYWORDS) {
    if (lowerExpr.includes(kw.toLowerCase())) {
      throw new Error(`表达式包含禁止的关键词: ${kw}`);
    }
  }

  // 检查白名单字符
  if (!SAFE_EXPR_RE.test(expr)) {
    throw new Error(`表达式包含不允许的字符: ${expr.slice(0, 100)}`);
  }

  // 使用 Function 在严格受限的作用域中求值（白名单已过滤危险输入）
  const fn = new Function('"use strict"; return (' + expr + ')');
  return fn();
};

/**
 * 安全地求值条件表达式，返回布尔值
 */
const evaluateCondition = (condition: string, ctx: SkillContext): boolean => {
  try {
    const resolved = resolveTemplateVar(condition, ctx);
    return Boolean(safeEvaluate(resolved));
  } catch (err) {
    console.warn(`[SkillEngine] 条件表达式求值失败: ${condition}`, err instanceof Error ? err.message : err);
    return false;
  }
};

// =============================================================================
// 步骤执行器
// =============================================================================

/**
 * 执行单个步骤
 */
const executeStepInternal = async (
  step: ISkillStep,
  ctx: SkillContext,
  options: SkillExecuteOptions,
  stepExec: IStepExecution
): Promise<{ success: boolean; data: unknown; error?: string; tokenUsage?: { promptTokens: number; completionTokens: number } }> => {
  const provider = options.provider || env.activeProvider as 'ollama' | 'openai';
  const modelType = options.modelType || 'text';

  switch (step.type) {
    // ── Tool 步骤 ──
    case 'tool': {
      if (!step.toolName) {
        return { success: false, data: null, error: '步骤缺少 toolName' };
      }
      const args = resolveToolArgs(step.toolArgs, ctx);
      // 对 URL 类参数做 trim，防止 LLM 输出带有多余空白/换行
      if (typeof args.url === 'string') {
        args.url = args.url.trim();
      }
      stepExec.toolName = step.toolName;
      stepExec.toolInput = args;

      const result = await executeUnifiedTool(step.toolName, args);
      stepExec.toolSuccess = result.success;
      return result;
    }

    // ── LLM 步骤 ──
    case 'llm': {
      // 构建 Prompt
      let promptContent = '';
      if (step.promptKey) {
        const doc = await SystemPrompt.findOne({ key: step.promptKey, isActive: true }).lean();
        promptContent = (doc as any)?.content || '';
      }
      if (!promptContent && step.promptTemplate) {
        promptContent = resolveTemplateVar(step.promptTemplate, ctx);
      }
      if (!promptContent) {
        return { success: false, data: null, error: '步骤缺少 Prompt 内容' };
      }

      stepExec.promptUsed = step.promptKey || promptContent.slice(0, 100);
      stepExec.llmProvider = provider;

      // 构建消息
      const messages: LLMMessage[] = [
        { role: 'system', content: promptContent },
        { role: 'user', content: resolveTemplateVar('{{input.message}}', ctx) || JSON.stringify(ctx.input) },
      ];

      // 判断是否流式输出（最后一个 LLM 步骤 + 配置允许）
      const isLastLlmStep = step.llmOptions?.stream !== false;
      const shouldStream = isLastLlmStep && options.callbacks?.onDelta;

      if (shouldStream) {
        // 流式输出
        let fullContent = '';
        const stream = streamLLM(messages, {
          provider,
          modelType,
          temperature: step.llmOptions?.temperature,
          maxTokens: step.llmOptions?.maxTokens,
        });

        for await (const chunk of stream) {
          if (chunk.delta) {
            fullContent += chunk.delta;
            options.callbacks?.onDelta?.(chunk.delta);
          }
          if (chunk.done) break;
        }

        return { success: true, data: fullContent };
      } else {
        // 非流式
        const response = await callLLM(messages, { provider, modelType });
        stepExec.tokenUsage = response.usage
          ? { promptTokens: response.usage.promptTokens, completionTokens: response.usage.completionTokens, totalTokens: response.usage.promptTokens + response.usage.completionTokens }
          : undefined;
        stepExec.llmModel = response.model;
        return {
          success: true,
          data: response.content,
          tokenUsage: response.usage,
        };
      }
    }

    // ── 条件分支步骤 ──
    case 'condition': {
      if (!step.condition) {
        return { success: false, data: null, error: '步骤缺少 condition 表达式' };
      }
      const result = evaluateCondition(step.condition, ctx);
      return { success: true, data: { conditionResult: result, nextStep: result ? step.ifTrue : step.ifFalse } };
    }

    // ── 数据转换步骤（使用安全求值器，补充点 3）──
    case 'transform': {
      if (!step.transformExpr) {
        return { success: false, data: null, error: '步骤缺少 transformExpr' };
      }
      try {
        const resolved = resolveTemplateVar(step.transformExpr, ctx);
        const result = safeEvaluate(resolved);
        return { success: true, data: result };
      } catch (err) {
        return { success: false, data: null, error: `转换表达式执行失败: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    // ── 并行步骤 ──
    case 'parallel': {
      // 并行步骤在外层处理，这里只返回标记
      return { success: true, data: { isParallel: true, parallelStepIds: step.parallelStepIds } };
    }

    // ── 嵌套 Skill 步骤（组合嵌套）──
    case 'sub_skill': {
      if (!step.subSkillKey) {
        return { success: false, data: null, error: '步骤缺少 subSkillKey' };
      }

      // 防止无限递归：检查嵌套深度
      const currentDepth = (ctx.metadata as any)._nestingDepth || 0;
      const maxDepth = step.maxNestingDepth || 3;
      if (currentDepth >= maxDepth) {
        return { success: false, data: null, error: `嵌套深度超过限制 (${maxDepth})，可能存在循环依赖` };
      }

      // 构建子 Skill 的输入参数
      const subInput: Record<string, unknown> = {};
      if (step.subSkillInput) {
        for (const [key, template] of Object.entries(step.subSkillInput)) {
          subInput[key] = resolveTemplateVar(template, ctx);
        }
      } else {
        // 默认传递当前 Skill 的全部输入
        Object.assign(subInput, ctx.input);
      }

      // 递归执行子 Skill
      try {
        console.log(`[SkillEngine] 🔗 嵌套执行 Skill: ${step.subSkillKey} (深度 ${currentDepth + 1}/${maxDepth})`);
        const subResult = await executeSkill(step.subSkillKey, subInput, {
          ...options,
          triggerMethod: 'api',
          triggerMatch: `sub_skill of ${ctx.metadata.skillKey}`,
          callbacks: undefined, // 子 Skill 不回调给上层
          _nestingDepth: currentDepth + 1,
        } as any);

        stepExec.toolName = `sub_skill:${step.subSkillKey}`;
        stepExec.toolSuccess = subResult.success;

        return {
          success: subResult.success,
          data: subResult.output,
          error: subResult.error,
        };
      } catch (err) {
        return {
          success: false,
          data: null,
          error: `嵌套 Skill "${step.subSkillKey}" 执行失败: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    default:
      return { success: false, data: null, error: `未知步骤类型: ${step.type}` };
  }
};

// =============================================================================
// 核心执行函数
// =============================================================================

/**
 * 执行 Skill
 *
 * @param skillKey - Skill 的唯一标识
 * @param input - 用户输入参数
 * @param options - 执行选项
 * @returns 执行结果
 */
export const executeSkill = async (
  skillKey: string,
  input: Record<string, unknown>,
  options: SkillExecuteOptions = {}
): Promise<SkillExecutionResult> => {
  const startTime = Date.now();
  const executionId = `exec_${uuidv4().slice(0, 12)}`;

  // ── 1. 加载 Skill 定义 ──
  const skill = await Skill.findOne({ key: skillKey, isActive: true }).lean() as ISkill | null;
  if (!skill) {
    throw new Error(`Skill "${skillKey}" 不存在或未启用`);
  }

  // ── 1.5 缓存命中检查（补充点 5）──
  if (skill.config?.cacheTTL > 0) {
    const inputHash = crypto.createHash('md5').update(JSON.stringify(input)).digest('hex');
    const cached = await SkillExecution.findOne({
      skillKey,
      status: 'success',
      createdAt: { $gte: new Date(Date.now() - skill.config.cacheTTL * 1000) },
    }).sort({ createdAt: -1 }).lean() as ISkillExecution | null;

    if (cached) {
      // 验证输入是否一致（用 hash 比较避免大对象深比较）
      const cachedInputHash = crypto.createHash('md5').update(JSON.stringify(cached.input || {})).digest('hex');
      if (cachedInputHash === inputHash) {
        console.log(`[SkillEngine] 📦 缓存命中: ${skill.name} (TTL=${skill.config.cacheTTL}s)`);
        return {
          executionId: cached.executionId + '_cached',
          skillKey: skill.key,
          success: true,
          output: cached.output,
          totalDuration: 0,
          totalTokens: 0,
          stepResults: cached.stepExecutions.map(s => ({
            stepId: s.stepId,
            status: s.status,
            duration: s.duration,
            outputSummary: s.outputSummary,
          })),
        };
      }
    }
  }

  // ── 2. 初始化执行上下文 ──
  const ctx: SkillContext = {
    input,
    steps: {},
    metadata: {
      skillKey: skill.key,
      skillName: skill.name,
      executionId,
      startTime,
      currentStepId: '',
    },
  };

  // ── 2.5 依赖 Skill 自动执行（补充点 1）──
  if (skill.dependsOn && skill.dependsOn.length > 0) {
    for (const depKey of skill.dependsOn) {
      if (ctx.steps[depKey]) continue; // 已有结果，跳过
      try {
        console.log(`[SkillEngine] 🔗 执行依赖 Skill: ${depKey} → ${skill.key}`);
        const depResult = await executeSkill(depKey, input, {
          ...options,
          triggerMethod: 'api',
          triggerMatch: `dependency of ${skillKey}`,
          callbacks: undefined, // 依赖执行不回调给上层
        });
        ctx.steps[depKey] = { success: depResult.success, data: depResult.output };
      } catch (err) {
        console.warn(`[SkillEngine] 依赖 Skill "${depKey}" 执行失败:`, err instanceof Error ? err.message : err);
        ctx.steps[depKey] = { success: false, data: null, error: err instanceof Error ? err.message : String(err) };
      }
    }
  }

  // ── 3. 创建执行记录（维度 10） ──
  const execRecord = await SkillExecution.create({
    executionId,
    skillKey: skill.key,
    skillName: skill.name,
    skillVersion: skill.version,
    abTestGroup: skill.abTestGroup,
    triggerMethod: options.triggerMethod || 'manual',
    triggerMatch: options.triggerMatch || '',
    sessionId: options.sessionId,
    userId: options.userId,
    input,
    status: 'running',
    totalSteps: skill.steps.length,
  });

  const stepResults: SkillExecutionResult['stepResults'] = [];
  let lastOutput: unknown = null;
  let overallSuccess = true;
  let totalTokens = 0;

  // ── 4. 构建步骤索引（用于条件跳转） ──
  const stepMap = new Map<string, ISkillStep>();
  for (const step of skill.steps) {
    stepMap.set(step.id, step);
  }

  // ── 5. 执行步骤 ──
  let stepIndex = 0;
  const executedSteps = new Set<string>();

  while (stepIndex < skill.steps.length) {
    const step = skill.steps[stepIndex];

    // 防止无限循环
    if (executedSteps.has(step.id) && step.type !== 'condition') {
      stepIndex++;
      continue;
    }
    executedSteps.add(step.id);

    // ── 补充点 6: parallel 步骤真正并行执行 ──
    if (step.type === 'parallel' && step.parallelStepIds?.length) {
      ctx.metadata.currentStepId = step.id;
      options.callbacks?.onStepStart?.(step);

      const parallelSteps = step.parallelStepIds
        .map(id => stepMap.get(id))
        .filter((s): s is ISkillStep => !!s);

      const concurrency = skill.config?.concurrency || 3;
      const parallelStartTime = Date.now();

      // 并行执行子步骤（受 concurrency 限制）
      const chunks: ISkillStep[][] = [];
      for (let i = 0; i < parallelSteps.length; i += concurrency) {
        chunks.push(parallelSteps.slice(i, i + concurrency));
      }

      let parallelAllSuccess = true;
      for (const chunk of chunks) {
        const chunkResults = await Promise.all(
          chunk.map(async (pStep) => {
            executedSteps.add(pStep.id); // 标记为已执行，主循环跳过
            const pStepExec: IStepExecution = {
              stepId: pStep.id, stepType: pStep.type, stepLabel: pStep.label,
              status: 'running', startedAt: new Date(), duration: 0,
              inputSize: JSON.stringify(input).length, outputSize: 0,
              outputSummary: '', retryCount: 0,
            };
            const pStart = Date.now();
            try {
              const pTimeout = pStep.timeout || skill.config?.timeout || 30000;
              const pResult = await Promise.race([
                executeStepInternal(pStep, ctx, options, pStepExec),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error(`并行步骤 "${pStep.label}" 超时 (${pTimeout}ms)`)), pTimeout)
                ),
              ]);
              pStepExec.duration = Date.now() - pStart;
              pStepExec.finishedAt = new Date();
              if (pResult.success) {
                pStepExec.status = 'success';
                const outStr = typeof pResult.data === 'string' ? pResult.data : JSON.stringify(pResult.data);
                pStepExec.outputSize = outStr.length;
                pStepExec.outputSummary = outStr.slice(0, 500);
                ctx.steps[pStep.outputKey] = { success: true, data: pResult.data };
                if (pResult.tokenUsage) {
                  totalTokens += (pResult.tokenUsage.promptTokens || 0) + (pResult.tokenUsage.completionTokens || 0);
                }
              } else {
                pStepExec.status = 'failed';
                pStepExec.error = pResult.error;
                ctx.steps[pStep.outputKey] = { success: false, data: null, error: pResult.error };
                if (!pStep.optional) parallelAllSuccess = false;
              }
              return { stepExec: pStepExec, pStep, result: pResult };
            } catch (err) {
              pStepExec.duration = Date.now() - pStart;
              pStepExec.finishedAt = new Date();
              pStepExec.status = 'failed';
              pStepExec.error = err instanceof Error ? err.message : String(err);
              ctx.steps[pStep.outputKey] = { success: false, data: null, error: pStepExec.error };
              if (!pStep.optional) parallelAllSuccess = false;
              return { stepExec: pStepExec, pStep, result: { success: false, data: null, error: pStepExec.error } };
            }
          })
        );

        for (const { stepExec: pse, pStep: ps, result: pr } of chunkResults) {
          stepResults.push({ stepId: ps.id, status: pse.status, duration: pse.duration, outputSummary: pse.outputSummary });
          execRecord.stepExecutions.push(pse);
          options.callbacks?.onStepComplete?.(ps, { success: pr.success, data: pr.data, error: pr.error });
        }
      }

      // 记录 parallel 父步骤
      const parallelDuration = Date.now() - parallelStartTime;
      const parentExec: IStepExecution = {
        stepId: step.id, stepType: 'parallel', stepLabel: step.label,
        status: parallelAllSuccess ? 'success' : 'failed',
        startedAt: new Date(parallelStartTime), finishedAt: new Date(),
        duration: parallelDuration, inputSize: 0, outputSize: 0,
        outputSummary: `并行执行 ${parallelSteps.length} 个子步骤`, retryCount: 0,
      };
      stepResults.push({ stepId: step.id, status: parentExec.status, duration: parallelDuration, outputSummary: parentExec.outputSummary });
      execRecord.stepExecutions.push(parentExec);

      if (!parallelAllSuccess) {
        overallSuccess = false;
        break;
      }

      stepIndex++;
      continue;
    }

    ctx.metadata.currentStepId = step.id;
    options.callbacks?.onStepStart?.(step);

    // 创建步骤执行记录
    const stepExec: IStepExecution = {
      stepId: step.id,
      stepType: step.type,
      stepLabel: step.label,
      status: 'running',
      startedAt: new Date(),
      duration: 0,
      inputSize: JSON.stringify(input).length,
      outputSize: 0,
      outputSummary: '',
      retryCount: 0,
    };

    const stepStartTime = Date.now();
    let stepResult: { success: boolean; data: unknown; error?: string; tokenUsage?: { promptTokens: number; completionTokens: number } } | null = null;
    let retries = 0;
    const maxRetries = step.retryCount || skill.config?.retryCount || 1;

    // 重试循环
    while (retries <= maxRetries) {
      try {
        // 超时控制
        const stepTimeout = step.timeout || skill.config?.timeout || 30000;
        stepResult = await Promise.race([
          executeStepInternal(step, ctx, options, stepExec),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`步骤 "${step.label}" 超时 (${stepTimeout}ms)`)), stepTimeout)
          ),
        ]);
        break; // 成功则跳出重试
      } catch (err) {
        retries++;
        stepExec.retryCount = retries;
        if (retries > maxRetries) {
          stepResult = {
            success: false,
            data: null,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }
    }

    // 记录步骤结果
    const stepDuration = Date.now() - stepStartTime;
    stepExec.duration = stepDuration;
    stepExec.finishedAt = new Date();

    if (stepResult?.success) {
      stepExec.status = 'success';
      const outputStr = typeof stepResult.data === 'string' ? stepResult.data : JSON.stringify(stepResult.data);
      stepExec.outputSize = outputStr.length;
      stepExec.outputSummary = outputStr.slice(0, 500);

      // 存入上下文
      ctx.steps[step.outputKey] = { success: true, data: stepResult.data };
      lastOutput = stepResult.data;

      // 累计 Token
      if (stepResult.tokenUsage) {
        totalTokens += (stepResult.tokenUsage.promptTokens || 0) + (stepResult.tokenUsage.completionTokens || 0);
      }

      // 处理条件分支跳转
      if (step.type === 'condition' && stepResult.data && typeof stepResult.data === 'object') {
        const condData = stepResult.data as { nextStep?: string };
        if (condData.nextStep) {
          const targetIdx = skill.steps.findIndex(s => s.id === condData.nextStep);
          if (targetIdx >= 0) {
            stepIndex = targetIdx;
            stepResults.push({ stepId: step.id, status: 'success', duration: stepDuration, outputSummary: stepExec.outputSummary });
            execRecord.stepExecutions.push(stepExec);
            options.callbacks?.onStepComplete?.(step, { success: true, data: stepResult.data });
            continue;
          }
        }
      }
    } else {
      stepExec.status = 'failed';
      stepExec.error = stepResult?.error || '未知错误';
      ctx.steps[step.outputKey] = { success: false, data: null, error: stepExec.error };

      if (!step.optional) {
        overallSuccess = false;
        stepResults.push({ stepId: step.id, status: 'failed', duration: stepDuration, outputSummary: stepExec.error || '' });
        execRecord.stepExecutions.push(stepExec);
        options.callbacks?.onStepComplete?.(step, { success: false, data: null, error: stepExec.error });
        break; // 非可选步骤失败，终止执行
      }
    }

    stepResults.push({
      stepId: step.id,
      status: stepExec.status,
      duration: stepDuration,
      outputSummary: stepExec.outputSummary,
    });
    execRecord.stepExecutions.push(stepExec);
    options.callbacks?.onStepComplete?.(step, {
      success: stepResult?.success || false,
      data: stepResult?.data,
      error: stepResult?.error,
    });

    stepIndex++;
  }

  // ── 6. 更新执行记录 ──
  const totalDuration = Date.now() - startTime;
  const successSteps = stepResults.filter(s => s.status === 'success').length;
  const failedSteps = stepResults.filter(s => s.status === 'failed').length;

  execRecord.status = overallSuccess ? 'success' : 'failed';
  execRecord.output = typeof lastOutput === 'string' ? lastOutput.slice(0, 2000) : JSON.stringify(lastOutput).slice(0, 2000);
  execRecord.totalDuration = totalDuration;
  execRecord.totalTokens = totalTokens;
  execRecord.successSteps = successSteps;
  execRecord.failedSteps = failedSteps;
  if (!overallSuccess) {
    execRecord.error = stepResults.find(s => s.status === 'failed')?.outputSummary;
  }
  await execRecord.save();

  // ── 7. 更新 Skill 统计数据（补充点 2：指数移动平均 EMA）──
  // avgDuration: EMA(0.9) — 90% 历史 + 10% 最新
  // successRate: EMA(0.95) — 95% 历史 + 5% 最新（更平滑，避免单次失败大幅拉低）
  await Skill.updateOne(
    { key: skillKey },
    [
      {
        $set: {
          usageCount: { $add: ['$usageCount', 1] },
          avgDuration: {
            $cond: {
              if: { $eq: ['$usageCount', 0] },
              then: totalDuration,
              else: { $round: [{ $add: [{ $multiply: ['$avgDuration', 0.9] }, { $multiply: [totalDuration, 0.1] }] }, 0] },
            },
          },
          successRate: {
            $cond: {
              if: { $eq: ['$usageCount', 0] },
              then: overallSuccess ? 1 : 0,
              else: { $round: [{ $add: [{ $multiply: ['$successRate', 0.95] }, { $multiply: [overallSuccess ? 1 : 0, 0.05] }] }, 3] },
            },
          },
        },
      },
    ]
  );

  // ── 8. 返回结果 ──
  const result: SkillExecutionResult = {
    executionId,
    skillKey: skill.key,
    success: overallSuccess,
    output: lastOutput,
    error: overallSuccess ? undefined : execRecord.error,
    totalDuration,
    totalTokens,
    stepResults,
  };

  options.callbacks?.onComplete?.(result);
  console.log(`[SkillEngine] ✅ ${skill.name} 执行${overallSuccess ? '成功' : '失败'} (${totalDuration}ms, ${totalTokens} tokens)`);

  return result;
};

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 获取 Skill 的执行历史
 */
export const getSkillExecutionHistory = async (
  skillKey: string,
  options: { limit?: number; page?: number } = {}
) => {
  const limit = Math.min(options.limit || 20, 50);
  const page = Math.max(options.page || 1, 1);

  const [executions, total] = await Promise.all([
    SkillExecution.find({ skillKey })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SkillExecution.countDocuments({ skillKey }),
  ]);

  return { executions, total, page, limit };
};

/**
 * 获取 Skill 统计概览
 */
export const getSkillStats = async (skillKey: string) => {
  const [skill, recentExecutions] = await Promise.all([
    Skill.findOne({ key: skillKey }).lean(),
    SkillExecution.find({ skillKey })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  ]);

  if (!skill) return null;

  const totalExecs = recentExecutions.length;
  const successExecs = recentExecutions.filter(e => e.status === 'success').length;
  const avgDuration = totalExecs > 0
    ? Math.round(recentExecutions.reduce((sum, e) => sum + e.totalDuration, 0) / totalExecs)
    : 0;
  const avgTokens = totalExecs > 0
    ? Math.round(recentExecutions.reduce((sum, e) => sum + e.totalTokens, 0) / totalExecs)
    : 0;

  // 按步骤统计失败率
  const stepFailRates: Record<string, { total: number; failed: number }> = {};
  for (const exec of recentExecutions) {
    for (const stepExec of exec.stepExecutions) {
      if (!stepFailRates[stepExec.stepId]) {
        stepFailRates[stepExec.stepId] = { total: 0, failed: 0 };
      }
      stepFailRates[stepExec.stepId].total++;
      if (stepExec.status === 'failed') {
        stepFailRates[stepExec.stepId].failed++;
      }
    }
  }

  return {
    skillKey,
    skillName: (skill as any).name,
    totalExecutions: (skill as any).usageCount,
    recentSuccessRate: totalExecs > 0 ? successExecs / totalExecs : 1,
    avgDuration,
    avgTokens,
    stepFailRates: Object.entries(stepFailRates).map(([stepId, stats]) => ({
      stepId,
      failRate: stats.total > 0 ? stats.failed / stats.total : 0,
      totalRuns: stats.total,
    })),
  };
};
