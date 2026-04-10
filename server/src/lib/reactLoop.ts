/**
 * @file lib/reactLoop.ts
 * @description Agent ReAct 循环引擎 — 思考→行动→观察→再思考
 *
 * ReAct (Reasoning + Acting) 模式：
 *   1. Thought  — LLM 分析当前状态，决定下一步行动
 *   2. Action   — 调用工具执行操作
 *   3. Observation — 观察工具返回结果
 *   4. 循环直到 LLM 认为任务完成，输出 Final Answer
 *
 * 与 Plan-Execute 的区别：
 *   - Plan-Execute：先规划所有步骤，再逐步执行（预规划模式）
 *   - ReAct：每步都根据上一步的观察结果动态决策（自主决策模式）
 */

import { callLLM } from '../services/llmService.js';
import { AGENT_TOOLS, executeTool } from './agentTools.js';
import type { ToolCallResult } from './agentTools.js';

// =============================================================================
// 类型定义
// =============================================================================

export interface ReActStep {
  /** 步骤序号 */
  index: number;
  /** 思考内容 */
  thought: string;
  /** 行动：工具名称 */
  action?: string;
  /** 行动：工具参数 */
  actionInput?: Record<string, unknown>;
  /** 观察：工具返回结果 */
  observation?: string;
  /** 是否为最终答案步骤 */
  isFinal: boolean;
  /** 最终答案（仅 isFinal=true 时有值） */
  finalAnswer?: string;
  /** 耗时（ms） */
  duration: number;
}

export interface ReActResult {
  /** 所有步骤记录 */
  steps: ReActStep[];
  /** 最终答案 */
  finalAnswer: string;
  /** 是否成功完成 */
  success: boolean;
  /** 总耗时（ms） */
  totalDuration: number;
  /** 总步骤数 */
  totalSteps: number;
  /** 工具调用次数 */
  toolCallCount: number;
}

export interface ReActOptions {
  provider: string;
  modelType?: string;
  /** 最大循环次数（防止无限循环） */
  maxIterations?: number;
  /** 可用工具列表（默认使用全部 AGENT_TOOLS） */
  availableTools?: string[];
  /** 系统提示词前缀（可注入 Agent 人设） */
  systemPromptPrefix?: string;
  /** 每步完成后的回调（用于流式推送） */
  onStepComplete?: (step: ReActStep) => void;
}

// =============================================================================
// ReAct 系统提示词
// =============================================================================

const REACT_SYSTEM_PROMPT = `你是一个具备自主决策能力的 AI Agent，使用 ReAct（Reasoning + Acting）模式来解决问题。

【工作流程】
你必须严格按照以下格式进行思考和行动：

Thought: <分析当前状态，思考下一步应该做什么>
Action: <要调用的工具名称>
Action Input: <工具参数，JSON 格式>

或者，当你认为已经收集到足够信息可以给出最终答案时：

Thought: <总结分析>
Final Answer: <最终答案>

【重要规则】
1. 每次只能执行一个 Action
2. 必须先 Thought 再 Action，不能跳过思考步骤
3. 观察到工具结果后，必须再次 Thought 分析结果
4. 最多执行 {MAX_ITERATIONS} 轮循环
5. 如果工具调用失败，分析原因并尝试其他方案
6. 当信息足够时，直接给出 Final Answer，不要过度调用工具

【输出格式要求】
- Thought/Action/Action Input/Observation/Final Answer 必须各占一行
- Action Input 必须是合法的 JSON
- Final Answer 是你的最终回答，可以包含 Markdown 格式`;

// =============================================================================
// 解析 LLM 输出
// =============================================================================

interface ParsedReActOutput {
  thought: string;
  action?: string;
  actionInput?: Record<string, unknown>;
  finalAnswer?: string;
}

const parseReActOutput = (output: string): ParsedReActOutput => {
  const result: ParsedReActOutput = { thought: '' };

  // 提取 Thought
  const thoughtMatch = output.match(/Thought:\s*([\s\S]*?)(?=\n(?:Action:|Final Answer:)|$)/i);
  if (thoughtMatch) {
    result.thought = thoughtMatch[1].trim();
  }

  // 检查是否有 Final Answer
  const finalMatch = output.match(/Final Answer:\s*([\s\S]*?)$/i);
  if (finalMatch) {
    result.finalAnswer = finalMatch[1].trim();
    return result;
  }

  // 提取 Action
  const actionMatch = output.match(/Action:\s*(.+)/i);
  if (actionMatch) {
    result.action = actionMatch[1].trim();
  }

  // 提取 Action Input
  const inputMatch = output.match(/Action Input:\s*([\s\S]*?)(?=\n(?:Thought:|Observation:|$))/i);
  if (inputMatch) {
    try {
      const jsonStr = inputMatch[1].trim();
      // 尝试提取 JSON 对象
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result.actionInput = JSON.parse(jsonMatch[0]);
      }
    } catch {
      result.actionInput = {};
    }
  }

  return result;
};

// =============================================================================
// ReAct 循环主入口
// =============================================================================

/**
 * 执行 ReAct 循环
 * @param userPrompt 用户输入
 * @param options 配置选项
 */
export const executeReActLoop = async (
  userPrompt: string,
  options: ReActOptions
): Promise<ReActResult> => {
  const maxIterations = options.maxIterations || 8;
  const availableTools = options.availableTools || AGENT_TOOLS.map((t) => t.function.name);

  // 构建工具描述
  const toolDescriptions = AGENT_TOOLS
    .filter((t) => availableTools.includes(t.function.name))
    .map((t) => {
      const params = t.function.parameters?.properties
        ? Object.entries(t.function.parameters.properties as Record<string, { type: string; description: string }>)
            .map(([k, v]) => `  - ${k} (${v.type}): ${v.description}`)
            .join('\n')
        : '  无参数';
      return `- ${t.function.name}: ${t.function.description}\n  参数:\n${params}`;
    })
    .join('\n\n');

  const systemPrompt = [
    options.systemPromptPrefix || '',
    REACT_SYSTEM_PROMPT.replace('{MAX_ITERATIONS}', String(maxIterations)),
    `\n【可用工具】\n${toolDescriptions}`,
  ].filter(Boolean).join('\n\n');

  const steps: ReActStep[] = [];
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const startTime = Date.now();
  let toolCallCount = 0;
  let finalAnswer = '';
  let success = false;

  for (let i = 0; i < maxIterations; i++) {
    const stepStart = Date.now();

    // 调用 LLM 获取下一步决策
    const response = await callLLM(messages, {
      provider: options.provider as any,
      modelType: (options.modelType || 'text') as any,
    });

    const parsed = parseReActOutput(response.content);

    // 构建步骤记录
    const step: ReActStep = {
      index: i + 1,
      thought: parsed.thought || '（无明确思考内容）',
      isFinal: !!parsed.finalAnswer,
      duration: Date.now() - stepStart,
    };

    // 如果是最终答案
    if (parsed.finalAnswer) {
      step.finalAnswer = parsed.finalAnswer;
      finalAnswer = parsed.finalAnswer;
      success = true;
      steps.push(step);
      options.onStepComplete?.(step);
      break;
    }

    // 如果有 Action，执行工具调用
    if (parsed.action) {
      step.action = parsed.action;
      step.actionInput = parsed.actionInput || {};

      // 验证工具是否可用
      const toolExists = availableTools.includes(parsed.action);
      let observation: string;

      if (toolExists) {
        try {
          const toolResult: ToolCallResult = await executeTool({
            name: parsed.action,
            arguments: parsed.actionInput || {},
          });
          toolCallCount++;

          observation = toolResult.success
            ? JSON.stringify(toolResult.data, null, 2).slice(0, 3000)
            : `工具调用失败: ${toolResult.error}`;
        } catch (err: unknown) {
          observation = `工具执行异常: ${err instanceof Error ? err.message : String(err)}`;
        }
      } else {
        observation = `工具 "${parsed.action}" 不存在。可用工具: ${availableTools.join(', ')}`;
      }

      step.observation = observation;

      // 将本轮对话加入上下文
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: `Observation: ${observation}` });
    } else {
      // 没有 Action 也没有 Final Answer，提示 LLM 继续
      messages.push({ role: 'assistant', content: response.content });
      messages.push({
        role: 'user',
        content: '请继续。如果你已经有足够的信息，请给出 Final Answer。否则请选择一个 Action 来获取更多信息。',
      });
    }

    step.duration = Date.now() - stepStart;
    steps.push(step);
    options.onStepComplete?.(step);
  }

  // 如果达到最大迭代次数仍未给出 Final Answer
  if (!success) {
    // 强制要求 LLM 给出总结
    messages.push({
      role: 'user',
      content: '你已经达到最大思考轮数。请根据目前收集到的所有信息，立即给出 Final Answer。',
    });

    const finalResponse = await callLLM(messages, {
      provider: options.provider as any,
      modelType: (options.modelType || 'text') as any,
    });

    const parsed = parseReActOutput(finalResponse.content);
    finalAnswer = parsed.finalAnswer || finalResponse.content;
    success = true;

    steps.push({
      index: steps.length + 1,
      thought: parsed.thought || '达到最大迭代次数，强制总结',
      isFinal: true,
      finalAnswer,
      duration: 0,
    });
  }

  return {
    steps,
    finalAnswer,
    success,
    totalDuration: Date.now() - startTime,
    totalSteps: steps.length,
    toolCallCount,
  };
};
