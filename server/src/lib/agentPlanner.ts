/**
 * @file lib/agentPlanner.ts
 * @description Agent 任务规划器 — Plan-Execute 模式核心
 *
 * 功能：
 *   1. 分析用户意图，判断任务复杂度（simple / moderate / complex）
 *   2. 生成分步执行计划（每步包含明确的输入/输出/工具/Agent）
 *   3. 管理执行状态（pending / running / done / failed / skipped）
 *   4. 支持步骤重试（最多 2 次）
 *
 * 复杂度分级：
 *   - simple   : 修改样式/属性、问答、单步操作 → 直接执行，无需规划
 *   - moderate : 创建单个页面、中等复杂功能 → 生成 + 验证（2步）
 *   - complex  : 多页面系统、复杂应用、多步操作 → 完整多步规划
 */

import { callLLM } from '../services/llmService.js';
import { AGENT_TOOLS, executeTool } from './agentTools.js';
import type { ToolCallRequest, ToolCallResult } from './agentTools.js';

// =============================================================================
// 类型定义
// =============================================================================

export type TaskComplexity = 'simple' | 'moderate' | 'complex';
export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface PlanStep {
  /** 步骤唯一 ID */
  id: string;
  /** 步骤序号（从 1 开始） */
  index: number;
  /** 步骤标题（简短描述） */
  title: string;
  /** 步骤详细说明 */
  description: string;
  /** 该步骤使用的工具列表 */
  tools: string[];
  /** 该步骤推荐使用的 Agent slug（可选） */
  agentSlug?: string;
  /** 该步骤的输入来源（上一步的输出 / 用户输入 / 工具结果） */
  inputFrom: string[];
  /** 该步骤的预期输出 */
  expectedOutput: string;
  /** 执行状态 */
  status: StepStatus;
  /** 实际输出结果 */
  result?: string;
  /** 错误信息 */
  error?: string;
  /** 重试次数 */
  retryCount: number;
  /** 是否可以跳过 */
  skippable: boolean;
}

export interface ExecutionPlan {
  /** 计划唯一 ID */
  planId: string;
  /** 原始用户需求 */
  userPrompt: string;
  /** 任务复杂度 */
  complexity: TaskComplexity;
  /** 复杂度判断理由 */
  complexityReason: string;
  /** 执行步骤列表 */
  steps: PlanStep[];
  /** 整体目标描述 */
  goal: string;
  /** 预计总步骤数 */
  totalSteps: number;
  /** 创建时间 */
  createdAt: Date;
}

export interface StepExecutionResult {
  stepId: string;
  status: StepStatus;
  result?: string;
  toolResults?: ToolCallResult[];
  error?: string;
  retryCount: number;
}

// =============================================================================
// 复杂度分析
// =============================================================================

/** 问答类关键词（不生成 HTML，走对话模式） */
const QA_PATTERNS = [
  /什么是|怎么|如何|为什么|解释/,
  /帮我看看|查询|查找|搜索/,
  /是什么|有哪些|有那些|有什么|告诉我|介绍一下/,
  /都有哪些|都有那些|都有什么|有几个|有多少/,
  /复杂程度|调用了|用了哪些|用了那些|哪些agent|那些agent|哪些工具|那些工具|哪些步骤|那些步骤/,
  /分析一下|说明一下|描述一下/,
  /列出|列举|展示一下|看看有/,
  /agent.*有|有.*agent/i,
  /分类.*有|有.*分类/,
];

/** 简单操作类关键词（直接执行，无需规划，输出 HTML） */
const SIMPLE_PATTERNS = [
  /修改.{0,10}(颜色|字体|大小|样式|背景|边框|间距|圆角)/,
  /改.{0,5}(颜色|字体|大小|样式)/,
  /调整.{0,10}(布局|位置|对齐)/,
  /添加.{0,10}(按钮|文字|图标|链接)/,
  /删除.{0,10}(元素|按钮|文字)/,
  // 选中元素修改（来自 UIPreviewPanel 元素选择功能）
  /请修改选中的.{0,60}元素/,
  /修改.{0,20}(文字|文本|内容|标题|标签|占位符|placeholder)/,
  /改.{0,10}(文字|文本|内容|标题)/,
  /把.{0,20}(改为|改成|换成|替换为|替换成)/,
  /将.{0,20}(改为|改成|换成|替换为|替换成)/,
  /\[element_modify\]/,
];

/** 复杂任务关键词（需要多步规划） */
const COMPLEX_PATTERNS = [
  /多(个|页|模块|功能)/,
  /完整(系统|应用|平台|网站)/,
  /包含.{0,20}(和|与|及|、).{0,20}(和|与|及|、)/,
  /管理系统|后台|仪表盘|dashboard/i,
  /电商|商城|购物/,
  /社交|论坛|社区/,
  /游戏.{0,10}(系统|平台|多关卡)/,
];

/**
 * 分析任务复杂度
 * 返回复杂度等级、判断理由、以及意图类型（qa=问答 / action=操作生成）
 */
export const analyzeComplexity = (prompt: string): { complexity: TaskComplexity; reason: string; intent: 'qa' | 'action' } => {
  // 问答类检测（优先级最高，不生成 HTML）
  for (const pattern of QA_PATTERNS) {
    if (pattern.test(prompt)) {
      return {
        complexity: 'simple',
        reason: `检测到问答意图（${pattern.source.slice(0, 20)}...），走对话模式`,
        intent: 'qa',
      };
    }
  }

  // 简单操作类检测（直接执行，输出 HTML）
  for (const pattern of SIMPLE_PATTERNS) {
    if (pattern.test(prompt)) {
      return {
        complexity: 'simple',
        reason: `检测到简单操作模式（${pattern.source.slice(0, 20)}...），直接执行无需规划`,
        intent: 'action',
      };
    }
  }

  // 复杂任务检测
  for (const pattern of COMPLEX_PATTERNS) {
    if (pattern.test(prompt)) {
      return {
        complexity: 'complex',
        reason: `检测到复杂系统需求（${pattern.source.slice(0, 20)}...），需要多步规划`,
        intent: 'action',
      };
    }
  }

  // 长度启发式：超过 100 字的需求通常是中等或复杂
  if (prompt.length > 200) {
    return { complexity: 'complex', reason: '需求描述较长，包含多个功能点，需要多步规划', intent: 'action' };
  }
  if (prompt.length > 80) {
    return { complexity: 'moderate', reason: '需求包含一定复杂度，采用生成+验证两步流程', intent: 'action' };
  }

  return { complexity: 'moderate', reason: '标准创建任务，采用生成+验证两步流程', intent: 'action' };
};

// =============================================================================
// 计划生成
// =============================================================================

const PLANNER_SYSTEM_PROMPT = `你是一个专业的 AI Agent 任务规划师。
你的职责是分析用户需求，生成清晰的分步执行计划。

【输出格式要求】
必须输出合法的 JSON，格式如下：
{
  "goal": "整体目标的一句话描述",
  "steps": [
    {
      "id": "step_1",
      "index": 1,
      "title": "步骤标题（10字以内）",
      "description": "步骤详细说明（50字以内）",
      "tools": ["工具名称列表，从可用工具中选择"],
      "agentSlug": "推荐使用的Agent slug（可选，没有合适的则省略）",
      "inputFrom": ["user_prompt", "step_1", "tool_result"],
      "expectedOutput": "该步骤完成后的预期产出",
      "skippable": false
    }
  ]
}

【可用工具】
list_pages, get_page_structure, find_agent, get_design_spec, search_knowledge, get_agent_workflow, list_categories, get_template_code

【规划原则】
1. simple 任务：1步，直接执行
2. moderate 任务：2-3步，分析→代码生成
3. complex 任务：3-6步，分析→设计→代码生成（可含验证/优化步骤）
4. 每步必须有明确的输入来源和预期输出
5. 工具选择要精准，不要选不必要的工具
6. 【强制】最后一步必须是"代码生成"步骤，title 包含"代码生成"或"HTML生成"，expectedOutput 为"完整可运行的HTML页面代码"
7. 只输出 JSON，不要有任何其他文字`;

/**
 * 使用 LLM 生成执行计划
 */
export const generatePlan = async (
  userPrompt: string,
  complexity: TaskComplexity,
  options: { provider: string; modelType: string }
): Promise<ExecutionPlan> => {
  const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // simple 任务直接生成单步计划，不调用 LLM
  if (complexity === 'simple') {
    return {
      planId,
      userPrompt,
      complexity,
      complexityReason: '简单任务，直接执行',
      goal: userPrompt.slice(0, 50),
      totalSteps: 1,
      createdAt: new Date(),
      steps: [
        {
          id: 'step_1',
          index: 1,
          title: '直接执行',
          description: userPrompt.slice(0, 100),
          tools: [],
          inputFrom: ['user_prompt'],
          expectedOutput: '完成用户请求',
          status: 'pending',
          retryCount: 0,
          skippable: false,
        },
      ],
    };
  }

  const complexityDesc = {
    moderate: '中等复杂度（创建单个页面/功能），生成2-3步计划',
    complex: '高复杂度（多页面系统/复杂应用），生成3-6步计划',
  }[complexity];

  const response = await callLLM(
    [
      { role: 'system', content: PLANNER_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `任务复杂度：${complexityDesc}\n\n用户需求：${userPrompt}\n\n请生成执行计划（JSON格式）：`,
      },
    ],
    { provider: options.provider as 'ollama' | 'codebuddy', modelType: 'text' }
  );

  // 解析 LLM 返回的 JSON
  let parsed: { goal: string; steps: Omit<PlanStep, 'status' | 'retryCount'>[] };
  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('未找到 JSON 内容');
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    // 解析失败时生成默认计划
    parsed = {
      goal: userPrompt.slice(0, 50),
      steps: [
        {
          id: 'step_1',
          index: 1,
          title: '需求分析',
          description: '分析用户需求，确定实现方案',
          tools: ['find_agent', 'get_design_spec'],
          inputFrom: ['user_prompt'],
          expectedOutput: '需求分析报告和实现方案',
          skippable: false,
        },
        {
          id: 'step_2',
          index: 2,
          title: '代码生成',
          description: '根据分析结果生成完整代码',
          tools: [],
          inputFrom: ['user_prompt', 'step_1'],
          expectedOutput: '完整可运行的代码',
          skippable: false,
        },
      ],
    };
  }

  const steps: PlanStep[] = (parsed.steps || []).map((s, i) => ({
    ...s,
    id: s.id || `step_${i + 1}`,
    index: s.index || i + 1,
    status: 'pending' as StepStatus,
    retryCount: 0,
    skippable: s.skippable ?? false,
  }));

  return {
    planId,
    userPrompt,
    complexity,
    complexityReason: complexityDesc || '',
    goal: parsed.goal || userPrompt.slice(0, 50),
    totalSteps: steps.length,
    createdAt: new Date(),
    steps,
  };
};

// =============================================================================
// 步骤执行器
// =============================================================================

const MAX_STEP_RETRIES = 2;

/**
 * 执行单个计划步骤
 * 1. 调用该步骤所需的工具（并行）
 * 2. 将工具结果注入 LLM 上下文
 * 3. 返回步骤执行结果
 */
export const executeStep = async (
  step: PlanStep,
  plan: ExecutionPlan,
  previousResults: Map<string, string>,
  options: { provider: string; modelType: string; isReact?: boolean }
): Promise<StepExecutionResult> => {
  let toolResults: ToolCallResult[] = [];

  // ── 1. 执行工具调用 ──────────────────────────────────────────────────────────
  if (step.tools.length > 0) {
    const toolCalls: ToolCallRequest[] = step.tools.map((toolName) => ({
      name: toolName,
      arguments: buildToolArguments(toolName, step, plan, previousResults),
    }));

    toolResults = await Promise.all(toolCalls.map(executeTool));
  }

  // ── 2. 构建 LLM 上下文 ───────────────────────────────────────────────────────
  const contextParts: string[] = [
    `【总体目标】${plan.goal}`,
    `【当前步骤】第 ${step.index}/${plan.totalSteps} 步：${step.title}`,
    `【步骤说明】${step.description}`,
    `【用户原始需求】${plan.userPrompt}`,
  ];

  // 注入前置步骤结果
  for (const inputId of step.inputFrom) {
    if (inputId === 'user_prompt') continue;
    const prevResult = previousResults.get(inputId);
    if (prevResult) {
      contextParts.push(`【${inputId} 的输出】\n${prevResult.slice(0, 2000)}`);
    }
  }

  // 注入工具结果
  if (toolResults.length > 0) {
    const toolSummary = toolResults
      .map((r) => `[${r.toolName}] ${r.success ? JSON.stringify(r.data).slice(0, 500) : `失败: ${r.error}`}`)
      .join('\n');
    contextParts.push(`【工具查询结果】\n${toolSummary}`);
  }

  contextParts.push(`【预期输出】${step.expectedOutput}`);

  // 最后一步始终强制输出完整代码（Agent Plan 的最终目标就是生成页面）
  const isLastStep = step.index === plan.totalSteps;

  let systemPrompt: string;
  if (isLastStep && options.isReact) {
    // React 模式：生成 JSX 组件
    systemPrompt = `你是一个专业的 React 前端工程师。请根据用户需求和前置步骤的分析结果，生成完整的 React 函数组件。
【强制要求】
1. 使用 React 函数组件 + Hooks（useState、useEffect 等）
2. 使用原生 CSS 进行样式设计（通过内联 style 对象或组件内定义 styles 常量），禁止使用 Tailwind CSS、className 类名方式
3. 样式要精致美观、现代化，注重间距、圆角、阴影、配色等细节
4. 组件必须默认导出（export default）
5. 输出格式必须严格为：\`\`\`jsx\n...完整组件代码...\n\`\`\`
6. 代码必须完整可运行，不能有省略或占位符
7. 禁止 import React（使用 React 17+ 新 JSX 转换）
8. 禁止 import 外部库（只能使用 React 内置 Hooks）
9. 禁止输出任何解释文字，只输出代码块`;
  } else if (isLastStep) {
    // HTML 模式：生成完整 HTML 页面
    systemPrompt = `你是一个专业的前端开发工程师。请根据用户需求和前置步骤的分析结果，生成完整的单文件 HTML 页面。
【强制要求】
1. 必须输出完整的 HTML 文件，包含 <!DOCTYPE html> 到 </html> 的全部内容
2. 所有 CSS 写在 <style> 标签内，所有 JS 写在 <script> 标签内
3. 使用 Tailwind CSS CDN（https://cdn.tailwindcss.com）确保页面美观
4. 输出格式必须严格为：\`\`\`html\n...完整代码...\n\`\`\`
5. 禁止输出任何解释文字，只输出代码块
6. 代码必须完整可运行，不能有省略或占位符`;
  } else {
    systemPrompt = '你是一个专业的 AI Agent 执行器，负责按计划完成每个步骤的任务。输出要简洁、准确、可执行。';
  }

  contextParts.push('请根据以上信息完成当前步骤，输出结果：');

  const response = await callLLM(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: contextParts.join('\n\n') },
    ],
    { provider: options.provider as 'ollama' | 'codebuddy', modelType: options.modelType as 'text' | 'vision' }
  );

  return {
    stepId: step.id,
    status: 'done',
    result: response.content,
    toolResults,
    retryCount: step.retryCount,
  };
};

/**
 * 根据工具名称和上下文自动构建工具参数
 */
const buildToolArguments = (
  toolName: string,
  step: PlanStep,
  plan: ExecutionPlan,
  previousResults: Map<string, string>
): Record<string, unknown> => {
  const prompt = plan.userPrompt;

  switch (toolName) {
    case 'list_pages':
      return { limit: 10 };

    case 'find_agent':
      return { query: prompt.slice(0, 50), limit: 3 };

    case 'get_design_spec':
      return { spec_type: 'all' };

    case 'search_knowledge':
      return { query: prompt.slice(0, 100), limit: 3 };

    case 'list_categories':
      return { include_agent_count: true };

    case 'get_page_structure':
    case 'get_template_code': {
      // 尝试从前置步骤结果中提取 template_id
      for (const [, result] of previousResults) {
        const idMatch = result.match(/[0-9a-f]{24}/i);
        if (idMatch) return { template_id: idMatch[0] };
      }
      return {};
    }

    case 'get_agent_workflow': {
      // 尝试从前置步骤结果中提取 agent_slug
      for (const [, result] of previousResults) {
        const slugMatch = result.match(/"slug"\s*:\s*"([^"]+)"/);
        if (slugMatch) return { agent_slug: slugMatch[1] };
      }
      return { agent_slug: '' };
    }

    default:
      return {};
  }
};

// =============================================================================
// 完整 Plan-Execute 流程
// =============================================================================

export interface PlanExecuteOptions {
  provider: string;
  modelType: string;
  /** React 模式：生成 JSX 组件代码 */
  isReact?: boolean;
  /** 传入已生成的计划（避免重复调用 LLM 生成计划） */
  existingPlan?: ExecutionPlan;
  /** 是否在每步完成后回调（用于流式推送进度） */
  onStepUpdate?: (step: PlanStep, result: StepExecutionResult) => void;
}

/**
 * 完整的 Plan-Execute 流程
 * 1. 分析复杂度
 * 2. 生成计划
 * 3. 逐步执行（支持重试）
 * 4. 返回最终结果
 */
export const planAndExecute = async (
  userPrompt: string,
  options: PlanExecuteOptions
): Promise<{ plan: ExecutionPlan; finalResult: string; success: boolean }> => {
  let plan: ExecutionPlan;

  if (options.existingPlan) {
    // 使用外部已生成的计划，避免重复调用 LLM
    plan = options.existingPlan;
  } else {
    // ── Step 1: 分析复杂度 ──────────────────────────────────────────────────────
    const { complexity, reason } = analyzeComplexity(userPrompt);
    // ── Step 2: 生成计划 ────────────────────────────────────────────────────────
    plan = await generatePlan(userPrompt, complexity, options);
    plan.complexityReason = reason;
  }

  // ── Step 3: 逐步执行 ──────────────────────────────────────────────────────────
  const previousResults = new Map<string, string>();
  let lastResult = '';

  for (const step of plan.steps) {
    step.status = 'running';
    options.onStepUpdate?.(step, { stepId: step.id, status: 'running', retryCount: 0 });

    let stepResult: StepExecutionResult | null = null;
    let success = false;

    // 重试循环
    while (step.retryCount <= MAX_STEP_RETRIES) {
      try {
        stepResult = await executeStep(step, plan, previousResults, options);
        success = true;
        break;
      } catch (err: unknown) {
        step.retryCount++;
        const message = err instanceof Error ? err.message : String(err);
        step.error = message;

        if (step.retryCount > MAX_STEP_RETRIES) {
          if (step.skippable) {
            step.status = 'skipped';
            stepResult = { stepId: step.id, status: 'skipped', retryCount: step.retryCount };
          } else {
            step.status = 'failed';
            stepResult = { stepId: step.id, status: 'failed', error: message, retryCount: step.retryCount };
          }
          break;
        }
      }
    }

    if (success && stepResult) {
      step.status = 'done';
      step.result = stepResult.result;
      previousResults.set(step.id, stepResult.result || '');
      lastResult = stepResult.result || '';
    }

    options.onStepUpdate?.(step, stepResult!);

    // 关键步骤失败则终止
    if (step.status === 'failed' && !step.skippable) break;
  }

  const allDone = plan.steps.every((s) => s.status === 'done' || s.status === 'skipped');

  // 优先取含代码块的步骤结果作为 finalResult
  const CODE_BLOCK_RE = options.isReact
    ? /```(?:jsx|tsx)[\s\S]*?```/i
    : /```html[\s\S]*?```|<!DOCTYPE\s+html[\s\S]*?<\/html>/i;
  let codeResult = '';
  for (const step of [...plan.steps].reverse()) {
    if (step.result && CODE_BLOCK_RE.test(step.result)) {
      codeResult = step.result;
      break;
    }
  }

  return {
    plan,
    finalResult: codeResult || lastResult,
    success: allDone,
  };
};
