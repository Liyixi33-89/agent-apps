/**
 * @file routes/vibeFullStackPipeline.ts
 * @description § 7d  Vibe Coding — 全栈 CRUD Pipeline（5步流水线）
 *
 * 执行顺序：
 *   Step 1 - 需求分析 Agent    → 拆解功能模块、数据实体、API 清单
 *   Step 2 - 数据库架构 Agent  → 设计 MongoDB Schema + 索引 + 验证
 *   Step 3 - 后端工程 Agent    → 生成 Koa 路由 + Service + 中间件
 *   Step 4 - 前端工程 Agent    → 生成 React 页面 + API 调用层
 *   Step 5 - 质检整合 Agent    → 审查全部代码 → 安全 + 一致性 + 完整性
 *
 * 路由列表：
 *   POST /api/vibe/fullstack-pipeline  → 全栈 Pipeline 流式生成（SSE）
 */

import Router from '@koa/router';
import { SystemPrompt } from '../models/SystemPrompt.js';
import type { ISystemPrompt } from '../models/SystemPrompt.js';
import { VibeTemplate } from '../models/VibeTemplate.js';
import { env } from '../config/env.js';
import { streamWithContinuation } from '../lib/llmUtils.js';
import { deployAppBackend } from './vibeAppRuntime.js';

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

const FS_FRONTEND_ENGINEER_PROMPT = `你是一个资深 React 前端工程师，专精于 React 18 + 纯 CSS 内联样式。
请根据需求分析和 API 接口清单，生成完整的前端 React 页面代码。

【输出格式要求】
输出一个完整的 React 组件，用代码块包裹：
\`\`\`jsx
// 完整的 React 前端代码（单文件，包含所有页面和组件）
\`\`\`

【⚠️ 代码长度限制 - 最高优先级】
你的输出 token 有限，必须用最紧凑的方式写完所有模块。关键策略：
1. **使用 CRUD 页面工厂**：写一个通用的 CrudPage 组件，接收 columns/fields/apiName 配置，自动生成完整 CRUD 页面
2. **每个模块只需一行配置**：如 <CrudPage apiName="order" columns={orderColumns} fields={orderFields} />
3. **绝对不要为每个模块重复写 CRUD 逻辑**，这是代码被截断的主要原因
4. 变量名可以适当缩短（如 s 代替 styles），样式对象用展开运算符复用
5. 不要写注释，不要写空行，代码越短越好

【架构设计 - 极其重要】
必须严格按照以下架构，确保代码紧凑且所有模块完整：

\`\`\`
// 1. 样式常量（一个 S 对象包含所有样式）
const S = { bg:'#0f172a', card:'#1e293b', border:'#334155', primary:'#7c3aed', ... };

// 2. API 工厂函数（一个函数生成所有 CRUD 方法）
const api = (name) => ({ list:(p)=>fetch(...), create:(d)=>fetch(...), update:(id,d)=>fetch(...), del:(id)=>fetch(...) });

// 3. 通用组件（Table, Modal, Pagination）— 所有页面复用
const Table = ({columns, data, onEdit, onDel}) => ...;
const Modal = ({show, title, onClose, children, onOk}) => ...;
const Pagination = ({page, total, onChange}) => ...;

// 4. ⭐ CrudPage 工厂组件（核心！接收配置自动生成完整 CRUD 页面）
const CrudPage = ({apiName, title, columns, fields, mockData}) => {
  // 内置：列表查询、搜索、分页、新增弹窗、编辑弹窗、删除确认
  // 所有 CRUD 逻辑只写一次！
};

// 5. 各模块配置（每个模块只需定义 columns 和 fields）
const orderColumns = [...]; const orderFields = [...];
const productColumns = [...]; const productFields = [...];
// ... 其他模块

// 6. App 主组件（侧边栏 + 页面切换）
const App = () => {
  const [page, setPage] = useState('order');
  const pages = { order: <CrudPage apiName="order" .../>, product: <CrudPage .../>, ... };
  return <div>侧边栏 + {pages[page]}</div>;
};
export default App;
\`\`\`

【CrudPage 工厂组件 - 必须实现的功能】
CrudPage 接收以下 props：
- apiName: string — API 实体名（如 'order'）
- title: string — 页面标题
- columns: Array<{key, label, render?}> — 表格列配置
- fields: Array<{key, label, type, options?}> — 表单字段配置（type: 'text'|'number'|'select'|'textarea'）
- mockData?: Array — 降级 mock 数据（至少 3 条）

CrudPage 内部自动实现：
a. 列表查询 + 搜索 + 分页
b. 新增弹窗 + 表单
c. 编辑弹窗 + 数据回填
d. 删除确认
e. API 失败时降级到 mockData

【⚠️ 防御性编程 - 极其重要】
所有从 API 获取的数据必须做防御性处理：
1. fetch 返回的 data 可能是 undefined/null，必须用 || [] 兜底
2. 示例：const list = (res.data || []);  // 而不是直接 res.data.map(...)
3. Table 组件的 data prop 必须有默认值：const Table = ({columns, data = [], ...}) => ...
4. 分页的 total 也要兜底：const total = res.pagination?.total || res.total || 0;
5. 所有 .map() 调用前必须确保目标是数组：(Array.isArray(data) ? data : []).map(...)

【代码规范】
1. React 函数组件 + Hooks
2. 原生 CSS 内联样式（style 对象），禁止 className
3. 深色主题，配色美观
4. export default App
5. 【极其重要】确保所有括号（圆括号、花括号、方括号）严格配对闭合，尤其是多层嵌套的 React.createElement 调用和箭头函数。每个 ( 必须有对应的 )，每个 { 必须有对应的 }，每个 [ 必须有对应的 ]。括号不匹配会导致编译失败。

【禁止事项】
- ❌ 禁止 import/require 语句
- ❌ 禁止外部库（antd、axios、lodash 等）
- ❌ 禁止 className
- ❌ 禁止 React Router（用 state 切换）
- ❌ 禁止为每个模块重复写 CRUD 逻辑（必须用 CrudPage 工厂）

【API 路径格式】
fetch('/api/' + apiName + '?page=1&limit=20')
fetch('/api/' + apiName, {method:'POST', ...})
fetch('/api/' + apiName + '/' + id, {method:'PUT', ...})
fetch('/api/' + apiName + '/' + id, {method:'DELETE'})

【UI 设计】
1. 深色主题（#0f172a / #1e293b / #334155）
2. 主色调紫色（#7c3aed）
3. 左侧边栏 + 顶部栏 + 内容区
4. 表格行悬停高亮，按钮有 hover 效果

请直接输出完整代码，不要解释。`;



const FS_REVIEWER_PROMPT = `你是一个全栈代码质检专家，负责审查和修复全栈项目的所有代码。

【⚠️ 最高优先级 — 代码长度控制】
你的输出 token 有限！请遵循以下原则：
1. **前端代码如果基本完整，直接原样输出**，不要重写
2. 只修复明确的 bug（如 import 语句、className 使用、API 路径错误）
3. 后端代码同理，只修复问题，不要重构
4. 如果代码已经正确，直接复制粘贴原代码到对应代码块中

【审查清单 — 快速检查】

一、前端硬性规则（违反必修复）：
- ❌ 有 import/require 语句 → 删除
- ❌ 有 className → 改为 style
- ❌ 用了 axios → 改为 fetch
- ❌ 缺少 export default → 补上
- ❌ 缺少 CRUD 功能 → 补全（使用 CrudPage 工厂模式）
- ❌ data.map() 没有防御 → 改为 (data || []).map() 或 (Array.isArray(data) ? data : []).map()
- ❌ 直接使用 res.data 没有兜底 → 改为 (res.data || [])
- ❌ 括号不匹配（圆括号/花括号/方括号未正确闭合）→ 逐行检查并修复，尤其是多层嵌套的 React.createElement 和箭头函数

二、API 路径一致性：
- 前端 fetch 路径以 /api/ 开头
- 实体名小写（/api/order、/api/product）

三、后端检查：
- 路由有认证中间件
- 密码 bcrypt 加密
- 分页 limit 上限 100

【输出格式 — 每个文件一个代码块】

\`\`\`typescript:models/ALL_MODELS
// Model 代码（如无修改，原样输出）
\`\`\`

\`\`\`typescript:routes/ALL_ROUTES
// 路由代码
\`\`\`

\`\`\`typescript:services/ALL_SERVICES
// Service 代码
\`\`\`

\`\`\`typescript:middleware/ALL_MIDDLEWARE
// 中间件代码
\`\`\`

\`\`\`env:.env.template
// 环境变量
\`\`\`

\`\`\`jsx
// 前端 React 代码（⚠️ 如果原代码基本正确，直接原样输出！不要重写！）
\`\`\`

只输出代码块，不要输出解释文字。`;

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
    const MAX_BACKEND_CHARS = 6000;    // 后端代码最大字符数
    const MAX_FRONTEND_CHARS = 8000;   // 前端代码最大字符数（增大以保留更多页面）
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
        total: 5,
        title: info.continuations > 0
          ? `${['📋', '🗄️', '⚙️', '🎨', ''][step - 1]} 续写中（第${info.continuations}次）... 已生成 ${info.chars} 字符`
          : `${['📋', '🗄️', '⚙️', '🎨', ''][step - 1]} 生成中... 已生成 ${info.chars} 字符`,
        status: 'running',
      });
    },
  });

  try {
    const AGENTS = await getFullStackAgents();

    // ── Step 1: 需求分析 ──────────────────────────────────────────────────
    send({ type: 'step', step: 1, total: 5, title: '📋 全栈需求分析中...', status: 'running' });

    const analysisResult = await runStep([
      { role: 'system', content: AGENTS.analyst },
      { role: 'user', content: `请分析以下全栈应用需求：\n\n${prompt}` },
    ], opts, makeStepOpts(1, 'Step1-需求分析'));

    send({ type: 'step', step: 1, total: 5, title: '📋 需求分析完成', status: 'done', content: analysisResult });

    // ── Step 2: 数据库架构设计 ────────────────────────────────────────────
    send({ type: 'step', step: 2, total: 5, title: '🗄️ 数据库架构设计中...', status: 'running' });

    const dbResult = await runStep([
      { role: 'system', content: AGENTS.dbArchitect },
      {
        role: 'user',
        content: `请根据以下需求分析，设计 MongoDB 数据库架构并生成 Mongoose Model 代码。\n\n【原始需求】\n${prompt}\n\n【需求分析】\n${truncateText(analysisResult, MAX_ANALYSIS_CHARS)}`,
      },
    ], opts, makeStepOpts(2, 'Step2-数据库架构'));

    send({ type: 'step', step: 2, total: 5, title: '🗄️ 数据库架构完成', status: 'done', content: dbResult });

    // ── Step 3: 后端工程 ──────────────────────────────────────────────────
    send({ type: 'step', step: 3, total: 5, title: '⚙️ 后端代码生成中...', status: 'running' });

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

    send({ type: 'step', step: 3, total: 5, title: '⚙️ 后端代码完成', status: 'done', content: backendResult });

    // ── Step 4: 前端工程 ──────────────────────────────────────────────────
    send({ type: 'step', step: 4, total: 5, title: '🎨 前端代码生成中...', status: 'running' });

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

【⚠️ 最重要的要求 — 使用 CrudPage 工厂模式】
你必须写一个通用的 CrudPage 组件，内置完整的 CRUD 逻辑（列表、搜索、分页、新增、编辑、删除）。
然后每个模块只需传入 columns/fields/apiName 配置即可，不要为每个模块重复写 CRUD 代码！
这是确保所有模块都能完整生成的关键策略。

【强制要求】
1. React 函数组件 + Hooks，原生 CSS 内联样式（禁止 className）
2. 深色主题，export default App
3. 代码必须完整，不能有 TODO 或省略号
4. 禁止 import/require/外部库
5. API 路径：/api/order、/api/product、/api/user 等小写实体名
6. 【极其重要】确保所有括号（圆括号、花括号、方括号）严格配对闭合，括号不匹配会导致编译失败
7. 【空值保护】遍历数组数据时必须做空值过滤：使用 (data || []).filter(Boolean).map(...) 而非直接 data.map(...)。访问对象属性时使用可选链 item?.name 或默认值 item.name || ''，防止后端返回 null 数据导致运行时崩溃
8. 【style 规范】style 属性必须是纯对象（如 style={{ color: 'red', padding: 8 }}），绝对禁止传入数组（如 style={[{}, {}]}），禁止传入字符串。多个样式对象请用展开运算符合并：style={{ ...baseStyle, ...activeStyle }}`,
      },
    ], opts, makeStepOpts(4, 'Step4-前端工程'));

    send({ type: 'step', step: 4, total: 5, title: '🎨 前端代码完成', status: 'done', content: frontendResult });

    // ── Step 5: 质检整合 ──────────────────────────────────────────────────
    send({ type: 'step', step: 5, total: 5, title: '🔧 全栈质检中...', status: 'running' });

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

请按照审查清单逐项检查，修复所有问题后输出完整代码。`,
      },
    ], opts, makeStepOpts(5, 'Step5-质检整合'));

    send({ type: 'step', step: 5, total: 5, title: '🔧 质检完成', status: 'done' });

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

    // 前端代码作为 codeParts 返回
    const codeParts = {
      html: '',
      css: '',
      js: '',
      jsx: jsxCode,
      isReact: true,
      isFullHtml: false,
    };

    // ── 质检完成后自动保存到数据库并部署后端 ─────────────────────────────
    let savedAppId: string | undefined;
    let runtimeApiBase: string | undefined;

    try {
      // 从原始 prompt 中提取标题（取前 30 个字符）
      const autoTitle = prompt.trim().slice(0, 30) || '全栈应用';

      // 保存到数据库（isActive: false，不在模板市场展示）
      const savedApp = await VibeTemplate.create({
        title: autoTitle,
        description: `由全栈 Pipeline 自动生成`,
        category: '后台管理',
        author: 'pipeline',
        codeParts,
        isFullStack: true,
        serverParts,
        dbSchema,
        isActive: false,
        publishedAt: new Date(),
      });

      savedAppId = savedApp._id.toString();
      console.log(`✅ Pipeline 自动保存应用: ${savedAppId}`);

      // 自动部署后端（创建动态路由 + Mongoose Model）
      if (serverParts.model) {
        try {
          const deployResult = await deployAppBackend(savedAppId);
          runtimeApiBase = deployResult.basePath;
          console.log(`✅ Pipeline 自动部署后端成功: ${runtimeApiBase}，${deployResult.collections.length} 个集合`);
        } catch (deployErr: any) {
          console.warn(`⚠️ Pipeline 自动部署后端失败（不影响保存）: ${deployErr?.message}`);
        }
      }
    } catch (saveErr: any) {
      console.warn(`⚠️ Pipeline 自动保存失败: ${saveErr?.message}`);
    }

    send({
      type: 'done',
      content: jsxCode ? `\`\`\`jsx\n${jsxCode}\n\`\`\`` : '',
      codeParts,
      serverParts,
      dbSchema,
      analysis: analysisResult,
      isFullStack: true,
      // 新增：返回自动保存和部署的信息
      appId: savedAppId,
      runtimeApiBase,
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
