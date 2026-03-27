import { KnowledgeBase, IKnowledgeChunk } from '../models/KnowledgeBase.js';
import { Agent } from '../models/Agent.js';
import { Category } from '../models/Category.js';
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
 * 从 Agent 库检索相关 Agent 信息
 */
const searchAgents = async (
  question: string,
  options: { categoryKey?: string; lang?: 'zh' | 'en'; limit?: number } = {}
): Promise<string> => {
  const { lang = 'zh', limit = 20 } = options;

  const filter: Record<string, unknown> = { isActive: true };

  // 如果指定了分类，直接按分类查
  if (options.categoryKey) {
    filter.categoryKey = options.categoryKey;
  } else {
    // 尝试从问题中识别分类关键词
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

    // 如果没有识别到分类，做全文搜索
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
  })
    .limit(limit)
    .lean();

  if (agents.length === 0) {
    return lang === 'zh' ? '未找到相关 Agent。' : 'No relevant agents found.';
  }

  // 获取分类信息
  const categoryKeys = [...new Set(agents.map((a) => a.categoryKey).filter(Boolean))];
  const categories = await Category.find({ key: { $in: categoryKeys } }, { key: 1, 'name.zh': 1, 'name.en': 1 }).lean();
  const categoryMap = Object.fromEntries(categories.map((c) => [c.key, lang === 'zh' ? c.name.zh : c.name.en]));

  // 格式化为可读文本
  const lines = agents.map((a) => {
    const name = lang === 'zh' ? (a.name?.zh || a.name?.en) : (a.name?.en || a.name?.zh);
    const desc = lang === 'zh' ? (a.description?.zh || '') : (a.description?.en || '');
    const catName = categoryMap[a.categoryKey || ''] || a.categoryKey || '';
    const caps = (a.capabilities as any)?.zh?.slice(0, 3).join('、') || '';
    return `- ${a.emoji || '🤖'} **${name}** (${catName})：${desc}${caps ? `\n  能力：${caps}` : ''}`;
  });

  const header = filter.categoryKey
    ? (lang === 'zh' ? `**${categoryMap[filter.categoryKey as string] || filter.categoryKey}** 分类下共有 ${agents.length} 个 Agent：\n` : `Found ${agents.length} agents in **${categoryMap[filter.categoryKey as string] || filter.categoryKey}**:\n`)
    : (lang === 'zh' ? `共找到 ${agents.length} 个相关 Agent：\n` : `Found ${agents.length} relevant agents:\n`);

  return header + lines.join('\n');
};

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

  // ── 意图识别：判断是否在询问 Agent 信息 ──────────────────────────────────────
  const queryingAgents = isAgentQuery(question);

  let context = '';

  if (queryingAgents) {
    // 优先从 Agent 库检索
    const agentContext = await searchAgents(question, {
      categoryKey: options.categoryKey,
      lang,
      limit: 20,
    });
    context = agentContext;

    // 同时补充知识库内容（如果有）
    const kbChunks = await searchKnowledge(question, {
      categoryKey: options.categoryKey,
      agentSlug: options.agentSlug,
      limit: 3,
      lang,
    });
    if (kbChunks.length > 0) {
      const kbContext = kbChunks.map((c) => (lang === 'zh' ? c.content.zh : c.content.en)).join('\n\n---\n\n');
      context += `\n\n---\n\n**知识库补充信息：**\n${kbContext}`;
    }
  } else {
    // 纯知识库检索
    const relevantChunks = await searchKnowledge(question, {
      categoryKey: options.categoryKey,
      agentSlug: options.agentSlug,
      limit: 5,
      lang,
    });

    if (relevantChunks.length === 0) {
      // 知识库也没有，尝试 Agent 库兜底
      const agentContext = await searchAgents(question, { lang, limit: 10 });
      context = agentContext;
    } else {
      context = relevantChunks
        .map((c) => (lang === 'zh' ? c.content.zh : c.content.en))
        .join('\n\n---\n\n');
    }
  }

  const systemPrompt =
    lang === 'zh'
      ? `你是一个专业的 AI Agent 系统助手。根据以下检索到的信息回答用户问题。请直接给出清晰、结构化的回答，不要说"根据知识库"等套话。\n\n检索结果：\n${context}`
      : `You are a professional AI Agent system assistant. Answer the user's question based on the following retrieved information. Give a clear, structured answer directly.\n\nRetrieved information:\n${context}`;

  const response = await callLLM(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ],
    { provider }
  );

  return response.content;
};
