import { KnowledgeBase, IKnowledgeChunk } from '../models/KnowledgeBase.js';
import { callLLM } from './llmService.js';
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

// ─── 知识库搜索 ────────────────────────────────────────────────────────────────

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

export const ragQuery = async (
  question: string,
  options: {
    categoryKey?: string;
    agentSlug?: string;
    provider?: 'ollama' | 'codebuddy';
    lang?: 'zh' | 'en';
  } = {}
): Promise<string> => {
  const { lang = 'zh', provider } = options;

  const relevantChunks = await searchKnowledge(question, {
    categoryKey: options.categoryKey,
    agentSlug: options.agentSlug,
    limit: 5,
    lang
  });

  const context = relevantChunks
    .map((c) => (lang === 'zh' ? c.content.zh : c.content.en))
    .join('\n\n---\n\n');

  const systemPrompt =
    lang === 'zh'
      ? `你是一个专业的 AI Agent 助手。根据以下知识库内容回答用户问题。如果知识库中没有相关信息，请如实说明。\n\n知识库内容：\n${context}`
      : `You are a professional AI Agent assistant. Answer the user's question based on the following knowledge base content. If the information is not available, say so honestly.\n\nKnowledge base:\n${context}`;

  const response = await callLLM(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question }
    ],
    { provider }
  );

  return response.content;
};
