import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Modal, Form, Alert, Tag, Space, Typography,
  Switch, Tooltip, Avatar, Popconfirm, App,
} from 'antd';
import {
  RobotOutlined, SearchOutlined, DeleteOutlined, EditOutlined,
  DownloadOutlined, TranslationOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { fetchAdminAgents, deleteAgent, triggerAdminIngest, updateAgent } from '../api';

const { Title, Text } = Typography;

interface IngestResult {
  totalAgents: number;
  totalCategories: number;
  created: number;
  updated: number;
  errors: Array<{ file: string; error: string }>;
}

interface Agent {
  _id: string;
  slug: string;
  categoryKey: string;
  name: { zh: string; en: string };
  description: { zh: string; en: string };
  emoji: string;
  color: string;
  modelPreferences: { primary: string; recommendedProvider: string };
  stats: { wordCount: number };
}

const AgentsAdminPage = () => {
  const { modal } = App.useApp();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [translateOnIngest, setTranslateOnIngest] = useState(false);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAdminAgents({ page, limit: 20, search: search || undefined });
      setAgents(result.data);
      setTotal(result.pagination.total);
    } catch (err) {
      console.error('Failed to load agents', err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const handleOpenEdit = (agent: Agent) => {
    setEditAgent(agent);
    form.setFieldsValue({
      nameZh: agent.name.zh,
      nameEn: agent.name.en,
      descZh: agent.description.zh,
      descEn: agent.description.en,
      emoji: agent.emoji,
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editAgent) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      await updateAgent(editAgent._id, {
        name: { zh: values.nameZh, en: values.nameEn },
        description: { zh: values.descZh, en: values.descEn },
        emoji: values.emoji,
      });
      setEditModalOpen(false);
      await loadAgents();
    } catch (err) {
      console.error('Update failed', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteAgent(id);
      await loadAgents();
    } catch (err) {
      console.error('Delete failed', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleIngest = async () => {
    modal.confirm({
      title: '确认导入',
      content: `将扫描项目根目录下所有 .md 文件并导入/更新到数据库。${translateOnIngest ? '\n\n⚠️ 已开启「翻译为中文」，将调用 AI 翻译每个 Agent，耗时较长。' : ''}`,
      onOk: async () => {
        setIngesting(true);
        setIngestResult(null);
        setIngestError(null);
        try {
          const result = await triggerAdminIngest(translateOnIngest);
          setIngestResult(result);
          await loadAgents();
        } catch (err: any) {
          setIngestError(err?.response?.data?.message || err?.message || '导入失败');
        } finally {
          setIngesting(false);
        }
      },
    });
  };

  const columns = [
    {
      title: 'Agent',
      key: 'agent',
      render: (_: unknown, record: Agent) => (
        <Space>
          <Avatar size={32} style={{ background: 'transparent', fontSize: 20 }}>
            {record.emoji}
          </Avatar>
          <div>
            <Text strong className="text-sm">{record.name.zh || record.name.en}</Text>
            <br />
            <Text type="secondary" className="text-xs font-mono">{record.slug}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: '分类',
      dataIndex: 'categoryKey',
      key: 'categoryKey',
      render: (key: string) => <Tag color="blue">{key}</Tag>,
    },
    {
      title: '模型',
      key: 'model',
      render: (_: unknown, record: Agent) => (
        <Tag color={record.modelPreferences.primary === 'vision' ? 'purple' : 'cyan'}>
          {record.modelPreferences.primary === 'vision' ? '👁️ Vision' : '💬 Text'}
        </Tag>
      ),
    },
    {
      title: '字数',
      key: 'wordCount',
      render: (_: unknown, record: Agent) => (
        <Text type="secondary" className="text-xs">{record.stats.wordCount.toLocaleString()}</Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      align: 'right' as const,
      render: (_: unknown, record: Agent) => (
        <Space>
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenEdit(record)}
              aria-label="编辑 Agent"
            />
          </Tooltip>
          <Popconfirm
            title="确认删除此 Agent？"
            onConfirm={() => handleDelete(record._id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="删除">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={deletingId === record._id}
                aria-label="删除 Agent"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4 animate-fade-in">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <Title level={4} className="!mb-0 flex items-center gap-2">
            <RobotOutlined className="text-sky-600" />
            Agent 管理
          </Title>
          <Text type="secondary" className="text-sm">共 {total} 个</Text>
        </div>
        <Space>
          <Tooltip title="开启后导入时将调用 AI 把英文字段翻译为中文（耗时较长）">
            <Space size={4}>
              <TranslationOutlined className="text-slate-400" />
              <Text className="text-xs text-slate-500">翻译为中文</Text>
              <Switch
                size="small"
                checked={translateOnIngest}
                onChange={setTranslateOnIngest}
                aria-label="翻译为中文"
              />
            </Space>
          </Tooltip>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleIngest}
            loading={ingesting}
            aria-label="从 Markdown 文件导入 Agent"
          >
            {ingesting ? (translateOnIngest ? '导入并翻译中...' : '导入中...') : '从 MD 导入'}
          </Button>
        </Space>
      </div>

      {/* 导入结果 */}
      {ingestResult && (
        <Alert
          icon={<CheckCircleOutlined />}
          message="导入完成"
          description={`共处理 ${ingestResult.totalAgents} 个 Agent，新建 ${ingestResult.created}，更新 ${ingestResult.updated}，分类 ${ingestResult.totalCategories} 个${ingestResult.errors.length > 0 ? `，${ingestResult.errors.length} 个文件失败` : ''}`}
          type="success"
          showIcon
          closable
          onClose={() => setIngestResult(null)}
          className="rounded-xl"
        />
      )}
      {ingestError && (
        <Alert
          message="导入失败"
          description={ingestError}
          type="error"
          showIcon
          closable
          onClose={() => setIngestError(null)}
          className="rounded-xl"
        />
      )}

      {/* 搜索 */}
      <Input
        prefix={<SearchOutlined className="text-slate-400" />}
        placeholder="搜索 Agent..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        className="max-w-xs"
        allowClear
        aria-label="搜索 Agent"
      />

      {/* 表格 */}
      <Table
        dataSource={agents}
        columns={columns}
        rowKey="_id"
        loading={loading}
        size="middle"
        className="rounded-xl overflow-hidden shadow-sm"
        pagination={{
          current: page,
          pageSize: 20,
          total,
          onChange: (p) => setPage(p),
          showTotal: (t) => `共 ${t} 条`,
          size: 'small',
        }}
      />

      {/* 编辑弹窗 */}
      <Modal
        title={
          <Space>
            <EditOutlined className="text-amber-500" />
            编辑 Agent
          </Space>
        }
        open={editModalOpen}
        onOk={handleSaveEdit}
        onCancel={() => setEditModalOpen(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        width={480}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <div className="flex gap-3">
            <Form.Item name="emoji" label="Emoji" className="w-20">
              <Input className="text-center text-xl" aria-label="Emoji" />
            </Form.Item>
            <Form.Item label="Slug" className="flex-1">
              <Input value={editAgent?.slug} disabled className="font-mono text-xs" />
            </Form.Item>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Form.Item name="nameZh" label="名称（中文）" rules={[{ required: true }]}>
              <Input aria-label="中文名称" />
            </Form.Item>
            <Form.Item name="nameEn" label="名称（英文）" rules={[{ required: true }]}>
              <Input aria-label="英文名称" />
            </Form.Item>
          </div>
          <Form.Item name="descZh" label="描述（中文）">
            <Input.TextArea rows={3} aria-label="中文描述" />
          </Form.Item>
          <Form.Item name="descEn" label="描述（英文）">
            <Input.TextArea rows={3} aria-label="英文描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AgentsAdminPage;