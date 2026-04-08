/**
 * @file lib/builtinSkills.ts
 * @description 内置 Skill 定义（维度 5 — 内置 Skill）
 *
 * 开箱即用的 Skill 列表：
 *   1. web_research    — 网页调研（MCP fetch + LLM 总结）
 *   2. code_review     — 代码审查（知识库搜索 + LLM 分析）
 *   3. smart_translate — 智能翻译（语言检测 + 双向翻译）
 *   4. agent_recommend — Agent 推荐（find_agent + LLM 推荐）
 *   5. page_analysis   — 页面分析（get_page_structure + LLM 分析）
 *
 * 这些 Skill 在系统首次启动时自动注入数据库（如果不存在）。
 */

import type { ISkill } from '../models/Skill.js';

/** 内置 Skill 定义（不含 Mongoose Document 字段） */
type BuiltinSkillDef = Omit<ISkill, keyof import('mongoose').Document | 'createdAt' | 'updatedAt'>;

export const BUILTIN_SKILLS: BuiltinSkillDef[] = [
  // ─── 1. 网页调研 ──────────────────────────────────────────────────────────────
  {
    key: 'web_research',
    name: '网页调研',
    description: '搜索并总结网页内容，适用于用户想了解某个话题的最新信息、查看某个网址的内容',
    icon: '🔍',
    category: 'research',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '要抓取的网页 URL' },
        message: { type: 'string', description: '用户的原始问题' },
      },
      required: ['message'],
    },
    outputDescription: '网页内容的中文摘要',
    steps: [
      {
        id: 'resolve_url',
        type: 'llm',
        label: '解析目标 URL',
        promptTemplate: `你是一个 URL 解析助手。根据用户的输入，确定要抓取的网页 URL。

规则：
1. 如果用户提供了明确的 URL（如 https://...），直接返回该 URL
2. 如果用户没有提供 URL，而是描述了一个话题/问题，请构造一个 Google 搜索 URL：
   https://www.google.com/search?q=<URL编码的搜索词>
3. 搜索词应该简洁精准，用英文效果更好

用户提供的 URL：{{input.url}}
用户的问题：{{input.message}}

请只输出一个 URL，不要有任何其他文字。`,
        llmOptions: { stream: false, temperature: 0, maxTokens: 200 },
        inputMapping: {},
        outputKey: 'resolved_url',
        optional: false,
        timeout: 15000,
        retryCount: 1,
      },
      {
        id: 'fetch',
        type: 'tool',
        label: '抓取网页',
        toolName: 'mcp_fetch_fetch',
        toolArgs: { url: '{{steps.resolved_url.data}}', max_length: '5000' },
        inputMapping: {},
        outputKey: 'webpage',
        optional: false,
        timeout: 15000,
        retryCount: 1,
      },
      {
        id: 'summarize',
        type: 'llm',
        label: 'LLM 总结',
        promptTemplate: `请用中文总结以下网页内容的关键信息，回答用户的问题。

用户问题：{{input.message}}

网页内容：
{{steps.webpage.data}}

请提供结构化的总结，包含关键要点。`,
        llmOptions: { stream: true },
        inputMapping: {},
        outputKey: 'summary',
        optional: false,
        timeout: 30000,
        retryCount: 0,
      },
    ],
    triggers: {
      keywords: ['搜索', '查找', '了解', '最新', '新闻', '网页', '网站', '链接'],
      patterns: ['https?://[^\\s]+', '帮我(看看|查查|搜搜|了解).+'],
      contextRules: ['contains_url'],
      intentDescription: '用户想搜索网页或了解某个话题的最新信息',
    },
    config: {
      timeout: 45000,
      retryCount: 1,
      cacheTTL: 300,
      concurrency: 1,
      streamOutput: true,
    },
    dependsOn: [],
    version: '1.1.0',
    versions: [],
    abTestGroup: '',
    isActive: true,
    isBuiltin: true,
    sortOrder: 1,
    usageCount: 0,
    avgDuration: 0,
    successRate: 1,
  },

  // ─── 2. 代码审查 ──────────────────────────────────────────────────────────────
  {
    key: 'code_review',
    name: '代码审查',
    description: '审查代码质量，检查最佳实践、安全漏洞、性能问题，给出改进建议',
    icon: '🔎',
    category: 'coding',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '用户的代码审查请求' },
        language: { type: 'string', description: '编程语言', default: 'javascript' },
      },
      required: ['message'],
    },
    outputDescription: '代码审查报告，包含问题列表和改进建议',
    steps: [
      {
        id: 'resolve_language',
        type: 'llm',
        label: '识别编程语言',
        promptTemplate: `根据用户提供的代码或描述，识别编程语言。

用户指定的语言：{{input.language}}
用户请求：{{input.message}}

规则：
1. 如果用户明确指定了语言，直接返回该语言名称（小写英文）
2. 如果未指定，从代码内容中自动检测语言
3. 如果无法判断，返回 "javascript"

请只输出语言名称，不要有其他文字。`,
        llmOptions: { stream: false, temperature: 0, maxTokens: 50 },
        inputMapping: {},
        outputKey: 'language',
        optional: true,
        timeout: 10000,
        retryCount: 1,
      },
      {
        id: 'search_practices',
        type: 'tool',
        label: '搜索最佳实践',
        toolName: 'search_knowledge',
        toolArgs: { query: '{{steps.language.data}} 代码规范 最佳实践 安全', limit: '3' },
        inputMapping: {},
        outputKey: 'practices',
        optional: true,
        timeout: 10000,
        retryCount: 1,
      },
      {
        id: 'review',
        type: 'llm',
        label: 'LLM 审查',
        promptTemplate: `你是一个资深代码审查专家。请审查用户提供的代码，从以下维度给出评价：

1. **代码质量**：可读性、命名规范、DRY 原则
2. **安全性**：XSS、注入、敏感信息泄露
3. **性能**：不必要的计算、内存泄漏、N+1 查询
4. **最佳实践**：是否遵循语言/框架的惯用写法

参考知识库中的最佳实践：
{{steps.practices.data}}

用户请求：
{{input.message}}

请用中文输出结构化的审查报告。`,
        llmOptions: { stream: true, temperature: 0.3 },
        inputMapping: {},
        outputKey: 'review_result',
        optional: false,
        timeout: 30000,
        retryCount: 0,
      },
    ],
    triggers: {
      keywords: ['审查', '代码审查', 'review', 'code review', '检查代码', '代码质量'],
      patterns: ['(审查|检查|review).{0,10}(代码|code)', '这段代码.{0,10}(问题|优化|改进)'],
      contextRules: ['contains_code'],
      intentDescription: '用户想让 AI 审查代码质量并给出改进建议',
    },
    config: {
      timeout: 45000,
      retryCount: 1,
      cacheTTL: 0,
      concurrency: 1,
      streamOutput: true,
    },
    dependsOn: [],
    version: '1.1.0',
    versions: [],
    abTestGroup: '',
    isActive: true,
    isBuiltin: true,
    sortOrder: 2,
    usageCount: 0,
    avgDuration: 0,
    successRate: 1,
  },

  // ─── 3. 智能翻译 ──────────────────────────────────────────────────────────────
  {
    key: 'smart_translate',
    name: '智能翻译',
    description: '自动检测语言并翻译，支持中英双向翻译',
    icon: '🌐',
    category: 'creative',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '要翻译的文本' },
      },
      required: ['message'],
    },
    outputDescription: '翻译后的文本',
    steps: [
      {
        id: 'detect_and_translate',
        type: 'llm',
        label: '检测语言并翻译',
        promptTemplate: `你是一个专业翻译。请完成以下任务：

1. 自动检测输入文本的语言
2. 如果是中文，翻译为英文
3. 如果是英文或其他语言，翻译为中文
4. 保持原文的格式和语气
5. 对于技术术语，在翻译后用括号标注原文

输入文本：
{{input.message}}

请直接输出翻译结果，不要有多余的解释。`,
        llmOptions: { stream: true, temperature: 0.2 },
        inputMapping: {},
        outputKey: 'translation',
        optional: false,
        timeout: 20000,
        retryCount: 1,
      },
    ],
    triggers: {
      keywords: ['翻译', 'translate', '译成', '翻成', '用英文', '用中文'],
      patterns: ['(翻译|translate).{0,20}(中文|英文|中英|英中)', '(帮我|请).{0,5}翻译'],
      contextRules: [],
      intentDescription: '用户想翻译一段文本',
    },
    config: {
      timeout: 25000,
      retryCount: 1,
      cacheTTL: 600,
      concurrency: 1,
      streamOutput: true,
    },
    dependsOn: [],
    version: '1.0.0',
    versions: [],
    abTestGroup: '',
    isActive: true,
    isBuiltin: true,
    sortOrder: 3,
    usageCount: 0,
    avgDuration: 0,
    successRate: 1,
  },

  // ─── 4. Agent 推荐 ────────────────────────────────────────────────────────────
  {
    key: 'agent_recommend',
    name: 'Agent 推荐',
    description: '根据用户需求推荐最合适的 Agent，介绍其能力和工作流',
    icon: '🤖',
    category: 'workflow',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '用户的需求描述' },
      },
      required: ['message'],
    },
    outputDescription: '推荐的 Agent 列表及使用建议',
    steps: [
      {
        id: 'find',
        type: 'tool',
        label: '搜索 Agent',
        toolName: 'find_agent',
        toolArgs: { query: '{{input.message}}', limit: '5' },
        inputMapping: {},
        outputKey: 'agents',
        optional: false,
        timeout: 10000,
        retryCount: 1,
      },
      {
        id: 'recommend',
        type: 'llm',
        label: 'LLM 推荐',
        promptTemplate: `你是一个 AI Agent 推荐专家。根据用户的需求，从搜索结果中推荐最合适的 Agent。

用户需求：{{input.message}}

搜索到的 Agent 列表：
{{steps.agents.data}}

请用中文输出推荐结果，包含：
1. 推荐的 Agent 名称和 emoji
2. 推荐理由（为什么适合用户的需求）
3. 该 Agent 的核心能力
4. 使用建议`,
        llmOptions: { stream: true },
        inputMapping: {},
        outputKey: 'recommendation',
        optional: false,
        timeout: 20000,
        retryCount: 0,
      },
    ],
    triggers: {
      keywords: ['推荐', '哪个agent', '哪个 agent', '用什么agent', '找个agent', '找一个agent'],
      patterns: ['(推荐|找|选).{0,10}(agent|助手|机器人)', '(哪个|什么).{0,5}(agent|助手).{0,5}(适合|能|可以)'],
      contextRules: [],
      intentDescription: '用户想找到适合自己需求的 Agent',
    },
    config: {
      timeout: 35000,
      retryCount: 1,
      cacheTTL: 0,
      concurrency: 1,
      streamOutput: true,
    },
    dependsOn: [],
    version: '1.0.0',
    versions: [],
    abTestGroup: '',
    isActive: true,
    isBuiltin: true,
    sortOrder: 4,
    usageCount: 0,
    avgDuration: 0,
    successRate: 1,
  },

  // ─── 5. 页面分析 ──────────────────────────────────────────────────────────────
  {
    key: 'page_analysis',
    name: '页面分析',
    description: '分析已有页面的结构、技术栈和设计模式，给出优化建议',
    icon: '📊',
    category: 'analysis',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '用户的分析请求' },
        templateId: { type: 'string', description: '要分析的模板 ID' },
      },
      required: ['message'],
    },
    outputDescription: '页面分析报告',
    steps: [
      {
        id: 'list',
        type: 'tool',
        label: '查询页面列表',
        toolName: 'list_pages',
        toolArgs: { limit: '10' },
        inputMapping: {},
        outputKey: 'pages',
        optional: true,
        timeout: 10000,
        retryCount: 1,
      },
      {
        id: 'detail',
        type: 'tool',
        label: '获取页面结构',
        toolName: 'get_page_structure',
        toolArgs: { template_id: '{{input.templateId}}', include_code: 'false' },
        inputMapping: {},
        outputKey: 'page_detail',
        optional: true,
        timeout: 10000,
        retryCount: 1,
      },
      {
        id: 'analyze',
        type: 'llm',
        label: 'LLM 分析',
        promptTemplate: `你是一个前端架构分析专家。请根据用户的请求分析页面信息。

用户请求：{{input.message}}

可用的页面列表：
{{steps.pages.data}}

指定页面的结构详情：
{{steps.page_detail.data}}

请用中文输出分析报告，包含：
1. 页面概览（数量、分类分布）
2. 技术栈分析
3. 设计模式总结
4. 优化建议`,
        llmOptions: { stream: true },
        inputMapping: {},
        outputKey: 'analysis',
        optional: false,
        timeout: 25000,
        retryCount: 0,
      },
    ],
    triggers: {
      keywords: ['分析页面', '页面分析', '页面结构', '有哪些页面', '页面列表'],
      patterns: ['(分析|查看|了解).{0,10}(页面|模板|template)', '(有|列出).{0,5}(哪些|多少).{0,5}(页面|模板)'],
      contextRules: [],
      intentDescription: '用户想分析已有页面的结构和设计',
    },
    config: {
      timeout: 40000,
      retryCount: 1,
      cacheTTL: 60,
      concurrency: 1,
      streamOutput: true,
    },
    dependsOn: [],
    version: '1.1.0',
    versions: [],
    abTestGroup: '',
    isActive: true,
    isBuiltin: true,
    sortOrder: 5,
    usageCount: 0,
    avgDuration: 0,
    successRate: 1,
  },
];

/**
 * 初始化内置 Skill — 将不存在的内置 Skill 写入数据库
 * 在服务启动时调用
 */
export const seedBuiltinSkills = async (): Promise<{ created: number; existing: number; updated: number }> => {
  const { Skill } = await import('../models/Skill.js');
  let created = 0;
  let existing = 0;
  let updated = 0;

  for (const skillDef of BUILTIN_SKILLS) {
    const exists = await Skill.findOne({ key: skillDef.key });
    if (exists) {
      // 版本不同时自动更新内置 Skill（仅更新步骤、触发器、配置等核心字段）
      if ((exists as any).version !== skillDef.version) {
        await Skill.updateOne(
          { key: skillDef.key },
          {
            $set: {
              steps: skillDef.steps,
              triggers: skillDef.triggers,
              config: skillDef.config,
              inputSchema: skillDef.inputSchema,
              description: skillDef.description,
              version: skillDef.version,
            },
          }
        );
        updated++;
        console.log(`[Skill] 🔄 更新内置 Skill: ${skillDef.key} → v${skillDef.version}`);
      } else {
        existing++;
      }
      continue;
    }

    await Skill.create(skillDef);
    created++;
  }

  if (created > 0 || updated > 0) {
    console.log(`[Skill] ✅ 初始化 ${created} 个内置 Skill，更新 ${updated} 个，已存在 ${existing} 个`);
  }

  return { created, existing, updated };
};
