# AI 核心概念与架构解析

> 本文基于 **Agency Agents Platform v2.0** 项目的真实代码，系统梳理现代 AI Agent 系统中的八大核心概念：LLM、Token、Context、Prompt、Tool、MCP、Agent、Agent Skill。每个概念均结合项目源码进行说明，帮助读者从工程视角理解 AI 系统的运作原理。

---

## 目录

1. [LLM — 大语言模型](#1-llm--大语言模型)
2. [Token — 语言的最小单元](#2-token--语言的最小单元)
3. [Context — 上下文窗口](#3-context--上下文窗口)
4. [Prompt — 提示词工程](#4-prompt--提示词工程)
5. [Tool — 工具调用](#5-tool--工具调用)
6. [MCP — 模型上下文协议](#6-mcp--模型上下文协议)
7. [Agent — 智能代理](#7-agent--智能代理)
8. [Agent Skill — 可编排的能力单元](#8-agent-skill--可编排的能力单元)
9. [八大概念的协作关系](#9-八大概念的协作关系)

---

## 1. LLM — 大语言模型

### 什么是 LLM？

LLM（Large Language Model，大语言模型）是整个 AI Agent 系统的"大脑"。它通过海量文本训练，学会了理解自然语言、推理逻辑、生成代码等能力。在工程实践中，我们通常不直接训练 LLM，而是通过 **API 调用**的方式使用它。

### 项目中的 LLM 接入

本项目支持两种 LLM 提供商，通过环境变量 `ACTIVE_PROVIDER` 切换：

| 提供商 | 特点 | 适用场景 |
|--------|------|----------|
| **Ollama** 🦙 | 本地部署，数据不出境，零成本 | 开发调试、隐私敏感场景 |
| **OpenAI** 🤖 | 云端 API，能力更强，按量计费 | 生产环境、复杂推理任务 |

每个提供商还区分了两种模型类型：

```typescript
// server/src/services/llmService.ts
export interface LLMResponse {
  content: string;
  provider: 'ollama' | 'openai';
  model: string;
  usage?: { promptTokens: number; completionTokens: number };
}

// 文本模型：处理纯文字对话、代码生成
// 视觉模型：处理图片 + 文字的多模态输入
const model = modelType === 'vision'
  ? env.ollamaVisionModel   // 如 qwen3-vl
  : env.ollamaTextModel;    // 如 gpt-oss
```

### 统一调用层

项目封装了统一的 LLM 调用入口，屏蔽了不同提供商的 API 差异：

```typescript
// 普通调用（一次性返回完整结果）
export const callLLM = async (messages, options) => { ... };

// 流式调用（逐字符实时输出，提升用户体验）
export const streamLLM = (messages, options): AsyncGenerator<LLMStreamChunk> => { ... };

// 带工具调用（支持 Function Calling）
export const callLLMWithTools = async (messages, tools, options) => { ... };
```

> **工程要点**：流式输出（Streaming）是现代 AI 产品的标配。用户看到文字逐字出现，感知延迟大幅降低，即使模型响应需要 10 秒，用户在第 0.5 秒就能看到第一个字。

---

## 2. Token — 语言的最小单元

### 什么是 Token？

Token 是 LLM 处理文本的基本单位，既不是字符，也不是单词，而是介于两者之间的"子词"（subword）中文翻译为词元。

- 英文中，`"hello"` 通常是 1 个 token，`"unbelievable"` 可能被拆成 3 个 token
- 中文中，每个汉字通常对应 1~2 个 token
- 代码中，缩进、括号、关键字都会消耗 token

### Token 的两种计量

```
输入 Token（Prompt Tokens）：你发给模型的内容
输出 Token（Completion Tokens）：模型生成的内容
总费用 = 输入 Token 单价 × 输入量 + 输出 Token 单价 × 输出量
```

### 项目中的 Token 管理

项目在 OpenAI 调用时会记录 Token 用量：

```typescript
// server/src/services/llmService.ts
const usage = response.data?.usage
  ? {
      promptTokens: response.data.usage.prompt_tokens || 0,
      completionTokens: response.data.usage.completion_tokens || 0,
    }
  : undefined;

return { content, provider: 'openai', model, usage };
```

### Token 超限与续写机制

当生成内容超过模型的最大输出 Token 限制时，输出会被截断。项目实现了**自动续写**机制：

```typescript
// server/src/lib/llmUtils.ts
// 触发续写的两个条件：
// 1. finish_reason === 'length'（模型明确报告 token 超出）
// 2. isLikelyTruncated() 检测到截断特征（代码块未闭合、括号不匹配等）

const needContinuation =
  finishReason === 'length' ||
  isLikelyTruncated(accumulatedContent, finishReason);

if (needContinuation) {
  // 续写策略：只携带原始 system + user 消息 + 末尾 800 字符锚点
  // 避免上下文爆炸式膨胀导致本地模型卡死
  continuationCount++;
  // ... 发起续写请求
}
```

> **工程要点**：续写时不能把完整历史都塞进去，否则每次续写都会让上下文翻倍增长，最终超出模型的 Context 窗口。正确做法是只保留"锚点"——上一轮输出的末尾片段。

---

## 3. Context — 上下文窗口

### 什么是 Context Window？

Context Window（上下文窗口）是 LLM 在单次推理中能"看到"的最大 Token 数量。超出这个范围的内容，模型完全无法感知。

```
┌─────────────────────────────────────────────────────┐
│                  Context Window                      │
│  ┌──────────┐  ┌──────────────────┐  ┌───────────┐  │
│  │  System  │  │  对话历史（压缩）  │  │  当前输入  │  │
│  │  Prompt  │  │                  │  │           │  │
│  └──────────┘  └──────────────────┘  └───────────┘  │
│  始终保留        越早越压缩              完整保留       │
└─────────────────────────────────────────────────────┘
```

### 项目中的 Context 管理策略

**策略一：记忆压缩**

对历史消息中的 HTML 代码块进行摘要，保留文字说明，丢弃冗长代码：

```typescript
// server/src/lib/llmUtils.ts
export const compressAssistantMessage = (content: string): string => {
  // 提取 HTML 代码块的关键信息
  const title = titleMatch?.[1] || '未命名页面';
  const lineCount = html.split('\n').length;
  const hasEcharts = html.includes('echarts');

  // 将完整 HTML 替换为简短摘要
  return `${summary}\n\n[HTML代码已压缩存储] 页面标题：${title}，共 ${lineCount} 行...`;
};
```

**策略二：滑动窗口**

只保留最近 N 轮对话，丢弃更早的历史：

```typescript
// server/src/routes/chat.ts
// 最多保留最近 30 条消息（约 15 轮对话）
const rawMessages = buildMemoryMessages(chat.messages.slice(-30));
```

**策略三：RAG 历史截断**

知识库问答场景，最多保留最近 6 轮（12 条消息）：

```typescript
// server/src/services/knowledgeService.ts
const recentHistory = history.slice(-12); // 最近 6 轮
```

**策略四：全栈 Pipeline 分级**

根据模型能力等级，动态调整各步骤的上下文长度限制：

```typescript
// server/src/routes/vibeFullStackPipeline.ts
interface TierConfig {
  maxAnalysisChars: number;   // 需求分析最大字符数
  maxDbChars: number;         // 数据库设计最大字符数
  maxBackendChars: number;    // 后端代码最大字符数
  maxFrontendChars: number;   // 前端代码最大字符数
  maxContinuations: number;   // 最大续写次数
}
```

> **工程要点**：Context 管理是 AI 应用工程化的核心难题。塞太多 → 超出窗口或推理变慢；塞太少 → 模型"失忆"，前后矛盾。好的策略是：**重要的永远保留，次要的按时间衰减压缩**。

---

## 4. Prompt — 提示词工程

### 什么是 Prompt？

Prompt 是你给 LLM 的"指令"。同样的模型，不同的 Prompt 可以让它变成程序员、翻译官、数据分析师或创意写手。Prompt 工程（Prompt Engineering）是让 LLM 发挥最大价值的关键技能。

### 消息角色体系

现代 LLM 使用多角色消息格式：

```typescript
// server/src/services/llmService.ts
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<{ type: 'text' | 'image_url'; ... }>;
  tool_call_id?: string;  // tool role 专用
  tool_calls?: unknown[]; // assistant role 专用
}
```

| 角色 | 作用 |
|------|------|
| `system` | 设定 AI 的身份、能力边界、行为规则（始终在最前面） |
| `user` | 用户的输入 |
| `assistant` | AI 的回复（历史轮次） |
| `tool` | 工具调用的返回结果 |

### 项目的 Prompt 管理体系

项目将所有 Prompt 存入数据库，支持在线编辑，无需重启服务：

```typescript
// server/src/models/SystemPrompt.ts
// Prompt 分类体系：
// vibe                → Vibe Coding 对话/流式生成
// pipeline            → 固定 4 步 Pipeline（需求→设计→编码→质检）
// fullstack_pipeline  → 全栈 Pipeline（7 步）
// agent_plan          → Agent 任务规划与执行
// knowledge           → 知识库 RAG 问答
// system              → 通用系统级 Prompt
```

**典型 Prompt 示例**：

```typescript
// Vibe Coding 助手的 System Prompt（节选）
`你是一个专业的 Vibe Coding 助手，兼具 UI/UX 设计师和前端工程师能力。

## 工具使用规则（重要）
你拥有以下工具，遇到对应场景时**必须**调用，不能凭空回答：
- find_agent / list_categories：用户询问"有哪些agent"时必须调用
- get_page_structure：用户询问"页面结构"时必须调用
- search_knowledge：用户询问技术问题时必须调用`
```

> **工程要点**：好的 System Prompt 要做到三件事：**定义身份**（你是谁）、**划定边界**（你能做什么、不能做什么）、**规定行为**（遇到 X 情况必须做 Y）。尤其是工具调用规则，必须明确写出触发条件，否则模型会"忘记"使用工具。

---

## 5. Tool — 工具调用

### 什么是 Tool Calling？

Tool Calling（工具调用，也叫 Function Calling）让 LLM 从"只会说话"变成"能干活"。当 LLM 判断需要获取外部信息或执行操作时，它会输出一个结构化的"工具调用请求"，由应用层执行后将结果返回给模型。

```
用户提问
   ↓
LLM 分析：需要调用工具
   ↓
输出 tool_calls（JSON 格式的函数调用）
   ↓
应用层执行工具（查数据库、调 API、运行代码...）
   ↓
将结果以 tool role 消息返回给 LLM
   ↓
LLM 综合工具结果生成最终回答
```

### 工具定义格式

```typescript
// server/src/lib/agentTools.ts
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;  // 告诉 LLM 这个工具做什么、何时用
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
      }>;
      required: string[];
    };
  };
}
```

### 项目内置工具列表

| 工具名 | 功能 |
|--------|------|
| `find_agent` | 根据描述搜索合适的 Agent |
| `list_categories` | 列出所有 Agent 分类 |
| `search_knowledge` | 搜索知识库 |
| `get_page_structure` | 获取页面结构信息 |
| `get_template_code` | 获取模板代码 |
| `get_design_spec` | 获取设计规范 |

### Tool Calling 循环

```typescript
// server/src/routes/chat.ts
// 最多执行 3 轮工具调用，防止无限循环
const MAX_TOOL_ROUNDS = 3;
let toolRound = 0;

while (toolRound < MAX_TOOL_ROUNDS) {
  const response = await callLLMWithTools(toolMessages, allTools);

  if (!response.toolCalls?.length) break; // 没有工具调用，结束循环

  // 执行所有工具调用
  for (const toolCall of response.toolCalls) {
    const result = await executeTool(toolCall.function.name, args);
    // 将结果追加到消息列表
    toolMessages.push({ role: 'tool', content: JSON.stringify(result), ... });
  }
  toolRound++;
}
```

> **工程要点**：工具调用循环必须设置最大轮次上限（本项目为 3 轮），防止模型陷入"调用工具 → 得到结果 → 再调用工具"的死循环，导致 API 费用失控。

---

## 6. MCP — 模型上下文协议

### 什么是 MCP？

MCP（Model Context Protocol，模型上下文协议）是 Anthropic 于 2024 年提出的开放标准，定义了 LLM 与外部工具/资源之间的**标准化通信规范**。

在 MCP 出现之前，每个 AI 应用都要自己实现工具集成，格式各异、无法复用。MCP 就像 AI 世界的"USB 接口"——只要遵循协议，任何工具都能即插即用。

```
┌─────────────────────────────────────────────────────────┐
│                    AI 应用（MCP Client）                  │
│  ┌──────────┐    JSON-RPC 2.0    ┌──────────────────┐   │
│  │   LLM    │ ←────────────────→ │   MCP Server     │   │
│  │          │   initialize       │  (工具提供方)     │   │
│  │          │   tools/list       │                  │   │
│  │          │   tools/call       │  - 网页抓取       │   │
│  └──────────┘                    │  - 数据库查询     │   │
│                                  │  - 文件操作       │   │
│                                  └──────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### MCP 的两种传输方式

```typescript
// server/src/models/McpServer.ts
export type McpTransportType = 'stdio' | 'sse';
```

| 传输方式 | 原理 | 适用场景 |
|----------|------|----------|
| **stdio** | 启动子进程，通过标准输入/输出通信 | 本地工具（Python 脚本、命令行工具） |
| **SSE** | HTTP Server-Sent Events，远程通信 | 远程服务、云端工具 |

### MCP 连接生命周期

```typescript
// server/src/services/mcpService.ts
// 完整连接流程：
// 1. 建立连接（启动进程 / 建立 HTTP 连接）
// 2. 发送 initialize 请求（握手，声明协议版本）
// 3. 发送 notifications/initialized（确认就绪）
// 4. 调用 tools/list（发现工具列表）
// 5. 将工具保存到数据库
// 6. 后续按需调用 tools/call

await sendRequest('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: { tools: {} },
  clientInfo: { name: 'agency-agents-platform', version: '2.0.0' },
});
```

### MCP 工具的命名规范

项目使用 `mcp_{serverKey}_{toolName}` 格式区分 MCP 工具和内置工具：

```typescript
// server/src/services/mcpService.ts
export const parseMcpToolName = (fullName: string) => {
  // 例如：mcp_fetch_get_url → serverKey=fetch, toolName=get_url
  const match = fullName.match(/^mcp_([^_]+)_(.+)$/);
  if (!match) return { isMcp: false };
  return { isMcp: true, serverKey: match[1], toolName: match[2] };
};
```

### 项目已集成的 MCP Server

| Server Key | 名称 | 功能 |
|------------|------|------|
| `fetch` | 网页抓取 (Fetch) | 抓取网页内容并转换为 Markdown |

> **工程要点**：MCP 的核心价值在于**生态复用**。社区已有大量现成的 MCP Server（数据库、文件系统、GitHub、Slack 等），接入后 AI 立刻获得对应能力，无需自己实现。

---

## 7. Agent — 智能代理

### 什么是 Agent？

Agent（智能代理）是一个具有**特定人格、专业知识和行为模式**的 AI 角色。与通用 LLM 不同，Agent 通过精心设计的 System Prompt 和知识库，在特定领域表现出专家级能力。

```
通用 LLM：什么都懂一点，什么都不精
Agent：在特定领域深度专业化，有自己的"性格"和"专长"
```

### Agent 的数据结构

```typescript
// 项目中 Agent 的核心字段
interface IAgent {
  slug: string;           // 唯一标识，如 "academic-anthropologist"
  name: LocalizedText;    // 多语言名称 { zh: "人类学家", en: "Anthropologist" }
  description: LocalizedText;
  categoryKey: string;    // 所属分类
  capabilities: string;   // 能力描述（给用户看）
  workflow: {             // 工作流程定义
    summary: string;
    nodes: WorkflowNode[];
  };
  rawMarkdown: string;    // 原始 Markdown 文件内容（作为 System Prompt 基础）
  modelPreferences: {
    primary: 'text' | 'vision';
    recommendedProvider: 'ollama' | 'openai';
  };
}
```

### Agent 的工作方式

当用户选择某个 Agent 开始对话时：

```typescript
// server/src/routes/vibe.ts
if (agentSlug) {
  const agent = await Agent.findOne({ slug: agentSlug }).lean();
  if (agent) {
    // 将 Agent 的 Markdown 内容（前 2000 字符）作为 System Prompt 的一部分
    systemPrompt = agent.rawMarkdown.slice(0, 2000) + '\n\n' + systemPrompt;
  }
}
```

### 项目的 Agent 规模

本项目内置了 **180 个专业 Agent**，覆盖 15 个分类：

| 分类 | 示例 Agent |
|------|-----------|
| `academic` | 人类学家、历史学家、哲学家 |
| `engineering` | 全栈工程师、DevOps 专家 |
| `product` | 产品经理、UX 研究员 |
| `strategy` | 战略顾问、商业分析师 |
| `general` | 通用助手 |
| ... | 共 15 个分类 |

### Agent 规划模式（ReAct）

对于复杂任务，项目实现了 **Agent 规划模式**：

```
用户输入复杂需求
      ↓
Planner Agent：分析任务复杂度，拆解为多个步骤
      ↓
Executor Agent：逐步执行，每步可调用工具
      ↓
每步完成后更新状态，展示进度
      ↓
所有步骤完成，汇总结果
```

```typescript
// 任务复杂度分级
type TaskComplexity = 'simple' | 'medium' | 'complex';

// 对应不同的执行策略：
// simple  → 直接流式生成，无需规划
// medium  → 2-3 步规划执行
// complex → 多步规划 + 工具调用 + 中间结果验证
```

> **工程要点**：Agent 的本质是"有个性的 LLM"。它的专业性来自 System Prompt 的精心设计，而不是模型本身的差异。同一个 LLM，配上不同的 Agent Prompt，可以扮演完全不同的专家角色。

---

## 8. Agent Skill — 可编排的能力单元

### 什么是 Agent Skill？

Skill（技能）是介于 Tool 和 Agent 之间的**编排层**。如果说 Tool 是单个函数调用，Agent 是完整的角色扮演，那么 Skill 就是"可复用的业务流程"——将多个 Tool + Prompt + 逻辑编排组合成一个有名字、可管理、可监控的能力单元。

```
Tool（原子操作）
  ↓ 组合编排
Skill（业务流程）
  ↓ 角色赋予
Agent（专业角色）
```

### Skill 的步骤类型

```typescript
// server/src/models/Skill.ts
export type SkillStepType =
  | 'tool'       // 调用工具（内置工具 / MCP 工具）
  | 'llm'        // 调用 LLM（流式/非流式）
  | 'condition'  // 条件分支（if/else）
  | 'transform'  // 数据转换（JS 表达式）
  | 'parallel';  // 并行执行多个子步骤
```

### 内置 Skill 示例

**`web_research`（网页调研）**：

```
步骤 1: tool → 调用 MCP fetch 工具抓取网页内容
步骤 2: llm  → 调用 LLM 对抓取内容进行总结提炼
输出: 结构化的调研报告
```

**`smart_translate`（智能翻译）**：

```
步骤 1: llm  → 检测输入语言（中文/英文）
步骤 2: llm  → 根据检测结果选择翻译方向，执行翻译
输出: 翻译结果
```

**`vibe_analyst`（需求分析，Vibe Pipeline Step1）**：

```
步骤 1: llm  → 使用 pipeline_analyst Prompt 分析用户需求
输出: 结构化需求文档（功能列表、技术选型、页面规划）
```

### Skill 的触发机制

Skill 支持**智能路由**——根据用户输入自动匹配最合适的 Skill：

```typescript
// server/src/services/skillRouter.ts
// 触发条件配置
interface ISkillTrigger {
  keywords: string[];     // 关键词匹配（如 ["推荐", "哪个agent"]）
  patterns: string[];     // 正则模式（如 ["(推荐|找).{0,10}(agent|助手)"]）
  contextRules: string[]; // 上下文规则
  intentDescription: string; // 意图描述（给 LLM 看，用于语义匹配）
}
```

### Skill 的高级特性

| 特性 | 说明 |
|------|------|
| **版本管理** | 每次更新自动创建版本快照，支持一键回退 |
| **A/B 测试** | `abTestGroup` 字段支持灰度发布 |
| **依赖声明** | `dependsOn` 声明式依赖其他 Skill 的输出 |
| **执行监控** | 记录每次执行的耗时、成功率、错误信息 |
| **缓存控制** | `cacheTTL` 配置结果缓存时间 |
| **并发控制** | `concurrency` 限制并行执行数量 |

```typescript
// server/src/models/Skill.ts
export interface ISkill extends Document {
  key: string;           // 唯一标识
  name: string;          // 显示名称
  description: string;   // 给 LLM 看的描述（决定何时触发）
  steps: ISkillStep[];   // 有序执行步骤
  triggers: ISkillTrigger;
  version: string;       // 当前版本
  versions: ISkillVersion[]; // 历史版本
  abTestGroup: string;   // A/B 测试分组
  dependsOn: string[];   // 依赖的其他 Skill
  usageCount: number;    // 累计调用次数
  avgDuration: number;   // 平均执行耗时（ms）
  successRate: number;   // 成功率（0-1）
}
```

> **工程要点**：Skill 的核心价值是**可复用性**和**可观测性**。把"网页调研"封装成 Skill 后，任何 Agent 都能一行代码调用它，同时后台自动记录每次执行的成功率和耗时，方便持续优化。

---

## 9. 八大概念的协作关系

理解了每个概念后，让我们看看它们在一次完整的 AI 对话中是如何协作的：

```
用户发送消息："帮我调研一下 React 19 的新特性"
                    │
                    ▼
        ┌─────────────────────┐
        │   Skill Router      │  匹配到 web_research Skill
        │   关键词: "调研"     │  （关键词触发）
        └─────────────────────┘
                    │
                    ▼
        ┌─────────────────────┐
        │   Skill Engine      │  执行 web_research 的步骤
        └─────────────────────┘
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
  ┌──────────────┐    ┌──────────────────┐
  │  Step 1: Tool │    │  Step 2: LLM     │
  │  MCP fetch   │    │  总结分析         │
  │  抓取网页内容 │    │                  │
  └──────────────┘    └──────────────────┘
          │                    │
          │  Tool 结果          │  Prompt 模板
          ▼                    ▼
  ┌─────────────────────────────────────┐
  │              LLM 调用               │
  │  Provider: Ollama / OpenAI          │
  │  Context: System Prompt + 工具结果  │
  │  Token 计量 + 流式输出              │
  └─────────────────────────────────────┘
                    │
                    ▼
        流式返回给用户（逐字输出）
```

### 各概念的职责分工

```
LLM      → 核心推理引擎，理解语言、生成内容
Token    → LLM 的计量单位，影响成本和速度
Context  → LLM 的"工作记忆"，决定它能"看到"多少历史
Prompt   → 给 LLM 的指令，决定它的身份和行为
Tool     → LLM 的"手"，让它能操作外部世界
MCP      → 工具的标准化接口，实现工具生态复用
Agent    → 有专业人格的 LLM，在特定领域深度专业化
Skill    → 可复用的业务流程，将 Tool + Prompt 编排成能力单元
```

---

## 总结

现代 AI Agent 系统的复杂性，本质上是这八个概念的有机组合：

1. **LLM** 提供基础推理能力，通过统一接口屏蔽提供商差异
2. **Token** 是成本和性能的核心度量，需要精细管理
3. **Context** 决定模型的"记忆范围"，需要压缩和滑动窗口策略
4. **Prompt** 是塑造 AI 行为的关键，需要系统化管理和在线编辑能力
5. **Tool** 让 AI 从"说话者"变成"行动者"，通过 Function Calling 实现
6. **MCP** 标准化了工具接入方式，构建可复用的工具生态
7. **Agent** 通过专业化 Prompt 和知识库，在垂直领域实现专家级表现
8. **Skill** 将原子工具编排成业务流程，实现能力的模块化和可观测性

理解这八个概念及其相互关系，是构建生产级 AI Agent 系统的基础。

---

*本文基于 Agency Agents Platform v2.0 项目源码编写，项目技术栈：Node.js + Koa + MongoDB + React + TypeScript*
