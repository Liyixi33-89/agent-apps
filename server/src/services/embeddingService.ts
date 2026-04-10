/**
 * @file services/embeddingService.ts
 * @description 向量嵌入服务 — 支持多 Provider 的文本向量化
 *
 * 功能：
 *   1. 文本向量化（OpenAI / Ollama embedding API）
 *   2. 余弦相似度计算
 *   3. 知识库向量索引构建
 *   4. 语义检索（RAG）
 */

import axios from 'axios';
import { env, type LLMProvider } from '../config/env.js';
import { KnowledgeBase, type IKnowledgeBase } from '../models/KnowledgeBase.js';

// =============================================================================
// 向量化接口
// =============================================================================

/**
 * 调用 Embedding API 将文本转换为向量
 */
export const getEmbedding = async (text: string, provider?: LLMProvider): Promise<number[]> => {
  const p = provider || env.embeddingProvider;
  const cleanText = text.replace(/\n+/g, ' ').trim().slice(0, 8000);

  if (p === 'ollama') {
    return getOllamaEmbedding(cleanText);
  }
  // OpenAI / DeepSeek 等兼容 API
  return getOpenAICompatibleEmbedding(cleanText, p);
};

/** Ollama Embedding */
const getOllamaEmbedding = async (text: string): Promise<number[]> => {
  const url = `${env.ollamaBaseUrl}/api/embeddings`;
  const response = await axios.post(url, {
    model: env.embeddingModel || 'nomic-embed-text',
    prompt: text,
  }, { timeout: 30_000 });

  return response.data?.embedding || [];
};

/** OpenAI 兼容 Embedding（OpenAI / DeepSeek） */
const getOpenAICompatibleEmbedding = async (text: string, provider: LLMProvider): Promise<number[]> => {
  const configMap: Record<string, { baseUrl: string; apiKey: string }> = {
    openai: { baseUrl: env.openaiBaseUrl, apiKey: env.openaiApiKey },
    deepseek: { baseUrl: env.deepseekBaseUrl, apiKey: env.deepseekApiKey },
    claude: { baseUrl: env.openaiBaseUrl, apiKey: env.openaiApiKey }, // Claude 不支持 embedding，降级到 OpenAI
    gemini: { baseUrl: env.openaiBaseUrl, apiKey: env.openaiApiKey }, // Gemini 降级到 OpenAI
  };

  const config = configMap[provider] || configMap.openai;
  const url = `${config.baseUrl}/embeddings`;

  const response = await axios.post(
    url,
    {
      model: env.embeddingModel,
      input: text,
    },
    {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    }
  );

  return response.data?.data?.[0]?.embedding || [];
};

// =============================================================================
// 批量向量化
// =============================================================================

/**
 * 批量向量化文本（带并发控制）
 */
export const batchGetEmbeddings = async (
  texts: string[],
  options?: { concurrency?: number; provider?: LLMProvider }
): Promise<number[][]> => {
  const concurrency = options?.concurrency ?? 3;
  const results: number[][] = new Array(texts.length);
  const queue = texts.map((text, index) => ({ text, index }));

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      try {
        results[item.index] = await getEmbedding(item.text, options?.provider);
      } catch (err) {
        console.warn(`[Embedding] 第 ${item.index} 个文本向量化失败:`, err instanceof Error ? err.message : String(err));
        results[item.index] = [];
      }
    }
  });

  await Promise.all(workers);
  return results;
};

// =============================================================================
// 相似度计算
// =============================================================================

/** 余弦相似度 */
export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
};

// =============================================================================
// 知识库向量索引
// =============================================================================

/**
 * 为知识库条目构建向量索引
 * 将每个 chunk 的内容向量化并存储到 embedding 字段
 */
export const buildKnowledgeEmbeddings = async (
  knowledgeId: string,
  options?: { provider?: LLMProvider }
): Promise<{ totalChunks: number; embeddedChunks: number; errors: number }> => {
  const kb = await KnowledgeBase.findById(knowledgeId);
  if (!kb) throw new Error('知识库条目不存在');

  let embeddedChunks = 0;
  let errors = 0;

  for (const chunk of kb.chunks) {
    const text = chunk.content.zh || chunk.content.en;
    if (!text) continue;

    try {
      const embedding = await getEmbedding(text, options?.provider);
      if (embedding.length > 0) {
        chunk.embedding = embedding;
        embeddedChunks++;
      }
    } catch (err) {
      errors++;
      console.warn(`[Embedding] chunk ${chunk.chunkId} 向量化失败:`, err instanceof Error ? err.message : String(err));
    }
  }

  await kb.save();
  return { totalChunks: kb.chunks.length, embeddedChunks, errors };
};

/**
 * 批量构建所有知识库的向量索引
 */
export const buildAllKnowledgeEmbeddings = async (
  options?: { provider?: LLMProvider }
): Promise<{ totalKBs: number; totalChunks: number; embeddedChunks: number; errors: number }> => {
  const kbs = await KnowledgeBase.find({ isActive: true });
  let totalChunks = 0;
  let embeddedChunks = 0;
  let errors = 0;

  for (const kb of kbs) {
    const result = await buildKnowledgeEmbeddings(kb._id.toString(), options);
    totalChunks += result.totalChunks;
    embeddedChunks += result.embeddedChunks;
    errors += result.errors;
  }

  return { totalKBs: kbs.length, totalChunks, embeddedChunks, errors };
};

// =============================================================================
// 语义检索（RAG 核心）
// =============================================================================

export interface SemanticSearchResult {
  knowledgeId: string;
  title: { zh: string; en: string };
  chunkId: string;
  content: { zh: string; en: string };
  score: number;
  categoryKey?: string;
  agentSlug?: string;
}

/**
 * 语义检索 — 基于向量相似度搜索知识库
 *
 * @param query - 用户查询文本
 * @param options - 检索选项
 * @returns 按相似度排序的检索结果
 */
export const semanticSearch = async (
  query: string,
  options?: {
    categoryKey?: string;
    agentSlug?: string;
    limit?: number;
    minScore?: number;
    provider?: LLMProvider;
  }
): Promise<SemanticSearchResult[]> => {
  const limit = options?.limit ?? 5;
  const minScore = options?.minScore ?? 0.3;

  // 1. 将查询文本向量化
  const queryEmbedding = await getEmbedding(query, options?.provider);
  if (queryEmbedding.length === 0) {
    console.warn('[SemanticSearch] 查询向量化失败，降级到关键词搜索');
    return [];
  }

  // 2. 查询知识库
  const filter: Record<string, unknown> = { isActive: true };
  if (options?.categoryKey) filter.categoryKey = options.categoryKey;
  if (options?.agentSlug) filter.agentSlug = options.agentSlug;

  const kbs = await KnowledgeBase.find(filter).lean() as any[];

  // 3. 计算每个 chunk 的相似度
  const results: SemanticSearchResult[] = [];

  for (const kb of kbs) {
    for (const chunk of kb.chunks) {
      if (!chunk.embedding || chunk.embedding.length === 0) continue;

      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      if (score >= minScore) {
        results.push({
          knowledgeId: String(kb._id),
          title: kb.title,
          chunkId: chunk.chunkId,
          content: chunk.content,
          score,
          categoryKey: kb.categoryKey,
          agentSlug: kb.agentSlug,
        });
      }
    }
  }

  // 4. 按相似度排序并截取
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
};

/**
 * 混合检索 — 结合关键词搜索和语义搜索
 * 先用关键词粗筛，再用向量精排
 */
export const hybridSearch = async (
  query: string,
  options?: {
    categoryKey?: string;
    agentSlug?: string;
    limit?: number;
    provider?: LLMProvider;
  }
): Promise<SemanticSearchResult[]> => {
  const limit = options?.limit ?? 5;

  // 并行执行关键词搜索和语义搜索
  const [keywordResults, semanticResults] = await Promise.all([
    keywordSearch(query, options),
    semanticSearch(query, { ...options, limit: limit * 2 }),
  ]);

  // 合并去重，语义搜索结果优先
  const seen = new Set<string>();
  const merged: SemanticSearchResult[] = [];

  for (const result of [...semanticResults, ...keywordResults]) {
    const key = `${result.knowledgeId}:${result.chunkId}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(result);
    }
  }

  return merged.slice(0, limit);
};

/** 关键词搜索（降级方案） */
const keywordSearch = async (
  query: string,
  options?: { categoryKey?: string; agentSlug?: string; limit?: number }
): Promise<SemanticSearchResult[]> => {
  const limit = options?.limit ?? 5;
  const filter: Record<string, unknown> = { isActive: true };
  if (options?.categoryKey) filter.categoryKey = options.categoryKey;
  if (options?.agentSlug) filter.agentSlug = options.agentSlug;

  // 简单的关键词匹配
  const keywords = query.split(/\s+/).filter(Boolean);
  if (keywords.length === 0) return [];

  const kbs = await KnowledgeBase.find(filter).lean() as any[];
  const results: SemanticSearchResult[] = [];

  for (const kb of kbs) {
    for (const chunk of kb.chunks) {
      const text = (chunk.content.zh + ' ' + chunk.content.en).toLowerCase();
      const matchCount = keywords.filter(kw => text.includes(kw.toLowerCase())).length;
      if (matchCount > 0) {
        results.push({
          knowledgeId: String(kb._id),
          title: kb.title,
          chunkId: chunk.chunkId,
          content: chunk.content,
          score: matchCount / keywords.length * 0.5, // 关键词匹配分数上限 0.5
          categoryKey: kb.categoryKey,
          agentSlug: kb.agentSlug,
        });
      }
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
};
