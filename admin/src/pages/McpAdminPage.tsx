/**
 * @file pages/McpAdminPage.tsx
 * @description MCP（Model Context Protocol）管理页面 — Admin 后台
 *
 * 功能：
 *   1. 查看所有已注册的 MCP Server 及其状态
 *   2. 添加新的 MCP Server（支持 stdio / SSE 两种传输方式）
 *   3. 连接/断开 MCP Server
 *   4. 查看 MCP Server 提供的工具列表
 *   5. 编辑/删除 MCP Server 配置
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, Tag, Space, Modal, Form, Input, Select, Switch,
  Badge, Empty, Spin, Collapse, Typography, Popconfirm, message,
  Descriptions, Alert,
} from 'antd';
import {
  PlusOutlined, LinkOutlined, DisconnectOutlined, DeleteOutlined,
  ReloadOutlined, ToolOutlined, ApiOutlined, CloudServerOutlined,
  DesktopOutlined, InfoCircleOutlined, ThunderboltOutlined, EditOutlined,
} from '@ant-design/icons';
import {
  fetchMcpServers, createMcpServer, updateMcpServer, deleteMcpServer,
  connectMcpServer, disconnectMcpServer, callMcpTool,
  type McpServerConfig, type McpTool,
} from '../api';

const { Text, Paragraph } = Typography;

// ─── 状态标签组件 ──────────────────────────────────────────────────────────────

const StatusBadge = ({ status, isConnected }: { status: string; isConnected: boolean }) => {
  if (isConnected && status === 'connected') {
    return <Badge status="success" text={<Text type="success">已连接</Text>} />;
  }
  if (status === 'error') {
    return <Badge status="error" text={<Text type="danger">错误</Text>} />;
  }
  return <Badge status="default" text={<Text type="secondary">未连接</Text>} />;
};

// ─── 传输类型标签 ──────────────────────────────────────────────────────────────

const TransportTag = ({ type }: { type: 'stdio' | 'sse' }) => {
  if (type === 'stdio') {
    return (
      <Tag icon={<DesktopOutlined />} color="blue">
        stdio（本地进程）
      </Tag>
    );
  }
  return (
    <Tag icon={<CloudServerOutlined />} color="green">
      SSE（远程服务）
    </Tag>
  );
};

// ─── 工具列表展示 ──────────────────────────────────────────────────────────────

const ToolList = ({ tools, onTestTool }: { tools: McpServerConfig['tools']; onTestTool?: (tool: McpTool) => void }) => {
  if (!tools || tools.length === 0) {
    return <Text type="secondary">暂无工具（请先连接 Server）</Text>;
  }

  return (
    <div className="space-y-2">
      {tools.map((tool) => (
        <div
          key={tool.name}
          className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200"
        >
          <ToolOutlined className="text-sky-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Text strong className="text-sm">{tool.name}</Text>
              <Tag color="default" className="text-xs">
                {tool.parameters?.length || 0} 个参数
              </Tag>
              {onTestTool && (
                <Button
                  type="link"
                  size="small"
                  icon={<ThunderboltOutlined />}
                  onClick={() => onTestTool(tool)}
                  className="text-xs p-0 h-auto"
                >
                  测试
                </Button>
              )}
            </div>
            <Paragraph
              type="secondary"
              className="text-xs mb-0 mt-1"
              ellipsis={{ rows: 2 }}
            >
              {tool.description || '无描述'}
            </Paragraph>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── MCP 工具测试弹窗 ─────────────────────────────────────────────────────────

interface ToolTestModalProps {
  open: boolean;
  tool: McpTool | null;
  onClose: () => void;
}

const ToolTestModal = ({ open, tool, onClose }: ToolTestModalProps) => {
  const [argsJson, setArgsJson] = useState('{}');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; data?: unknown; error?: string } | null>(null);

  useEffect(() => {
    if (open && tool) {
      // 根据工具参数生成默认 JSON 模板
      const schema = tool.inputSchema as Record<string, unknown> | undefined;
      const properties = (schema?.properties || {}) as Record<string, { type?: string; description?: string }>;
      const template: Record<string, string> = {};
      for (const [key, val] of Object.entries(properties)) {
        template[key] = val.description ? `<${val.description}>` : '';
      }
      setArgsJson(JSON.stringify(template, null, 2));
      setResult(null);
    }
  }, [open, tool]);

  const handleExecute = async () => {
    if (!tool) return;
    setLoading(true);
    setResult(null);
    try {
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(argsJson);
        // 清理模板占位符
        for (const [key, val] of Object.entries(parsedArgs)) {
          if (typeof val === 'string' && val.startsWith('<') && val.endsWith('>')) {
            delete parsedArgs[key];
          }
        }
      } catch {
        message.error('参数 JSON 格式不正确');
        setLoading(false);
        return;
      }
      const res = await callMcpTool(tool.name, parsedArgs);
      setResult(res);
    } catch (err: unknown) {
      setResult({ success: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <ThunderboltOutlined className="text-amber-500" />
          <span>测试工具：{tool?.name}</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={700}
      destroyOnClose
    >
      {tool && (
        <div className="space-y-4 mt-4">
          {/* 工具描述 */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <Text type="secondary" className="text-sm">{tool.description || '无描述'}</Text>
          </div>

          {/* 参数输入 */}
          <div>
            <Text strong className="text-sm block mb-2">请求参数（JSON）</Text>
            <Input.TextArea
              value={argsJson}
              onChange={(e) => setArgsJson(e.target.value)}
              rows={8}
              className="font-mono text-xs"
              placeholder='{"key": "value"}'
            />
          </div>

          {/* 执行按钮 */}
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={loading}
            onClick={handleExecute}
            block
          >
            执行工具调用
          </Button>

          {/* 结果展示 */}
          {result && (
            <div className="space-y-2">
              <Text strong className="text-sm block">
                执行结果
                {result.success
                  ? <Tag color="success" className="ml-2">成功</Tag>
                  : <Tag color="error" className="ml-2">失败</Tag>
                }
              </Text>
              <pre className="p-4 rounded-lg bg-slate-900 text-green-400 text-xs overflow-auto max-h-80 whitespace-pre-wrap">
                {result.error
                  ? result.error
                  : JSON.stringify(result, null, 2)
                }
              </pre>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

// ─── 添加/编辑 MCP Server 弹窗 ────────────────────────────────────────────────

interface ServerFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingServer?: McpServerConfig | null;
}

const ServerFormModal = ({ open, onClose, onSuccess, editingServer }: ServerFormProps) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [transportType, setTransportType] = useState<'stdio' | 'sse'>('sse');

  useEffect(() => {
    if (open) {
      if (editingServer) {
        form.setFieldsValue({
          key: editingServer.key,
          name: editingServer.name,
          description: editingServer.description,
          icon: editingServer.icon,
          transportType: editingServer.transportType,
          stdioCommand: editingServer.stdioConfig?.command,
          stdioArgs: editingServer.stdioConfig?.args?.join(' '),
          stdioCwd: editingServer.stdioConfig?.cwd,
          sseUrl: editingServer.sseConfig?.url,
        });
        setTransportType(editingServer.transportType);
      } else {
        form.resetFields();
        setTransportType('sse');
      }
    }
  }, [open, editingServer, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const body: Record<string, unknown> = {
        key: values.key,
        name: values.name,
        description: values.description || '',
        icon: values.icon || '🔌',
        transportType: values.transportType,
      };

      if (values.transportType === 'stdio') {
        body.stdioConfig = {
          command: values.stdioCommand,
          args: values.stdioArgs ? values.stdioArgs.split(/\s+/) : [],
          cwd: values.stdioCwd || undefined,
        };
      } else {
        body.sseConfig = {
          url: values.sseUrl,
        };
      }

      if (editingServer) {
        await updateMcpServer(editingServer.key, body as Parameters<typeof updateMcpServer>[1]);
        message.success('MCP Server 已更新');
      } else {
        await createMcpServer(body as Parameters<typeof createMcpServer>[0]);
        message.success('MCP Server 已创建');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(`操作失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={editingServer ? '编辑 MCP Server' : '添加 MCP Server'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={600}
      destroyOnClose
    >
      <Form form={form} layout="vertical" className="mt-4">
        <div className="grid grid-cols-2 gap-4">
          <Form.Item
            name="key"
            label="唯一标识（key）"
            rules={[
              { required: true, message: '请输入唯一标识' },
              { pattern: /^[a-z0-9_-]+$/, message: '只允许小写字母、数字、下划线和连字符' },
            ]}
          >
            <Input
              placeholder="如：filesystem、github"
              disabled={!!editingServer}
            />
          </Form.Item>

          <Form.Item
            name="name"
            label="显示名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="如：文件系统工具" />
          </Form.Item>
        </div>

        <Form.Item name="description" label="描述">
          <Input.TextArea rows={2} placeholder="描述此 MCP Server 的功能" />
        </Form.Item>

        <div className="grid grid-cols-2 gap-4">
          <Form.Item name="icon" label="图标（emoji）">
            <Input placeholder="🔌" maxLength={4} />
          </Form.Item>

          <Form.Item
            name="transportType"
            label="传输方式"
            rules={[{ required: true }]}
            initialValue="sse"
          >
            <Select
              onChange={(val) => setTransportType(val)}
              options={[
                { value: 'sse', label: '🌐 SSE（远程 HTTP 服务）' },
                { value: 'stdio', label: '💻 stdio（本地命令行进程）' },
              ]}
            />
          </Form.Item>
        </div>

        {/* stdio 配置 */}
        {transportType === 'stdio' && (
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 space-y-4">
            <Text type="secondary" className="text-xs">
              <InfoCircleOutlined className="mr-1" />
              stdio 模式：启动本地进程，通过 stdin/stdout 进行 JSON-RPC 通信
            </Text>
            <Form.Item
              name="stdioCommand"
              label="启动命令"
              rules={[{ required: transportType === 'stdio', message: '请输入启动命令' }]}
            >
              <Input placeholder="如：npx、python、node" />
            </Form.Item>
            <Form.Item name="stdioArgs" label="命令参数（空格分隔）">
              <Input placeholder="如：-m mcp_server 或 @modelcontextprotocol/server-filesystem /path" />
            </Form.Item>
            <Form.Item name="stdioCwd" label="工作目录（可选）">
              <Input placeholder="如：C:\projects\my-mcp-server" />
            </Form.Item>
          </div>
        )}

        {/* SSE 配置 */}
        {transportType === 'sse' && (
          <div className="p-4 rounded-lg bg-green-50 border border-green-200 space-y-4">
            <Text type="secondary" className="text-xs">
              <InfoCircleOutlined className="mr-1" />
              SSE 模式：连接远程 HTTP 服务，通过 Server-Sent Events 进行通信
            </Text>
            <Form.Item
              name="sseUrl"
              label="服务 URL"
              rules={[{ required: transportType === 'sse', message: '请输入服务 URL' }]}
            >
              <Input placeholder="如：http://localhost:3001/mcp" />
            </Form.Item>
          </div>
        )}
      </Form>
    </Modal>
  );
};

// ─── 主页面 ────────────────────────────────────────────────────────────────────

const McpAdminPage = () => {
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<McpServerConfig | null>(null);
  const [connectingKeys, setConnectingKeys] = useState<Set<string>>(new Set());
  const [testToolOpen, setTestToolOpen] = useState(false);
  const [testingTool, setTestingTool] = useState<McpTool | null>(null);

  // 加载 MCP Server 列表
  const loadServers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchMcpServers();
      setServers(data);
    } catch {
      message.error('加载 MCP Server 列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  // 连接 MCP Server
  const handleConnect = async (key: string) => {
    setConnectingKeys((prev) => new Set(prev).add(key));
    try {
      const result = await connectMcpServer(key);
      message.success(`已连接，发现 ${result.toolCount} 个工具`);
      await loadServers();
    } catch (err: unknown) {
      message.error(`连接失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setConnectingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // 断开 MCP Server
  const handleDisconnect = async (key: string) => {
    try {
      await disconnectMcpServer(key);
      message.success('已断开连接');
      await loadServers();
    } catch {
      message.error('断开连接失败');
    }
  };

  // 删除 MCP Server
  const handleDelete = async (key: string) => {
    try {
      await deleteMcpServer(key);
      message.success('已删除');
      await loadServers();
    } catch {
      message.error('删除失败');
    }
  };

  // 切换启用状态
  const handleToggleActive = async (server: McpServerConfig) => {
    try {
      await updateMcpServer(server.key, { isActive: !server.isActive });
      await loadServers();
    } catch {
      message.error('更新状态失败');
    }
  };

  // 编辑
  const handleEdit = (server: McpServerConfig) => {
    setEditingServer(server);
    setFormOpen(true);
  };

  // 统计
  const connectedCount = servers.filter((s) => s.isConnected && s.status === 'connected').length;
  const totalToolCount = servers.reduce((acc, s) => acc + (s.tools?.length || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <ApiOutlined className="text-sky-600" />
            MCP 管理
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Model Context Protocol — 管理外部工具服务，连接后自动合并到 AI 对话的 Tool Calling 系统
          </p>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadServers}
            loading={loading}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { setEditingServer(null); setFormOpen(true); }}
          >
            添加 MCP Server
          </Button>
        </Space>
      </div>

      {/* 概览统计 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card size="small" className="border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
              <CloudServerOutlined className="text-sky-600 text-lg" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">{servers.length}</div>
              <div className="text-xs text-slate-500">已注册 Server</div>
            </div>
          </div>
        </Card>
        <Card size="small" className="border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <LinkOutlined className="text-green-600 text-lg" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">{connectedCount}</div>
              <div className="text-xs text-slate-500">已连接</div>
            </div>
          </div>
        </Card>
        <Card size="small" className="border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <ToolOutlined className="text-amber-600 text-lg" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">{totalToolCount}</div>
              <div className="text-xs text-slate-500">可用工具</div>
            </div>
          </div>
        </Card>
      </div>

      {/* MCP 协议说明 */}
      <Alert
        type="info"
        showIcon
        icon={<ThunderboltOutlined />}
        message="MCP 工作原理"
        description={
          <span className="text-xs">
            MCP（Model Context Protocol）是一个开放标准协议，让 AI 模型能够安全地访问外部工具和数据源。
            在此页面注册并连接 MCP Server 后，其提供的工具会自动合并到前端用户对话的 Tool Calling 系统中，用户无需感知即可使用。
          </span>
        }
        className="border-sky-200 bg-sky-50"
      />

      {/* Server 列表 */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Spin size="large" tip="加载中..." />
        </div>
      ) : servers.length === 0 ? (
        <Card className="border-slate-200">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span className="text-slate-500">
                还没有注册任何 MCP Server，点击上方按钮添加
              </span>
            }
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => { setEditingServer(null); setFormOpen(true); }}
            >
              添加第一个 MCP Server
            </Button>
          </Empty>
        </Card>
      ) : (
        <Collapse
          accordion
          className="bg-white rounded-xl border border-slate-200"
          expandIconPosition="start"
        >
          {servers.map((server) => {
            const isConnecting = connectingKeys.has(server.key);
            const isConnected = server.isConnected && server.status === 'connected';

            return (
              <Collapse.Panel
                key={server.key}
                header={
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{server.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <Text strong>{server.name}</Text>
                          <Tag color="default" className="text-xs">{server.key}</Tag>
                          <TransportTag type={server.transportType} />
                        </div>
                        <Text type="secondary" className="text-xs">
                          {server.description || '无描述'}
                        </Text>
                      </div>
                    </div>
                    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                      <StatusBadge status={server.status} isConnected={server.isConnected} />
                      {server.tools?.length > 0 && (
                        <Tag color="purple" className="text-xs">
                          {server.tools.length} 个工具
                        </Tag>
                      )}
                      <Switch
                        size="small"
                        checked={server.isActive}
                        onChange={() => handleToggleActive(server)}
                        checkedChildren="启用"
                        unCheckedChildren="禁用"
                      />
                    </div>
                  </div>
                }
              >
                <div className="space-y-4">
                  {/* 连接信息 */}
                  <Descriptions size="small" column={2} bordered>
                    <Descriptions.Item label="传输方式">
                      <TransportTag type={server.transportType} />
                    </Descriptions.Item>
                    <Descriptions.Item label="状态">
                      <StatusBadge status={server.status} isConnected={server.isConnected} />
                    </Descriptions.Item>
                    {server.transportType === 'stdio' && server.stdioConfig && (
                      <Descriptions.Item label="命令" span={2}>
                        <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">
                          {server.stdioConfig.command} {server.stdioConfig.args?.join(' ')}
                        </code>
                      </Descriptions.Item>
                    )}
                    {server.transportType === 'sse' && server.sseConfig && (
                      <Descriptions.Item label="URL" span={2}>
                        <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">
                          {server.sseConfig.url}
                        </code>
                      </Descriptions.Item>
                    )}
                    {server.lastConnectedAt && (
                      <Descriptions.Item label="最后连接">
                        {new Date(server.lastConnectedAt).toLocaleString()}
                      </Descriptions.Item>
                    )}
                    {server.lastError && (
                      <Descriptions.Item label="最后错误" span={2}>
                        <Text type="danger" className="text-xs">{server.lastError}</Text>
                      </Descriptions.Item>
                    )}
                  </Descriptions>

                  {/* 工具列表 */}
                  <div>
                    <Text strong className="text-sm mb-2 block">
                      <ToolOutlined className="mr-1" />
                      工具列表（{server.tools?.length || 0}）
                    </Text>
                    <ToolList
                      tools={server.tools}
                      onTestTool={(tool) => {
                        setTestingTool(tool);
                        setTestToolOpen(true);
                      }}
                    />
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    {isConnected ? (
                      <Button
                        icon={<DisconnectOutlined />}
                        onClick={() => handleDisconnect(server.key)}
                        danger
                      >
                        断开连接
                      </Button>
                    ) : (
                      <Button
                        type="primary"
                        icon={<LinkOutlined />}
                        loading={isConnecting}
                        onClick={() => handleConnect(server.key)}
                      >
                        连接并发现工具
                      </Button>
                    )}
                    <Button
                      icon={<ReloadOutlined />}
                      loading={isConnecting}
                      onClick={() => handleConnect(server.key)}
                      disabled={!isConnected}
                    >
                      重新发现工具
                    </Button>
                    <Button
                      icon={<EditOutlined />}
                      onClick={() => handleEdit(server)}
                    >
                      编辑配置
                    </Button>
                    <Popconfirm
                      title="确定删除此 MCP Server？"
                      description="删除后将断开连接并移除所有配置"
                      onConfirm={() => handleDelete(server.key)}
                      okText="删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                    >
                      <Button danger icon={<DeleteOutlined />}>
                        删除
                      </Button>
                    </Popconfirm>
                  </div>
                </div>
              </Collapse.Panel>
            );
          })}
        </Collapse>
      )}

      {/* 添加/编辑弹窗 */}
      <ServerFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingServer(null); }}
        onSuccess={loadServers}
        editingServer={editingServer}
      />

      {/* MCP 工具测试弹窗 */}
      <ToolTestModal
        open={testToolOpen}
        tool={testingTool}
        onClose={() => { setTestToolOpen(false); setTestingTool(null); }}
      />
    </div>
  );
};

export default McpAdminPage;
