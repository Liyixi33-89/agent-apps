/**
 * @file routes/mcp.ts
 * @description MCP（Model Context Protocol）管理路由
 *
 * 路由列表：
 *   GET    /api/mcp/servers              → 获取所有 MCP Server 列表
 *   POST   /api/mcp/servers              → 创建 MCP Server 配置
 *   PUT    /api/mcp/servers/:key         → 更新 MCP Server 配置
 *   DELETE /api/mcp/servers/:key         → 删除 MCP Server 配置
 *   POST   /api/mcp/servers/:key/connect → 连接 MCP Server（发现工具）
 *   POST   /api/mcp/servers/:key/disconnect → 断开 MCP Server 连接
 *   GET    /api/mcp/tools                → 获取所有可用 MCP 工具
 *   POST   /api/mcp/tools/call           → 调用 MCP 工具
 */

import Router from '@koa/router';
import { McpServer } from '../models/McpServer.js';
import {
  connectMcpServer,
  disconnectMcpServer,
  executeMcpTool,
  getMcpToolDefinitions,
  getMcpServerStatuses,
} from '../services/mcpService.js';

export const mcpRouter = new Router({ prefix: '/mcp' });

// ─── 获取所有 MCP Server 列表 ─────────────────────────────────────────────────

mcpRouter.get('/servers', async (ctx) => {
  const servers = await McpServer.find().sort({ sortOrder: 1, createdAt: -1 }).lean();

  // 附加实时连接状态
  const statuses = getMcpServerStatuses();
  const serversWithStatus = servers.map((s) => ({
    ...s,
    isConnected: statuses.has(s.key),
  }));

  ctx.body = { success: true, data: serversWithStatus };
});

// ─── 创建 MCP Server 配置 ─────────────────────────────────────────────────────

mcpRouter.post('/servers', async (ctx) => {
  const body = ctx.request.body as Record<string, unknown>;
  const { key, name, description, icon, transportType, stdioConfig, sseConfig } = body;

  if (!key || !name || !transportType) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少必填字段：key, name, transportType' };
    return;
  }

  // 检查 key 唯一性
  const existing = await McpServer.findOne({ key });
  if (existing) {
    ctx.status = 409;
    ctx.body = { success: false, message: `MCP Server key "${key}" 已存在` };
    return;
  }

  const server = await McpServer.create({
    key,
    name,
    description: description || '',
    icon: icon || '🔌',
    transportType,
    stdioConfig: transportType === 'stdio' ? stdioConfig : undefined,
    sseConfig: transportType === 'sse' ? sseConfig : undefined,
    status: 'disconnected',
    isActive: true,
  });

  ctx.body = { success: true, data: server };
});

// ─── 更新 MCP Server 配置 ─────────────────────────────────────────────────────

mcpRouter.put('/servers/:key', async (ctx) => {
  const { key } = ctx.params;
  const body = ctx.request.body as Record<string, unknown>;

  const server = await McpServer.findOne({ key });
  if (!server) {
    ctx.status = 404;
    ctx.body = { success: false, message: `MCP Server "${key}" 不存在` };
    return;
  }

  // 可更新的字段
  const updatableFields = ['name', 'description', 'icon', 'transportType', 'stdioConfig', 'sseConfig', 'isActive', 'sortOrder'];
  for (const field of updatableFields) {
    if (body[field] !== undefined) {
      (server as any)[field] = body[field];
    }
  }

  await server.save();
  ctx.body = { success: true, data: server };
});

// ─── 删除 MCP Server 配置 ─────────────────────────────────────────────────────

mcpRouter.delete('/servers/:key', async (ctx) => {
  const { key } = ctx.params;

  // 先断开连接
  try {
    await disconnectMcpServer(key);
  } catch {
    // 忽略断开错误
  }

  const result = await McpServer.deleteOne({ key });
  if (result.deletedCount === 0) {
    ctx.status = 404;
    ctx.body = { success: false, message: `MCP Server "${key}" 不存在` };
    return;
  }

  ctx.body = { success: true, message: `MCP Server "${key}" 已删除` };
});

// ─── 连接 MCP Server ──────────────────────────────────────────────────────────

mcpRouter.post('/servers/:key/connect', async (ctx) => {
  const { key } = ctx.params;

  try {
    const result = await connectMcpServer(key);
    ctx.body = {
      success: true,
      data: {
        status: result.status,
        toolCount: result.tools.length,
        tools: result.tools.map((t) => ({ name: t.name, description: t.description })),
      },
    };
  } catch (err: unknown) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: `连接失败: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
});

// ─── 断开 MCP Server 连接 ─────────────────────────────────────────────────────

mcpRouter.post('/servers/:key/disconnect', async (ctx) => {
  const { key } = ctx.params;

  try {
    await disconnectMcpServer(key);
    ctx.body = { success: true, message: '已断开连接' };
  } catch (err: unknown) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: `断开失败: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
});

// ─── 获取所有可用 MCP 工具 ────────────────────────────────────────────────────

mcpRouter.get('/tools', async (ctx) => {
  try {
    const tools = await getMcpToolDefinitions();
    ctx.body = {
      success: true,
      data: {
        total: tools.length,
        tools: tools.map((t) => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        })),
      },
    };
  } catch (err: unknown) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: `获取工具失败: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
});

// ─── 调用 MCP 工具 ────────────────────────────────────────────────────────────

mcpRouter.post('/tools/call', async (ctx) => {
  const { name, arguments: args } = ctx.request.body as { name: string; arguments?: Record<string, unknown> };

  if (!name) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少工具名称' };
    return;
  }

  try {
    const result = await executeMcpTool(name, args || {});
    ctx.body = result;
  } catch (err: unknown) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: `工具调用失败: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
});
