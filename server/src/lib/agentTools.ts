/**
 * @file lib/agentTools.ts
 * @description Agent 工具系统（Tool Calling）
 *
 * 为 AI 提供可调用的工具集，遵循 Ollama / OpenAI tools 格式。
 *
 * 工具列表：
 *   1. list_pages          — 查询可用页面及其属性（来自 VibeTemplate）
 *   2. get_page_structure  — 读取指定页面的 HTML 结构摘要
 *   3. find_agent          — 按名称/分类/能力查找匹配的 Agent
 *   4. get_design_spec     — 获取项目设计规范（配色/布局/组件风格）
 *   5. search_knowledge    — 语义搜索知识库
 *   6. get_agent_workflow  — 获取指定 Agent 的工作流节点
 *   7. list_categories     — 列出所有 Agent 分类
 *   8. get_template_code   — 获取指定模板的完整代码
 */

import { Agent } from '../models/Agent.js';
import { Category } from '../models/Category.js';
import { KnowledgeBase } from '../models/KnowledgeBase.js';
import { VibeTemplate } from '../models/VibeTemplate.js';
import { SystemPrompt } from '../models/SystemPrompt.js';
import type { ISystemPrompt } from '../models/SystemPrompt.js';

// =============================================================================
// 工具类型定义
// =============================================================================

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: { type: string };
  required?: boolean;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, ToolParameter>;
      required: string[];
    };
  };
}

export interface ToolCallRequest {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallResult {
  toolName: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

// =============================================================================
// 工具定义（Ollama / OpenAI 兼容格式）
// =============================================================================

export const AGENT_TOOLS: ToolDefinition[] = [
  // ── 1. 查询可用页面 ──────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'list_pages',
      description: '查询系统中已生成的可用页面（Vibe 模板）列表，返回页面标题、分类、标签、浏览量等属性。用于了解当前有哪些页面可以修改或参考。',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: '按分类过滤，如"游戏"、"工具"、"管理系统"、"展示"，不填则返回全部',
          },
          limit: {
            type: 'number',
            description: '返回数量上限，默认 10，最大 50',
          },
          search: {
            type: 'string',
            description: '按标题关键词搜索',
          },
        },
        required: [],
      },
    },
  },

  // ── 2. 读取页面结构 ──────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'get_page_structure',
      description: '读取指定页面（Vibe 模板）的 HTML 结构摘要，包括主要 DOM 节点、CSS 类名、JavaScript 函数列表。用于了解页面结构以便进行精准修改。',
      parameters: {
        type: 'object',
        properties: {
          template_id: {
            type: 'string',
            description: '模板的 MongoDB ObjectId',
          },
          include_code: {
            type: 'boolean',
            description: '是否包含完整代码（默认 false，只返回结构摘要）',
          },
        },
        required: ['template_id'],
      },
    },
  },

  // ── 3. 查找 Agent ────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'find_agent',
      description: '按名称、分类或能力关键词查找最匹配的 Agent，返回 Agent 的 slug、名称、描述、能力列表和工作流。用于为任务选择最合适的 Agent。',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索关键词，如"前端开发"、"数据分析"、"UI设计"',
          },
          category: {
            type: 'string',
            description: '按分类过滤，如"frontend"、"backend"、"design"',
          },
          limit: {
            type: 'number',
            description: '返回数量，默认 5',
          },
        },
        required: ['query'],
      },
    },
  },

  // ── 4. 获取设计规范 ──────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'get_design_spec',
      description: '获取项目的 UI 设计规范，包括配色方案、布局规则、组件风格、字体层级等。用于确保生成的页面与项目整体风格一致。',
      parameters: {
        type: 'object',
        properties: {
          spec_type: {
            type: 'string',
            description: '规范类型',
            enum: ['color', 'layout', 'component', 'typography', 'all'],
          },
        },
        required: [],
      },
    },
  },

  // ── 5. 搜索知识库 ────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'search_knowledge',
      description: '在知识库中语义搜索相关内容，返回最相关的知识片段。用于 RAG 增强回答质量，查找技术文档、最佳实践等。',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索查询，描述你想了解的内容',
          },
          category_key: {
            type: 'string',
            description: '限定知识库分类，不填则全库搜索',
          },
          limit: {
            type: 'number',
            description: '返回片段数量，默认 3，最大 10',
          },
        },
        required: ['query'],
      },
    },
  },

  // ── 6. 获取 Agent 工作流 ─────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'get_agent_workflow',
      description: '获取指定 Agent 的详细工作流节点，包括每个步骤的输入/输出、依赖关系和 Prompt 提示。用于了解 Agent 的执行流程。',
      parameters: {
        type: 'object',
        properties: {
          agent_slug: {
            type: 'string',
            description: 'Agent 的唯一标识符（slug）',
          },
        },
        required: ['agent_slug'],
      },
    },
  },

  // ── 7. 列出分类 ──────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'list_categories',
      description: '列出系统中所有 Agent 分类，包括分类名称、描述和该分类下的 Agent 数量。用于了解系统能力范围。',
      parameters: {
        type: 'object',
        properties: {
          include_agent_count: {
            type: 'boolean',
            description: '是否统计每个分类下的 Agent 数量，默认 true',
          },
        },
        required: [],
      },
    },
  },

  // ── 8. 获取模板完整代码 ──────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'get_template_code',
      description: '获取指定 Vibe 模板的完整 HTML/CSS/JS 代码。用于在修改页面时获取原始代码作为基础。',
      parameters: {
        type: 'object',
        properties: {
          template_id: {
            type: 'string',
            description: '模板的 MongoDB ObjectId',
          },
        },
        required: ['template_id'],
      },
    },
  },
];

// =============================================================================
// 工具执行器
// =============================================================================

/**
 * 执行工具调用，返回结构化结果
 */
export const executeTool = async (call: ToolCallRequest): Promise<ToolCallResult> => {
  const { name, arguments: args } = call;

  try {
    switch (name) {
      // ── list_pages ──────────────────────────────────────────────────────────
      case 'list_pages': {
        const limit = Math.min(Number(args.limit) || 10, 50);
        const filter: Record<string, unknown> = { isActive: true };
        if (args.category) filter.category = args.category;
        if (args.search) {
          filter.title = { $regex: String(args.search), $options: 'i' };
        }

        const templates = await VibeTemplate.find(filter, {
          title: 1, category: 1, description: 1, tags: 1,
          viewCount: 1, likeCount: 1, publishedAt: 1, author: 1,
          'codeParts.isFullHtml': 1,
        })
          .sort({ publishedAt: -1 })
          .limit(limit)
          .lean();

        return {
          toolName: name,
          success: true,
          data: {
            total: templates.length,
            pages: templates.map((t) => ({
              id: String(t._id),
              title: t.title,
              category: t.category,
              description: t.description,
              tags: t.tags,
              viewCount: t.viewCount,
              likeCount: t.likeCount,
              author: t.author,
              publishedAt: t.publishedAt,
            })),
          },
        };
      }

      // ── get_page_structure ──────────────────────────────────────────────────
      case 'get_page_structure': {
        const template = await VibeTemplate.findById(String(args.template_id)).lean();
        if (!template) {
          return { toolName: name, success: false, error: `模板 ${args.template_id} 不存在` };
        }

        const html = template.codeParts?.html || '';
        const fullHtml = template.codeParts?.isFullHtml ? html : `${html}\n<style>${template.codeParts?.css || ''}</style>\n<script>${template.codeParts?.js || ''}</script>`;

        // 提取结构摘要
        const titleMatch = fullHtml.match(/<title>([^<]*)<\/title>/i);
        const idMatches = [...fullHtml.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
        const classMatches = [...new Set([...fullHtml.matchAll(/\bclass\s*=\s*["']([^"']+)["']/gi)].flatMap((m) => m[1].split(/\s+/)))].slice(0, 30);
        const fnMatches = [...fullHtml.matchAll(/function\s+(\w+)\s*\(/g)].map((m) => m[1]);
        const scriptCount = (fullHtml.match(/<script/gi) || []).length;
        const hasCanvas = /<canvas/i.test(fullHtml);
        const hasEcharts = /echarts/i.test(fullHtml);
        const hasTailwind = /tailwind/i.test(fullHtml);
        const lineCount = fullHtml.split('\n').length;

        const structure = {
          title: titleMatch?.[1] || template.title,
          lineCount,
          scriptCount,
          hasCanvas,
          hasEcharts,
          hasTailwind,
          elementIds: idMatches.slice(0, 20),
          cssClasses: classMatches,
          jsFunctions: fnMatches.slice(0, 30),
          ...(args.include_code ? { fullCode: fullHtml } : {}),
        };

        return { toolName: name, success: true, data: structure };
      }

      // ── find_agent ──────────────────────────────────────────────────────────
      case 'find_agent': {
        const limit = Math.min(Number(args.limit) || 5, 20);
        const query: Record<string, unknown> = {};

        if (args.category) query.categoryKey = args.category;
        if (args.query) {
          query.$or = [
            { 'name.zh': { $regex: String(args.query), $options: 'i' } },
            { 'name.en': { $regex: String(args.query), $options: 'i' } },
            { 'description.zh': { $regex: String(args.query), $options: 'i' } },
            { 'description.en': { $regex: String(args.query), $options: 'i' } },
            { tags: { $in: [String(args.query)] } },
            { 'capabilities.zh': { $regex: String(args.query), $options: 'i' } },
          ];
        }

        const agents = await Agent.find(query, {
          slug: 1, 'name.zh': 1, 'name.en': 1, 'description.zh': 1,
          categoryKey: 1, tags: 1, capabilities: 1, emoji: 1,
          'workflow.summary': 1, 'modelPreferences': 1,
        })
          .limit(limit)
          .lean();

        return {
          toolName: name,
          success: true,
          data: {
            total: agents.length,
            agents: agents.map((a) => ({
              slug: a.slug,
              name: a.name,
              description: a.description,
              categoryKey: a.categoryKey,
              tags: a.tags,
              emoji: a.emoji,
              capabilities: a.capabilities,
              workflowSummary: a.workflow?.summary,
              modelPreferences: a.modelPreferences,
            })),
          },
        };
      }

      // ── get_design_spec ─────────────────────────────────────────────────────
      case 'get_design_spec': {
        const specType = String(args.spec_type || 'all');

        // 优先从数据库读取
        const dbSpec = await SystemPrompt.findOne<ISystemPrompt>(
          { key: 'design_spec', isActive: true }
        ).lean();

        if (dbSpec?.content) {
          return { toolName: name, success: true, data: { source: 'database', spec: dbSpec.content } };
        }

        // 内置默认设计规范
        const defaultSpec = {
          color: {
            primary: '#6366f1',
            secondary: '#8b5cf6',
            background: '#0f172a',
            surface: '#1e293b',
            textPrimary: '#f1f5f9',
            textSecondary: '#94a3b8',
            border: '#334155',
            success: '#10b981',
            warning: '#f59e0b',
            danger: '#ef4444',
          },
          layout: {
            sidebarWidth: '240px',
            topbarHeight: '64px',
            contentPadding: '24px',
            cardGap: '16px',
            borderRadius: '8px',
          },
          component: {
            button: 'rounded-lg px-4 py-2 font-medium transition-all duration-200',
            input: 'rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 focus:border-indigo-500',
            card: 'rounded-xl bg-slate-800 border border-slate-700 shadow-lg',
            badge: 'rounded-full px-2 py-0.5 text-xs font-medium',
          },
          typography: {
            pageTitle: { size: '24px', weight: '700' },
            sectionTitle: { size: '18px', weight: '600' },
            body: { size: '14px', weight: '400' },
            caption: { size: '12px', weight: '400', color: '#94a3b8' },
          },
        };

        const result = specType === 'all'
          ? defaultSpec
          : { [specType]: defaultSpec[specType as keyof typeof defaultSpec] };

        return { toolName: name, success: true, data: { source: 'default', spec: result } };
      }

      // ── search_knowledge ────────────────────────────────────────────────────
      case 'search_knowledge': {
        const limit = Math.min(Number(args.limit) || 3, 10);
        const query = String(args.query);
        const filter: Record<string, unknown> = { isActive: true };
        if (args.category_key) filter.categoryKey = String(args.category_key);

        // 简单关键词匹配（无向量时的降级方案）
        const kbs = await KnowledgeBase.find(filter, { chunks: 1, 'title.zh': 1, categoryKey: 1 })
          .limit(20)
          .lean();

        const results: Array<{ title: string; chunk: string; score: number }> = [];

        for (const kb of kbs) {
          for (const chunk of kb.chunks || []) {
            const content = chunk.content?.zh || chunk.content?.en || '';
            if (!content) continue;

            // 简单 TF 评分：计算查询词在内容中出现的次数
            const words = query.toLowerCase().split(/\s+/);
            const score = words.reduce((acc, w) => {
              const re = new RegExp(w, 'gi');
              return acc + (content.match(re) || []).length;
            }, 0);

            if (score > 0) {
              results.push({ title: kb.title?.zh || '', chunk: content.slice(0, 500), score });
            }
          }
        }

        results.sort((a, b) => b.score - a.score);

        return {
          toolName: name,
          success: true,
          data: {
            query,
            results: results.slice(0, limit).map(({ title, chunk }) => ({ title, chunk })),
          },
        };
      }

      // ── get_agent_workflow ──────────────────────────────────────────────────
      case 'get_agent_workflow': {
        const agent = await Agent.findOne(
          { slug: String(args.agent_slug) },
          { 'workflow': 1, 'name': 1, 'description': 1, 'capabilities': 1 }
        ).lean();

        if (!agent) {
          return { toolName: name, success: false, error: `Agent "${args.agent_slug}" 不存在` };
        }

        return {
          toolName: name,
          success: true,
          data: {
            slug: args.agent_slug,
            name: agent.name,
            description: agent.description,
            capabilities: agent.capabilities,
            workflow: agent.workflow,
          },
        };
      }

      // ── list_categories ─────────────────────────────────────────────────────
      case 'list_categories': {
        const includeCount = args.include_agent_count !== false;
        const categories = await Category.find().sort({ sortOrder: 1 }).lean();

        let result: unknown[] = categories;

        if (includeCount) {
          result = await Promise.all(
            categories.map(async (cat) => ({
              ...cat,
              agentCount: await Agent.countDocuments({ categoryKey: (cat as any).key }),
            }))
          );
        }

        return { toolName: name, success: true, data: { categories: result } };
      }

      // ── get_template_code ───────────────────────────────────────────────────
      case 'get_template_code': {
        const template = await VibeTemplate.findById(String(args.template_id)).lean();
        if (!template) {
          return { toolName: name, success: false, error: `模板 ${args.template_id} 不存在` };
        }

        return {
          toolName: name,
          success: true,
          data: {
            id: String(template._id),
            title: template.title,
            category: template.category,
            codeParts: template.codeParts,
          },
        };
      }

      default:
        return { toolName: name, success: false, error: `未知工具：${name}` };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { toolName: name, success: false, error: message };
  }
};

/**
 * 批量执行工具调用（并行）
 */
export const executeTools = async (calls: ToolCallRequest[]): Promise<ToolCallResult[]> => {
  return Promise.all(calls.map(executeTool));
};
