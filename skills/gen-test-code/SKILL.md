---
name: gen-test-code
description: "基于设计文档和源码，自动生成测试用例。覆盖后端 API 测试（Jest + Supertest）、Service 单元测试（Jest）、前端组件测试（Vitest + React Testing Library），按 PRD 验收标准生成测试用例，确保每个验收条件都有对应测试。"
triggers:
  - 生成测试
  - 测试用例
  - unit test
  - 单元测试
  - e2e test
  - 组件测试
  - API 测试
  - 写测试
---

# Gen-Test-Code — 测试用例生成

## 目标

基于设计文档中的验收标准和源码实现，自动生成全面的测试用例。确保每个 PRD 验收条件都有对应的测试覆盖，让代码变更有信心。

**核心隐喻**：你是一个"QA 测试架构师"——不只是写测试代码，而是设计测试策略。先确定"测什么"，再决定"怎么测"。每个测试都有明确的目的。

---

## 设计原则

1. **验收标准驱动**：测试用例从 PRD 验收标准反推，确保业务需求被测试覆盖
2. **金字塔结构**：单元测试 > 集成测试 > E2E 测试，底层测试数量最多
3. **独立可运行**：每个测试文件可独立运行，不依赖其他测试的执行顺序
4. **Mock 最小化**：只 Mock 外部依赖（数据库、第三方 API），不 Mock 被测模块的内部逻辑
5. **可读性优先**：测试描述用中文，清晰表达测试意图

---

## 测试技术栈

### 后端测试

| 技术 | 用途 |
|------|------|
| Jest | 测试框架 + 断言库 |
| Supertest | HTTP API 集成测试 |
| mongodb-memory-server | 内存 MongoDB（测试隔离） |

### 前端测试

| 技术 | 用途 |
|------|------|
| Vitest | 测试框架（兼容 Jest API） |
| React Testing Library | 组件渲染 + 交互测试 |
| MSW (Mock Service Worker) | API Mock |
| @testing-library/user-event | 用户交互模拟 |

---

## 输入

| 参数 | 必填 | 说明 |
|------|------|------|
| **源码文件** | ✅ | 需要生成测试的源码文件路径 |
| **设计文档** | 否 | `version-doc/{版本号}/design/` 下的设计文档，用于提取验收标准 |
| **PRD** | 否 | `version-doc/{版本号}/prd/prd.md`，用于提取验收标准 |
| **版本号** | 否 | 如提供，自动关联对应的设计文档和 PRD |
| **测试类型** | 否 | `unit` / `integration` / `component` / `all`，默认 `all` |

## 输出

| 输出类型 | 文件位置 | 说明 |
|---------|---------|------|
| 后端单元测试 | `server/src/__tests__/{module}.test.ts` | Service 函数测试 |
| 后端 API 测试 | `server/src/__tests__/api/{route}.test.ts` | HTTP 端点集成测试 |
| 前端组件测试 | `{app}/src/__tests__/{Component}.test.tsx` | 组件渲染 + 交互测试 |
| 前端 Hook 测试 | `{app}/src/__tests__/hooks/{hook}.test.ts` | 自定义 Hook 测试 |
| 测试覆盖报告 | 直接输出 | 验收标准覆盖矩阵 |

---

## 编排流程

### 第 0 步：检查前置条件

1. 检查源码文件是否存在
2. 检查测试基础设施是否就绪：
   - 后端：`jest.config.ts` 是否存在
   - 前端：`vitest.config.ts` 是否存在
   - 如不存在 → 先生成测试配置文件
3. 如提供版本号 → 读取 PRD 和设计文档，提取验收标准

### 第 1 步：分析源码，提取可测试单元

读取源码文件，提取：

**后端文件**：
- Service 导出函数列表（函数名、参数、返回值）
- Route 端点列表（HTTP 方法、路径、中间件、请求/响应类型）
- Model Schema 定义（字段、校验规则、索引）

**前端文件**：
- 组件 Props 接口
- 组件内部状态（useState）
- 事件处理函数（handle* 函数）
- API 调用（useEffect 中的 fetch/axios）
- 条件渲染逻辑

### 第 2 步：设计测试策略

根据源码分析结果，设计测试矩阵：

```markdown
### 测试矩阵

| 被测单元 | 测试类型 | 测试场景 | 对应验收标准 |
|---------|---------|---------|------------|
| AgentService.create | 单元测试 | 正常创建 | PRD 验收 1.1 |
| AgentService.create | 单元测试 | 名称为空 | PRD 验收 1.5 |
| GET /api/agents | API 测试 | 分页查询 | PRD 验收 2.1 |
| AgentCard | 组件测试 | 渲染 Agent 信息 | PRD 验收 3.1 |
| AgentCard | 组件测试 | 点击编辑按钮 | PRD 验收 3.2 |
```

### 第 3 步：查阅 KB 获取测试模式

读取 KB 中的现有测试文件（如有），提取测试编写模式：
- 测试文件组织方式
- Mock 数据格式
- 断言风格
- 测试辅助函数

如果 KB 中没有测试相关信息，使用以下默认模式。

### 第 4 步：生成后端测试

#### 4.1 Service 单元测试

```typescript
// server/src/__tests__/{serviceName}.test.ts
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as {ServiceName} from '../services/{serviceName}';
import {ModelName} from '../models/{ModelName}';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  // 清理测试数据
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe('{ServiceName}', () => {
  describe('{functionName}', () => {
    it('正常场景：{描述}', async () => {
      // Arrange - 准备测试数据
      // Act - 执行被测函数
      // Assert - 验证结果
    });

    it('异常场景：{描述}', async () => {
      // Arrange
      // Act & Assert
      await expect({ServiceName}.{functionName}(invalidParams))
        .rejects.toThrow('{expectedError}');
    });

    it('边界条件：{描述}', async () => {
      // ...
    });
  });
});
```

#### 4.2 API 集成测试

```typescript
// server/src/__tests__/api/{routeName}.test.ts
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../index';

let mongoServer: MongoMemoryServer;
let authToken: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  // 创建测试用户并获取 token
  authToken = await createTestUserAndGetToken();
});

describe('GET /api/{route}', () => {
  it('200: 正常获取列表', async () => {
    const res = await request(app.callback())
      .get('/api/{route}')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('401: 未登录访问', async () => {
    const res = await request(app.callback())
      .get('/api/{route}');

    expect(res.status).toBe(401);
  });
});

describe('POST /api/{route}', () => {
  it('201: 正常创建', async () => {
    const res = await request(app.callback())
      .post('/api/{route}')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ /* 请求体 */ });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('400: 参数校验失败', async () => {
    const res = await request(app.callback())
      .post('/api/{route}')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ /* 无效参数 */ });

    expect(res.status).toBe(400);
  });
});
```

### 第 5 步：生成前端测试

#### 5.1 组件测试

```typescript
// {app}/src/__tests__/{ComponentName}.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import {ComponentName} from '../pages/{ComponentName}';

// Mock API
vi.mock('../api', () => ({
  {apiFunction}: vi.fn(),
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>{component}</BrowserRouter>
  );
};

describe('{ComponentName}', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('正常渲染：显示页面标题', async () => {
    renderWithRouter(<{ComponentName} />);
    expect(screen.getByText('{页面标题}')).toBeInTheDocument();
  });

  it('数据加载：显示列表数据', async () => {
    // Mock API 返回数据
    const mockData = [/* ... */];
    vi.mocked({apiFunction}).mockResolvedValue({ success: true, data: mockData });

    renderWithRouter(<{ComponentName} />);

    await waitFor(() => {
      expect(screen.getByText(mockData[0].name)).toBeInTheDocument();
    });
  });

  it('用户交互：点击创建按钮打开弹窗', async () => {
    const user = userEvent.setup();
    renderWithRouter(<{ComponentName} />);

    await user.click(screen.getByRole('button', { name: /创建/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('空状态：无数据时显示空提示', async () => {
    vi.mocked({apiFunction}).mockResolvedValue({ success: true, data: [] });

    renderWithRouter(<{ComponentName} />);

    await waitFor(() => {
      expect(screen.getByText(/暂无数据/i)).toBeInTheDocument();
    });
  });

  it('错误处理：API 失败时显示错误提示', async () => {
    vi.mocked({apiFunction}).mockRejectedValue(new Error('网络错误'));

    renderWithRouter(<{ComponentName} />);

    await waitFor(() => {
      expect(screen.getByText(/错误/i)).toBeInTheDocument();
    });
  });
});
```

### 第 6 步：生成验收标准覆盖矩阵

```markdown
## 验收标准覆盖矩阵

| PRD 验收标准 | 测试文件 | 测试用例 | 状态 |
|-------------|---------|---------|------|
| 1.1 用户可以创建 Agent | api/agents.test.ts | POST 201: 正常创建 | ✅ 已覆盖 |
| 1.2 名称不能为空 | api/agents.test.ts | POST 400: 参数校验失败 | ✅ 已覆盖 |
| 1.3 列表支持分页 | api/agents.test.ts | GET 200: 分页查询 | ✅ 已覆盖 |
| 2.1 页面显示 Agent 列表 | AgentsPage.test.tsx | 数据加载：显示列表数据 | ✅ 已覆盖 |
| 2.2 点击创建打开弹窗 | AgentsPage.test.tsx | 用户交互：点击创建按钮 | ✅ 已覆盖 |
| ⚠️ 3.1 标签筛选 | — | — | ❌ 未覆盖（源码中未实现） |
```

### 第 7 步：自检

- [ ] 每个 PRD 验收标准都有对应的测试用例（或标注为"源码未实现"）
- [ ] 测试文件可独立运行（导入完整、Mock 完整）
- [ ] 正向场景、异常场景、边界条件都有覆盖
- [ ] 测试描述用中文，清晰表达测试意图
- [ ] Mock 数据合理（不是空对象或无意义数据）

### 第 8 步：输出摘要

```
## 测试用例生成完成

- 源码文件：{N} 个
- 生成测试文件：{N} 个

| 测试类型 | 文件数 | 用例数 |
|---------|--------|--------|
| Service 单元测试 | {N} | {N} |
| API 集成测试 | {N} | {N} |
| 组件测试 | {N} | {N} |

验收标准覆盖率：{N}/{M}（{百分比}%）

运行测试：
- 后端：`cd server && npx jest`
- 前端：`cd {app} && npx vitest`

建议下一步：
1. 运行测试确认全部通过
2. 修复未通过的测试（可能是源码 bug）
3. 补充未覆盖的验收标准对应的测试
```

---

## 约束

### 测试约束

1. **不修改源码**：只生成测试文件，不修改被测源码（除非源码有明显 bug 需要标注）
2. **测试隔离**：每个测试用例独立，不依赖其他用例的执行结果
3. **数据清理**：每个测试后清理测试数据（afterEach）
4. **不测试框架**：不测试 React/Koa/Mongoose 本身的功能，只测试业务逻辑
5. **Mock 最小化**：只 Mock 外部依赖，不 Mock 被测模块内部

### 命名约束

1. **测试文件**：`{被测文件名}.test.ts(x)`
2. **describe 块**：被测模块/函数名
3. **it 描述**：`{场景类型}：{具体描述}`（如 `正常场景：创建成功返回 Agent 对象`）

### 边界条件处理

| 场景 | 处理方式 |
|------|---------|
| 源码文件不存在 | 提示用户先生成代码 |
| 测试配置不存在 | 先生成 jest.config.ts / vitest.config.ts |
| PRD 无验收标准 | 从源码逻辑反推测试场景，标注"⚠️ 无 PRD 验收标准" |
| 源码逻辑过于复杂 | 拆分为多个测试文件，每个文件测试一个函数/组件 |
| 依赖第三方服务 | 使用 MSW 或 Jest Mock 模拟 |
