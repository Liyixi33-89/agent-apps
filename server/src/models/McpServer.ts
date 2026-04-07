/**
 * @file models/McpServer.ts
 * @description MCP Server 配置模型 — 存储 MCP Server 连接信息和工具定义
 *
 * MCP（Model Context Protocol）是一个标准化协议，定义了 LLM 与外部工具/资源之间的通信规范。
 * 本模型存储已注册的 MCP Server 配置，支持 stdio 和 SSE 两种传输方式。
 */

import mongoose, { Document, Schema } from 'mongoose';

/** MCP 工具参数定义 */
export interface IMcpToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  enum?: string[];
}

/** MCP 工具定义（从 MCP Server 发现的工具） */
export interface IMcpTool {
  name: string;
  description: string;
  parameters: IMcpToolParameter[];
  /** 工具的 JSON Schema（原始格式，用于传递给 LLM） */
  inputSchema: Record<string, unknown>;
}

/** MCP Server 传输类型 */
export type McpTransportType = 'stdio' | 'sse';

/** MCP Server 状态 */
export type McpServerStatus = 'connected' | 'disconnected' | 'error';

/** MCP Server 配置 */
export interface IMcpServer extends Document {
  /** 唯一标识符 */
  key: string;
  /** 显示名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 图标（emoji） */
  icon: string;
  /** 传输类型 */
  transportType: McpTransportType;
  /** stdio 配置：命令和参数 */
  stdioConfig?: {
    command: string;
    args: string[];
    env?: Record<string, string>;
    cwd?: string;
  };
  /** SSE 配置：远程 URL */
  sseConfig?: {
    url: string;
    headers?: Record<string, string>;
  };
  /** 从 MCP Server 发现的工具列表 */
  tools: IMcpTool[];
  /** 当前状态 */
  status: McpServerStatus;
  /** 最后一次连接时间 */
  lastConnectedAt?: Date;
  /** 最后一次错误信息 */
  lastError?: string;
  /** 是否启用 */
  isActive: boolean;
  /** 排序权重 */
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const mcpToolParameterSchema = new Schema<IMcpToolParameter>(
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
    description: { type: String, default: '' },
    required: { type: Boolean, default: false },
    enum: { type: [String], default: undefined },
  },
  { _id: false }
);

const mcpToolSchema = new Schema<IMcpTool>(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    parameters: { type: [mcpToolParameterSchema], default: [] },
    inputSchema: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const mcpServerSchema = new Schema<IMcpServer>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    icon: { type: String, default: '🔌' },
    transportType: { type: String, enum: ['stdio', 'sse'], required: true },
    stdioConfig: {
      command: { type: String },
      args: { type: [String], default: [] },
      env: { type: Schema.Types.Mixed },
      cwd: { type: String },
    },
    sseConfig: {
      url: { type: String },
      headers: { type: Schema.Types.Mixed },
    },
    tools: { type: [mcpToolSchema], default: [] },
    status: { type: String, enum: ['connected', 'disconnected', 'error'], default: 'disconnected' },
    lastConnectedAt: { type: Date },
    lastError: { type: String },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const McpServer = mongoose.models.McpServer || mongoose.model<IMcpServer>('McpServer', mcpServerSchema);
