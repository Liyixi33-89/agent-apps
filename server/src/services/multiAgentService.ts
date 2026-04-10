/**
 * @file services/multiAgentService.ts
 * @description Multi-Agent 协作服务
 *
 * 支持多个 Agent 之间的协作模式：
 *   1. 顺序协作（Sequential）— Agent A → Agent B → Agent C
 *   2. 并行协作（Parallel）— Agent A + Agent B 同时执行
 *   3. 委派协作（Delegation）— Agent A 将子任务委派给 Agent B
 *   4. 辩论协作（Debate）— 多个 Agent 对同一问题给出不同观点
 */

import { Agent, type IAgent } from '../models/Agent.js';
import { callLLM, streamLLM, type LLMMessage } from './llmService.js';
import { getMemoryContext } from './memoryService.js';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// 类型定义
// =============================================================================

/** 协作模式 */
export type CollaborationMode = 'sequential' | 'parallel' | 'delegation' | 'debate';

/** Agent 消息（Agent 之间的通信） */
export interface AgentMessage {
  fromAgent: string; // Agent slug
  toAgent: string;   // Agent slug 或 'user' 或 'all'
  content: string;
  messageType: 'task' | 'result' | 'question' | 'feedback' | 'delegation';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/** 协作任务定义 */
export interface CollaborationTask {
  taskId: string;
  mode: CollaborationMode;
  userPrompt: string;
  agents: string[]; // Agent slugs
  messages: AgentMessage[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  startedAt?: Date;
  completedAt?: Date;
}

/** 协作步骤结果 */
export interface CollaborationStepResult {
  agentSlug: string;
  agentName: string;
  output: string;
  duration: number;
  status: 'success' | 'failed';
  error?: string;
}

// =============================================================================
// 顺序协作
// =============================================================================

/**
 * 顺序协作 — Agent 按顺序依次处理，前一个的输出作为后一个的输入
 *
 * @example
 * 研究 Agent → 分析 Agent → 写作 Agent
 */
export const sequentialCollaboration = async (
  userPrompt: string,
  agentSlugs: string[],
  options?: { userId?: string; onStep?: (step: CollaborationStepResult) => void }
): Promise<{ taskId: string; results: CollaborationStepResult[]; finalOutput: string }> => {
  const taskId = uuidv4();
  const results: CollaborationStepResult[] = [];
  let currentInput = userPrompt;

  for (const slug of agentSlugs) {
    const agent = await Agent.findOne({ slug }).lean() as IAgent | null;
    if (!agent) {
      results.push({
        agentSlug: slug,
        agentName: slug,
        output: '',
        duration: 0,
        status: 'failed',
        error: `Agent "${slug}" 不存在`,
      });
      continue;
    }

    const startTime = Date.now();
    try {
      // 构建 Agent 上下文
      const systemPrompt = buildAgentSystemPrompt(agent);
      let memoryContext = '';
      if (options?.userId) {
        memoryContext = await getMemoryContext({
          userId: options.userId,
          currentMessage: currentInput,
          agentSlug: slug,
        });
      }

      const messages: LLMMessage[] = [
        { role: 'system', content: systemPrompt + memoryContext },
        {
          role: 'user',
          content: results.length > 0
            ? `前一个 Agent 的输出：\n${currentInput}\n\n请基于以上内容继续处理用户的原始需求：${userPrompt}`
            : currentInput,
        },
      ];

      const response = await callLLM(messages);
      const duration = Date.now() - startTime;

      const stepResult: CollaborationStepResult = {
        agentSlug: slug,
        agentName: agent.name.zh || agent.name.en,
        output: response.content,
        duration,
        status: 'success',
      };

      results.push(stepResult);
      currentInput = response.content;
      options?.onStep?.(stepResult);
    } catch (err) {
      const duration = Date.now() - startTime;
      results.push({
        agentSlug: slug,
        agentName: agent.name.zh || agent.name.en,
        output: '',
        duration,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { taskId, results, finalOutput: currentInput };
};

// =============================================================================
// 并行协作
// =============================================================================

/**
 * 并行协作 — 多个 Agent 同时处理同一任务，最后合并结果
 */
export const parallelCollaboration = async (
  userPrompt: string,
  agentSlugs: string[],
  options?: { userId?: string; mergeStrategy?: 'concat' | 'llm_merge' }
): Promise<{ taskId: string; results: CollaborationStepResult[]; finalOutput: string }> => {
  const taskId = uuidv4();
  const mergeStrategy = options?.mergeStrategy || 'llm_merge';

  // 并行执行所有 Agent
  const promises = agentSlugs.map(async (slug) => {
    const agent = await Agent.findOne({ slug }).lean() as IAgent | null;
    if (!agent) {
      return {
        agentSlug: slug,
        agentName: slug,
        output: '',
        duration: 0,
        status: 'failed' as const,
        error: `Agent "${slug}" 不存在`,
      };
    }

    const startTime = Date.now();
    try {
      const systemPrompt = buildAgentSystemPrompt(agent);
      const messages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const response = await callLLM(messages);
      return {
        agentSlug: slug,
        agentName: agent.name.zh || agent.name.en,
        output: response.content,
        duration: Date.now() - startTime,
        status: 'success' as const,
      };
    } catch (err) {
      return {
        agentSlug: slug,
        agentName: agent.name.zh || agent.name.en,
        output: '',
        duration: Date.now() - startTime,
        status: 'failed' as const,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  const results = await Promise.all(promises);
  const successResults = results.filter(r => r.status === 'success');

  // 合并结果
  let finalOutput: string;
  if (mergeStrategy === 'concat' || successResults.length <= 1) {
    finalOutput = successResults.map(r => `## ${r.agentName}\n${r.output}`).join('\n\n---\n\n');
  } else {
    // 使用 LLM 智能合并
    const mergePrompt = successResults.map(r =>
      `### ${r.agentName} 的分析：\n${r.output}`
    ).join('\n\n');

    const mergeResponse = await callLLM([
      {
        role: 'system',
        content: '你是一个信息整合专家。请将多个 Agent 的分析结果整合为一份完整、连贯的报告。保留各方的关键观点，消除重复内容。',
      },
      {
        role: 'user',
        content: `用户原始问题：${userPrompt}\n\n以下是各 Agent 的分析结果：\n\n${mergePrompt}`,
      },
    ]);
    finalOutput = mergeResponse.content;
  }

  return { taskId, results, finalOutput };
};

// =============================================================================
// 辩论协作
// =============================================================================

/**
 * 辩论协作 — 多个 Agent 对同一问题进行多轮辩论，最后由裁判 Agent 总结
 */
export const debateCollaboration = async (
  userPrompt: string,
  agentSlugs: string[],
  options?: { rounds?: number; judgeSlug?: string }
): Promise<{ taskId: string; rounds: Array<{ round: number; arguments: CollaborationStepResult[] }>; verdict: string }> => {
  const taskId = uuidv4();
  const maxRounds = options?.rounds ?? 2;
  const allRounds: Array<{ round: number; arguments: CollaborationStepResult[] }> = [];

  let previousArguments = '';

  for (let round = 1; round <= maxRounds; round++) {
    const roundResults: CollaborationStepResult[] = [];

    for (const slug of agentSlugs) {
      const agent = await Agent.findOne({ slug }).lean() as IAgent | null;
      if (!agent) continue;

      const startTime = Date.now();
      try {
        const systemPrompt = buildAgentSystemPrompt(agent);
        const messages: LLMMessage[] = [
          {
            role: 'system',
            content: `${systemPrompt}\n\n你正在参与一场关于以下问题的辩论。请从你的专业角度给出独特的观点和论据。${round > 1 ? '请回应其他参与者的观点。' : ''}`,
          },
          {
            role: 'user',
            content: round === 1
              ? userPrompt
              : `问题：${userPrompt}\n\n上一轮的讨论：\n${previousArguments}\n\n请给出你的回应和新的论据。`,
          },
        ];

        const response = await callLLM(messages);
        roundResults.push({
          agentSlug: slug,
          agentName: agent.name.zh || agent.name.en,
          output: response.content,
          duration: Date.now() - startTime,
          status: 'success',
        });
      } catch (err) {
        roundResults.push({
          agentSlug: slug,
          agentName: agent.name.zh || agent.name.en,
          output: '',
          duration: Date.now() - startTime,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    allRounds.push({ round, arguments: roundResults });
    previousArguments = roundResults
      .filter(r => r.status === 'success')
      .map(r => `**${r.agentName}**: ${r.output}`)
      .join('\n\n');
  }

  // 裁判总结
  const allArguments = allRounds.flatMap(r =>
    r.arguments.filter(a => a.status === 'success').map(a => `[第${r.round}轮] ${a.agentName}: ${a.output}`)
  ).join('\n\n');

  const verdictResponse = await callLLM([
    {
      role: 'system',
      content: '你是一个公正的裁判。请综合所有参与者的观点，给出一个全面、平衡的总结和结论。',
    },
    {
      role: 'user',
      content: `问题：${userPrompt}\n\n辩论记录：\n${allArguments}\n\n请给出你的裁决和总结。`,
    },
  ]);

  return { taskId, rounds: allRounds, verdict: verdictResponse.content };
};

// =============================================================================
// 工具函数
// =============================================================================

/** 根据 Agent 数据构建系统提示词 */
const buildAgentSystemPrompt = (agent: IAgent): string => {
  const name = agent.name.zh || agent.name.en;
  const description = agent.description.zh || agent.description.en;
  const vibe = agent.vibe?.zh || agent.vibe?.en || '';

  let prompt = `你是 ${name}。${description}`;
  if (vibe) prompt += `\n\n你的风格：${vibe}`;

  // 添加能力描述
  if (agent.capabilities && agent.capabilities.length > 0) {
    const caps = agent.capabilities.map(c => c.zh || c.en).filter(Boolean);
    if (caps.length > 0) {
      prompt += `\n\n你的核心能力：\n${caps.map(c => `- ${c}`).join('\n')}`;
    }
  }

  return prompt;
};
