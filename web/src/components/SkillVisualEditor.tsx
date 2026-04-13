/**
 * @file components/SkillVisualEditor.tsx
 * @description Skill 可视化拖拽编排器 — 通过拖拽节点创建/编辑 Skill 步骤流程
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import {
  Card, Button, Tag, Space, Input, Select, Tooltip, Drawer, Form, message,
  Typography, Popconfirm,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ArrowDownOutlined, SettingOutlined,
  ThunderboltOutlined, MessageOutlined, BranchesOutlined, CodeOutlined,
  AppstoreOutlined, NodeIndexOutlined, DragOutlined, SaveOutlined,
  CloseOutlined, EditOutlined,
} from '@ant-design/icons';
import type { SkillStep, SkillStepType } from '../types';

const { Text } = Typography;
const { TextArea } = Input;

// ─── 步骤类型配置 ────────────────────────────────────────────────────────────

interface StepTypeConfig {
  icon: typeof ThunderboltOutlined;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

const STEP_TYPES: Record<SkillStepType, StepTypeConfig> = {
  tool:      { icon: SettingOutlined,     label: '工具调用',   color: '#0284c7', bgColor: '#f0f9ff', borderColor: '#bae6fd', description: '调用内置工具或 MCP 工具' },
  llm:       { icon: MessageOutlined,     label: 'LLM 调用',  color: '#7c3aed', bgColor: '#f5f3ff', borderColor: '#c4b5fd', description: '调用大语言模型生成内容' },
  condition: { icon: BranchesOutlined,    label: '条件分支',   color: '#d97706', bgColor: '#fffbeb', borderColor: '#fcd34d', description: '根据条件选择不同执行路径' },
  transform: { icon: CodeOutlined,        label: '数据转换',   color: '#059669', bgColor: '#ecfdf5', borderColor: '#6ee7b7', description: '使用 JS 表达式转换数据' },
  parallel:  { icon: AppstoreOutlined,    label: '并行执行',   color: '#e11d48', bgColor: '#fff1f2', borderColor: '#fda4af', description: '同时执行多个子步骤' },
  sub_skill: { icon: NodeIndexOutlined,   label: '嵌套 Skill', color: '#4f46e5', bgColor: '#eef2ff', borderColor: '#a5b4fc', description: '调用另一个 Skill' },
};

// ─── 可拖拽的步骤类型面板 ────────────────────────────────────────────────────

interface StepPaletteProps {
  onAdd: (type: SkillStepType) => void;
}

const StepPalette = ({ onAdd }: StepPaletteProps) => (
  <div className="space-y-2">
    <Text strong className="text-xs text-slate-500 block mb-2">
      <DragOutlined className="mr-1" />
      点击添加步骤
    </Text>
    <div className="grid grid-cols-2 gap-2">
      {(Object.entries(STEP_TYPES) as [SkillStepType, StepTypeConfig][]).map(([type, config]) => {
        const Icon = config.icon;
        return (
          <button
            key={type}
            className="flex items-center gap-2 p-2.5 rounded-lg border-2 border-dashed transition-all duration-200 hover:shadow-md cursor-pointer text-left"
            style={{ borderColor: config.borderColor, backgroundColor: config.bgColor }}
            onClick={() => onAdd(type)}
            aria-label={`添加${config.label}步骤`}
            tabIndex={0}
          >
            <Icon style={{ color: config.color, fontSize: 16 }} />
            <div>
              <div className="text-xs font-medium" style={{ color: config.color }}>{config.label}</div>
              <div className="text-[10px] text-slate-400 leading-tight">{config.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

// ─── 单个步骤节点 ────────────────────────────────────────────────────────────

interface StepNodeProps {
  step: SkillStep;
  index: number;
  total: number;
  onEdit: (step: SkillStep) => void;
  onDelete: (stepId: string) => void;
  onMoveUp: (stepId: string) => void;
  onMoveDown: (stepId: string) => void;
}

const StepNode = ({ step, index, total, onEdit, onDelete, onMoveUp, onMoveDown }: StepNodeProps) => {
  const config = STEP_TYPES[step.type] || STEP_TYPES.tool;
  const Icon = config.icon;

  return (
    <div className="relative">
      {/* 连接线 */}
      {index > 0 && (
        <div className="flex justify-center -mt-1 mb-1">
          <ArrowDownOutlined className="text-slate-300 text-xs" />
        </div>
      )}

      {/* 步骤卡片 */}
      <div
        className="rounded-xl border-2 p-3 transition-all duration-200 hover:shadow-lg cursor-pointer group"
        style={{ borderColor: config.borderColor, backgroundColor: config.bgColor }}
        onClick={() => onEdit(step)}
        role="button"
        aria-label={`编辑步骤: ${step.label}`}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') onEdit(step); }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${config.color}20` }}
            >
              <Icon style={{ color: config.color, fontSize: 16 }} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <Tag className="text-[10px] m-0" style={{ color: config.color, borderColor: config.borderColor }}>
                  #{index + 1}
                </Tag>
                <Text strong className="text-sm">{step.label || '未命名步骤'}</Text>
              </div>
              <Text className="text-[10px] text-slate-400">{config.label}</Text>
            </div>
          </div>

          {/* 操作按钮 */}
          <Space size={2} className="opacity-0 group-hover:opacity-100 transition-opacity">
            {index > 0 && (
              <Button
                type="text"
                size="small"
                icon={<ArrowDownOutlined className="rotate-180" />}
                onClick={(e) => { e.stopPropagation(); onMoveUp(step.id); }}
                aria-label="上移"
                tabIndex={0}
              />
            )}
            {index < total - 1 && (
              <Button
                type="text"
                size="small"
                icon={<ArrowDownOutlined />}
                onClick={(e) => { e.stopPropagation(); onMoveDown(step.id); }}
                aria-label="下移"
                tabIndex={0}
              />
            )}
            <Popconfirm
              title="确定删除此步骤？"
              onConfirm={() => onDelete(step.id)}
              okText="删除"
              cancelText="取消"
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => e.stopPropagation()}
                aria-label="删除步骤"
                tabIndex={0}
              />
            </Popconfirm>
          </Space>
        </div>

        {/* 步骤详情预览 */}
        <div className="mt-2 text-[10px] text-slate-500 space-y-0.5">
          {step.type === 'tool' && step.toolName && (
            <div>工具: <Text code className="text-[10px]">{step.toolName}</Text></div>
          )}
          {step.type === 'llm' && step.promptTemplate && (
            <div className="truncate">Prompt: {step.promptTemplate.slice(0, 60)}...</div>
          )}
          {step.type === 'condition' && step.condition && (
            <div>条件: <Text code className="text-[10px]">{step.condition}</Text></div>
          )}
          {step.type === 'transform' && step.transformExpr && (
            <div>表达式: <Text code className="text-[10px]">{step.transformExpr.slice(0, 40)}</Text></div>
          )}
          {step.type === 'sub_skill' && step.subSkillKey && (
            <div>子 Skill: <Text code className="text-[10px]">{step.subSkillKey}</Text></div>
          )}
          <div className="flex items-center gap-2 mt-1">
            <Tag className="text-[9px] m-0">输出: {step.outputKey}</Tag>
            {step.optional && <Tag color="orange" className="text-[9px] m-0">可选</Tag>}
            {step.timeout > 0 && <Tag className="text-[9px] m-0">超时: {step.timeout}s</Tag>}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── 步骤编辑抽屉 ────────────────────────────────────────────────────────────

interface StepEditDrawerProps {
  step: SkillStep | null;
  open: boolean;
  onClose: () => void;
  onSave: (step: SkillStep) => void;
}

const StepEditDrawer = ({ step, open, onClose, onSave }: StepEditDrawerProps) => {
  const [form] = Form.useForm();

  const handleSave = useCallback(() => {
    const values = form.getFieldsValue();
    if (!step) return;
    onSave({
      ...step,
      ...values,
      timeout: Number(values.timeout) || 30,
      retryCount: Number(values.retryCount) || 0,
    });
    onClose();
  }, [step, form, onSave, onClose]);

  if (!step) return null;

  return (
    <Drawer
      title={
        <div className="flex items-center gap-2">
          <EditOutlined />
          <span>编辑步骤: {step.label || '未命名'}</span>
        </div>
      }
      open={open}
      onClose={onClose}
      width={480}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>保存</Button>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        size="small"
        initialValues={step}
      >
        <Form.Item name="label" label="步骤名称" rules={[{ required: true }]}>
          <Input placeholder="如: 抓取网页内容" />
        </Form.Item>

        <Form.Item name="outputKey" label="输出变量名" rules={[{ required: true }]}>
          <Input placeholder="如: fetchResult" />
        </Form.Item>

        {step.type === 'tool' && (
          <Form.Item name="toolName" label="工具名称">
            <Input placeholder="如: search_knowledge" />
          </Form.Item>
        )}

        {step.type === 'llm' && (
          <Form.Item name="promptTemplate" label="Prompt 模板">
            <TextArea rows={4} placeholder="使用 {{变量名}} 引用上一步输出" />
          </Form.Item>
        )}

        {step.type === 'condition' && (
          <>
            <Form.Item name="condition" label="条件表达式">
              <Input placeholder="如: {{language}} === 'zh'" />
            </Form.Item>
            <Form.Item name="ifTrue" label="条件为真时跳转">
              <Input placeholder="步骤 ID" />
            </Form.Item>
            <Form.Item name="ifFalse" label="条件为假时跳转">
              <Input placeholder="步骤 ID" />
            </Form.Item>
          </>
        )}

        {step.type === 'transform' && (
          <Form.Item name="transformExpr" label="转换表达式 (JS)">
            <TextArea rows={3} placeholder="如: JSON.parse({{input}}).data" />
          </Form.Item>
        )}

        {step.type === 'sub_skill' && (
          <Form.Item name="subSkillKey" label="子 Skill Key">
            <Input placeholder="如: web_research" />
          </Form.Item>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Form.Item name="timeout" label="超时(秒)">
            <Input type="number" placeholder="30" />
          </Form.Item>
          <Form.Item name="retryCount" label="重试次数">
            <Input type="number" placeholder="0" />
          </Form.Item>
        </div>

        <Form.Item name="optional" valuePropName="checked" label="">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="rounded" />
            <span className="text-xs text-slate-600">此步骤可选（失败不影响整体执行）</span>
          </label>
        </Form.Item>
      </Form>
    </Drawer>
  );
};

// ─── 主编排器组件 ────────────────────────────────────────────────────────────

interface SkillVisualEditorProps {
  steps: SkillStep[];
  onChange: (steps: SkillStep[]) => void;
  className?: string;
}

const SkillVisualEditor = ({ steps, onChange, className = '' }: SkillVisualEditorProps) => {
  const [editingStep, setEditingStep] = useState<SkillStep | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const nextIdRef = useRef(steps.length + 1);

  // 添加新步骤
  const handleAddStep = useCallback((type: SkillStepType) => {
    const id = `step_${nextIdRef.current++}`;
    const config = STEP_TYPES[type];
    const newStep: SkillStep = {
      id,
      type,
      label: `${config.label} ${steps.length + 1}`,
      outputKey: `output_${steps.length + 1}`,
      optional: false,
      timeout: 30,
      retryCount: 0,
    };
    onChange([...steps, newStep]);
    message.success(`已添加 ${config.label} 步骤`);
  }, [steps, onChange]);

  // 编辑步骤
  const handleEditStep = useCallback((step: SkillStep) => {
    setEditingStep(step);
    setDrawerOpen(true);
  }, []);

  // 保存步骤编辑
  const handleSaveStep = useCallback((updatedStep: SkillStep) => {
    onChange(steps.map((s) => s.id === updatedStep.id ? updatedStep : s));
    message.success('步骤已更新');
  }, [steps, onChange]);

  // 删除步骤
  const handleDeleteStep = useCallback((stepId: string) => {
    onChange(steps.filter((s) => s.id !== stepId));
    message.success('步骤已删除');
  }, [steps, onChange]);

  // 上移步骤
  const handleMoveUp = useCallback((stepId: string) => {
    const idx = steps.findIndex((s) => s.id === stepId);
    if (idx <= 0) return;
    const newSteps = [...steps];
    [newSteps[idx - 1], newSteps[idx]] = [newSteps[idx], newSteps[idx - 1]];
    onChange(newSteps);
  }, [steps, onChange]);

  // 下移步骤
  const handleMoveDown = useCallback((stepId: string) => {
    const idx = steps.findIndex((s) => s.id === stepId);
    if (idx < 0 || idx >= steps.length - 1) return;
    const newSteps = [...steps];
    [newSteps[idx], newSteps[idx + 1]] = [newSteps[idx + 1], newSteps[idx]];
    onChange(newSteps);
  }, [steps, onChange]);

  return (
    <div className={`flex gap-4 ${className}`}>
      {/* 左侧：步骤类型面板 */}
      <div className="w-56 flex-shrink-0">
        <StepPalette onAdd={handleAddStep} />
      </div>

      {/* 右侧：步骤流程画布 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3">
          <Text strong className="text-sm">
            <ThunderboltOutlined className="mr-1 text-amber-500" />
            执行流程 ({steps.length} 步)
          </Text>
        </div>

        {steps.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
            <PlusOutlined className="text-2xl text-slate-300 mb-2" />
            <div className="text-sm text-slate-400">从左侧面板点击添加步骤</div>
            <div className="text-[10px] text-slate-300 mt-1">步骤将按顺序执行</div>
          </div>
        ) : (
          <div className="space-y-1 max-h-[500px] overflow-y-auto pr-2">
            {steps.map((step, index) => (
              <StepNode
                key={step.id}
                step={step}
                index={index}
                total={steps.length}
                onEdit={handleEditStep}
                onDelete={handleDeleteStep}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
              />
            ))}
          </div>
        )}
      </div>

      {/* 步骤编辑抽屉 */}
      <StepEditDrawer
        step={editingStep}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditingStep(null); }}
        onSave={handleSaveStep}
      />
    </div>
  );
};

export default SkillVisualEditor;
