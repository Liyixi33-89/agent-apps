/**
 * @file services/memoryService.ts
 * @description Agent 记忆管理服务
 *
 * 功能：
 *   1. 记忆的 CRUD 操作
 *   2. 基于语义的记忆检索
 *   3. 记忆整合（将短期记忆提炼为长期记忆）
 *   4. 遗忘机制（基于访问频率和时间衰减）
 *   5. 记忆注入（将相关记忆注入到 LLM 上下文中）
 */

import { v4 as uuidv4 } from 'uuid';
import { AgentMemory, type IMemoryEntry, type MemoryType, type MemoryImportance } from '../models/AgentMemory.js';
import { getEmbedding, cosineSimilarity } from './embeddingService.js';
import { callLLM, type LLMMessage } from './llmService.js';

// =============================================================================
// 记忆 CRUD
// =============================================================================

/**
 * 添加一条记忆
 */
export const addMemory = async (params: {
  userId: string;
  agentSlug?: string;
  sessionId?: string;
  content: string;
  type: MemoryType;
  importance?: MemoryImportance;
  tags?: string[];
  ttlHours?: number;
}): Promise<IMemoryEntry> => {
  const {
    userId, agentSlug, sessionId, content, type,
    importance = 'medium', tags = [], ttlHours,
  } = params;

  // 生成记忆摘要
  const summary = content.length > 100 ? content.slice(0, 100) + '...' : content;

  // 尝试生成向量嵌入
  let embedding: number[] | undefined;
  try {
    embedding = await getEmbedding(content);
    if (embedding.length === 0) embedding = undefined;
  } catch {
    // 向量化失败不影响记忆存储
  }

  const memoryEntry: IMemoryEntry = {
    memoryId: uuidv4(),
    type,
    content,
    summary,
    importance,
    tags,
    embedding,
    accessCount: 0,
    lastAccessedAt: new Date(),
    createdAt: new Date(),
    expiresAt: ttlHours ? new Date(Date.now() + ttlHours * 3600_000) : undefined,
  };

  // 查找或创建记忆文档
  let memoryDoc = await AgentMemory.findOne({ userId, agentSlug: agentSlug || null });
  if (!memoryDoc) {
    memoryDoc = new AgentMemory({
      userId,
      agentSlug,
      sessionId,
      memories: [],
      stats: { totalMemories: 0, sessionMemories: 0, longTermMemories: 0, workingMemories: 0 },
    });
  }

  memoryDoc.memories.push(memoryEntry);

  // 更新统计
  memoryDoc.stats.totalMemories = memoryDoc.memories.length;
  memoryDoc.stats.sessionMemories = memoryDoc.memories.filter((m: IMemoryEntry) => m.type === 'session').length;
  memoryDoc.stats.longTermMemories = memoryDoc.memories.filter((m: IMemoryEntry) => m.type === 'long_term').length;
  memoryDoc.stats.workingMemories = memoryDoc.memories.filter((m: IMemoryEntry) => m.type === 'working').length;

  await memoryDoc.save();
  return memoryEntry;
};

/**
 * 获取用户的所有记忆
 */
export const getMemories = async (params: {
  userId: string;
  agentSlug?: string;
  type?: MemoryType;
  limit?: number;
}): Promise<IMemoryEntry[]> => {
  const { userId, agentSlug, type, limit = 50 } = params;

  const memoryDoc = await AgentMemory.findOne({ userId, agentSlug: agentSlug || null }).lean() as any;
  if (!memoryDoc) return [];

  let memories: IMemoryEntry[] = memoryDoc.memories || [];

  // 过滤类型
  if (type) {
    memories = memories.filter(m => m.type === type);
  }

  // 过滤过期记忆
  const now = new Date();
  memories = memories.filter(m => !m.expiresAt || new Date(m.expiresAt) > now);

  // 按重要性和最近访问时间排序
  const importanceOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  memories.sort((a: IMemoryEntry, b: IMemoryEntry) => {
    const impDiff = (importanceOrder[b.importance] || 0) - (importanceOrder[a.importance] || 0);
    if (impDiff !== 0) return impDiff;
    return new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime();
  });

  return memories.slice(0, limit);
};

/**
 * 删除一条记忆
 */
export const deleteMemory = async (userId: string, memoryId: string, agentSlug?: string): Promise<boolean> => {
  const result = await AgentMemory.findOneAndUpdate(
    { userId, agentSlug: agentSlug || null },
    { $pull: { memories: { memoryId } } },
    { new: true }
  );
  return !!result;
};

// =============================================================================
// 语义记忆检索
// =============================================================================

/**
 * 基于语义相似度检索相关记忆
 */
export const searchMemories = async (params: {
  userId: string;
  query: string;
  agentSlug?: string;
  type?: MemoryType;
  limit?: number;
  minScore?: number;
}): Promise<Array<IMemoryEntry & { score: number }>> => {
  const { userId, query, agentSlug, type, limit = 5, minScore = 0.3 } = params;

  const memoryDoc = await AgentMemory.findOne({ userId, agentSlug: agentSlug || null }).lean() as any;
  if (!memoryDoc) return [];

  // 获取查询向量
  let queryEmbedding: number[];
  try {
    queryEmbedding = await getEmbedding(query);
    if (queryEmbedding.length === 0) return [];
  } catch {
    return [];
  }

  // 计算相似度
  const now = new Date();
  const results: Array<IMemoryEntry & { score: number }> = [];

  for (const memory of (memoryDoc.memories || []) as IMemoryEntry[]) {
    // 过滤过期记忆
    if (memory.expiresAt && new Date(memory.expiresAt) <= now) continue;
    // 过滤类型
    if (type && memory.type !== type) continue;
    // 需要有向量
    if (!memory.embedding || memory.embedding.length === 0) continue;

    const score = cosineSimilarity(queryEmbedding, memory.embedding);
    if (score >= minScore) {
      results.push({ ...memory, score });
    }
  }

  results.sort((a, b) => b.score - a.score);

  // 更新访问计数
  const topIds = results.slice(0, limit).map(r => r.memoryId);
  if (topIds.length > 0) {
    await AgentMemory.updateOne(
      { userId, agentSlug: agentSlug || null },
      {
        $inc: { 'memories.$[elem].accessCount': 1 },
        $set: { 'memories.$[elem].lastAccessedAt': new Date() },
      },
      { arrayFilters: [{ 'elem.memoryId': { $in: topIds } }] }
    );
  }

  return results.slice(0, limit);
};

// =============================================================================
// 记忆整合（短期 → 长期）
// =============================================================================

/**
 * 将会话中的短期记忆整合为长期记忆
 * 使用 LLM 提炼关键信息
 */
export const consolidateMemories = async (params: {
  userId: string;
  agentSlug?: string;
  sessionId?: string;
}): Promise<{ consolidated: number; newLongTermMemories: number }> => {
  const { userId, agentSlug } = params;

  const memoryDoc = await AgentMemory.findOne({ userId, agentSlug: agentSlug || null });
  if (!memoryDoc) return { consolidated: 0, newLongTermMemories: 0 };

  // 获取所有短期记忆
  const sessionMemories = (memoryDoc.memories as IMemoryEntry[]).filter((m: IMemoryEntry) => m.type === 'session');
  if (sessionMemories.length < 3) return { consolidated: 0, newLongTermMemories: 0 };

  // 使用 LLM 提炼关键信息
  const memoryTexts = sessionMemories.map(m => `- ${m.content}`).join('\n');

  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: `你是一个记忆整合助手。请从以下对话记忆中提取关键的用户偏好、重要事实和行为模式。
每条提炼的记忆用一行表示，格式为：[重要性:high/medium/low] 记忆内容
只输出提炼后的记忆，不要有其他文字。最多输出 5 条。`,
    },
    {
      role: 'user',
      content: `以下是需要整合的短期记忆：\n${memoryTexts}`,
    },
  ];

  try {
    const response = await callLLM(messages);
    const lines = response.content.split('\n').filter(l => l.trim());

    let newLongTermMemories = 0;

    for (const line of lines) {
      const match = line.match(/\[重要性:(high|medium|low)\]\s*(.+)/);
      if (match) {
        const importance = match[1] as MemoryImportance;
        const content = match[2].trim();

        await addMemory({
          userId,
          agentSlug,
          content,
          type: 'long_term',
          importance,
          tags: ['consolidated'],
        });
        newLongTermMemories++;
      }
    }

    // 清理已整合的短期记忆
    const sessionIds = sessionMemories.map((m: IMemoryEntry) => m.memoryId);
    memoryDoc.memories = (memoryDoc.memories as IMemoryEntry[]).filter((m: IMemoryEntry) => !sessionIds.includes(m.memoryId)) as any;
    await memoryDoc.save();

    return { consolidated: sessionMemories.length, newLongTermMemories };
  } catch (err) {
    console.warn('[MemoryService] 记忆整合失败:', err instanceof Error ? err.message : String(err));
    return { consolidated: 0, newLongTermMemories: 0 };
  }
};

// =============================================================================
// 记忆注入（将记忆注入 LLM 上下文）
// =============================================================================

/**
 * 根据当前对话内容，检索相关记忆并生成注入文本
 */
export const getMemoryContext = async (params: {
  userId: string;
  currentMessage: string;
  agentSlug?: string;
  maxMemories?: number;
}): Promise<string> => {
  const { userId, currentMessage, agentSlug, maxMemories = 5 } = params;

  // 获取长期记忆
  const longTermMemories = await getMemories({ userId, agentSlug, type: 'long_term', limit: 10 });

  // 语义检索相关记忆
  const relevantMemories = await searchMemories({
    userId,
    query: currentMessage,
    agentSlug,
    limit: maxMemories,
    minScore: 0.3,
  });

  // 合并去重
  const seen = new Set<string>();
  const allMemories: IMemoryEntry[] = [];

  for (const m of [...relevantMemories, ...longTermMemories]) {
    if (!seen.has(m.memoryId)) {
      seen.add(m.memoryId);
      allMemories.push(m);
    }
  }

  if (allMemories.length === 0) return '';

  // 生成注入文本
  const memoryLines = allMemories.slice(0, maxMemories).map(m => {
    const typeLabel = m.type === 'long_term' ? '📌' : m.type === 'session' ? '💬' : '🔧';
    return `${typeLabel} ${m.content}`;
  });

  return `\n[用户记忆]\n${memoryLines.join('\n')}\n[/用户记忆]\n`;
};

/**
 * 从对话消息中自动提取值得记忆的信息
 */
export const autoExtractMemory = async (params: {
  userId: string;
  userMessage: string;
  assistantResponse: string;
  agentSlug?: string;
}): Promise<void> => {
  const { userId, userMessage, assistantResponse, agentSlug } = params;

  // 使用简单规则检测是否包含值得记忆的信息
  const memoryPatterns = [
    { pattern: /我(喜欢|偏好|习惯|常用|总是|一般|通常)/i, importance: 'high' as MemoryImportance },
    { pattern: /我(是|叫|在|做|从事)/i, importance: 'high' as MemoryImportance },
    { pattern: /请(记住|记下|记录)/i, importance: 'critical' as MemoryImportance },
    { pattern: /以后(不要|别|请)/i, importance: 'high' as MemoryImportance },
    { pattern: /(我的项目|我的公司|我的团队)/i, importance: 'medium' as MemoryImportance },
  ];

  for (const { pattern, importance } of memoryPatterns) {
    if (pattern.test(userMessage)) {
      await addMemory({
        userId,
        agentSlug,
        content: `用户说: "${userMessage.slice(0, 200)}"`,
        type: 'long_term',
        importance,
        tags: ['auto_extracted'],
      });
      break; // 只提取一次
    }
  }
};
