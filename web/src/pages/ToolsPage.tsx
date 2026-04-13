/**
 * @file pages/ToolsPage.tsx
 * @description Tool 管理页面 — 查看/测试内置工具和 MCP 工具
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card, Tag, Button, Input, Drawer, Form, Space, Spin, Empty,
  Tabs, Badge, Tooltip, message, Typography, Collapse, Descriptions,
} from 'antd';
import {
  ToolOutlined, SearchOutlined, PlayCircleOutlined, ApiOutlined,
  CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined,
  ThunderboltOutlined, ReloadOutlined, CodeOutlined,
} from '@ant-design/icons';
import { fetchAgentTools, callAgentTool } from '../api';
import type { ToolDefinition } from '../types';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

// ─── 工具卡片组件 ────────────────────────────────────────────────────────────

interface ToolCardProps {
  tool: ToolDefinition;
  onTest: (tool: ToolDefinition) => void;
}

const ToolCard = ({ tool, onTest }: ToolCardProps) => {
  const requiredParams = tool.parameters.required || [];
  const paramCount = Object.keys(tool.parameters.properties || {}).length;

  return (
    <Card
      hoverable
      className="border border-slate-200 hover:border-sky-300 transition-all duration-200"
      bodyStyle={{ padding: 16 }}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0">
          <ToolOutlined className="text-sky-500 text-lg" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Text strong className="text-sm truncate">{tool.name}</Text>
            <Tag color="blue" className="text-[10px]">内置</Tag>
          </div>
          <Paragraph
            className="text-xs text-slate-500 mb-2"
            ellipsis={{ rows: 2 }}
          >
            {tool.description}
          </Paragraph>
          <div className="flex items-center justify-between">
            <Space size={4}>
              <Tag className="text-[10px]">
                {paramCount} 个参数
              </Tag>
              {requiredParams.length > 0 && (
                <Tag color="orange" className="text-[10px]">
                  {requiredParams.length} 个必填
                </Tag>
              )}
            </Space>
            <Button
              type="primary"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => onTest(tool)}
              className="text-xs"
              aria-label={`测试工具 ${tool.name}`}
              tabIndex={0}
            >
              测试
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

// ─── 工具测试抽屉 ────────────────────────────────────────────────────────────

interface ToolTestDrawerProps {
  tool: ToolDefinition | null;
  open: boolean;
  onClose: () => void;
}

const ToolTestDrawer = ({ tool, open, onClose }: ToolTestDrawerProps) => {
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; data?: unknown; error?: string } | null>(null);

  useEffect(() => {
    if (open) {
      form.resetFields();
      setResult(null);
    }
  }, [open, form]);

  const handleTest = useCallback(async () => {
    if (!tool) return;
    setTesting(true);
    setResult(null);

    try {
      const values = form.getFieldsValue();
      // 构建参数对象，过滤空值
      const args: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(values)) {
        if (value !== undefined && value !== '' && value !== null) {
          // 尝试解析 JSON（用于 object/array 类型）
          const paramDef = tool.parameters.properties[key];
          if (paramDef?.type === 'number') {
            args[key] = Number(value);
          } else if (paramDef?.type === 'boolean') {
            args[key] = value === 'true' || value === true;
          } else {
            args[key] = value;
          }
        }
      }

      const res = await callAgentTool(tool.name, args);
      setResult(res);
      if (res.success) {
        message.success('工具调用成功');
      } else {
        message.error(res.error || '工具调用失败');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : '调用失败';
      setResult({ success: false, error: errMsg });
      message.error(errMsg);
    } finally {
      setTesting(false);
    }
  }, [tool, form]);

  if (!tool) return null;

  const properties = tool.parameters.properties || {};
  const requiredParams = tool.parameters.required || [];

  return (
    <Drawer
      title={
        <div className="flex items-center gap-2">
          <ToolOutlined className="text-sky-500" />
          <span>测试工具: {tool.name}</span>
        </div>
      }
      open={open}
      onClose={onClose}
      width={560}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>关闭</Button>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={testing}
            onClick={handleTest}
            aria-label="执行测试"
            tabIndex={0}
          >
            执行测试
          </Button>
        </div>
      }
    >
      {/* 工具描述 */}
      <div className="mb-4 p-3 bg-slate-50 rounded-lg">
        <Text className="text-xs text-slate-600">{tool.description}</Text>
      </div>

      {/* 参数表单 */}
      <div className="mb-4">
        <Text strong className="text-sm mb-2 block">
          <CodeOutlined className="mr-1" />
          输入参数
        </Text>
        <Form form={form} layout="vertical" size="small">
          {Object.entries(properties).map(([key, param]) => (
            <Form.Item
              key={key}
              name={key}
              label={
                <span className="text-xs">
                  {key}
                  {requiredParams.includes(key) && <span className="text-red-500 ml-1">*</span>}
                  <span className="text-slate-400 ml-2">({param.type})</span>
                </span>
              }
              tooltip={param.description}
              rules={requiredParams.includes(key) ? [{ required: true, message: `请输入 ${key}` }] : []}
            >
              {param.enum ? (
                <select
                  className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm"
                  aria-label={key}
                >
                  <option value="">请选择</option>
                  {param.enum.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              ) : param.type === 'boolean' ? (
                <select
                  className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm"
                  aria-label={key}
                >
                  <option value="">默认</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <Input placeholder={param.description} />
              )}
            </Form.Item>
          ))}
          {Object.keys(properties).length === 0 && (
            <div className="text-center py-4 text-slate-400 text-xs">
              此工具无需参数
            </div>
          )}
        </Form>
      </div>

      {/* 执行结果 */}
      {result && (
        <div className="mt-4">
          <Text strong className="text-sm mb-2 block">
            {result.success ? (
              <CheckCircleOutlined className="text-green-500 mr-1" />
            ) : (
              <CloseCircleOutlined className="text-red-500 mr-1" />
            )}
            执行结果
          </Text>
          <div className={`p-3 rounded-lg border text-xs font-mono overflow-auto max-h-[400px] ${
            result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <pre className="whitespace-pre-wrap break-words">
              {result.success
                ? JSON.stringify(result.data, null, 2)
                : result.error
              }
            </pre>
          </div>
        </div>
      )}
    </Drawer>
  );
};

// ─── 主页面 ──────────────────────────────────────────────────────────────────

/** 可内嵌的 Tool 面板（供 SkillOrchestratorPage 使用） */
export const ToolsPanel = () => {
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [testTool, setTestTool] = useState<ToolDefinition | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadTools = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAgentTools();
      setTools(data.tools);
    } catch {
      message.error('加载工具列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTools(); }, [loadTools]);

  const handleTest = (tool: ToolDefinition) => {
    setTestTool(tool);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setTestTool(null);
  };

  // 搜索过滤
  const filteredTools = tools.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
  });

  // 按功能分组
  const toolGroups = [
    { key: 'agent', label: 'Agent 相关', icon: '🤖', tools: filteredTools.filter(t => ['find_agent', 'get_agent_workflow', 'list_categories'].includes(t.name)) },
    { key: 'page', label: '页面相关', icon: '📄', tools: filteredTools.filter(t => ['list_pages', 'get_page_structure', 'get_template_code'].includes(t.name)) },
    { key: 'knowledge', label: '知识库', icon: '📚', tools: filteredTools.filter(t => ['search_knowledge'].includes(t.name)) },
    { key: 'design', label: '设计规范', icon: '🎨', tools: filteredTools.filter(t => ['get_design_spec'].includes(t.name)) },
  ];

  // 未分组的工具
  const groupedNames = new Set(toolGroups.flatMap(g => g.tools.map(t => t.name)));
  const ungrouped = filteredTools.filter(t => !groupedNames.has(t.name));
  if (ungrouped.length > 0) {
    toolGroups.push({ key: 'other', label: '其他工具', icon: '🔧', tools: ungrouped });
  }

  return (
    <div>

      {/* 搜索栏 */}
      <div className="mb-6">
        <Input
          prefix={<SearchOutlined className="text-slate-400" />}
          placeholder="搜索工具名称或描述..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          className="max-w-md"
          aria-label="搜索工具"
        />
      </div>

      {/* 概览统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card bodyStyle={{ padding: 16 }} className="border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
              <ToolOutlined className="text-sky-500" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-800">{tools.length}</div>
              <div className="text-[10px] text-slate-400">内置工具</div>
            </div>
          </div>
        </Card>
        <Card bodyStyle={{ padding: 16 }} className="border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
              <ApiOutlined className="text-violet-500" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-800">
                {tools.reduce((acc, t) => acc + Object.keys(t.parameters.properties || {}).length, 0)}
              </div>
              <div className="text-[10px] text-slate-400">总参数数</div>
            </div>
          </div>
        </Card>
        <Card bodyStyle={{ padding: 16 }} className="border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <ThunderboltOutlined className="text-amber-500" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-800">
                {tools.reduce((acc, t) => acc + (t.parameters.required?.length || 0), 0)}
              </div>
              <div className="text-[10px] text-slate-400">必填参数</div>
            </div>
          </div>
        </Card>
        <Card bodyStyle={{ padding: 16 }} className="border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircleOutlined className="text-emerald-500" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-800">{toolGroups.length}</div>
              <div className="text-[10px] text-slate-400">工具分组</div>
            </div>
          </div>
        </Card>
      </div>

      {/* 工具列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spin size="large" tip="加载工具列表..." />
        </div>
      ) : filteredTools.length === 0 ? (
        <Empty description="没有找到匹配的工具" />
      ) : (
        <div className="space-y-6">
          {toolGroups.filter(g => g.tools.length > 0).map((group) => (
            <div key={group.key}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">{group.icon}</span>
                <Text strong className="text-sm text-slate-700">{group.label}</Text>
                <Tag className="text-[10px]">{group.tools.length}</Tag>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.tools.map((tool) => (
                  <ToolCard key={tool.name} tool={tool} onTest={handleTest} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 测试抽屉 */}
      <ToolTestDrawer
        tool={testTool}
        open={drawerOpen}
        onClose={handleCloseDrawer}
      />
    </div>
  );
};

/** 独立页面（保留兼容，实际已合并到 Skill 能力中心） */
const ToolsPage = () => (
  <div className="p-6 max-w-7xl mx-auto">
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center">
        <ToolOutlined className="text-sky-600 text-xl" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-slate-800">Tool 工具管理</h1>
        <p className="text-xs text-slate-400">查看、测试所有内置工具和 MCP 工具</p>
      </div>
    </div>
    <ToolsPanel />
  </div>
);

export default ToolsPage;
