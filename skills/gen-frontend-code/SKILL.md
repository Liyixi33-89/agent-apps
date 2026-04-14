---
name: gen-frontend-code
description: "读取前端技术设计文档（fe-*.md），生成/修改前端代码。基于设计文档中的页面、组件、API、Store、类型定义，结合项目知识库（kb/）中的现有代码模式，生成符合项目规范的 React + TypeScript 前端代码。"
triggers:
  - 生成前端代码
  - 前端编码
  - frontend code
  - 生成页面
  - 生成组件
  - 前端开发
---

# Gen-Frontend-Code — 前端代码生成

## 目标

读取前端技术设计文档（`fe-*.md`），自动生成/修改 React 19 + Antd 6 + TailwindCSS + Zustand + TypeScript 前端代码。生成的代码必须符合项目现有的编码规范和组件模式，可以直接运行。

**核心隐喻**：你是一个"前端开发工程师"——严格按照技术设计文档编码，遵循项目现有的代码风格和组件模式。每个组件都有清晰的 Props 接口，每个页面都有完整的交互逻辑。

---

## 设计原则

1. **设计文档为纲**：严格按照 `fe-*.md` 中的定义编码，不自行添加或省略功能
2. **KB 为参考**：参考知识库中的现有代码模式，确保新代码与现有代码风格一致
3. **增量修改**：修改现有文件时，只改设计文档中要求的部分，不动其他代码
4. **组件化**：遵循 React 组件化最佳实践，Props 接口清晰，状态管理合理
5. **类型安全**：所有 Props、State、API 响应都有 TypeScript 类型
6. **样式一致**：使用 TailwindCSS 类名，风格与现有页面一致

---

## 适用技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| UI 框架 | React | 19.x |
| UI 组件库 | Antd | 6.x |
| 样式 | TailwindCSS | 3.x |
| 状态管理 | Zustand | 5.x |
| 路由 | react-router-dom | 7.x |
| HTTP | axios | 1.x |
| 语言 | TypeScript | 5.x |
| 图标 | lucide-react | latest |

---

## 输入

| 参数 | 必填 | 说明 |
|------|------|------|
| **设计文档** | ✅ | `version-doc/{版本号}/design/fe-*.md` 文件路径 |
| **版本号** | ✅ | 如 `v1.0.1`，用于定位设计文档 |
| **目标应用** | 否 | `web` / `admin`，从设计文档中自动判断 |
| **生成范围** | 否 | 指定只生成某些部分（如"只生成页面"），默认全部 |

## 输出

直接修改 `{app}/src/` 下的源码文件：

| 输出类型 | 文件位置 | 说明 |
|---------|---------|------|
| 页面 | `{app}/src/pages/{PageName}.tsx` | React 页面组件 |
| 组件 | `{app}/src/components/{ComponentName}.tsx` | 公共组件 |
| API | `{app}/src/api/index.ts` | API 封装函数 |
| Store | `{app}/src/store/index.ts` | Zustand Store |
| Types | `{app}/src/types/index.ts` | TypeScript 类型定义 |
| 路由 | `{app}/src/App.tsx` | 路由注册 |

---

## 编排流程

### 第 0 步：检查前置条件

1. 检查设计文档是否存在
   - 不存在 → 提示用户先执行 `prd-to-frontend-design` Skill
2. 读取设计文档，提取变更清单
3. 确定目标应用（web / admin）

### 第 1 步：读取设计文档

完整读取 `version-doc/{版本号}/design/fe-*.md`，提取：
- 所有需要新增/修改的页面
- 所有需要新增/修改的组件
- 所有需要新增/修改的 API 函数
- Store 变更
- 类型定义变更
- 路由变更
- 实施顺序建议

### 第 2 步：查阅 KB 获取代码模式

读取 KB 中的现有代码，提取编码模式：

**页面模式**（从 `kb/frontend/@agency/{app}/01_index_page.md` + 源码）：
- 页面组件结构（导入、状态、副作用、事件处理、渲染）
- Antd 组件使用方式（Table、Form、Modal、Button 等）
- TailwindCSS 类名使用模式
- 加载状态/空状态/错误状态处理

**组件模式**（从 `kb/frontend/@agency/{app}/02_index_component.md` + 源码）：
- Props 接口定义方式
- 组件导出方式（`const Component: React.FC<Props> = () => {}`）
- 事件回调命名（`onXxx`）

**API 模式**（从 `kb/frontend/@agency/{app}/03_index_api.md` + 源码）：
- API 函数命名和导出方式
- 请求封装方式（`request.get/post/put/delete`）
- 错误处理方式

**Store 模式**（从 `kb/frontend/@agency/{app}/04_index_store.md` + 源码）：
- Zustand `create()` 使用方式
- 状态和 Action 定义方式

**⚠️ 重要**：必须读取至少一个同类型的现有源码文件作为参考模板。例如：
- 生成新页面 → 先读取一个现有页面文件（如 `{app}/src/pages/AgentsPage.tsx`）
- 生成新组件 → 先读取一个现有组件文件
- 修改 API → 先读取 `{app}/src/api/index.ts`
- 修改 Store → 先读取 `{app}/src/store/index.ts`
- 修改 Types → 先读取 `{app}/src/types/index.ts`

### 第 3 步：按顺序生成代码

**严格按照设计文档中的"实施顺序"执行**，通常为：

#### 3.1 生成/修改类型定义

**在 `{app}/src/types/index.ts` 中**：

```typescript
// 新增类型（来源：设计文档）
export interface I{TypeName} {
  id: string;
  name: string;
  // ... 按设计文档定义所有字段
}
```

**修改现有类型**：
1. 读取现有 types 文件
2. 在对应 interface 中添加新字段
3. 确保不破坏现有类型的使用

#### 3.2 生成/修改 API 封装

**在 `{app}/src/api/index.ts` 中**：

```typescript
// 新增 API 函数
export const {funcName} = (params: {ParamType}) => {
  return request.get<{ResponseType}>('/api/xxx', { params });
};

export const {createFunc} = (data: {CreateType}) => {
  return request.post<{ResponseType}>('/api/xxx', data);
};
```

**修改现有 API 函数**：
1. 读取现有 api 文件
2. 添加新函数或修改现有函数的参数/返回类型

#### 3.3 生成/修改 Store

**在 `{app}/src/store/index.ts` 中**：

```typescript
// 在现有 Store 中新增状态和 Action
// ... 现有代码
{newState}: {type} as {type},
set{NewState}: (value: {type}) => set({ {newState}: value }),
```

#### 3.4 生成/修改组件

**新增公共组件**：

```tsx
// {app}/src/components/{ComponentName}.tsx
import React from 'react';
// ... 导入

interface {ComponentName}Props {
  // 按设计文档定义 Props
}

const {ComponentName}: React.FC<{ComponentName}Props> = ({ prop1, prop2, onEvent }) => {
  // 按设计文档实现组件逻辑
  
  return (
    <div className="...">
      {/* 按设计文档实现渲染 */}
    </div>
  );
};

export default {ComponentName};
```

#### 3.5 生成/修改页面

**新增页面**：

```tsx
// {app}/src/pages/{PageName}.tsx
import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, message } from 'antd';
// ... 其他导入

const {PageName}: React.FC = () => {
  // 状态定义（按设计文档）
  const [data, setData] = useState<{Type}[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // 数据加载
  useEffect(() => {
    handleLoad();
  }, []);

  // 事件处理函数（按设计文档）
  const handleLoad = async () => {
    setLoading(true);
    try {
      const res = await api.{getFunc}();
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: {CreateType}) => {
    try {
      const res = await api.{createFunc}(values);
      if (res.data.success) {
        message.success('创建成功');
        setModalOpen(false);
        handleLoad(); // 刷新列表
      }
    } catch (error) {
      message.error('创建失败');
    }
  };

  // ... 其他事件处理函数

  return (
    <div className="p-6">
      {/* 页面标题 + 操作按钮 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">{页面标题}</h1>
        <Button type="primary" onClick={() => setModalOpen(true)}>
          新增
        </Button>
      </div>

      {/* 数据表格/列表 */}
      <Table
        dataSource={data}
        loading={loading}
        columns={columns}
        rowKey="id"
      />

      {/* 弹窗 */}
      <Modal
        title="新增"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
      >
        <Form onFinish={handleCreate}>
          {/* 表单字段 */}
        </Form>
      </Modal>
    </div>
  );
};

export default {PageName};
```

**修改现有页面**：
1. 读取现有页面文件
2. 添加新的状态、事件处理函数、UI 元素
3. 确保不破坏现有功能

#### 3.6 注册路由

在 `{app}/src/App.tsx` 中：
1. 添加页面组件的导入语句
2. 在路由配置中添加新路由

### 第 4 步：自检

对每个生成/修改的文件：
- [ ] TypeScript 类型完整，无隐式 `any`
- [ ] 导入语句完整，无遗漏
- [ ] 所有 Antd 组件正确使用（Props 正确）
- [ ] TailwindCSS 类名正确
- [ ] 事件处理函数命名使用 `handle` 前缀
- [ ] 加载状态、空状态、错误状态都有处理
- [ ] 新增页面已在 App.tsx 中注册路由

### 第 5 步：输出摘要

```
## 前端代码生成完成

- 设计文档：version-doc/{版本号}/design/fe-{feature}.md
- 目标应用：{web/admin}

生成/修改的文件：

| # | 文件 | 操作 | 说明 |
|---|------|------|------|
| 1 | {app}/src/types/index.ts | 修改 | 新增 {N} 个类型 |
| 2 | {app}/src/api/index.ts | 修改 | 新增 {N} 个 API 函数 |
| 3 | {app}/src/store/index.ts | 修改 | 新增状态和 Action |
| 4 | {app}/src/components/{Component}.tsx | 新增 | {说明} |
| 5 | {app}/src/pages/{Page}.tsx | 新增 | {说明} |
| 6 | {app}/src/App.tsx | 修改 | 注册新路由 |

建议下一步：
1. 运行 `npm run dev` 验证页面是否正常渲染
2. 检查控制台是否有 TypeScript 或运行时错误
3. 与后端联调测试 API
4. 执行 `doc-code-to-kb` 更新知识库
```

---

## 约束

### 编码约束

1. **严格按设计文档**：不自行添加设计文档中未定义的页面、组件、API
2. **不破坏现有代码**：修改现有文件时，只改设计文档要求的部分
3. **函数组件**：所有组件使用函数组件 + Hooks，不使用 Class 组件
4. **TailwindCSS 优先**：样式使用 TailwindCSS 类名，不写自定义 CSS
5. **Antd 组件优先**：表格用 `Table`、表单用 `Form`、弹窗用 `Modal`，不自己造轮子
6. **事件处理命名**：使用 `handle` 前缀（`handleClick`、`handleSubmit`、`handleDelete`）
7. **常量函数**：使用 `const handleXxx = () => {}` 而非 `function handleXxx() {}`
8. **早期返回**：优先使用早期返回提高可读性

### 样式约束

1. **间距**：使用 Tailwind 的 `p-`、`m-`、`gap-` 类
2. **颜色**：使用项目主色 `primary`（蓝色系）、`success`（绿色）、`warning`（橙色）、`error`（红色）
3. **圆角**：统一使用 `rounded-lg`
4. **阴影**：卡片使用 `shadow-sm`，悬浮使用 `hover:shadow-md`
5. **字体**：标题 `text-2xl font-semibold`，正文 `text-sm`，辅助文字 `text-xs text-gray-500`

### 生成顺序约束

1. **类型先于 API**：API 函数依赖类型定义
2. **API 先于 Store**：Store 可能调用 API
3. **Store 先于组件**：组件可能使用 Store
4. **组件先于页面**：页面引用组件
5. **页面先于路由**：先有页面才能注册路由
6. **每个文件生成后立即写入**：不要等全部完成再写

### 边界条件处理

| 场景 | 处理方式 |
|------|---------|
| 设计文档不存在 | 提示用户先生成设计文档 |
| 现有文件与设计文档冲突 | 标注冲突，询问用户如何处理 |
| 设计文档引用了不存在的组件 | 先生成被依赖的组件 |
| 后端 API 尚未开发 | 在 API 函数中添加注释标注，建议使用 Mock |
| 修改现有文件导致其他文件报错 | 检查并修复关联文件 |

---

## 代码模板参考

### 页面模板（列表页）

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Popconfirm } from 'antd';
import { Plus, Trash2, Edit } from 'lucide-react';
import * as api from '../api';
import type { I{TypeName} } from '../types';

const {PageName}: React.FC = () => {
  const [data, setData] = useState<I{TypeName}[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<I{TypeName} | null>(null);
  const [form] = Form.useForm();

  const handleLoad = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.{getListFunc}();
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    handleLoad();
  }, [handleLoad]);

  const handleSubmit = async (values: Partial<I{TypeName}>) => {
    try {
      if (editingItem) {
        await api.{updateFunc}(editingItem.id, values);
        message.success('更新成功');
      } else {
        await api.{createFunc}(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      setEditingItem(null);
      form.resetFields();
      handleLoad();
    } catch {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.{deleteFunc}(id);
      message.success('删除成功');
      handleLoad();
    } catch {
      message.error('删除失败');
    }
  };

  const handleEdit = (item: I{TypeName}) => {
    setEditingItem(item);
    form.setFieldsValue(item);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setModalOpen(true);
  };

  const columns = [
    // 按设计文档定义列
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">{页面标题}</h1>
        <Button type="primary" icon={<Plus size={16} />} onClick={handleAdd}>
          新增
        </Button>
      </div>

      <Table
        dataSource={data}
        columns={columns}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title={editingItem ? '编辑' : '新增'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingItem(null); }}
        footer={null}
        destroyOnClose
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          {/* 表单字段 */}
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">确认</Button>
              <Button onClick={() => setModalOpen(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default {PageName};
```

### 组件模板

```tsx
import React from 'react';

interface {ComponentName}Props {
  // Props 定义
}

const {ComponentName}: React.FC<{ComponentName}Props> = ({ /* props */ }) => {
  return (
    <div className="...">
      {/* 组件内容 */}
    </div>
  );
};

export default {ComponentName};
```

### API 函数模板

```typescript
// 获取列表
export const get{Resource}List = (params?: { page?: number; limit?: number }) => {
  return request.get('/api/{resource}', { params });
};

// 获取详情
export const get{Resource}ById = (id: string) => {
  return request.get(`/api/{resource}/${id}`);
};

// 创建
export const create{Resource} = (data: Partial<I{Resource}>) => {
  return request.post('/api/{resource}', data);
};

// 更新
export const update{Resource} = (id: string, data: Partial<I{Resource}>) => {
  return request.put(`/api/{resource}/${id}`, data);
};

// 删除
export const delete{Resource} = (id: string) => {
  return request.delete(`/api/{resource}/${id}`);
};
```
