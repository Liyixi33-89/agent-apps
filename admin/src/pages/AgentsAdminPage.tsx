import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Modal, Form, Alert, Tag, Space, Typography,
  Tooltip, Avatar, Popconfirm, App, Upload,
} from 'antd';
import {
  RobotOutlined, SearchOutlined, DeleteOutlined, EditOutlined,
  UploadOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { fetchAdminAgents, deleteAgent, uploadAgentMd, updateAgent } from '../api';

const { Title, Text } = Typography;

interface UploadResult {
  action: 'created' | 'updated';
  message: string;
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
  const { modal, message: antMessage } = App.useApp();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
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
      antMessage.success('删除成功');
      await loadAgents();
    } catch (err) {
      antMessage.error('删除失败');
      console.error('Delete failed', err);
    } finally {
      setDeletingId(null);
    }
  };

  /** 上传 MD 文件解析生成 Agent */
  const handleUploadMd = async (file: File) => {
    setUploading(true);
    setUploadResult(null);
    setUploadError(null);
    try {
      const result = await uploadAgentMd(file);
      setUploadResult(result);
      antMessage.success(result.message);
      await loadAgents();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || '上传失败';
      setUploadError(errMsg);
      antMessage.error(errMsg);
    } finally {
      setUploading(false);
    }
    // 返回 false 阻止 antd Upload 的默认上传行为
    return false;
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
          <Upload
            accept=".md"
            showUploadList={false}
            beforeUpload={(file) => {
              handleUploadMd(file as unknown as File);
              return false;
            }}
            disabled={uploading}
          >
            <Button
              type="primary"
              icon={<UploadOutlined />}
              loading={uploading}
              aria-label="上传 MD 文件生成 Agent"
            >
              {uploading ? '解析中...' : '上传 MD 生成 Agent'}
            </Button>
          </Upload>
        </Space>
      </div>

      {/* 上传结果 */}
      {uploadResult && (
        <Alert
          icon={<CheckCircleOutlined />}
          message={uploadResult.action === 'created' ? '创建成功' : '更新成功'}
          description={uploadResult.message}
          type="success"
          showIcon
          closable
          onClose={() => setUploadResult(null)}
          className="rounded-xl"
        />
      )}
      {uploadError && (
        <Alert
          message="上传失败"
          description={uploadError}
          type="error"
          showIcon
          closable
          onClose={() => setUploadError(null)}
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