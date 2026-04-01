/**
 * @file routes/vibeFullStackPipeline.ts
 * @description § 7d  Vibe Coding — 全栈 CRUD Pipeline（6步流水线）
 *
 * 执行顺序：
 *   Step 1 - 需求分析 Agent    → 拆解功能模块、数据实体、API 清单
 *   Step 2 - 数据库架构 Agent  → 设计 MongoDB Schema + 索引 + 验证
 *   Step 3 - 后端工程 Agent    → 生成 Koa 路由 + Service + 中间件
 *   Step 4 - 前端工程 Agent    → 生成 React 页面 + API 调用层
 *   Step 5 - 权限配置 Agent    → 生成菜单 + RBAC 权限模型
 *   Step 6 - 质检整合 Agent    → 审查全部代码 → 安全 + 一致性 + 完整性
 *
 * 路由列表：
 *   POST /api/vibe/fullstack-pipeline  → 全栈 Pipeline 流式生成（SSE）
 */

import Router from '@koa/router';
import { SystemPrompt } from '../models/SystemPrompt.js';
import type { ISystemPrompt } from '../models/SystemPrompt.js';
import { env } from '../config/env.js';
import { streamWithContinuation } from '../lib/llmUtils.js';

export const vibeFullStackPipelineRouter = new Router();

// =============================================================================
// § 7d-a  全栈 Pipeline Prompt 常量
// =============================================================================

const FS_ANALYST_PROMPT = `你是一个资深全栈需求分析师，专精于 Node.js + React + MongoDB 技术栈。
请对用户的全栈应用需求进行详细的结构化分析，输出以下内容（纯文本，不要写代码）：

1. 【应用概述】应用类型、核心业务场景、目标用户
2. 【功能模块清单】每个模块一行，格式：模块名 - 功能描述 - CRUD 操作列表
3. 【数据实体设计】
   - 列出所有数据实体（如 User、Product、Order 等）
   - 每个实体的关键字段（字段名、类型、是否必填、默认值）
   - 实体间的关系（一对多、多对多等）
4. 【API 接口清单】
   - 格式：HTTP方法 路径 - 功能描述 - 请求参数 - 返回数据
   - 按模块分组列出所有 RESTful API
5. 【权限模型】
   - 角色列表（如 admin、user、guest）
   - 每个角色可访问的模块和操作
6. 【菜单结构】
   - 侧边栏菜单层级（一级菜单 → 二级菜单）
   - 每个菜单项对应的路由路径和权限

要求：分析要全面、具体、可执行，总字数不超过 1500 字。`;

const FS_DB_ARCHITECT_PROMPT = `你是一个 MongoDB 数据库架构师，专精于 Mongoose ODM。
请根据需求分析，为每个数据实体生成完整的 Mongoose Model 代码。

【输出格式要求】
每个 Model 用独立的代码块输出，格式：
\`\`\`typescript:models/ModelName.ts
// 完整的 Mongoose Model 代码
\`\`\`

【代码规范 - 必须严格遵守】
1. 使用 TypeScript 严格模式
2. 每个 Model 文件必须包含：
   - Interface 定义（IModelName extends Document）
   - Schema 定义（含字段验证、默认值、索引）
   - Model 导出
3. 字段验证规则：
   - 字符串字段：trim: true，必填字段加 required
   - 数字字段：min/max 范围限制
   - 枚举字段：enum 约束
   - 引用字段：ref 关联
4. 必须包含的通用字段：
   - timestamps: true（自动 createdAt/updatedAt）
   - isDeleted: Boolean（软删除标记）
5. 索引设计：
   - 常用查询字段建立索引
   - 唯一字段建立唯一索引
   - 复合查询建立复合索引
6. 密码字段必须标记 select: false

【安全要求】
- 禁止在 Schema 中存储明文密码
- 敏感字段（如 password）必须设置 select: false
- 所有用户输入字段必须有长度限制（maxlength）

请直接输出所有 Model 代码，不要输出解释文字。`;

const FS_BACKEND_ENGINEER_PROMPT = `你是一个资深 Node.js 后端工程师，专精于 Koa.js + TypeScript。
请根据需求分析和数据库 Schema，生成完整的后端 CRUD 代码。

【输出格式要求】
按以下顺序输出，每个文件用独立代码块：

1. 路由文件：
\`\`\`typescript:routes/moduleName.ts
// Koa Router 路由定义
\`\`\`

2. Service 文件：
\`\`\`typescript:services/moduleNameService.ts
// 业务逻辑层
\`\`\`

3. 中间件文件（如需要）：
\`\`\`typescript:middleware/auth.ts
// 认证/授权中间件
\`\`\`

4. 环境变量模板：
\`\`\`env:.env.template
# 环境变量模板
\`\`\`

【代码规范 - 必须严格遵守】
1. 路由层（Controller）：
   - 使用 @koa/router
   - 只负责参数校验、调用 Service、返回响应
   - 统一响应格式：{ success: boolean, data?: any, message?: string, pagination?: object }
   - 分页参数：page（默认1）、limit（默认20，最大100）
2. Service 层：
   - 封装所有业务逻辑和数据库操作
   - 使用 async/await
   - 错误使用自定义 Error 类抛出
3. 中间件：
   - auth 中间件：JWT 验证 + 角色检查
   - validate 中间件：请求参数校验
4. 每个 CRUD 操作必须完整实现：
   - Create：参数校验 → 创建 → 返回
   - Read：支持分页、搜索、筛选、排序
   - Update：参数校验 → 查找 → 更新 → 返回
   - Delete：软删除（isDeleted: true）

【安全要求 - 必须严格遵守】
1. 所有路由必须添加 auth 中间件（公开接口除外）
2. 密码必须使用 bcrypt 加密（cost factor >= 10）
3. 禁止直接拼接用户输入到 MongoDB 查询（防注入）
4. 分页 limit 上限 100（防 DoS）
5. 敏感操作（删除、修改权限）必须检查角色权限
6. 所有输入必须做类型和长度校验

请直接输出所有后端代码文件，不要输出解释文字。`;

const FS_FRONTEND_ENGINEER_PROMPT = `你是一个资深 React 前端工程师，专精于 React + TypeScript。
请根据需求分析和 API 接口清单，生成完整的前端 React 页面代码。

【输出格式要求】
输出一个完整的 React 组件，用代码块包裹：
\`\`\`jsx
// 完整的 React 前端代码（单文件，包含所有页面和组件）
\`\`\`

【代码规范 - 必须严格遵守】
1. 使用 React 函数组件 + Hooks（useState、useEffect、useCallback）
2. 使用原生 CSS 进行样式设计（通过内联 style 对象或组件内定义 styles 常量）
3. 样式要精致美观、现代化，注重间距、圆角、阴影、配色
4. 组件必须默认导出（export default）
5. 禁止 import React（使用 React 17+ 新 JSX 转换）
6. 禁止 import 外部库（只能使用 React 内置 Hooks）
7. 禁止使用 import 语句（所有依赖通过全局变量获取）
8. 代码必须完整可运行，不能有省略或占位符

【API 调用规范 - 极其重要】
1. 必须使用 fetch 调用后端 API（路径以 /api/ 开头）
2. 每个 CRUD 操作都必须有对应的 fetch 调用函数
3. API 调用函数统一放在组件顶部，格式如下：
   const api = {
     getList: (params) => fetch('/api/模块名?' + new URLSearchParams(params)).then(r => r.json()),
     getById: (id) => fetch('/api/模块名/' + id).then(r => r.json()),
     create: (data) => fetch('/api/模块名', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) }).then(r => r.json()),
     update: (id, data) => fetch('/api/模块名/' + id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) }).then(r => r.json()),
     remove: (id) => fetch('/api/模块名/' + id, { method: 'DELETE' }).then(r => r.json()),
   };
4. 在 useEffect 中调用 API 加载数据，处理 loading 和 error 状态
5. 同时内置一份 MOCK_DATA 作为降级数据，当 API 返回空数组时使用 mock 数据展示
6. 示例模式：
   const [data, setData] = useState(MOCK_DATA); // 初始用 mock 数据
   const [loading, setLoading] = useState(false);
   useEffect(() => {
     setLoading(true);
     api.getList({ page: 1, limit: 20 })
       .then(res => {
         if (res.success && res.data && res.data.length > 0) setData(res.data);
         // 如果 API 返回空数据，保持 mock 数据
       })
       .catch(() => { /* API 未部署时静默降级到 mock 数据 */ })
       .finally(() => setLoading(false));
   }, []);

【页面结构要求】
1. 侧边栏导航：根据菜单配置生成，支持一级/二级菜单
2. 顶部栏：应用名称、用户信息、退出按钮
3. 内容区：根据当前路由渲染对应页面
4. 每个 CRUD 页面必须包含：
   - 数据表格（带分页、搜索、筛选）
   - 新增/编辑弹窗（表单验证）
   - 删除确认弹窗
   - 状态标签（不同状态不同颜色）
   - 操作按钮（编辑、删除、查看详情）
5. MOCK_DATA 至少 8 条，字段与后端 Model 完全一致

【UI 设计要求】
1. 深色主题，配色协调美观
2. 表格行悬停高亮
3. 按钮有 hover 效果
4. 弹窗有遮罩和动画
5. 加载状态有 loading 指示器
6. 空数据有友好提示

请直接输出完整的 React 组件代码，不要输出解释文字。`;

const FS_PERMISSION_ARCHITECT_PROMPT = `你是一个权限系统架构师，专精于 RBAC（基于角色的访问控制）。
请根据需求分析，生成完整的菜单和权限配置。

【输出格式要求】
输出三个 JSON 配置，每个用独立代码块：

1. 菜单配置：
\`\`\`json:menus.json
[
  {
    "key": "dashboard",
    "label": "仪表盘",
    "icon": "DashboardOutlined",
    "path": "/dashboard",
    "permission": "dashboard:view",
    "children": []
  }
]
\`\`\`

2. 权限配置：
\`\`\`json:permissions.json
[
  {
    "key": "dashboard:view",
    "label": "查看仪表盘",
    "module": "dashboard",
    "action": "view"
  }
]
\`\`\`

3. 角色配置：
\`\`\`json:roles.json
[
  {
    "key": "admin",
    "label": "管理员",
    "description": "拥有所有权限",
    "permissions": ["*"]
  },
  {
    "key": "user",
    "label": "普通用户",
    "description": "基本操作权限",
    "permissions": ["dashboard:view", "..."]
  }
]
\`\`\`

【设计规范】
1. 菜单层级不超过 2 级
2. 权限粒度到操作级别（view/create/update/delete）
3. 每个模块至少包含 CRUD 四个权限
4. admin 角色拥有所有权限（使用 "*" 通配符）
5. 菜单 icon 使用 Ant Design 图标名称

请直接输出三个 JSON 配置，不要输出解释文字。`;

const FS_REVIEWER_PROMPT = `你是一个全栈代码质检专家，负责审查和修复全栈项目的所有代码。

【审查范围】
你将收到以下代码：
1. 数据库 Model 代码（Mongoose）
2. 后端路由和 Service 代码（Koa）
3. 前端 React 组件代码
4. 权限配置 JSON

【检查项目 - 必须逐项执行】

一、安全审查（最高优先级）：
1. 密码是否使用 bcrypt 加密
2. 是否有 SQL/NoSQL 注入风险
3. 是否有 XSS 风险（前端输出是否转义）
4. 敏感路由是否有认证中间件
5. 分页 limit 是否有上限限制
6. 文件上传是否有类型和大小限制

二、代码完整性：
1. 所有 CRUD 操作是否完整实现
2. 前后端 API 路径是否一致
3. 数据库字段与前端表单字段是否匹配
4. 权限配置是否覆盖所有路由

三、代码质量：
1. TypeScript 类型是否完整
2. 错误处理是否完善
3. 是否有未使用的变量或导入
4. 命名是否规范（camelCase 变量、PascalCase 组件）

四、前端专项（极其重要）：
1. React 组件是否使用函数组件 + Hooks
2. 样式是否使用内联 style 对象
3. 是否有 key prop 缺失
4. 事件处理函数是否以 handle 前缀命名
5. **禁止 import 语句**：前端代码中不能有任何 import 语句（代码运行在浏览器 script 标签中）
6. **禁止 require 语句**
7. **禁止引用外部库**（antd、axios、lodash、moment 等都不能用）
8. **必须使用 fetch 调用 API**：每个 CRUD 操作都必须有对应的 fetch('/api/xxx') 调用
9. **必须内置 MOCK_DATA**：作为 API 未部署时的降级数据

【输出要求】
按以下格式输出修复后的完整代码（每个文件一个代码块）：

数据库代码：
\`\`\`typescript:models/ALL_MODELS
// 所有 Model 代码合并输出
\`\`\`

后端路由代码：
\`\`\`typescript:routes/ALL_ROUTES
// 所有路由代码合并输出
\`\`\`

后端 Service 代码：
\`\`\`typescript:services/ALL_SERVICES
// 所有 Service 代码合并输出
\`\`\`

中间件代码：
\`\`\`typescript:middleware/ALL_MIDDLEWARE
// 所有中间件代码合并输出
\`\`\`

环境变量模板：
\`\`\`env:.env.template
// 环境变量
\`\`\`

前端代码：
\`\`\`jsx
// 完整的 React 前端代码（禁止 import 语句）
\`\`\`

菜单配置：
\`\`\`json:menus.json
// 菜单配置
\`\`\`

权限配置：
\`\`\`json:permissions.json
// 权限配置
\`\`\`

角色配置：
\`\`\`json:roles.json
// 角色配置
\`\`\`

如果代码已经完整正确，直接原样输出。不要输出任何解释文字，只输出代码块。`;

// =============================================================================
// § 7d-b  工具函数
// =============================================================================

/** 从数据库读取 Prompt，不存在则使用内置 fallback */
const getPrompt = async (key: string, fallback = ''): Promise<string> => {
  const doc = await SystemPrompt.findOne<ISystemPrompt>({ key, isActive: true }).lean();
  return doc?.content ?? fallback;
};

/** 加载所有全栈 Pipeline Agent 的 Prompt */
const getFullStackAgents = async () => ({
  analyst:     await getPrompt('fs_pipeline_analyst',     FS_ANALYST_PROMPT),
  dbArchitect: await getPrompt('fs_pipeline_db_architect', FS_DB_ARCHITECT_PROMPT),
  backend:     await getPrompt('fs_pipeline_backend',     FS_BACKEND_ENGINEER_PROMPT),
  frontend:    await getPrompt('fs_pipeline_frontend',    FS_FRONTEND_ENGINEER_PROMPT),
  permission:  await getPrompt('fs_pipeline_permission',  FS_PERMISSION_ARCHITECT_PROMPT),
  reviewer:    await getPrompt('fs_pipeline_reviewer',    FS_REVIEWER_PROMPT),
});

/** 截断文本到指定字符数，保留完整行 */
const truncateText = (text: string, maxChars: number): string => {
  if (text.length <= maxChars) return text;
  const truncated = text.slice(0, maxChars);
  const lastNewline = truncated.lastIndexOf('\n');
  return (lastNewline > maxChars * 0.8 ? truncated.slice(0, lastNewline) : truncated) + '\n... (已截断)';
};

/** 带超时的 Promise 包装 */
const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`[${label}] 超时（${ms / 1000}s），本地模型可能无法处理过长的上下文`)), ms)
    ),
  ]);

/**
 * 执行单个 Pipeline 步骤（流式收集，返回完整内容）
 *
 * 增强特性：
 *   - 超时保护（整体超时 + chunk 间隔超时）
 *   - 心跳回调（SSE 保活）
 *   - 实时进度回调（向前端推送已生成字符数和续写次数）
 *   - 续写感知（检测到续写时通知前端）
 *   - 空输出保护（模型完全卡住时提前结束）
 */
const runStep = async (
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: { provider: string; modelType: string },
  stepOptions?: {
    timeoutMs?: number;
    onHeartbeat?: () => void;
    onProgress?: (info: { chars: number; continuations: number }) => void;
    label?: string;
  }
): Promise<string> => {
  const timeoutMs = stepOptions?.timeoutMs ?? 300_000; // 默认 5 分钟超时
  const label = stepOptions?.label ?? 'Pipeline Step';

  const execute = async (): Promise<string> => {
    let result = '';
    let lastChunkTime = Date.now();
    let continuations = 0;
    const CHUNK_TIMEOUT = 120_000; // 单个 chunk 间隔超时 2 分钟
    const PROGRESS_INTERVAL = 3_000; // 每 3 秒推送一次进度
    let lastProgressTime = 0;

    const stream = streamWithContinuation(messages, options);
    for await (const chunk of stream) {
      const now = Date.now();

      if (chunk.delta) {
        result += chunk.delta;
        lastChunkTime = now;

        // 定期推送进度
        if (now - lastProgressTime > PROGRESS_INTERVAL) {
          lastProgressTime = now;
          stepOptions?.onProgress?.({ chars: result.length, continuations });
        }
      }

      // 检测续写事件
      if ('continuationIndex' in chunk && chunk.continuationIndex) {
        continuations = chunk.continuationIndex;
        console.log(`[${label}] 续写第 ${continuations} 次，已累计 ${result.length} 字符`);
        stepOptions?.onProgress?.({ chars: result.length, continuations });
      }

      // 检查单个 chunk 间隔是否超时（模型卡住不输出）
      if (now - lastChunkTime > CHUNK_TIMEOUT && !chunk.done) {
        console.warn(`[${label}] 模型超过 ${CHUNK_TIMEOUT / 1000}s 未输出新内容，提前结束（已收集 ${result.length} 字符）`);
        break;
      }

      // 心跳回调（用于 SSE 保活）
      stepOptions?.onHeartbeat?.();
      if (chunk.done) break;
    }

    // 空输出保护
    if (!result.trim()) {
      throw new Error(`[${label}] 模型未返回任何内容，可能是上下文过长或模型不可用`);
    }

    console.log(`[${label}] 完成，共 ${result.length} 字符，续写 ${continuations} 次`);
    return result;
  };

  return withTimeout(execute(), timeoutMs, label);
};

// =============================================================================
// § 7d-c  代码提取工具函数
// =============================================================================

/** 从 LLM 输出中提取带文件路径标注的代码块 */
const extractTaggedCodeBlocks = (raw: string): Array<{ tag: string; content: string }> => {
  const blocks: Array<{ tag: string; content: string }> = [];
  const regex = /```(?:typescript|ts|javascript|js|json|env|jsx|tsx):([^\n]+)\n([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    blocks.push({ tag: match[1].trim(), content: match[2].trim() });
  }
  return blocks;
};

/** 从 LLM 输出中提取 JSX 代码块 */
const extractJsxBlock = (raw: string): string => {
  const match = raw.match(/```(?:jsx|tsx)\n([\s\S]*?)```/i);
  if (match) return match[1].trim();
  // 降级：尝试匹配未闭合的代码块
  const openMatch = raw.match(/```(?:jsx|tsx)\n([\s\S]+)$/i);
  if (openMatch) return openMatch[1].trim();
  return '';
};

/** 从 LLM 输出中提取 JSON 代码块 */
const extractJsonBlock = (raw: string, fileTag: string): string => {
  // 优先匹配带文件标签的代码块
  const taggedRegex = new RegExp(`\`\`\`json:${fileTag.replace('.', '\\.')}\\n([\\s\\S]*?)\`\`\``, 'i');
  const taggedMatch = raw.match(taggedRegex);
  if (taggedMatch) return taggedMatch[1].trim();
  return '';
};

/** 合并同类代码块（如多个 model 文件合并为一个） */
const mergeCodeBlocks = (blocks: Array<{ tag: string; content: string }>, pathPrefix: string): string => {
  return blocks
    .filter((b) => b.tag.startsWith(pathPrefix) || b.tag.includes(pathPrefix))
    .map((b) => `// ─── ${b.tag} ───\n${b.content}`)
    .join('\n\n');
};

// =============================================================================
// § 7d-d  全栈 Pipeline 路由  POST /api/vibe/fullstack-pipeline
// =============================================================================

vibeFullStackPipelineRouter.post('/vibe/fullstack-pipeline', async (ctx) => {
  const { prompt, provider = env.activeProvider, modelType = 'text' } = ctx.request.body as Record<string, string>;

  if (!prompt?.trim()) {
    ctx.status = 400;
    ctx.body = { success: false, message: '请提供需求描述' };
    return;
  }

  ctx.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  ctx.status = 200;

  const res = ctx.res;
  const opts = { provider, modelType };

  const send = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // SSE 心跳定时器：每 15 秒发送一次心跳，防止连接超时
  const heartbeatInterval = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 15_000);

  send({ type: 'start' });

  // 上下文长度限制（Ollama 本地模型上下文窗口有限）
  const MAX_ANALYSIS_CHARS = 3000;   // 需求分析最大字符数
  const MAX_DB_CHARS = 4000;         // 数据库 Schema 最大字符数
  const MAX_BACKEND_CHARS = 5000;    // 后端代码最大字符数
  const MAX_FRONTEND_CHARS = 5000;   // 前端代码最大字符数
  const MAX_PERMISSION_CHARS = 2000; // 权限配置最大字符数
  const STEP_TIMEOUT = 300_000;      // 每步超时 5 分钟

  const stepHeartbeat = () => send({ type: 'heartbeat' });

  /** 创建带进度推送的步骤选项 */
  const makeStepOpts = (step: number, label: string) => ({
    timeoutMs: STEP_TIMEOUT,
    onHeartbeat: stepHeartbeat,
    label,
    onProgress: (info: { chars: number; continuations: number }) => {
      send({
        type: 'step',
        step,
        total: 6,
        title: info.continuations > 0
          ? `${['📋', '🗄️', '⚙️', '🎨', '🔐', '🔧'][step - 1]} 续写中（第${info.continuations}次）... 已生成 ${info.chars} 字符`
          : `${['📋', '🗄️', '⚙️', '🎨', '🔐', '🔧'][step - 1]} 生成中... 已生成 ${info.chars} 字符`,
        status: 'running',
      });
    },
  });

  try {
    const AGENTS = await getFullStackAgents();

    // ── Step 1: 需求分析 ──────────────────────────────────────────────────
    send({ type: 'step', step: 1, total: 6, title: '📋 全栈需求分析中...', status: 'running' });

    const analysisResult = await runStep([
      { role: 'system', content: AGENTS.analyst },
      { role: 'user', content: `请分析以下全栈应用需求：\n\n${prompt}` },
    ], opts, makeStepOpts(1, 'Step1-需求分析'));

    send({ type: 'step', step: 1, total: 6, title: '📋 需求分析完成', status: 'done', content: analysisResult });

    // ── Step 2: 数据库架构设计 ────────────────────────────────────────────
    send({ type: 'step', step: 2, total: 6, title: '🗄️ 数据库架构设计中...', status: 'running' });

    const dbResult = await runStep([
      { role: 'system', content: AGENTS.dbArchitect },
      {
        role: 'user',
        content: `请根据以下需求分析，设计 MongoDB 数据库架构并生成 Mongoose Model 代码。\n\n【原始需求】\n${prompt}\n\n【需求分析】\n${truncateText(analysisResult, MAX_ANALYSIS_CHARS)}`,
      },
    ], opts, makeStepOpts(2, 'Step2-数据库架构'));

    send({ type: 'step', step: 2, total: 6, title: '🗄️ 数据库架构完成', status: 'done', content: dbResult });

    // ── Step 3: 后端工程 ──────────────────────────────────────────────────
    send({ type: 'step', step: 3, total: 6, title: '⚙️ 后端代码生成中...', status: 'running' });

    const backendResult = await runStep([
      { role: 'system', content: AGENTS.backend },
      {
        role: 'user',
        content: `请根据以下需求分析和数据库 Schema，生成完整的后端 CRUD 代码。

【原始需求】
${prompt}

【需求分析（摘要）】
${truncateText(analysisResult, MAX_ANALYSIS_CHARS)}

【数据库 Schema】
${truncateText(dbResult, MAX_DB_CHARS)}

【强制要求】
- 每个 CRUD 操作都必须完整实现
- 所有路由必须添加认证中间件
- 密码必须 bcrypt 加密
- 分页 limit 上限 100
- 代码必须完整，不能有 TODO 或省略号`,
      },
    ], opts, makeStepOpts(3, 'Step3-后端工程'));

    send({ type: 'step', step: 3, total: 6, title: '⚙️ 后端代码完成', status: 'done', content: backendResult });

    // ── Step 4: 前端工程 ──────────────────────────────────────────────────
    send({ type: 'step', step: 4, total: 6, title: '🎨 前端代码生成中...', status: 'running' });

    const frontendResult = await runStep([
      { role: 'system', content: AGENTS.frontend },
      {
        role: 'user',
        content: `请根据以下需求分析和 API 接口，生成完整的 React 前端代码。

【原始需求】
${prompt}

【需求分析（摘要）】
${truncateText(analysisResult, MAX_ANALYSIS_CHARS)}

【后端 API 代码（参考接口路径和数据结构）】
${truncateText(backendResult, MAX_BACKEND_CHARS)}

【强制要求 - 必须严格遵守】
- 使用 React 函数组件 + Hooks
- 使用原生 CSS 内联样式（style 对象），禁止使用 Tailwind/className
- 每个 CRUD 页面都必须完整实现（表格+弹窗+搜索+分页）
- 侧边栏导航根据模块自动生成
- 深色主题，配色美观
- 代码必须完整，不能有 TODO 或省略号
- 组件必须默认导出（export default）

【API 调用 - 极其重要】
- 必须使用 fetch('/api/xxx') 调用后端 API，路径与后端路由完全一致
- 每个模块的 CRUD 操作都必须有对应的 fetch 调用
- 同时内置 MOCK_DATA 作为降级数据（至少 8 条）
- useEffect 中调用 API 加载数据，API 失败时静默降级到 mock 数据

【禁止事项】
- 禁止使用 import 语句（代码运行在浏览器 script 标签中）
- 禁止使用 require 语句
- 禁止引用任何外部库（antd、axios、lodash 等都不能用）
- 只能使用 React 内置 Hooks 和原生 DOM API`,
      },
    ], opts, makeStepOpts(4, 'Step4-前端工程'));

    send({ type: 'step', step: 4, total: 6, title: '🎨 前端代码完成', status: 'done', content: frontendResult });

    // ── Step 5: 权限配置 ──────────────────────────────────────────────────
    send({ type: 'step', step: 5, total: 6, title: '🔐 权限配置生成中...', status: 'running' });

    const permissionResult = await runStep([
      { role: 'system', content: AGENTS.permission },
      {
        role: 'user',
        content: `请根据以下需求分析，生成完整的菜单和权限配置。\n\n【原始需求】\n${prompt}\n\n【需求分析】\n${truncateText(analysisResult, MAX_ANALYSIS_CHARS)}`,
      },
    ], opts, makeStepOpts(5, 'Step5-权限配置'));

    send({ type: 'step', step: 5, total: 6, title: '🔐 权限配置完成', status: 'done', content: permissionResult });

    // ── Step 6: 质检整合 ──────────────────────────────────────────────────
    send({ type: 'step', step: 6, total: 6, title: '🔧 全栈质检中...', status: 'running' });

    const reviewResult = await runStep([
      { role: 'system', content: AGENTS.reviewer },
      {
        role: 'user',
        content: `请审查并修复以下全栈项目代码：

【数据库 Model 代码】
${truncateText(dbResult, MAX_DB_CHARS)}

【后端路由和 Service 代码】
${truncateText(backendResult, MAX_BACKEND_CHARS)}

【前端 React 代码】
${truncateText(frontendResult, MAX_FRONTEND_CHARS)}

【权限配置】
${truncateText(permissionResult, MAX_PERMISSION_CHARS)}

请按照审查清单逐项检查，修复所有问题后输出完整代码。`,
      },
    ], opts, makeStepOpts(6, 'Step6-质检整合'));

    send({ type: 'step', step: 6, total: 6, title: '🔧 质检完成', status: 'done' });

    // ── 解析质检后的最终代码 ──────────────────────────────────────────────

    // 从质检结果中提取各部分代码
    const taggedBlocks = extractTaggedCodeBlocks(reviewResult);

    // 后端代码提取
    const modelCode = mergeCodeBlocks(taggedBlocks, 'models/') || mergeCodeBlocks(extractTaggedCodeBlocks(dbResult), 'models/');
    const routeCode = mergeCodeBlocks(taggedBlocks, 'routes/') || mergeCodeBlocks(extractTaggedCodeBlocks(backendResult), 'routes/');
    const serviceCode = mergeCodeBlocks(taggedBlocks, 'services/') || mergeCodeBlocks(extractTaggedCodeBlocks(backendResult), 'services/');
    const middlewareCode = mergeCodeBlocks(taggedBlocks, 'middleware/') || mergeCodeBlocks(extractTaggedCodeBlocks(backendResult), 'middleware/');
    const envTemplate = taggedBlocks.find((b) => b.tag.includes('.env'))?.content
      || extractTaggedCodeBlocks(backendResult).find((b) => b.tag.includes('.env'))?.content
      || '';

    // 前端代码提取
    const jsxCode = extractJsxBlock(reviewResult) || extractJsxBlock(frontendResult);

    // 权限配置提取（优先从质检结果，降级到原始结果）
    const menusJson = extractJsonBlock(reviewResult, 'menus.json') || extractJsonBlock(permissionResult, 'menus.json');
    const permissionsJson = extractJsonBlock(reviewResult, 'permissions.json') || extractJsonBlock(permissionResult, 'permissions.json');
    const rolesJson = extractJsonBlock(reviewResult, 'roles.json') || extractJsonBlock(permissionResult, 'roles.json');

    // ── 构建最终输出 ──────────────────────────────────────────────────────

    const serverParts = {
      model: modelCode,
      route: routeCode,
      service: serviceCode,
      middleware: middlewareCode,
      envTemplate,
    };

    const dbSchema = {
      collections: modelCode, // Model 代码即为集合定义
      indexes: '',            // 索引已包含在 Model 代码中
      seedData: '',           // 种子数据可后续扩展
    };

    const menuConfig = {
      menus: menusJson,
      permissions: permissionsJson,
      roles: rolesJson,
    };

    // 前端代码作为 codeParts 返回
    const codeParts = {
      html: '',
      css: '',
      js: '',
      jsx: jsxCode,
      isReact: true,
      isFullHtml: false,
    };

    send({
      type: 'done',
      content: jsxCode ? `\`\`\`jsx\n${jsxCode}\n\`\`\`` : '',
      codeParts,
      serverParts,
      dbSchema,
      menuConfig,
      analysis: analysisResult,
      isFullStack: true,
    });
  } catch (err: any) {
    const errMsg = err?.message || '全栈生成失败，请重试';
    const isTimeout = errMsg.includes('超时');
    send({
      type: 'error',
      message: isTimeout
        ? `${errMsg}。建议：1) 简化需求描述 2) 使用更强的模型 3) 增大 Ollama 上下文窗口（num_ctx）`
        : errMsg,
    });
  } finally {
    clearInterval(heartbeatInterval);
    res.end();
  }
});
