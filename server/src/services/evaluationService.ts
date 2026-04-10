/**
 * @file services/evaluationService.ts
 * @description Agent 评估服务 — 用户反馈收集 + LLM 自动质量评估
 */

import { AgentEvaluation, type IAgentEvaluation } from '../models/AgentEvaluation.js';
import { callLLM } from './llmService.js';

// ─── 用户评分 ────────────────────────────────────────────────────────────────

export const submitUserRating = async (params: {
  agentSlug: string;
  chatId?: string;
  messageId?: string;
  rating: number;
  feedback?: string;
  userInput: string;
  agentOutput: string;
  evaluatedBy?: string;
}) => {
  return AgentEvaluation.create({
    ...params,
    evaluationType: params.feedback ? 'user_feedback' : 'user_rating',
  });
};

// ─── LLM 自动质量评估 ───────────────────────────────────────────────────────

const EVAL_SYSTEM_PROMPT = `你是一个 AI 输出质量评估专家。请对以下 AI Agent 的回答进行评估。

评估维度（每项 0-1 分）：
1. relevance（相关性）：回答是否切题，是否回答了用户的问题
2. accuracy（准确性）：信息是否正确，是否有事实错误
3. completeness（完整性）：回答是否全面，是否遗漏重要信息
4. readability（可读性）：表达是否清晰，格式是否友好

请只输出 JSON，格式如下：
{"relevance": 0.8, "accuracy": 0.9, "completeness": 0.7, "readability": 0.85, "overall": 0.81}

overall 为四项的加权平均（relevance:0.3, accuracy:0.3, completeness:0.2, readability:0.2）`;

export const autoEvaluateQuality = async (params: {
  agentSlug: string;
  chatId?: string;
  messageId?: string;
  userInput: string;
  agentOutput: string;
  provider?: string;
  model?: string;
}) => {
  try {
    const response = await callLLM(
      [
        { role: 'system', content: EVAL_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `【用户问题】\n${params.userInput.slice(0, 500)}\n\n【Agent 回答】\n${params.agentOutput.slice(0, 2000)}`,
        },
      ],
      { provider: 'openai', modelType: 'text' }
    );

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('未找到 JSON');

    const scores = JSON.parse(jsonMatch[0]) as {
      relevance: number; accuracy: number; completeness: number; readability: number; overall: number;
    };

    return AgentEvaluation.create({
      agentSlug: params.agentSlug,
      chatId: params.chatId,
      messageId: params.messageId,
      evaluationType: 'auto_quality',
      qualityScores: scores,
      userInput: params.userInput,
      agentOutput: params.agentOutput,
      provider: params.provider,
      model: params.model,
    });
  } catch (err) {
    console.error('[EvaluationService] 自动评估失败:', err);
    return null;
  }
};

// ─── 统计查询 ────────────────────────────────────────────────────────────────

/** 获取 Agent 评估统计 */
export const getAgentEvalStats = async (agentSlug: string) => {
  const [ratingStats, qualityStats, recentFeedback] = await Promise.all([
    // 用户评分统计
    AgentEvaluation.aggregate([
      { $match: { agentSlug, evaluationType: { $in: ['user_rating', 'user_feedback'] }, rating: { $exists: true } } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          totalRatings: { $sum: 1 },
          rating5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
          rating4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          rating3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          rating2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          rating1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
        },
      },
    ]),

    // 自动质量评估统计
    AgentEvaluation.aggregate([
      { $match: { agentSlug, evaluationType: 'auto_quality', qualityScores: { $exists: true } } },
      {
        $group: {
          _id: null,
          avgRelevance: { $avg: '$qualityScores.relevance' },
          avgAccuracy: { $avg: '$qualityScores.accuracy' },
          avgCompleteness: { $avg: '$qualityScores.completeness' },
          avgReadability: { $avg: '$qualityScores.readability' },
          avgOverall: { $avg: '$qualityScores.overall' },
          totalEvals: { $sum: 1 },
        },
      },
    ]),

    // 最近的用户反馈
    AgentEvaluation.find(
      { agentSlug, evaluationType: 'user_feedback', feedback: { $exists: true, $ne: '' } },
      { feedback: 1, rating: 1, createdAt: 1, evaluatedBy: 1 }
    )
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  return {
    userRating: ratingStats[0] || {
      avgRating: 0, totalRatings: 0,
      rating5: 0, rating4: 0, rating3: 0, rating2: 0, rating1: 0,
    },
    autoQuality: qualityStats[0] || {
      avgRelevance: 0, avgAccuracy: 0, avgCompleteness: 0,
      avgReadability: 0, avgOverall: 0, totalEvals: 0,
    },
    recentFeedback,
  };
};
