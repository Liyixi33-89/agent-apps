/**
 * @file routes/knowledgeGraph.ts
 * @description 知识图谱路由 — 基于 Agent 关系建模的图数据 API
 *
 * 路由列表：
 *   GET  /api/knowledge-graph          → 获取完整知识图谱数据（节点 + 边）
 *   GET  /api/knowledge-graph/agent/:slug → 获取单个 Agent 的关系子图
 */

import Router from '@koa/router';
import { Agent } from '../models/Agent.js';
import { Category } from '../models/Category.js';
import { Skill } from '../models/Skill.js';
import { KnowledgeBase } from '../models/KnowledgeBase.js';
import { McpServer } from '../models/McpServer.js';
import { AGENT_TOOLS } from '../lib/agentTools.js';

export const knowledgeGraphRouter = new Router({ prefix: '/api/knowledge-graph' });

// ─── 图节点/边类型定义 ────────────────────────────────────────────────────────

interface GraphNode {
  id: string;
  label: string;
  type: 'agent' | 'category' | 'skill' | 'knowledge' | 'tool';
  emoji?: string;
  color?: string;
  size?: number;
  metadata?: Record<string, unknown>;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
  type: 'belongs_to' | 'uses_skill' | 'has_knowledge' | 'depends_on' | 'collaborates' | 'uses_tool';
  weight?: number;
}

// ─── 获取完整知识图谱  GET /api/knowledge-graph ──────────────────────────────

knowledgeGraphRouter.get('/', async (ctx) => {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeIds = new Set<string>();

  // 1. 加载所有 Agent
  const agents = await Agent.find({}, {
    slug: 1, name: 1, emoji: 1, color: 1, categoryKey: 1, tags: 1,
    'workflow.nodes': 1, 'modelPreferences.primary': 1,
  }).lean();

  // 2. 加载所有分类
  const categories = await Category.find({}).lean();

  // 3. 加载所有 Skill
  const skills = await Skill.find({ isActive: true }, {
    key: 1, name: 1, icon: 1, category: 1, dependsOn: 1,
    steps: { $slice: 5 }, // 只取前 5 个步骤用于关系分析
  }).lean();

  // 4. 加载知识库
  const knowledgeBases = await KnowledgeBase.find({ isActive: true }, {
    title: 1, categoryKey: 1, agentSlug: 1, tags: 1,
  }).lean();

  // ── 构建分类节点 ──
  for (const cat of categories) {
    const id = `cat_${cat.key}`;
    if (!nodeIds.has(id)) {
      nodes.push({
        id,
        label: cat.name?.zh || cat.key,
        type: 'category',
        emoji: cat.icon || '📂',
        color: cat.color || 'slate',
        size: 40,
        metadata: { key: cat.key, agentCount: cat.stats?.agentCount || 0 },
      });
      nodeIds.add(id);
    }
  }

  // ── 构建 Agent 节点 + 边 ──
  for (const agent of agents) {
    const agentId = `agent_${agent.slug}`;
    nodes.push({
      id: agentId,
      label: agent.name?.zh || agent.slug,
      type: 'agent',
      emoji: agent.emoji || '🤖',
      color: agent.color || 'sky',
      size: 30,
      metadata: {
        slug: agent.slug,
        modelType: agent.modelPreferences?.primary || 'text',
        tags: agent.tags || [],
      },
    });
    nodeIds.add(agentId);

    // Agent → Category 边
    if (agent.categoryKey) {
      const catId = `cat_${agent.categoryKey}`;
      if (nodeIds.has(catId)) {
        edges.push({
          source: agentId,
          target: catId,
          label: '属于',
          type: 'belongs_to',
        });
      }
    }

    // Agent 之间的协作关系（基于共同 tag）
    for (const otherAgent of agents) {
      if (otherAgent.slug === agent.slug) continue;
      const commonTags = (agent.tags || []).filter(t => (otherAgent.tags || []).includes(t));
      if (commonTags.length >= 2) {
        // 避免重复边
        const edgeKey = [agent.slug, otherAgent.slug].sort().join('_');
        if (!edges.some(e => e.source === `agent_${edgeKey.split('_')[0]}` && e.target === `agent_${edgeKey.split('_')[1]}` && e.type === 'collaborates')) {
          edges.push({
            source: `agent_${agent.slug}`,
            target: `agent_${otherAgent.slug}`,
            label: `共同标签: ${commonTags.slice(0, 2).join(', ')}`,
            type: 'collaborates',
            weight: commonTags.length,
          });
        }
      }
    }
  }

  // ── 构建 Skill 节点 + 边 ──
  for (const skill of skills) {
    const skillId = `skill_${skill.key}`;
    nodes.push({
      id: skillId,
      label: (skill as any).name || skill.key,
      type: 'skill',
      emoji: (skill as any).icon || '⚡',
      size: 20,
      metadata: { key: skill.key, category: (skill as any).category },
    });
    nodeIds.add(skillId);

    // Skill 依赖关系
    for (const depKey of (skill as any).dependsOn || []) {
      edges.push({
        source: skillId,
        target: `skill_${depKey}`,
        label: '依赖',
        type: 'depends_on',
      });
    }

    // Skill 中使用的工具 → 创建工具节点
    for (const step of (skill as any).steps || []) {
      if (step.type === 'tool' && step.toolName) {
        const toolId = `tool_${step.toolName}`;
        if (!nodeIds.has(toolId)) {
          nodes.push({
            id: toolId,
            label: step.toolName,
            type: 'tool',
            emoji: '🔧',
            size: 15,
          });
          nodeIds.add(toolId);
        }
        edges.push({
          source: skillId,
          target: toolId,
          label: '使用',
          type: 'uses_tool',
        });
      }
    }
  }

  // ── 构建知识库节点 + 边 ──
  for (const kb of knowledgeBases) {
    const kbId = `kb_${kb._id}`;
    nodes.push({
      id: kbId,
      label: kb.title?.zh || kb.title?.en || '未命名',
      type: 'knowledge',
      emoji: '📚',
      size: 18,
      metadata: { categoryKey: kb.categoryKey, agentSlug: kb.agentSlug },
    });
    nodeIds.add(kbId);

    // 知识库 → Agent 边
    if (kb.agentSlug) {
      const agentId = `agent_${kb.agentSlug}`;
      if (nodeIds.has(agentId)) {
        edges.push({
          source: agentId,
          target: kbId,
          label: '拥有知识',
          type: 'has_knowledge',
        });
      }
    }

    // 知识库 → Category 边
    if (kb.categoryKey) {
      const catId = `cat_${kb.categoryKey}`;
      if (nodeIds.has(catId)) {
        edges.push({
          source: kbId,
          target: catId,
          label: '属于分类',
          type: 'belongs_to',
        });
      }
    }
  }

  // ── 构建内置工具节点（全量）──
  for (const toolDef of AGENT_TOOLS) {
    const toolId = `tool_${toolDef.function.name}`;
    if (!nodeIds.has(toolId)) {
      nodes.push({
        id: toolId,
        label: toolDef.function.name,
        type: 'tool',
        emoji: '🔧',
        size: 15,
        metadata: {
          description: toolDef.function.description,
          paramCount: Object.keys(toolDef.function.parameters.properties || {}).length,
          source: 'builtin',
        },
      });
      nodeIds.add(toolId);
    }
  }

  // ── 构建 MCP Server 节点 + 边 ──
  const mcpServers = await McpServer.find({ isActive: true }, {
    key: 1, name: 1, icon: 1, tools: 1, status: 1, transportType: 1,
  }).lean();

  for (const mcp of mcpServers) {
    const mcpId = `mcp_${mcp.key}`;
    nodes.push({
      id: mcpId,
      label: (mcp as any).name || mcp.key,
      type: 'tool' as const,
      emoji: (mcp as any).icon || '🔌',
      color: 'violet',
      size: 22,
      metadata: {
        key: mcp.key,
        transportType: (mcp as any).transportType,
        toolCount: ((mcp as any).tools || []).length,
        status: (mcp as any).status,
        source: 'mcp',
      },
    });
    nodeIds.add(mcpId);

    // MCP Server 提供的工具 → 工具节点
    for (const tool of (mcp as any).tools || []) {
      const mcpToolId = `tool_mcp_${mcp.key}_${tool.name}`;
      if (!nodeIds.has(mcpToolId)) {
        nodes.push({
          id: mcpToolId,
          label: tool.name,
          type: 'tool',
          emoji: '⚙️',
          size: 12,
          metadata: { description: tool.description, source: 'mcp', serverKey: mcp.key },
        });
        nodeIds.add(mcpToolId);
      }
      edges.push({
        source: mcpId,
        target: mcpToolId,
        label: '提供',
        type: 'uses_tool',
      });
    }
  }

  // 过滤掉目标节点不存在的边
  const validEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

  ctx.body = {
    success: true,
    data: {
      nodes,
      edges: validEdges,
      stats: {
        totalNodes: nodes.length,
        totalEdges: validEdges.length,
        agentCount: agents.length,
        categoryCount: categories.length,
        skillCount: skills.length,
        knowledgeCount: knowledgeBases.length,
        toolCount: AGENT_TOOLS.length,
        mcpCount: mcpServers.length,
      },
    },
  };
});

// ─── 获取单个 Agent 的关系子图  GET /api/knowledge-graph/agent/:slug ─────────

knowledgeGraphRouter.get('/agent/:slug', async (ctx) => {
  const { slug } = ctx.params;
  const agent = await Agent.findOne({ slug }).lean();
  if (!agent) {
    ctx.status = 404;
    ctx.body = { success: false, message: `Agent "${slug}" 不存在` };
    return;
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // 中心节点
  nodes.push({
    id: `agent_${agent.slug}`,
    label: agent.name?.zh || agent.slug,
    type: 'agent',
    emoji: agent.emoji || '🤖',
    color: agent.color || 'sky',
    size: 40,
    metadata: { slug: agent.slug, tags: agent.tags },
  });

  // 分类
  if (agent.categoryKey) {
    const cat = await Category.findOne({ key: agent.categoryKey }).lean();
    if (cat) {
      nodes.push({
        id: `cat_${cat.key}`,
        label: cat.name?.zh || cat.key,
        type: 'category',
        emoji: cat.icon || '📂',
        size: 30,
      });
      edges.push({ source: `agent_${agent.slug}`, target: `cat_${cat.key}`, label: '属于', type: 'belongs_to' });
    }
  }

  // 同分类的其他 Agent
  const sameCategory = await Agent.find(
    { categoryKey: agent.categoryKey, slug: { $ne: slug } },
    { slug: 1, name: 1, emoji: 1 }
  ).limit(5).lean();

  for (const peer of sameCategory) {
    nodes.push({
      id: `agent_${peer.slug}`,
      label: peer.name?.zh || peer.slug,
      type: 'agent',
      emoji: peer.emoji || '🤖',
      size: 22,
    });
    edges.push({
      source: `agent_${agent.slug}`,
      target: `agent_${peer.slug}`,
      label: '同分类',
      type: 'collaborates',
    });
  }

  // 关联知识库
  const kbs = await KnowledgeBase.find(
    { $or: [{ agentSlug: slug }, { categoryKey: agent.categoryKey }], isActive: true },
    { title: 1, agentSlug: 1 }
  ).limit(10).lean();

  for (const kb of kbs) {
    nodes.push({
      id: `kb_${kb._id}`,
      label: kb.title?.zh || kb.title?.en || '未命名',
      type: 'knowledge',
      emoji: '📚',
      size: 18,
    });
    edges.push({
      source: `agent_${agent.slug}`,
      target: `kb_${kb._id}`,
      label: kb.agentSlug === slug ? '拥有知识' : '相关知识',
      type: 'has_knowledge',
    });
  }

  ctx.body = {
    success: true,
    data: { nodes, edges, center: `agent_${agent.slug}` },
  };
});
