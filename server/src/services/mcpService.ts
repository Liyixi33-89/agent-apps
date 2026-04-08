/**
 * @file services/mcpService.ts
 * @description MCP（Model Context Protocol）服务层
 *
 * 实现 MCP Client 功能：
 *   1. 连接 MCP Server（支持 stdio / SSE 两种传输方式）
 *   2. 发现工具（tools/list）
 *   3. 调用工具（tools/call）
 *   4. 管理连接生命周期
 *   5. 将 MCP 工具转换为 OpenAI Function Calling 格式
 *
 * MCP 协议核心流程：
 *   Client → initialize → tools/list → tools/call → ...
 *
 * 本实现采用简化的 JSON-RPC 2.0 协议，兼容主流 MCP Server。
 */

import { spawn, ChildProcess } from 'node:child_process';
import axios from 'axios';
import { McpServer, type IMcpServer, type IMcpTool } from '../models/McpServer.js';
import type { ToolDefinition, ToolCallResult } from '../lib/agentTools.js';

// =============================================================================
// 类型定义
// =============================================================================

/** JSON-RPC 2.0 请求 */
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

/** JSON-RPC 2.0 响应 */
interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/** MCP 工具定义（协议格式） */
interface McpProtocolTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/** MCP 工具调用结果（协议格式） */
interface McpToolCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

// =============================================================================
// MCP 连接管理器
// =============================================================================

/** 活跃的 stdio 进程映射 */
const activeProcesses = new Map<string, {
  process: ChildProcess;
  requestId: number;
  pendingRequests: Map<number, {
    resolve: (value: JsonRpcResponse) => void;
    reject: (reason: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>;
  buffer: string;
}>();

/** 活跃的 SSE 连接映射 */
const activeSseConnections = new Map<string, {
  sessionUrl: string;
  requestId: number;
}>();

// =============================================================================
// stdio 传输实现
// =============================================================================

/**
 * 通过 stdio 连接 MCP Server
 * 启动子进程，通过 stdin/stdout 进行 JSON-RPC 通信
 */
const connectStdio = async (serverKey: string, command: string, args: string[], envVars?: Record<string, string>, cwd?: string): Promise<void> => {
  // 如果已有连接，先断开
  if (activeProcesses.has(serverKey)) {
    disconnectStdio(serverKey);
  }

  return new Promise((resolve, reject) => {
    // Windows 下使用 shell 模式时，如果 command 路径含空格需要用引号包裹
    const isWin = process.platform === 'win32';
    const safeCommand = isWin && command.includes(' ') ? `"${command}"` : command;

    const childProcess = spawn(safeCommand, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...envVars },
      cwd: cwd || undefined,
      shell: isWin,
    });

    const connection = {
      process: childProcess,
      requestId: 0,
      pendingRequests: new Map<number, {
        resolve: (value: JsonRpcResponse) => void;
        reject: (reason: Error) => void;
        timer: ReturnType<typeof setTimeout>;
      }>(),
      buffer: '',
    };

    activeProcesses.set(serverKey, connection);

    // 处理 stdout 数据
    childProcess.stdout?.on('data', (data: Buffer) => {
      connection.buffer += data.toString();

      // 按换行分割，处理完整的 JSON-RPC 消息
      const lines = connection.buffer.split('\n');
      connection.buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const response: JsonRpcResponse = JSON.parse(trimmed);
          const pending = connection.pendingRequests.get(response.id);
          if (pending) {
            clearTimeout(pending.timer);
            connection.pendingRequests.delete(response.id);
            pending.resolve(response);
          }
        } catch {
          // 忽略非 JSON 输出（如日志信息）
        }
      }
    });

    // 处理 stderr（日志输出）
    childProcess.stderr?.on('data', (data: Buffer) => {
      console.log(`[MCP:${serverKey}:stderr] ${data.toString().trim()}`);
    });

    // 进程退出
    childProcess.on('exit', (code) => {
      console.log(`[MCP:${serverKey}] 进程退出，code=${code}`);
      // 拒绝所有待处理的请求
      for (const [, pending] of connection.pendingRequests) {
        clearTimeout(pending.timer);
        pending.reject(new Error(`MCP Server 进程退出 (code=${code})`));
      }
      connection.pendingRequests.clear();
      activeProcesses.delete(serverKey);
    });

    // 进程错误
    childProcess.on('error', (err) => {
      console.error(`[MCP:${serverKey}] 进程错误:`, err.message);
      reject(err);
      activeProcesses.delete(serverKey);
    });

    // 等待进程启动（给 2s 缓冲，Python 进程启动较慢）
    setTimeout(() => {
      if (childProcess.killed || childProcess.exitCode !== null) {
        reject(new Error('MCP Server 进程启动失败'));
      } else {
        resolve();
      }
    }, 2000);
  });
};

/**
 * 向 stdio MCP Server 发送 JSON-RPC 请求
 * 通知消息（method 以 notifications/ 开头）不需要等待响应
 */
const sendStdioRequest = async (serverKey: string, method: string, params?: Record<string, unknown>): Promise<unknown> => {
  const connection = activeProcesses.get(serverKey);
  if (!connection) {
    throw new Error(`MCP Server "${serverKey}" 未连接（stdio）`);
  }

  // 通知消息：不带 id，不等待响应
  const isNotification = method.startsWith('notifications/');
  if (isNotification) {
    const notification = {
      jsonrpc: '2.0' as const,
      method,
      ...(params ? { params } : {}),
    };
    const data = JSON.stringify(notification) + '\n';
    connection.process.stdin?.write(data);
    return undefined;
  }

  const id = ++connection.requestId;
  const request: JsonRpcRequest = {
    jsonrpc: '2.0',
    id,
    method,
    ...(params ? { params } : {}),
  };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      connection.pendingRequests.delete(id);
      reject(new Error(`MCP 请求超时 (method=${method}, timeout=30s)`));
    }, 30_000);

    connection.pendingRequests.set(id, {
      resolve: (response: JsonRpcResponse) => {
        if (response.error) {
          reject(new Error(`MCP 错误 [${response.error.code}]: ${response.error.message}`));
        } else {
          resolve(response.result);
        }
      },
      reject,
      timer,
    });

    // 发送请求
    const data = JSON.stringify(request) + '\n';
    connection.process.stdin?.write(data);
  });
};

/**
 * 断开 stdio 连接
 */
const disconnectStdio = (serverKey: string): void => {
  const connection = activeProcesses.get(serverKey);
  if (!connection) return;

  // 拒绝所有待处理请求
  for (const [, pending] of connection.pendingRequests) {
    clearTimeout(pending.timer);
    pending.reject(new Error('连接已断开'));
  }
  connection.pendingRequests.clear();

  // 终止进程
  if (!connection.process.killed) {
    connection.process.kill('SIGTERM');
    // 如果 3 秒后还没退出，强制杀死
    setTimeout(() => {
      if (!connection.process.killed) {
        connection.process.kill('SIGKILL');
      }
    }, 3000);
  }

  activeProcesses.delete(serverKey);
};

// =============================================================================
// SSE 传输实现
// =============================================================================

/**
 * 通过 SSE 连接 MCP Server
 * 先 GET /sse 获取 session URL，后续通过 POST 发送请求
 */
const connectSse = async (serverKey: string, baseUrl: string, headers?: Record<string, string>): Promise<void> => {
  // 断开旧连接
  activeSseConnections.delete(serverKey);

  try {
    // 发送初始化请求获取 session URL
    // 标准 MCP SSE 协议：GET /sse 建立 SSE 连接，服务端返回 endpoint 事件
    // 简化实现：直接使用 baseUrl 作为 session URL
    const sessionUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';

    activeSseConnections.set(serverKey, {
      sessionUrl,
      requestId: 0,
    });

    console.log(`[MCP:${serverKey}] SSE 连接建立: ${sessionUrl}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`SSE 连接失败: ${msg}`);
  }
};

/**
 * 向 SSE MCP Server 发送 JSON-RPC 请求
 */
const sendSseRequest = async (serverKey: string, method: string, params?: Record<string, unknown>, headers?: Record<string, string>): Promise<unknown> => {
  const connection = activeSseConnections.get(serverKey);
  if (!connection) {
    throw new Error(`MCP Server "${serverKey}" 未连接（SSE）`);
  }

  const id = ++connection.requestId;
  const request: JsonRpcRequest = {
    jsonrpc: '2.0',
    id,
    method,
    ...(params ? { params } : {}),
  };

  try {
    const response = await axios.post(connection.sessionUrl, request, {
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      timeout: 30_000,
    });

    const rpcResponse = response.data as JsonRpcResponse;
    if (rpcResponse.error) {
      throw new Error(`MCP 错误 [${rpcResponse.error.code}]: ${rpcResponse.error.message}`);
    }

    return rpcResponse.result;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      throw new Error(`MCP SSE 请求失败: ${err.response?.status} ${err.message}`);
    }
    throw err;
  }
};

// =============================================================================
// MCP 协议操作
// =============================================================================

/**
 * 初始化 MCP 连接（发送 initialize 请求）
 */
const initializeConnection = async (serverKey: string, transportType: string, headers?: Record<string, string>): Promise<void> => {
  const sendRequest = transportType === 'stdio'
    ? (method: string, params?: Record<string, unknown>) => sendStdioRequest(serverKey, method, params)
    : (method: string, params?: Record<string, unknown>) => sendSseRequest(serverKey, method, params, headers);

  try {
    // 发送 initialize 请求
    await sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
      },
      clientInfo: {
        name: 'agency-agents-platform',
        version: '2.0.0',
      },
    });

    // 发送 initialized 通知
    await sendRequest('notifications/initialized');
  } catch (err: unknown) {
    // 某些 MCP Server 不需要 initialize，忽略错误
    console.warn(`[MCP:${serverKey}] initialize 请求失败（可能不需要）:`, err instanceof Error ? err.message : String(err));
  }
};

/**
 * 发现 MCP Server 提供的工具
 */
const discoverTools = async (serverKey: string, transportType: string, headers?: Record<string, string>): Promise<McpProtocolTool[]> => {
  const sendRequest = transportType === 'stdio'
    ? (method: string, params?: Record<string, unknown>) => sendStdioRequest(serverKey, method, params)
    : (method: string, params?: Record<string, unknown>) => sendSseRequest(serverKey, method, params, headers);

  const result = await sendRequest('tools/list') as { tools: McpProtocolTool[] };
  return result?.tools || [];
};

/**
 * 调用 MCP 工具
 */
const callMcpTool = async (serverKey: string, transportType: string, toolName: string, args: Record<string, unknown>, headers?: Record<string, string>): Promise<McpToolCallResult> => {
  const sendRequest = transportType === 'stdio'
    ? (method: string, params?: Record<string, unknown>) => sendStdioRequest(serverKey, method, params)
    : (method: string, params?: Record<string, unknown>) => sendSseRequest(serverKey, method, params, headers);

  const result = await sendRequest('tools/call', {
    name: toolName,
    arguments: args,
  }) as McpToolCallResult;

  return result;
};

// =============================================================================
// 公开 API
// =============================================================================

/**
 * 连接到 MCP Server 并发现工具
 * 完整流程：建立连接 → initialize → tools/list → 保存工具到数据库
 */
export const connectMcpServer = async (serverKey: string): Promise<{ tools: IMcpTool[]; status: string }> => {
  const server = await McpServer.findOne({ key: serverKey });
  if (!server) {
    throw new Error(`MCP Server "${serverKey}" 不存在`);
  }

  try {
    // 1. 建立传输连接
    if (server.transportType === 'stdio') {
      if (!server.stdioConfig?.command) {
        throw new Error('stdio 配置缺少 command');
      }
      await connectStdio(
        serverKey,
        server.stdioConfig.command,
        server.stdioConfig.args || [],
        server.stdioConfig.env,
        server.stdioConfig.cwd
      );
    } else if (server.transportType === 'sse') {
      if (!server.sseConfig?.url) {
        throw new Error('SSE 配置缺少 url');
      }
      await connectSse(serverKey, server.sseConfig.url, server.sseConfig.headers);
    }

    // 2. 初始化协议
    await initializeConnection(serverKey, server.transportType, server.sseConfig?.headers);

    // 3. 发现工具
    const protocolTools = await discoverTools(serverKey, server.transportType, server.sseConfig?.headers);

    // 4. 转换为内部格式
    const tools: IMcpTool[] = protocolTools.map((pt) => ({
      name: pt.name,
      description: pt.description || '',
      parameters: Object.entries(pt.inputSchema?.properties || {}).map(([name, schema]: [string, any]) => ({
        name,
        type: schema.type || 'string',
        description: schema.description || '',
        required: (pt.inputSchema?.required || []).includes(name),
        ...(schema.enum ? { enum: schema.enum } : {}),
      })),
      inputSchema: pt.inputSchema || {},
    }));

    // 5. 更新数据库
    server.tools = tools;
    server.status = 'connected';
    server.lastConnectedAt = new Date();
    server.lastError = undefined;
    await server.save();

    console.log(`[MCP] ✅ 已连接 "${server.name}"，发现 ${tools.length} 个工具`);
    return { tools, status: 'connected' };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    server.status = 'error';
    server.lastError = errMsg;
    await server.save();

    console.error(`[MCP] ❌ 连接 "${server.name}" 失败:`, errMsg);
    throw err;
  }
};

/**
 * 断开 MCP Server 连接
 */
export const disconnectMcpServer = async (serverKey: string): Promise<void> => {
  disconnectStdio(serverKey);
  activeSseConnections.delete(serverKey);

  await McpServer.updateOne(
    { key: serverKey },
    { status: 'disconnected' }
  );

  console.log(`[MCP] 已断开 "${serverKey}"`);
};

/**
 * 执行 MCP 工具调用
 * 自动查找工具所属的 MCP Server 并调用
 */
export const executeMcpTool = async (toolName: string, args: Record<string, unknown>): Promise<ToolCallResult> => {
  // 查找包含该工具的 MCP Server
  const server = await McpServer.findOne({
    isActive: true,
    'tools.name': toolName,
  });

  if (!server) {
    return {
      toolName,
      success: false,
      error: `未找到提供工具 "${toolName}" 的 MCP Server`,
    };
  }

  // 检查连接状态，如果未连接则尝试重连
  const isStdioConnected = server.transportType === 'stdio' && activeProcesses.has(server.key);
  const isSseConnected = server.transportType === 'sse' && activeSseConnections.has(server.key);

  if (!isStdioConnected && !isSseConnected) {
    try {
      await connectMcpServer(server.key);
    } catch (err: unknown) {
      return {
        toolName,
        success: false,
        error: `MCP Server "${server.name}" 连接失败: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  try {
    const result = await callMcpTool(
      server.key,
      server.transportType,
      toolName,
      args,
      server.sseConfig?.headers
    );

    // 提取文本内容
    const textContent = result.content
      ?.filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n') || '';

    if (result.isError) {
      return { toolName, success: false, error: textContent || '工具调用失败' };
    }

    // 尝试解析 JSON
    let data: unknown = textContent;
    try {
      data = JSON.parse(textContent);
    } catch {
      // 保持原始文本
    }

    // 对超长文本内容做智能截取，避免占满 LLM 上下文 token
    const MAX_TOOL_CONTENT_LENGTH = 8000;
    if (typeof data === 'string' && data.length > MAX_TOOL_CONTENT_LENGTH) {
      const truncated = data.slice(0, MAX_TOOL_CONTENT_LENGTH);
      // 尝试在最后一个完整段落处截断，避免截断在句子中间
      const lastParagraph = truncated.lastIndexOf('\n\n');
      const lastNewline = truncated.lastIndexOf('\n');
      const cutPoint = lastParagraph > MAX_TOOL_CONTENT_LENGTH * 0.7
        ? lastParagraph
        : lastNewline > MAX_TOOL_CONTENT_LENGTH * 0.8
          ? lastNewline
          : MAX_TOOL_CONTENT_LENGTH;
      data = truncated.slice(0, cutPoint) + `\n\n[内容已截取前 ${cutPoint} 字符，原始内容共 ${(data as string).length} 字符]`;
      console.log(`[MCP:${toolName}] 返回内容过长(${(textContent).length}字符)，已截取至 ${cutPoint} 字符`);
    }

    return { toolName, success: true, data };
  } catch (err: unknown) {
    return {
      toolName,
      success: false,
      error: `MCP 工具调用失败: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

/**
 * 获取所有已启用 MCP Server 的工具，转换为 OpenAI Function Calling 格式
 * 用于与现有的 AGENT_TOOLS 合并
 */
export const getMcpToolDefinitions = async (): Promise<ToolDefinition[]> => {
  const servers = await McpServer.find({ isActive: true, status: 'connected' }).lean();

  const tools: ToolDefinition[] = [];

  for (const server of servers) {
    for (const tool of server.tools || []) {
      // 将 MCP 工具转换为 OpenAI Function Calling 格式
      const properties: Record<string, any> = {};
      const required: string[] = [];

      if (tool.inputSchema && typeof tool.inputSchema === 'object') {
        // 直接使用原始 inputSchema
        const schema = tool.inputSchema as any;
        if (schema.properties) {
          Object.assign(properties, schema.properties);
        }
        if (Array.isArray(schema.required)) {
          required.push(...schema.required);
        }
      } else {
        // 从 parameters 数组构建
        for (const param of tool.parameters || []) {
          properties[param.name] = {
            type: param.type,
            description: param.description,
            ...(param.enum ? { enum: param.enum } : {}),
          };
          if (param.required) {
            required.push(param.name);
          }
        }
      }

      // 增强 MCP 工具描述，引导 LLM 正确传参
      let enhancedDescription = `[MCP:${server.name}] ${tool.description}`;
      if (tool.name === 'fetch') {
        enhancedDescription += '\n\n使用建议：抓取网页时建议设置 max_length=5000 获取足够内容。如果需要获取更多内容，可以通过 start_index 参数分页获取。对于新闻、文章类页面，建议不要设置 raw=true 以获得更易读的 Markdown 格式。';
      }

      tools.push({
        type: 'function',
        function: {
          name: `mcp_${server.key}_${tool.name}`,
          description: enhancedDescription,
          parameters: {
            type: 'object',
            properties,
            required,
          },
        },
      });
    }
  }

  return tools;
};

/**
 * 判断工具名是否为 MCP 工具，并解析出 serverKey 和 toolName
 */
export const parseMcpToolName = (fullName: string): { isMcp: boolean; serverKey?: string; toolName?: string } => {
  const match = fullName.match(/^mcp_([^_]+)_(.+)$/);
  if (!match) return { isMcp: false };
  return { isMcp: true, serverKey: match[1], toolName: match[2] };
};

/**
 * 获取所有 MCP Server 的连接状态
 */
export const getMcpServerStatuses = (): Map<string, boolean> => {
  const statuses = new Map<string, boolean>();
  for (const [key] of activeProcesses) {
    statuses.set(key, true);
  }
  for (const [key] of activeSseConnections) {
    statuses.set(key, true);
  }
  return statuses;
};

/**
 * 断开所有 MCP 连接（用于服务关闭时清理）
 */
export const disconnectAllMcpServers = (): void => {
  for (const [key] of activeProcesses) {
    disconnectStdio(key);
  }
  activeSseConnections.clear();
  console.log('[MCP] 所有连接已断开');
};
