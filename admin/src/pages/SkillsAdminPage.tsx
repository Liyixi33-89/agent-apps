/**
 * @file pages/SkillsAdminPage.tsx
 * @description Skill 管理后台页面（维度 7 — 管理后台）
 *
 * 功能：
 *   1. Skill 列表（分类过滤、搜索、排序）
 *   2. Skill 详情查看（步骤可视化）
 *   3. 启用/禁用 Skill
 *   4. 测试台（手动执行 Skill）
 *   5. 执行历史和统计
 *   6. 路由匹配测试
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Tag, Button, Input, Select, Space, Modal, Tooltip,
  Switch, Badge, Statistic, Row, Col, Descriptions, Steps, message,
  Tabs, Typography, Empty, Spin, Divider,
} from 'antd';
import {
  ThunderboltOutlined, SearchOutlined, PlayCircleOutlined, HistoryOutlined,
  BarChartOutlined, ReloadOutlined, AimOutlined, BranchesOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import {
  fetchSkills, toggleSkill, executeSkill, fetchSkillStats,
  fetchSkillExecutions, testSkillMatch, fetchSkillOverviewStats,
  type Skill, type SkillStats, type SkillOverviewStats,
} from '../api';

const { TextArea } = Input;
const { Text, Title } = Typography;

// =============================================================================
// 分类配置
// =============================================================================

const CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  research: { label: '调研', color: 'blue' },
  coding:   { label: '编码', color: 'green' },
  analysis: { label: '分析', color: 'orange' },
  creative: { label: '创意', color: 'purple' },
  workflow: { label: '流程', color: 'cyan' },
  custom:   { label: '自定义', color: 'default' },
};

const STEP_TYPE_MAP: Record<string, { label: string; color: string }> = {
  tool:      { label: '工具调用', color: '#1890ff' },
  llm:       { label: 'LLM 推理', color: '#722ed1' },
  condition: { label: '条件分支', color: '#faad14' },
  transform: { label: '数据转换', color: '#13c2c2' },
  parallel:  { label: '并行执行', color: '#eb2f96' },
};

// =============================================================================
// 主组件
// =============================================================================

const SkillsAdminPage = () => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('');
  const [overviewStats, setOverviewStats] = useState<SkillOverviewStats | null>(null);

  // 详情弹窗
  const [detailSkill, setDetailSkill] = useState<Skill | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailTab, setDetailTab] = useState('steps');
  const [skillStats, setSkillStats] = useState<SkillStats | null>(null);
  const [executions, setExecutions] = useState<any[]>([]);

  // 测试台
  const [testVisible, setTestVisible] = useState(false);
  const [testSkillKey, setTestSkillKey] = useState('');
  const [testInput, setTestInput] = useState('{}');
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  // 路由匹配测试
  const [matchVisible, setMatchVisible] = useState(false);
  const [matchMessage, setMatchMessage] = useState('');
  const [matchResult, setMatchResult] = useState<any>(null);
  const [matchLoading, setMatchLoading] = useState(false);

  // ── 加载数据 ──
  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, limit: 20 };
      if (search) params.search = search;
      if (category) params.category = category;
      const res = await fetchSkills(params);
      if (res.success) {
        setSkills(res.data);
        setTotal(res.pagination?.total || 0);
      }
    } catch {
      message.error('加载 Skill 列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, search, category]);

  const loadOverview = useCallback(async () => {
    try {
      const stats = await fetchSkillOverviewStats();
      setOverviewStats(stats);
    } catch { /* 忽略 */ }
  }, []);

  useEffect(() => { loadSkills(); }, [loadSkills]);
  useEffect(() => { loadOverview(); }, [loadOverview]);

  // ── 操作处理 ──
  const handleToggle = async (key: string) => {
    try {
      const res = await toggleSkill(key);
      message.success(`Skill "${key}" 已${res.isActive ? '启用' : '禁用'}`);
      loadSkills();
    } catch {
      message.error('操作失败');
    }
  };

  const handleViewDetail = async (skill: Skill) => {
    setDetailSkill(skill);
    setDetailVisible(true);
    setDetailTab('steps');
    setSkillStats(null);
    setExecutions([]);
    // 并行加载统计和执行历史
    try {
      const [stats, execData] = await Promise.all([
        fetchSkillStats(skill.key),
        fetchSkillExecutions(skill.key),
      ]);
      setSkillStats(stats);
      setExecutions(execData.executions || []);
    } catch { /* 忽略 */ }
  };

  const handleTest = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const input = JSON.parse(testInput);
      const res = await executeSkill(testSkillKey, input);
      setTestResult(res);
    } catch (err) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : '执行失败' });
    } finally {
      setTestLoading(false);
    }
  };

  const handleMatchTest = async () => {
    setMatchLoading(true);
    setMatchResult(null);
    try {
      const result = await testSkillMatch(matchMessage);
      setMatchResult(result);
    } catch {
      setMatchResult({ matched: false });
    } finally {
      setMatchLoading(false);
    }
  };

  // ── 表格列定义 ──
  const columns = [
    {
      title: 'Skill',
      key: 'name',
      render: (_: unknown, record: Skill) => (
        <div className="flex items-center gap-2">
          <span className="text-xl">{record.icon}</span>
          <div>
            <div className="font-medium text-slate-800">{record.name}</div>
            <Text type="secondary" className="text-xs">{record.key}</Text>
          </div>
        </div>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 80,
      render: (cat: string) => {
        const info = CATEGORY_MAP[cat] || { label: cat, color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '步骤',
      key: 'steps',
      width: 80,
      render: (_: unknown, record: Skill) => (
        <Tooltip title={record.steps.map(s => s.label).join(' → ')}>
          <Tag icon={<BranchesOutlined />}>{record.steps.length} 步</Tag>
        </Tooltip>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '调用次数',
      dataIndex: 'usageCount',
      key: 'usageCount',
      width: 90,
      sorter: (a: Skill, b: Skill) => a.usageCount - b.usageCount,
      render: (count: number) => <span className="font-mono">{count}</span>,
    },
    {
      title: '状态',
      key: 'isActive',
      width: 80,
      render: (_: unknown, record: Skill) => (
        <Switch
          checked={record.isActive}
          onChange={() => handleToggle(record.key)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          size="small"
        />
      ),
    },
    {
      title: '类型',
      key: 'isBuiltin',
      width: 70,
      render: (_: unknown, record: Skill) => (
        record.isBuiltin
          ? <Tag color="gold">内置</Tag>
          : <Tag>自定义</Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: Skill) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              size="small"
              icon={<BarChartOutlined />}
              onClick={() => handleViewDetail(record)}
              aria-label="查看详情"
              tabIndex={0}
            />
          </Tooltip>
          <Tooltip title="测试执行">
            <Button
              type="text"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => {
                setTestSkillKey(record.key);
                setTestInput(JSON.stringify({ message: '' }, null, 2));
                setTestResult(null);
                setTestVisible(true);
              }}
              aria-label="测试执行"
              tabIndex={0}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* ── 页面标题 ── */}
      <div className="flex items-center justify-between">
        <div>
          <Title level={3} className="!mb-1 flex items-center gap-2">
            <ThunderboltOutlined className="text-amber-500" />
            Skill 管理
          </Title>
          <Text type="secondary">管理和监控 AI 技能编排系统</Text>
        </div>
        <Space>
          <Button
            icon={<AimOutlined />}
            onClick={() => setMatchVisible(true)}
          >
            路由匹配测试
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => { loadSkills(); loadOverview(); }}
          >
            刷新
          </Button>
        </Space>
      </div>

      {/* ── 统计概览 ── */}
      {overviewStats && (
        <Row gutter={16}>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="总 Skill 数"
                value={overviewStats.totalSkills}
                suffix={<Text type="secondary" className="text-xs">/ {overviewStats.activeSkills} 启用</Text>}
                prefix={<ThunderboltOutlined className="text-amber-500" />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="总执行次数"
                value={overviewStats.totalExecutions}
                prefix={<PlayCircleOutlined className="text-blue-500" />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="成功率"
                value={Math.round(overviewStats.recentSuccessRate * 100)}
                suffix="%"
                prefix={<CheckCircleOutlined className="text-green-500" />}
                valueStyle={{ color: overviewStats.recentSuccessRate >= 0.9 ? '#52c41a' : '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="平均耗时"
                value={overviewStats.avgDuration}
                suffix="ms"
                prefix={<ClockCircleOutlined className="text-purple-500" />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* ── 筛选栏 ── */}
      <Card size="small">
        <Space wrap>
          <Input
            placeholder="搜索 Skill..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ width: 240 }}
            allowClear
          />
          <Select
            placeholder="分类筛选"
            value={category || undefined}
            onChange={v => { setCategory(v || ''); setPage(1); }}
            allowClear
            style={{ width: 140 }}
            options={Object.entries(CATEGORY_MAP).map(([k, v]) => ({ value: k, label: v.label }))}
          />
        </Space>
      </Card>

      {/* ── Skill 列表 ── */}
      <Card>
        <Table
          dataSource={skills}
          columns={columns}
          rowKey="key"
          loading={loading}
          pagination={{
            current: page,
            pageSize: 20,
            total,
            onChange: setPage,
            showTotal: (t) => `共 ${t} 个 Skill`,
          }}
          size="middle"
        />
      </Card>

      {/* ── 详情弹窗 ── */}
      <Modal
        title={detailSkill ? `${detailSkill.icon} ${detailSkill.name}` : 'Skill 详情'}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={800}
      >
        {detailSkill && (
          <Tabs
            activeKey={detailTab}
            onChange={setDetailTab}
            items={[
              {
                key: 'steps',
                label: '执行步骤',
                icon: <BranchesOutlined />,
                children: (
                  <div className="space-y-4">
                    <Descriptions size="small" column={2} bordered>
                      <Descriptions.Item label="Key">{detailSkill.key}</Descriptions.Item>
                      <Descriptions.Item label="版本">{detailSkill.version}</Descriptions.Item>
                      <Descriptions.Item label="分类">
                        <Tag color={CATEGORY_MAP[detailSkill.category]?.color}>
                          {CATEGORY_MAP[detailSkill.category]?.label}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="超时">{detailSkill.config.timeout}ms</Descriptions.Item>
                      <Descriptions.Item label="描述" span={2}>{detailSkill.description}</Descriptions.Item>
                      {detailSkill.dependsOn.length > 0 && (
                        <Descriptions.Item label="依赖" span={2}>
                          {detailSkill.dependsOn.map(d => <Tag key={d}>{d}</Tag>)}
                        </Descriptions.Item>
                      )}
                    </Descriptions>
                    <Divider orientation={'left' as any} plain>执行流程</Divider>
                    <Steps
                      direction="vertical"
                      size="small"
                      current={-1}
                      items={detailSkill.steps.map(step => ({
                        title: (
                          <span className="flex items-center gap-2">
                            <Badge color={STEP_TYPE_MAP[step.type]?.color || '#999'} />
                            {step.label}
                            <Tag className="text-xs">{STEP_TYPE_MAP[step.type]?.label || step.type}</Tag>
                            {step.optional && <Tag color="default" className="text-xs">可选</Tag>}
                          </span>
                        ),
                        description: (
                          <div className="text-xs text-slate-500 mt-1">
                            {step.toolName && <div>工具: <code>{step.toolName}</code></div>}
                            {step.promptKey && <div>Prompt: <code>{step.promptKey}</code></div>}
                            <div>输出: <code>{step.outputKey}</code></div>
                          </div>
                        ),
                      }))}
                    />
                  </div>
                ),
              },
              {
                key: 'triggers',
                label: '触发条件',
                icon: <AimOutlined />,
                children: (
                  <div className="space-y-4">
                    <div>
                      <Text strong>关键词触发 (L1)</Text>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {detailSkill.triggers.keywords.length > 0
                          ? detailSkill.triggers.keywords.map(kw => <Tag key={kw} color="blue">{kw}</Tag>)
                          : <Text type="secondary">无</Text>
                        }
                      </div>
                    </div>
                    <div>
                      <Text strong>正则模式 (L2)</Text>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {detailSkill.triggers.patterns.length > 0
                          ? detailSkill.triggers.patterns.map(p => <Tag key={p} color="orange"><code>{p}</code></Tag>)
                          : <Text type="secondary">无</Text>
                        }
                      </div>
                    </div>
                    <div>
                      <Text strong>上下文规则 (L2)</Text>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {detailSkill.triggers.contextRules.length > 0
                          ? detailSkill.triggers.contextRules.map(r => <Tag key={r} color="cyan">{r}</Tag>)
                          : <Text type="secondary">无</Text>
                        }
                      </div>
                    </div>
                    <div>
                      <Text strong>LLM 意图描述 (L3)</Text>
                      <div className="mt-2">
                        <Text type="secondary">{detailSkill.triggers.intentDescription || '无'}</Text>
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                key: 'stats',
                label: '统计',
                icon: <BarChartOutlined />,
                children: skillStats ? (
                  <div className="space-y-4">
                    <Row gutter={16}>
                      <Col span={6}>
                        <Statistic title="总执行次数" value={skillStats.totalExecutions} />
                      </Col>
                      <Col span={6}>
                        <Statistic
                          title="成功率"
                          value={Math.round(skillStats.recentSuccessRate * 100)}
                          suffix="%"
                          valueStyle={{ color: skillStats.recentSuccessRate >= 0.9 ? '#52c41a' : '#faad14' }}
                        />
                      </Col>
                      <Col span={6}>
                        <Statistic title="平均耗时" value={skillStats.avgDuration} suffix="ms" />
                      </Col>
                      <Col span={6}>
                        <Statistic title="平均 Token" value={skillStats.avgTokens} />
                      </Col>
                    </Row>
                    {skillStats.stepFailRates.length > 0 && (
                      <>
                        <Divider orientation={'left' as any} plain>步骤失败率</Divider>
                        <Table
                          dataSource={skillStats.stepFailRates}
                          rowKey="stepId"
                          size="small"
                          pagination={false}
                          columns={[
                            { title: '步骤', dataIndex: 'stepId', key: 'stepId' },
                            { title: '总运行', dataIndex: 'totalRuns', key: 'totalRuns' },
                            {
                              title: '失败率',
                              dataIndex: 'failRate',
                              key: 'failRate',
                              render: (v: number) => (
                                <span style={{ color: v > 0.1 ? '#ff4d4f' : '#52c41a' }}>
                                  {(v * 100).toFixed(1)}%
                                </span>
                              ),
                            },
                          ]}
                        />
                      </>
                    )}
                  </div>
                ) : (
                  <Spin />
                ),
              },
              {
                key: 'history',
                label: '执行历史',
                icon: <HistoryOutlined />,
                children: executions.length > 0 ? (
                  <Table
                    dataSource={executions}
                    rowKey="executionId"
                    size="small"
                    pagination={{ pageSize: 5 }}
                    columns={[
                      {
                        title: '状态',
                        dataIndex: 'status',
                        key: 'status',
                        width: 80,
                        render: (s: string) => (
                          s === 'success'
                            ? <Tag icon={<CheckCircleOutlined />} color="success">成功</Tag>
                            : <Tag icon={<CloseCircleOutlined />} color="error">失败</Tag>
                        ),
                      },
                      { title: '耗时', dataIndex: 'totalDuration', key: 'duration', width: 80, render: (v: number) => `${v}ms` },
                      { title: 'Token', dataIndex: 'totalTokens', key: 'tokens', width: 80 },
                      { title: '触发方式', dataIndex: 'triggerMethod', key: 'trigger', width: 100 },
                      {
                        title: '时间',
                        dataIndex: 'createdAt',
                        key: 'time',
                        render: (v: string) => new Date(v).toLocaleString('zh-CN'),
                      },
                    ]}
                  />
                ) : (
                  <Empty description="暂无执行记录" />
                ),
              },
              {
                key: 'versions',
                label: '版本历史',
                icon: <HistoryOutlined />,
                children: detailSkill.versions.length > 0 ? (
                  <Table
                    dataSource={[...detailSkill.versions].reverse()}
                    rowKey="version"
                    size="small"
                    pagination={false}
                    columns={[
                      { title: '版本', dataIndex: 'version', key: 'version', render: (v: string) => <Tag>{v}</Tag> },
                      { title: '变更说明', dataIndex: 'changelog', key: 'changelog' },
                      { title: '时间', dataIndex: 'createdAt', key: 'time', render: (v: string) => new Date(v).toLocaleString('zh-CN') },
                    ]}
                  />
                ) : (
                  <Empty description="暂无版本历史" />
                ),
              },
            ]}
          />
        )}
      </Modal>

      {/* ── 测试台弹窗 ── */}
      <Modal
        title={
          <span className="flex items-center gap-2">
            <ExperimentOutlined className="text-blue-500" />
            Skill 测试台 — {testSkillKey}
          </span>
        }
        open={testVisible}
        onCancel={() => setTestVisible(false)}
        footer={null}
        width={700}
      >
        <div className="space-y-4">
          <div>
            <Text strong>输入参数 (JSON)</Text>
            <TextArea
              value={testInput}
              onChange={e => setTestInput(e.target.value)}
              rows={4}
              className="mt-2 font-mono text-sm"
              placeholder='{"message": "帮我搜索一下 React 19 的新特性"}'
            />
          </div>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleTest}
            loading={testLoading}
            block
          >
            执行 Skill
          </Button>
          {testResult && (
            <Card
              size="small"
              title={testResult.success ? '✅ 执行成功' : '❌ 执行失败'}
              className={testResult.success ? 'border-green-200' : 'border-red-200'}
            >
              {testResult.data && (
                <div className="space-y-2">
                  <div><Text strong>耗时:</Text> {testResult.data.totalDuration}ms</div>
                  <div><Text strong>Token:</Text> {testResult.data.totalTokens}</div>
                  <Divider plain>步骤结果</Divider>
                  {testResult.data.stepResults?.map((sr: any) => (
                    <div key={sr.stepId} className="flex items-center gap-2 text-sm">
                      {sr.status === 'success'
                        ? <CheckCircleOutlined className="text-green-500" />
                        : <CloseCircleOutlined className="text-red-500" />
                      }
                      <span>{sr.stepId}</span>
                      <span className="text-slate-400">({sr.duration}ms)</span>
                    </div>
                  ))}
                  <Divider plain>输出</Divider>
                  <pre className="bg-slate-50 p-3 rounded text-xs max-h-[300px] overflow-auto whitespace-pre-wrap">
                    {typeof testResult.data.output === 'string'
                      ? testResult.data.output
                      : JSON.stringify(testResult.data.output, null, 2)
                    }
                  </pre>
                </div>
              )}
              {testResult.message && <Text type="danger">{testResult.message}</Text>}
            </Card>
          )}
        </div>
      </Modal>

      {/* ── 路由匹配测试弹窗 ── */}
      <Modal
        title={
          <span className="flex items-center gap-2">
            <AimOutlined className="text-orange-500" />
            路由匹配测试
          </span>
        }
        open={matchVisible}
        onCancel={() => setMatchVisible(false)}
        footer={null}
        width={600}
      >
        <div className="space-y-4">
          <div>
            <Text strong>输入用户消息</Text>
            <TextArea
              value={matchMessage}
              onChange={e => setMatchMessage(e.target.value)}
              rows={3}
              className="mt-2"
              placeholder="例如：帮我搜索一下当前世界局势"
            />
          </div>
          <Button
            type="primary"
            icon={<AimOutlined />}
            onClick={handleMatchTest}
            loading={matchLoading}
            block
          >
            测试匹配
          </Button>
          {matchResult && (
            <Card size="small" className={matchResult.matched ? 'border-green-200' : 'border-slate-200'}>
              {matchResult.matched ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircleOutlined className="text-green-500" />
                    <Text strong>匹配成功</Text>
                  </div>
                  <Descriptions size="small" column={1}>
                    <Descriptions.Item label="Skill">{matchResult.skillName} ({matchResult.skillKey})</Descriptions.Item>
                    <Descriptions.Item label="置信度">{((matchResult.confidence || 0) * 100).toFixed(0)}%</Descriptions.Item>
                    <Descriptions.Item label="匹配方式">{matchResult.method}</Descriptions.Item>
                    <Descriptions.Item label="触发项">{matchResult.matchedTrigger}</Descriptions.Item>
                  </Descriptions>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-slate-500">
                  <CloseCircleOutlined />
                  <Text type="secondary">未匹配到任何 Skill，将降级到普通 Chat</Text>
                </div>
              )}
            </Card>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default SkillsAdminPage;
