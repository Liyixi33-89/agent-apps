/**
 * @file routes/agentMarket.ts
 * @description Agent 市场/分享路由 — 导入导出 Agent 配置
 *
 * 路由列表：
 *   GET    /api/agent-market                → Agent 市场列表（公开分享的 Agent）
 *   GET    /api/agent-market/:slug/export   → 导出 Agent 配置（JSON 格式）
 *   POST   /api/agent-market/import         → 导入 Agent 配置
 *   POST   /api/agent-market/:slug/share    → 分享 Agent 到市场
 *   DELETE /api/agent-market/:slug/share    → 取消分享
 */

import Router from '@koa/router';
import { Agent } from '../models/Agent.js';
import { Category } from '../models/Category.js';
import { KnowledgeBase } from '../models/KnowledgeBase.js';

export const agentMarketRouter = new Router({ prefix: '/api/agent-market' });

// ─── Agent 导出格式标准 ──────────────────────────────────────────────────────

interface AgentExportFormat {
  /** 格式版本号 */
  formatVersion: '1.0.0';
  /** 导出时间 */
  exportedAt: string;
  /** 平台标识 */
  platform: 'agency-agents';
  /** Agent 数据 */
  agent: {
    slug: string;
    categoryKey: string;
    name: { zh: string; en: string };
    description: { zh: string; en: string };
    vibe: { zh: string; en: string };
    emoji: string;
    color: string;
    tags: string[];
    capabilities: Array<{ zh: string; en: string }>;
    workflow: {
      summary: { zh: string; en: string };
      nodes: Array<{
        nodeId: string;
        label: { zh: string; en: string };
        type: string;
        dependsOn: string[];
        promptHint: { zh: string; en: string };
        modelType: 'text' | 'vision';
      }>;
    };
    modelPreferences: {
      primary: 'text' | 'vision';
      recommendedProvider: string;
    };
    sections: Array<{
      key: string;
      heading: { zh: string; en: string };
      markdown: { zh: string; en: string };
      order: number;
    }>;
  };
  /** 关联的知识库摘要（不含完整内容，仅元数据） */
  knowledgeSummary?: Array<{
    title: { zh: string; en: string };
    description: { zh: string; en: string };
    sourceType: string;
    tags: string[];
  }>;
}

// ─── Agent 市场列表  GET /api/agent-market ───────────────────────────────────

agentMarketRouter.get('/', async (ctx) => {
  const { page = '1', limit = '20', category, search, sort = 'newest' } = ctx.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, parseInt(limit));

  const filter: Record<string, unknown> = {
    'frontmatter.shared': true, // 只展示已分享的 Agent
  };
  if (category) filter.categoryKey = category;
  if (search) {
    filter.$or = [
      { 'name.zh': { $regex: search, $options: 'i' } },
      { 'name.en': { $regex: search, $options: 'i' } },
      { 'description.zh': { $regex: search, $options: 'i' } },
      { tags: { $regex: search, $options: 'i' } },
    ];
  }

  const sortMap: Record<string, Record<string, 1 | -1>> = {
    newest: { updatedAt: -1 },
    name: { 'name.zh': 1 },
    popular: { 'stats.wordCount': -1 },
  };

  const [agents, total] = await Promise.all([
    Agent.find(filter, {
      slug: 1, name: 1, description: 1, emoji: 1, color: 1,
      categoryKey: 1, tags: 1, modelPreferences: 1, stats: 1, updatedAt: 1,
    })
      .sort(sortMap[sort] || sortMap.newest)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Agent.countDocuments(filter),
  ]);

  // 获取分类信息
  const categories = await Category.find({}, { key: 1, name: 1, icon: 1 }).lean();
  const categoryMap = new Map(categories.map(c => [c.key, c]));

  const enrichedAgents = agents.map(a => ({
    ...a,
    category: categoryMap.get(a.categoryKey),
  }));

  ctx.body = {
    success: true,
    data: enrichedAgents,
    pagination: { page: pageNum, limit: limitNum, total },
  };
});

// ─── 导出 Agent  GET /api/agent-market/:slug/export ─────────────────────────

agentMarketRouter.get('/:slug/export', async (ctx) => {
  const agent = await Agent.findOne({ slug: ctx.params.slug }).lean();
  if (!agent) {
    ctx.status = 404;
    ctx.body = { success: false, message: `Agent "${ctx.params.slug}" 不存在` };
    return;
  }

  // 获取关联知识库摘要
  const knowledgeBases = await KnowledgeBase.find(
    { agentSlug: agent.slug, isActive: true },
    { title: 1, description: 1, sourceType: 1, tags: 1 }
  ).lean();

  const exportData: AgentExportFormat = {
    formatVersion: '1.0.0',
    exportedAt: new Date().toISOString(),
    platform: 'agency-agents',
    agent: {
      slug: agent.slug,
      categoryKey: agent.categoryKey,
      name: agent.name,
      description: agent.description,
      vibe: agent.vibe || { zh: '', en: '' },
      emoji: agent.emoji,
      color: agent.color,
      tags: agent.tags || [],
      capabilities: agent.capabilities || [],
      workflow: agent.workflow || { summary: { zh: '', en: '' }, nodes: [] },
      modelPreferences: agent.modelPreferences || { primary: 'text', recommendedProvider: 'openai' },
      sections: (agent.sections || []).map(s => ({
        key: s.key,
        heading: s.heading,
        markdown: s.markdown,
        order: s.order,
      })),
    },
    knowledgeSummary: knowledgeBases.map(kb => ({
      title: kb.title,
      description: kb.description,
      sourceType: kb.sourceType,
      tags: kb.tags || [],
    })),
  };

  // 设置下载头
  ctx.set('Content-Type', 'application/json');
  ctx.set('Content-Disposition', `attachment; filename="agent-${agent.slug}.json"`);
  ctx.body = exportData;
});

// ─── 导入 Agent  POST /api/agent-market/import ──────────────────────────────

agentMarketRouter.post('/import', async (ctx) => {
  const body = ctx.request.body as AgentExportFormat;

  // 验证格式
  if (!body.formatVersion || !body.agent?.slug || !body.agent?.name) {
    ctx.status = 400;
    ctx.body = { success: false, message: '无效的 Agent 导入格式，缺少必要字段' };
    return;
  }

  if (body.platform !== 'agency-agents') {
    ctx.status = 400;
    ctx.body = { success: false, message: `不支持的平台格式: ${body.platform}` };
    return;
  }

  const agentData = body.agent;

  // 检查 slug 是否已存在
  const existing = await Agent.findOne({ slug: agentData.slug });
  if (existing) {
    // 更新已有 Agent
    Object.assign(existing, {
      name: agentData.name,
      description: agentData.description,
      vibe: agentData.vibe,
      emoji: agentData.emoji,
      color: agentData.color,
      tags: agentData.tags,
      capabilities: agentData.capabilities,
      workflow: agentData.workflow,
      modelPreferences: agentData.modelPreferences,
      sections: agentData.sections,
    });
    await existing.save();

    ctx.body = {
      success: true,
      data: existing,
      message: `Agent "${agentData.slug}" 已更新（覆盖导入）`,
      action: 'updated',
    };
    return;
  }

  // 确保分类存在
  const categoryExists = await Category.findOne({ key: agentData.categoryKey });
  if (!categoryExists) {
    // 自动创建分类
    await Category.create({
      key: agentData.categoryKey,
      name: { zh: agentData.categoryKey, en: agentData.categoryKey },
      description: { zh: '导入的分类', en: 'Imported category' },
      icon: '📁',
      color: 'slate',
      sortOrder: 99,
    });
  }

  // 创建新 Agent
  const newAgent = await Agent.create({
    ...agentData,
    sourcePath: `imported/${agentData.slug}`,
    rawMarkdown: agentData.sections.map(s =>
      `## ${s.heading.zh}\n\n${s.markdown.zh}`
    ).join('\n\n'),
    frontmatter: { imported: true, importedAt: new Date().toISOString() },
    stats: {
      sectionCount: agentData.sections.length,
      wordCount: agentData.sections.reduce((sum, s) => sum + (s.markdown.zh?.length || 0), 0),
    },
  });

  ctx.body = {
    success: true,
    data: newAgent,
    message: `Agent "${agentData.slug}" 导入成功`,
    action: 'created',
  };
});

// ─── 分享 Agent  POST /api/agent-market/:slug/share ─────────────────────────

agentMarketRouter.post('/:slug/share', async (ctx) => {
  const agent = await Agent.findOne({ slug: ctx.params.slug });
  if (!agent) {
    ctx.status = 404;
    ctx.body = { success: false, message: `Agent "${ctx.params.slug}" 不存在` };
    return;
  }

  agent.frontmatter = { ...agent.frontmatter, shared: true, sharedAt: new Date().toISOString() };
  await agent.save();

  ctx.body = { success: true, message: `Agent "${agent.slug}" 已分享到市场` };
});

// ─── 取消分享  DELETE /api/agent-market/:slug/share ──────────────────────────

agentMarketRouter.delete('/:slug/share', async (ctx) => {
  const agent = await Agent.findOne({ slug: ctx.params.slug });
  if (!agent) {
    ctx.status = 404;
    ctx.body = { success: false, message: `Agent "${ctx.params.slug}" 不存在` };
    return;
  }

  const fm = { ...agent.frontmatter };
  delete fm.shared;
  delete fm.sharedAt;
  agent.frontmatter = fm;
  await agent.save();

  ctx.body = { success: true, message: `Agent "${agent.slug}" 已取消分享` };
});
