/**
 * @file services/skillRouter.ts
 * @description Skill 路由匹配器（维度 4 — 路由匹配）
 *
 * 三级匹配策略：
 *   L1 — 关键词/正则匹配（零成本，毫秒级）
 *   L2 — 上下文规则匹配（低成本，基于对话历史）
 *   L3 — LLM 意图分类（高成本，仅在 L1/L2 不确定时使用）
 *
 * 匹配流程：
 *   1. 加载所有启用的 Skill
 *   2. L1 关键词扫描 → 如果唯一匹配，直接返回
 *   3. L2 正则 + 上下文规则 → 如果唯一匹配，直接返回
 *   4. L3 LLM 分类 → 从候选列表中选择最佳 Skill
 *   5. 如果都不匹配，返回 null（降级到普通 Chat）
 */

import { Skill, type ISkill } from '../models/Skill.js';
import { callLLM } from './llmService.js';
import { env } from '../config/env.js';
import type { TriggerMethod } from '../models/SkillExecution.js';

// =============================================================================
// 类型定义
// =============================================================================

/** 匹配结果 */
export interface SkillMatch {
  /** 匹配到的 Skill */
  skill: ISkill;
  /** 置信度 0-1 */
  confidence: number;
  /** 匹配方式 */
  method: TriggerMethod;
  /** 匹配到的关键词/模式 */
  matchedTrigger: string;
}

/** 对话上下文（用于 L2 规则匹配） */
export interface ChatContext {
  /** 最近的消息列表 */
  recentMessages: Array<{ role: string; content: string }>;
  /** 当前会话类型 */
  sessionType?: 'chat' | 'vibe';
  /** 当前 Agent slug */
  agentSlug?: string;
}

// =============================================================================
// Skill 缓存（避免每次匹配都查数据库）
// =============================================================================

let skillCache: ISkill[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 1 分钟缓存

/**
 * 获取所有启用的 Skill（带缓存）
 */
const getActiveSkills = async (): Promise<ISkill[]> => {
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_TTL && skillCache.length > 0) {
    return skillCache;
  }

  skillCache = await Skill.find({ isActive: true })
    .sort({ sortOrder: 1 })
    .lean() as ISkill[];
  cacheTimestamp = now;
  return skillCache;
};

/**
 * 手动刷新缓存（Skill 增删改后调用）
 */
export const invalidateSkillCache = () => {
  cacheTimestamp = 0;
  skillCache = [];
};

// =============================================================================
// L1 — 关键词匹配
// =============================================================================

/**
 * L1 关键词匹配：检查用户消息是否包含 Skill 的触发关键词
 * 返回所有匹配的 Skill（可能多个）
 */
const matchByKeywords = (message: string, skills: ISkill[]): SkillMatch[] => {
  const matches: SkillMatch[] = [];
  const lowerMsg = message.toLowerCase();

  for (const skill of skills) {
    const keywords = skill.triggers?.keywords || [];
    for (const kw of keywords) {
      if (lowerMsg.includes(kw.toLowerCase())) {
        matches.push({
          skill,
          confidence: 0.7,
          method: 'keyword',
          matchedTrigger: kw,
        });
        break; // 一个 Skill 只匹配一次
      }
    }
  }

  return matches;
};

// =============================================================================
// L2 — 正则 + 上下文规则匹配
// =============================================================================

/**
 * L2 正则模式匹配
 */
const matchByPatterns = (message: string, skills: ISkill[]): SkillMatch[] => {
  const matches: SkillMatch[] = [];

  for (const skill of skills) {
    const patterns = skill.triggers?.patterns || [];
    for (const pattern of patterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(message)) {
          matches.push({
            skill,
            confidence: 0.85,
            method: 'pattern',
            matchedTrigger: pattern,
          });
          break;
        }
      } catch {
        // 无效正则，跳过
      }
    }
  }

  return matches;
};

/**
 * L2 上下文规则匹配
 * 支持的规则：
 *   - "contains_url" — 消息中包含 URL
 *   - "contains_code" — 消息中包含代码块
 *   - "session_type:vibe" — 当前是 Vibe 会话
 *   - "prev_message_contains:xxx" — 上一条消息包含某关键词
 */
const matchByContextRules = (message: string, skills: ISkill[], context?: ChatContext): SkillMatch[] => {
  if (!context) return [];
  const matches: SkillMatch[] = [];

  for (const skill of skills) {
    const rules = skill.triggers?.contextRules || [];
    let allRulesMatch = rules.length > 0;

    for (const rule of rules) {
      let ruleMatch = false;

      if (rule === 'contains_url') {
        ruleMatch = /https?:\/\/[^\s]+/.test(message);
      } else if (rule === 'contains_code') {
        ruleMatch = /```[\s\S]*```/.test(message) || /`[^`]+`/.test(message);
      } else if (rule.startsWith('session_type:')) {
        const expectedType = rule.split(':')[1];
        ruleMatch = context.sessionType === expectedType;
      } else if (rule.startsWith('prev_message_contains:')) {
        const keyword = rule.split(':')[1];
        const prevMsg = context.recentMessages?.[context.recentMessages.length - 2];
        ruleMatch = prevMsg?.content?.toLowerCase().includes(keyword.toLowerCase()) || false;
      }

      if (!ruleMatch) {
        allRulesMatch = false;
        break;
      }
    }

    if (allRulesMatch && rules.length > 0) {
      matches.push({
        skill,
        confidence: 0.8,
        method: 'context_rule',
        matchedTrigger: rules.join(' + '),
      });
    }
  }

  return matches;
};

// =============================================================================
// L3 — LLM 意图分类
// =============================================================================

/**
 * L3 LLM 意图分类：让 LLM 从候选 Skill 中选择最匹配的
 * 仅在 L1/L2 匹配不确定时使用（多个候选或零候选）
 */
const classifyByLLM = async (
  message: string,
  candidates: ISkill[],
  allSkills: ISkill[]
): Promise<SkillMatch | null> => {
  // 如果没有候选，用全部 Skill 作为候选
  const skillList = candidates.length > 0 ? candidates : allSkills;
  if (skillList.length === 0) return null;

  const skillDescriptions = skillList.map((s, i) =>
    `${i + 1}. [${s.key}] ${s.name} — ${s.description}`
  ).join('\n');

  const response = await callLLM(
    [
      {
        role: 'system',
        content: `你是一个意图分类器。根据用户消息，判断应该使用哪个 Skill 来处理。
如果没有合适的 Skill，回答 "none"。
只回答 Skill 的 key（如 "web_research"），不要有其他文字。

可用的 Skill 列表：
${skillDescriptions}`,
      },
      { role: 'user', content: message },
    ],
    { provider: env.activeProvider as 'ollama' | 'openai', modelType: 'text' }
  );

  const selectedKey = response.content.trim().toLowerCase();
  if (selectedKey === 'none' || !selectedKey) return null;

  const matched = skillList.find(s => s.key === selectedKey);
  if (!matched) return null;

  return {
    skill: matched,
    confidence: 0.6,
    method: 'llm_classify',
    matchedTrigger: `LLM 分类: ${selectedKey}`,
  };
};

// =============================================================================
// 主匹配函数
// =============================================================================

/**
 * 匹配最佳 Skill
 *
 * @param message - 用户消息
 * @param context - 对话上下文（可选）
 * @param options - 匹配选项
 * @returns 匹配结果，null 表示无匹配（降级到普通 Chat）
 */
export const matchSkill = async (
  message: string,
  context?: ChatContext,
  options: { useLLM?: boolean; minConfidence?: number } = {}
): Promise<SkillMatch | null> => {
  const { useLLM = true, minConfidence = 0.5 } = options;
  const skills = await getActiveSkills();
  if (skills.length === 0) return null;

  // ── L1: 关键词匹配 ──
  const keywordMatches = matchByKeywords(message, skills);
  if (keywordMatches.length === 1) {
    return keywordMatches[0]; // 唯一匹配，直接返回
  }

  // ── L2: 正则 + 上下文规则 ──
  const patternMatches = matchByPatterns(message, skills);
  const contextMatches = matchByContextRules(message, skills, context);

  // 合并所有 L1 + L2 匹配，去重并按置信度排序
  const allMatches = new Map<string, SkillMatch>();
  for (const match of [...keywordMatches, ...patternMatches, ...contextMatches]) {
    const existing = allMatches.get(match.skill.key);
    if (!existing || match.confidence > existing.confidence) {
      allMatches.set(match.skill.key, match);
    }
  }

  const sortedMatches = [...allMatches.values()].sort((a, b) => b.confidence - a.confidence);

  // 如果有唯一的高置信度匹配，直接返回
  if (sortedMatches.length === 1 && sortedMatches[0].confidence >= minConfidence) {
    return sortedMatches[0];
  }

  // 如果有多个匹配且最高置信度远超第二名，返回最高的
  if (sortedMatches.length >= 2) {
    const [first, second] = sortedMatches;
    if (first.confidence - second.confidence >= 0.15) {
      return first;
    }
  }

  // ── L3: LLM 分类（仅在启用且 L1/L2 不确定时） ──
  if (useLLM) {
    try {
      const candidates = sortedMatches.map(m => m.skill);
      const llmMatch = await classifyByLLM(message, candidates, skills);
      if (llmMatch && llmMatch.confidence >= minConfidence) {
        return llmMatch;
      }
    } catch (err) {
      console.warn('[SkillRouter] LLM 分类失败，降级到无匹配:', err instanceof Error ? err.message : String(err));
    }
  }

  // 如果 L1/L2 有匹配但没用 LLM，返回最高置信度的
  if (sortedMatches.length > 0 && sortedMatches[0].confidence >= minConfidence) {
    return sortedMatches[0];
  }

  return null; // 无匹配，降级到普通 Chat
};
