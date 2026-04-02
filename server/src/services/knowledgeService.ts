import { KnowledgeBase, IKnowledgeChunk } from '../models/KnowledgeBase.js';
import { Agent } from '../models/Agent.js';
import { Category } from '../models/Category.js';
import { callLLM, streamLLM } from './llmService.js';
import type { LLMMessage, LLMStreamChunk } from './llmService.js';
import { v4 as uuidv4 } from 'uuid';

// ─── 文本分块 ──────────────────────────────────────────────────────────────────

const chunkText = (text: string, chunkSize = 800, overlap = 100): string[] => {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if ((current + para).length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      // 保留重叠部分
      const words = current.split(' ');
      current = words.slice(-Math.floor(overlap / 5)).join(' ') + '\n\n' + para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.filter((c) => c.length > 20);
};

// ─── 翻译文本块 ────────────────────────────────────────────────────────────────

const translateChunk = async (text: string): Promise<{ zh: string; en: string }> => {
  // 检测是否主要是中文
  const chineseRatio = (text.match(/[\u4e00-\u9fa5]/g) || []).length / text.length;

  if (chineseRatio > 0.3) {
    // 主要是中文，翻译成英文
    try {
      const response = await callLLM([
        {
          role: 'system',
          content: 'You are a professional translator. Translate the following Chinese text to English. Return only the translation, no explanations.'
        },
        { role: 'user', content: text }
      ]);
      return { zh: text, en: response.content };
    } catch {
      return { zh: text, en: text };
    }
  } else {
    // 主要是英文，翻译成中文
    try {
      const response = await callLLM([
        {
          role: 'system',
          content: '你是专业翻译。将以下英文文本翻译成中文。只返回翻译结果，不要解释。'
        },
        { role: 'user', content: text }
      ]);
      return { zh: response.content, en: text };
    } catch {
      return { zh: text, en: text };
    }
  }
};

// ─── 创建知识库条目 ────────────────────────────────────────────────────────────

export const createKnowledgeEntry = async (params: {
  titleZh: string;
  titleEn: string;
  descriptionZh?: string;
  descriptionEn?: string;
  content: string;
  sourceType: 'markdown' | 'text' | 'url';
  sourcePath?: string;
  sourceUrl?: string;
  categoryKey?: string;
  agentSlug?: string;
  tags?: string[];
  translate?: boolean;
}) => {
  const chunks = chunkText(params.content);
  const knowledgeChunks: IKnowledgeChunk[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkText = chunks[i];
    let content: { zh: string; en: string };

    if (params.translate) {
      content = await translateChunk(chunkText);
    } else {
      content = { zh: chunkText, en: chunkText };
    }

    knowledgeChunks.push({
      chunkId: uuidv4(),
      content,
      order: i
    });
  }

  const wordCount = params.content.split(/\s+/).filter(Boolean).length;

  const entry = await KnowledgeBase.findOneAndUpdate(
    { sourcePath: params.sourcePath || params.sourceUrl || params.titleEn },
    {
      $set: {
        title: { zh: params.titleZh, en: params.titleEn },
        description: {
          zh: params.descriptionZh || '',
          en: params.descriptionEn || ''
        },
        sourceType: params.sourceType,
        sourcePath: params.sourcePath,
        sourceUrl: params.sourceUrl,
        categoryKey: params.categoryKey,
        agentSlug: params.agentSlug,
        chunks: knowledgeChunks,
        tags: params.tags || [],
        isActive: true,
        stats: { chunkCount: knowledgeChunks.length, wordCount }
      }
    },
    { upsert: true, new: true }
  );

  return entry;
};

// ─── 余弦相似度（向量检索降级方案）──────────────────────────────────────────────

/**
 * 计算两个向量的余弦相似度（-1 ~ 1，越大越相似）
 */
const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
};

/**
 * 将文本转为简单词频向量（无向量模型时的降级方案）
 * 基于 TF（词频）构建稀疏向量，用于近似语义匹配
 */
const textToVector = (text: string, vocab: string[]): number[] => {
  const lower = text.toLowerCase();
  return vocab.map((word) => {
    const re = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return (lower.match(re) || []).length;
  });
};

/**
 * 带相似度评分的知识库搜索（支持向量检索 + 关键词降级）
 */
const searchKnowledgeWithScore = async (
  query: string,
  options: {
    categoryKey?: string;
    agentSlug?: string;
    limit?: number;
    lang?: 'zh' | 'en';
  } = {}
): Promise<Array<{
  knowledgeId: unknown;
  title: { zh: string; en: string };
  categoryKey?: string;
  agentSlug?: string;
  content: { zh: string; en: string };
  chunkId: string;
  score: number;
  matchType: 'vector' | 'keyword';
}>> => {
  const { categoryKey, agentSlug, limit = 5, lang = 'zh' } = options;

  const filter: Record<string, unknown> = { isActive: true };
  if (categoryKey) filter.categoryKey = categoryKey;
  if (agentSlug) filter.agentSlug = agentSlug;

  // 拉取所有候选文档（含 embedding）
  const allDocs = await KnowledgeBase.find(filter, {
    chunks: 1, 'title.zh': 1, 'title.en': 1, categoryKey: 1, agentSlug: 1,
  }).limit(100).lean();

  const scored: Array<{
    knowledgeId: unknown;
    title: { zh: string; en: string };
    categoryKey?: string;
    agentSlug?: string;
    content: { zh: string; en: string };
    chunkId: string;
    score: number;
    matchType: 'vector' | 'keyword';
  }> = [];

  // 构建查询词汇表（用于词频向量）
  const queryWords = query.toLowerCase().split(/[\s，。！？、,.\s]+/).filter((w) => w.length > 1);

  for (const kb of allDocs) {
    for (const chunk of kb.chunks || []) {
      const content = lang === 'zh' ? (chunk.content?.zh || '') : (chunk.content?.en || '');
      if (!content) continue;

      let score = 0;
      let matchType: 'vector' | 'keyword' = 'keyword';

      // 优先：向量相似度（如果 chunk 有 embedding）
      if (chunk.embedding && chunk.embedding.length > 0) {
        const queryVec = textToVector(query, queryWords);
        const chunkVec = textToVector(content, queryWords);
        score = cosineSimilarity(queryVec, chunkVec);
        matchType = 'vector';
      } else {
        // 降级：TF 关键词评分（归一化到 0~1）
        const hits = queryWords.reduce((acc, w) => {
          const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          return acc + (content.match(re) || []).length;
        }, 0);
        // 归一化：hits / (queryWords.length * 最大可能出现次数)
        score = queryWords.length > 0 ? Math.min(hits / (queryWords.length * 3), 1) : 0;
      }

      if (score > 0) {
        scored.push({
          knowledgeId: kb._id,
          title: kb.title as { zh: string; en: string },
          categoryKey: kb.categoryKey,
          agentSlug: kb.agentSlug,
          content: chunk.content as { zh: string; en: string },
          chunkId: chunk.chunkId,
          score,
          matchType,
        });
      }
    }
  }

  // 按分数降序排列
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
};

// ─── 问题改写（提升检索召回率）──────────────────────────────────────────────────

/**
 * 将口语化问题改写为更适合检索的标准化表达
 * 例如："帮我找个写代码的" → "代码生成 Agent 编程助手"
 */
const rewriteQuestion = async (
  question: string,
  options: { provider?: 'ollama' | 'openai'; lang?: 'zh' | 'en' } = {}
): Promise<string> => {
  try {
    const prompt =
      options.lang === 'en'
        ? `Rewrite the following question into a concise search query (keywords only, no sentences). Return only the rewritten query.\n\nQuestion: ${question}`
        : `将以下问题改写为简洁的检索关键词（只输出关键词，不要句子，不要解释）。\n\n问题：${question}`;

    const response = await callLLM(
      [{ role: 'user', content: prompt }],
      { provider: options.provider }
    );
    const rewritten = response.content.trim();
    // 如果改写结果过长或失败，回退到原始问题
    return rewritten.length > 0 && rewritten.length < question.length * 3 ? rewritten : question;
  } catch {
    return question;
  }
};

// ─── 知识库搜索（原有，保持兼容）────────────────────────────────────────────────

export const searchKnowledge = async (
  query: string,
  options: {
    categoryKey?: string;
    agentSlug?: string;
    limit?: number;
    lang?: 'zh' | 'en';
  } = {}
) => {
  const { categoryKey, agentSlug, limit = 5, lang = 'zh' } = options;

  const filter: Record<string, unknown> = { isActive: true };
  if (categoryKey) filter.categoryKey = categoryKey;
  if (agentSlug) filter.agentSlug = agentSlug;

  const contentField = `chunks.content.${lang}`;

  const results = await KnowledgeBase.find({
    ...filter,
    [contentField]: { $regex: query, $options: 'i' }
  })
    .limit(limit)
    .lean();

  // 提取匹配的块
  const matchedChunks = results.flatMap((kb) =>
    kb.chunks
      .filter((chunk: any) => {
        const text = lang === 'zh' ? chunk.content.zh : chunk.content.en;
        return text.toLowerCase().includes(query.toLowerCase());
      })
      .map((chunk: any) => ({
        knowledgeId: kb._id,
        title: kb.title,
        categoryKey: kb.categoryKey,
        agentSlug: kb.agentSlug,
        content: chunk.content,
        chunkId: chunk.chunkId
      }))
  );

  return matchedChunks.slice(0, limit);
};

// ─── RAG 增强问答 ──────────────────────────────────────────────────────────────

/**
 * 判断问题是否在询问 Agent 相关信息
 */
const isAgentQuery = (question: string): boolean => {
  const agentKeywords = [
    'agent', 'agents', '助手', '智能体',
    '有哪些', '都有哪些', '有什么', '包含哪些', '列出',
    '工程开发', '产品设计', '设计创意', '市场营销', '销售业务',
    '战略规划', '学术研究', '项目管理', '客户支持', '测试质量',
    '游戏开发', '数据分析', '内容写作', '财务金融', '人力资源',
    '分类', '类别', '能力', '功能',
  ];
  const lower = question.toLowerCase();
  return agentKeywords.some((kw) => lower.includes(kw.toLowerCase()));
};

/**
 * 从 Agent 库检索相关 Agent 信息，返回文本 + 来源列表
 */
const searchAgentsWithSources = async (
  question: string,
  options: { categoryKey?: string; lang?: 'zh' | 'en'; limit?: number } = {}
): Promise<{ context: string; sources: Array<{ type: 'agent'; name: string; slug: string; categoryKey: string }> }> => {
  const { lang = 'zh', limit = 20 } = options;

  const filter: Record<string, unknown> = { isActive: true };

  if (options.categoryKey) {
    filter.categoryKey = options.categoryKey;
  } else {
    const categoryMap: Record<string, string> = {
      '工程开发': 'engineering', '工程': 'engineering', 'engineering': 'engineering',
      '产品设计': 'product', '产品': 'product',
      '设计创意': 'design', '设计': 'design',
      '市场营销': 'marketing', '营销': 'marketing',
      '销售': 'sales',
      '战略': 'strategy',
      '学术': 'academic',
      '项目管理': 'project-management',
      '客户支持': 'support',
      '测试': 'testing',
      '游戏开发': 'game-development', '游戏': 'game-development',
      '数据分析': 'data', '数据': 'data',
      '写作': 'writing', '内容': 'writing',
      '财务': 'finance', '金融': 'finance',
      '人力资源': 'hr', '人力': 'hr',
    };

    for (const [keyword, key] of Object.entries(categoryMap)) {
      if (question.toLowerCase().includes(keyword.toLowerCase())) {
        filter.categoryKey = key;
        break;
      }
    }

    if (!filter.categoryKey) {
      filter.$or = [
        { 'name.zh': { $regex: question, $options: 'i' } },
        { 'name.en': { $regex: question, $options: 'i' } },
        { 'description.zh': { $regex: question, $options: 'i' } },
        { tags: { $in: [question] } },
        { 'capabilities.zh': { $regex: question, $options: 'i' } },
      ];
    }
  }

  const agents = await Agent.find(filter, {
    slug: 1, 'name.zh': 1, 'name.en': 1, 'description.zh': 1, 'description.en': 1,
    categoryKey: 1, tags: 1, 'capabilities.zh': 1, emoji: 1,
  }).limit(limit).lean();

  if (agents.length === 0) {
    return {
      context: lang === 'zh' ? '未找到相关 Agent。' : 'No relevant agents found.',
      sources: [],
    };
  }

  const categoryKeys = [...new Set(agents.map((a) => a.categoryKey).filter(Boolean))];
  const categories = await Category.find({ key: { $in: categoryKeys } }, { key: 1, 'name.zh': 1, 'name.en': 1 }).lean();
  const catNameMap = Object.fromEntries(categories.map((c) => [c.key, lang === 'zh' ? c.name.zh : c.name.en]));

  const lines = agents.map((a) => {
    const name = lang === 'zh' ? (a.name?.zh || a.name?.en) : (a.name?.en || a.name?.zh);
    const desc = lang === 'zh' ? (a.description?.zh || '') : (a.description?.en || '');
    const catName = catNameMap[a.categoryKey || ''] || a.categoryKey || '';
    const caps = (a.capabilities as any)?.zh?.slice(0, 3).join('、') || '';
    return `- ${a.emoji || '🤖'} **${name}** (${catName})：${desc}${caps ? `\n  能力：${caps}` : ''}`;
  });

  const header = filter.categoryKey
    ? (lang === 'zh'
        ? `**${catNameMap[filter.categoryKey as string] || filter.categoryKey}** 分类下共有 ${agents.length} 个 Agent：\n`
        : `Found ${agents.length} agents in **${catNameMap[filter.categoryKey as string] || filter.categoryKey}**:\n`)
    : (lang === 'zh' ? `共找到 ${agents.length} 个相关 Agent：\n` : `Found ${agents.length} relevant agents:\n`);

  const sources = agents.map((a) => ({
    type: 'agent' as const,
    name: (lang === 'zh' ? a.name?.zh : a.name?.en) || a.slug,
    slug: a.slug,
    categoryKey: a.categoryKey || '',
  }));

  return { context: header + lines.join('\n'), sources };
};

// ─── 构建 RAG 消息列表（支持多轮对话）────────────────────────────────────────────

const buildRagMessages = (
  question: string,
  systemPrompt: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): LLMMessage[] => {
  const messages: LLMMessage[] = [{ role: 'system', content: systemPrompt }];
  // 注入历史对话（最多保留最近 6 轮）
  const recentHistory = history.slice(-12);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }
  messages.push({ role: 'user', content: question });
  return messages;
};

// ─── RAG 来源类型 ──────────────────────────────────────────────────────────────

export interface RagSource {
  type: 'agent' | 'knowledge';
  name: string;
  slug?: string;
  categoryKey?: string;
  chunkId?: string;
  score?: number;
}

export interface RagResult {
  answer: string;
  sources: RagSource[];
  rewrittenQuestion?: string;
}

// ─── RAG 问答（非流式）────────────────────────────────────────────────────────

export const ragQuery = async (
  question: string,
  options: {
    categoryKey?: string;
    agentSlug?: string;
    provider?: 'ollama' | 'openai';
    lang?: 'zh' | 'en';
    /** 多轮对话历史 */
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    /** 是否开启问题改写（默认 true） */
    rewrite?: boolean;
  } = {}
): Promise<RagResult> => {
  const { lang = 'zh', provider, history = [], rewrite = true } = options;

  // ── 1. 问题改写 ──────────────────────────────────────────────────────────────
  let searchQuery = question;
  let rewrittenQuestion: string | undefined;
  if (rewrite && question.length > 10) {
    const rw = await rewriteQuestion(question, { provider, lang });
    if (rw !== question) {
      rewrittenQuestion = rw;
      searchQuery = rw;
    }
  }

  // ── 2. 意图识别 ──────────────────────────────────────────────────────────────
  const queryingAgents = isAgentQuery(question);

  let context = '';
  const allSources: RagSource[] = [];

  if (queryingAgents) {
    // Agent 库检索
    const { context: agentCtx, sources: agentSources } = await searchAgentsWithSources(searchQuery, {
      categoryKey: options.categoryKey,
      lang,
      limit: 20,
    });
    context = agentCtx;
    allSources.push(...agentSources);

    // 知识库补充
    const kbChunks = await searchKnowledgeWithScore(searchQuery, {
      categoryKey: options.categoryKey,
      agentSlug: options.agentSlug,
      limit: 3,
      lang,
    });
    if (kbChunks.length > 0) {
      const kbContext = kbChunks.map((c) => (lang === 'zh' ? c.content.zh : c.content.en)).join('\n\n---\n\n');
      context += `\n\n---\n\n**知识库补充信息：**\n${kbContext}`;
      allSources.push(...kbChunks.map((c) => ({
        type: 'knowledge' as const,
        name: lang === 'zh' ? c.title.zh : c.title.en,
        categoryKey: c.categoryKey,
        chunkId: c.chunkId,
        score: c.score,
      })));
    }
  } else {
    // 知识库检索（带评分）
    const scoredChunks = await searchKnowledgeWithScore(searchQuery, {
      categoryKey: options.categoryKey,
      agentSlug: options.agentSlug,
      limit: 5,
      lang,
    });

    if (scoredChunks.length === 0) {
      // 兜底：Agent 库
      const { context: agentCtx, sources: agentSources } = await searchAgentsWithSources(searchQuery, { lang, limit: 10 });
      context = agentCtx;
      allSources.push(...agentSources);
    } else {
      context = scoredChunks.map((c) => (lang === 'zh' ? c.content.zh : c.content.en)).join('\n\n---\n\n');
      allSources.push(...scoredChunks.map((c) => ({
        type: 'knowledge' as const,
        name: lang === 'zh' ? c.title.zh : c.title.en,
        categoryKey: c.categoryKey,
        chunkId: c.chunkId,
        score: c.score,
      })));
    }
  }

  // ── 3. 构建 System Prompt（含来源标注提示）──────────────────────────────────
  const systemPrompt =
    lang === 'zh'
      ? `你是一个专业的 AI Agent 系统助手。根据以下检索到的信息回答用户问题。请直接给出清晰、结构化的回答，不要说"根据知识库"等套话。\n\n检索结果：\n${context}`
      : `You are a professional AI Agent system assistant. Answer the user's question based on the following retrieved information. Give a clear, structured answer directly.\n\nRetrieved information:\n${context}`;

  // ── 4. 构建消息列表（含多轮历史）────────────────────────────────────────────
  const messages = buildRagMessages(question, systemPrompt, history);

  // ── 5. LLM 生成回答 ──────────────────────────────────────────────────────────
  const response = await callLLM(messages, { provider });

  return {
    answer: response.content,
    sources: allSources,
    rewrittenQuestion,
  };
};

// ─── RAG 流式问答 ──────────────────────────────────────────────────────────────

export const ragQueryStream = async function* (
  question: string,
  options: {
    categoryKey?: string;
    agentSlug?: string;
    provider?: 'ollama' | 'openai';
    lang?: 'zh' | 'en';
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    rewrite?: boolean;
  } = {}
): AsyncGenerator<
  | { type: 'rewrite'; rewrittenQuestion: string }
  | { type: 'sources'; sources: RagSource[] }
  | { type: 'delta'; delta: string }
  | { type: 'done'; answer: string }
  | { type: 'error'; message: string }
> {
  const { lang = 'zh', provider, history = [], rewrite = true } = options;

  try {
    // ── 1. 问题改写 ────────────────────────────────────────────────────────────
    let searchQuery = question;
    if (rewrite && question.length > 10) {
      const rw = await rewriteQuestion(question, { provider, lang });
      if (rw !== question) {
        searchQuery = rw;
        yield { type: 'rewrite', rewrittenQuestion: rw };
      }
    }

    // ── 2. 意图识别 + 检索 ────────────────────────────────────────────────────
    const queryingAgents = isAgentQuery(question);
    let context = '';
    const allSources: RagSource[] = [];

    if (queryingAgents) {
      const { context: agentCtx, sources: agentSources } = await searchAgentsWithSources(searchQuery, {
        categoryKey: options.categoryKey,
        lang,
        limit: 20,
      });
      context = agentCtx;
      allSources.push(...agentSources);

      const kbChunks = await searchKnowledgeWithScore(searchQuery, {
        categoryKey: options.categoryKey,
        agentSlug: options.agentSlug,
        limit: 3,
        lang,
      });
      if (kbChunks.length > 0) {
        const kbContext = kbChunks.map((c) => (lang === 'zh' ? c.content.zh : c.content.en)).join('\n\n---\n\n');
        context += `\n\n---\n\n**知识库补充信息：**\n${kbContext}`;
        allSources.push(...kbChunks.map((c) => ({
          type: 'knowledge' as const,
          name: lang === 'zh' ? c.title.zh : c.title.en,
          categoryKey: c.categoryKey,
          chunkId: c.chunkId,
          score: c.score,
        })));
      }
    } else {
      const scoredChunks = await searchKnowledgeWithScore(searchQuery, {
        categoryKey: options.categoryKey,
        agentSlug: options.agentSlug,
        limit: 5,
        lang,
      });

      if (scoredChunks.length === 0) {
        const { context: agentCtx, sources: agentSources } = await searchAgentsWithSources(searchQuery, { lang, limit: 10 });
        context = agentCtx;
        allSources.push(...agentSources);
      } else {
        context = scoredChunks.map((c) => (lang === 'zh' ? c.content.zh : c.content.en)).join('\n\n---\n\n');
        allSources.push(...scoredChunks.map((c) => ({
          type: 'knowledge' as const,
          name: lang === 'zh' ? c.title.zh : c.title.en,
          categoryKey: c.categoryKey,
          chunkId: c.chunkId,
          score: c.score,
        })));
      }
    }

    // ── 3. 推送来源信息 ────────────────────────────────────────────────────────
    yield { type: 'sources', sources: allSources };

    // ── 4. 构建消息 ────────────────────────────────────────────────────────────
    const systemPrompt =
      lang === 'zh'
        ? `你是一个专业的 AI Agent 系统助手。根据以下检索到的信息回答用户问题。请直接给出清晰、结构化的回答，不要说"根据知识库"等套话。\n\n检索结果：\n${context}`
        : `You are a professional AI Agent system assistant. Answer the user's question based on the following retrieved information. Give a clear, structured answer directly.\n\nRetrieved information:\n${context}`;

    const messages = buildRagMessages(question, systemPrompt, history);

    // ── 5. 流式生成 ────────────────────────────────────────────────────────────
    const stream = streamLLM(messages, { provider });
    let fullAnswer = '';

    for await (const chunk of stream) {
      if (chunk.delta) {
        fullAnswer += chunk.delta;
        yield { type: 'delta', delta: chunk.delta };
      }
      if (chunk.done) break;
    }

    yield { type: 'done', answer: fullAnswer };
  } catch (err: unknown) {
    yield { type: 'error', message: err instanceof Error ? err.message : String(err) };
  }
};
