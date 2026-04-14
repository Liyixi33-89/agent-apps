---
name: gen-demo-html
description: "基于 BRD/PRD 生成可交互的 HTML Demo 站点。输出单文件 HTML（内嵌 TailwindCSS + Alpine.js），可直接在浏览器中预览，用于业务方快速确认 UI/UX 方案。"
triggers:
  - 生成 Demo
  - HTML Demo
  - 原型
  - 交互原型
  - Demo 站点
  - 预览页面
---

# Gen-Demo-HTML — 生成可交互 HTML Demo

## 目标

基于 BRD 或 PRD 文档，快速生成可在浏览器中直接打开的交互原型，让业务方在 **5 分钟内** 看到功能的大致样子，确认 UI/UX 方向是否正确。

**核心隐喻**：你是一个"快速原型师"——用最少的代码做出最直观的效果。不追求完美，追求"看得懂、点得动"。

---

## 设计原则

1. **零构建**：输出单个 HTML 文件，用 CDN 引入所有依赖，浏览器直接打开即可
2. **交互优先**：按钮可点、表单可填、列表可滚动、弹窗可开关——让业务方"体验"而非"看图"
3. **风格一致**：使用 TailwindCSS + 项目配色方案，视觉上接近最终产品
4. **Mock 数据**：所有数据用 JS 变量 Mock，不依赖任何后端接口
5. **标注清晰**：每个功能区域用注释标注对应的 BRD/PRD 需求编号

---

## 技术选型

| 技术 | 版本 | 用途 | 引入方式 |
|------|------|------|---------|
| TailwindCSS | 3.x | 样式 | CDN `<script src="https://cdn.tailwindcss.com">` |
| Alpine.js | 3.x | 交互逻辑 | CDN `<script src="https://unpkg.com/alpinejs">` |
| Lucide Icons | latest | 图标 | CDN `<script src="https://unpkg.com/lucide">` |

**为什么选 Alpine.js**：
- 语法简单，直接在 HTML 属性中写逻辑（`x-data`、`x-show`、`x-on:click`）
- 无需编译，适合单文件 Demo
- 足够支撑表单、列表、弹窗、Tab 切换等常见交互

---

## 输入

| 参数 | 必填 | 说明 |
|------|------|------|
| **需求文档** | ✅ | BRD（`brd_normalized.md`）或 PRD（`prd.md`）的文件路径 |
| **版本号** | ✅ | 如 `v1.0.1`，用于确定输出目录 |
| **Demo 范围** | 否 | 指定只生成某些需求的 Demo（默认全部） |

**版本号获取规则**：
1. 如果用户直接指定了版本号 → 使用用户指定的
2. 如果文件路径中包含版本号 → 从路径提取
3. 如果以上未提供 → **向用户询问版本号**，不可跳过

## 输出

**输出位置**：`version-doc/{版本号}/demo/`

| 文件 | 说明 |
|------|------|
| `index.html` | 主 Demo 页面（单文件，包含所有功能） |
| `{feature}.html` | 如果功能过多（>5 个），按功能拆分为多个 HTML 文件 |

---

## 编排流程

### 第 0 步：检查前置条件

1. 检查需求文档是否存在（BRD 或 PRD）
   - 优先使用 PRD（信息更详细）
   - 如果只有 BRD 也可以生成（但交互细节会较粗糙）
2. 检查 `version-doc/{版本号}/demo/` 是否已有文件
   - 已有 → 询问用户是"覆盖重写"还是"增量添加"

### 第 1 步：读取需求文档并提取 Demo 需求

读取 BRD/PRD，提取每个需求的：
- 功能名称
- 用户角色
- 核心交互流程（步骤列表）
- 涉及的数据字段
- UI 元素（列表、表单、弹窗、按钮等）

### 第 2 步：设计 Demo 结构

规划 HTML 页面结构：

```
┌─────────────────────────────────────┐
│ 顶部导航栏（项目名 + 版本号）          │
├─────────────────────────────────────┤
│ 侧边栏（功能列表导航）                │
│  ├─ 功能 1                          │
│  ├─ 功能 2                          │
│  └─ 功能 3                          │
├─────────────────────────────────────┤
│ 主内容区（当前功能的交互 Demo）        │
│                                     │
│  [根据功能类型展示不同的 UI]          │
│                                     │
└─────────────────────────────────────┘
```

### 第 3 步：准备 Mock 数据

为每个功能准备 Mock 数据：

```javascript
// Mock 数据（内嵌在 HTML 的 <script> 中）
const mockData = {
  agents: [
    { id: 1, name: 'Agent A', tags: ['开发', '测试'], status: 'active' },
    { id: 2, name: 'Agent B', tags: ['生产'], status: 'inactive' },
  ],
  // ... 根据需求生成
};
```

**Mock 数据规则**：
- 每个列表至少 3-5 条数据
- 数据内容要有意义（不要用 "test1", "test2"）
- 包含不同状态的数据（如 active/inactive）
- 字段名与 PRD/BRD 中的约定一致

### 第 4 步：生成 HTML

按以下结构生成单文件 HTML：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{项目名} - {版本号} Demo</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/alpinejs" defer></script>
  <script>
    // TailwindCSS 配置（匹配项目配色）
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: '#1677ff',    // Antd 主色
            success: '#52c41a',
            warning: '#faad14',
            error: '#ff4d4f',
          }
        }
      }
    }
  </script>
  <style>
    /* 最小化自定义样式，仅用于 TailwindCSS 无法覆盖的场景 */
    [x-cloak] { display: none !important; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">

  <!-- 顶部导航 -->
  <nav class="bg-white shadow-sm border-b px-6 py-3 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <h1 class="text-lg font-semibold">{项目名}</h1>
      <span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{版本号} Demo</span>
    </div>
    <span class="text-sm text-gray-400">⚠️ 这是交互原型，非最终产品</span>
  </nav>

  <!-- 主体 -->
  <div class="flex" x-data="{ currentPage: 'feature1' }">

    <!-- 侧边栏 -->
    <aside class="w-56 bg-white border-r min-h-screen p-4">
      <nav class="space-y-1">
        <!-- 每个功能一个导航项 -->
        <button @click="currentPage = 'feature1'"
                :class="currentPage === 'feature1' ? 'bg-blue-50 text-primary' : 'text-gray-600 hover:bg-gray-50'"
                class="w-full text-left px-3 py-2 rounded text-sm">
          功能 1：{名称}
        </button>
        <!-- ... -->
      </nav>
    </aside>

    <!-- 内容区 -->
    <main class="flex-1 p-6">
      <!-- 功能 1 的 Demo（来源：BRD/PRD 需求 1） -->
      <div x-show="currentPage === 'feature1'" x-cloak>
        <!-- 功能 1 的交互内容 -->
      </div>
      <!-- ... -->
    </main>

  </div>

  <script>
    // Mock 数据和辅助函数
  </script>

</body>
</html>
```

### 第 5 步：逐功能实现交互

对每个功能，根据类型使用对应的 UI 模式：

| 功能类型 | UI 模式 | Alpine.js 实现 |
|---------|---------|---------------|
| 列表展示 | 表格/卡片列表 | `x-for` 遍历 Mock 数据 |
| 搜索筛选 | 搜索框 + 筛选标签 | `x-model` 绑定 + computed 过滤 |
| 表单提交 | 表单 + 提交按钮 | `x-model` 绑定 + `@submit` 处理 |
| 弹窗操作 | Modal 弹窗 | `x-show` 控制显隐 |
| 状态切换 | 开关/下拉 | `@click` 切换状态 |
| Tab 切换 | Tab 栏 | `x-show` + 当前 Tab 状态 |
| 详情查看 | 详情面板/抽屉 | `x-show` + 选中项数据 |

**每个功能区域必须包含**：
1. 功能标题 + BRD/PRD 需求编号注释
2. 可交互的 UI 元素
3. 操作后的反馈（如 Toast 提示、列表刷新）

### 第 6 步：自检

在浏览器中检查（或通过代码审查）：
- [ ] HTML 语法正确，无报错
- [ ] 所有功能的导航可切换
- [ ] 列表数据正确渲染
- [ ] 按钮点击有响应
- [ ] 弹窗可打开/关闭
- [ ] 表单可填写
- [ ] 移动端基本可用（响应式）

### 第 7 步：输出摘要

```
## Demo 生成完成

- 需求来源：{BRD/PRD 文件路径}
- 功能数：{N} 个
- 输出文件：version-doc/{版本号}/demo/index.html

使用方式：在浏览器中直接打开 index.html 即可预览

建议下一步：
1. 将 Demo 发给业务方确认 UI/UX 方向
2. 确认后使用 `prd-to-backend-design` 和 `prd-to-frontend-design` 进入技术设计阶段
```

---

## 约束

### 技术约束

1. **单文件原则**：除非功能超过 5 个，否则所有内容放在一个 `index.html` 中
2. **零后端依赖**：所有数据用 JS Mock，不发任何 HTTP 请求
3. **CDN 引入**：所有第三方库通过 CDN 引入，不使用 npm/本地文件
4. **不用 React/Vue**：Demo 用 Alpine.js，不要引入重型框架

### 设计约束

1. **接近最终产品**：配色、字体、间距参考项目现有风格（Antd + TailwindCSS）
2. **响应式基础**：至少支持 PC 端（1280px+）正常显示
3. **标注来源**：每个功能区域用 HTML 注释标注 `<!-- 来源：BRD/PRD 需求 N -->`
4. **Mock 数据有意义**：不要用 "aaa", "bbb" 等无意义数据

### 边界条件处理

| 场景 | 处理方式 |
|------|---------|
| 需求文档不存在 | 提示用户先生成 BRD/PRD |
| 需求过于模糊无法设计 UI | 用占位符区域 + 文字说明代替 |
| 功能超过 5 个 | 拆分为多个 HTML 文件，index.html 作为导航首页 |
| 需求涉及复杂图表 | 用文字 + 简单表格模拟，不引入图表库 |

---

## Few-Shot 示例

### 示例：Agent 标签功能的 Demo 片段

```html
<!-- 来源：BRD 需求 1 - Agent 标签管理 -->
<div x-show="currentPage === 'agent-tags'" x-cloak
     x-data="{
       agents: [
         { id: 1, name: '智能客服助手', tags: ['客服', '对话'], status: 'active' },
         { id: 2, name: '代码审查专家', tags: ['开发', '审查'], status: 'active' },
         { id: 3, name: '数据分析师', tags: ['数据', '报表'], status: 'inactive' },
       ],
       filterTag: '',
       showAddModal: false,
       selectedAgent: null,
       newTag: '',
       get filteredAgents() {
         if (!this.filterTag) return this.agents;
         return this.agents.filter(a => a.tags.includes(this.filterTag));
       },
       get allTags() {
         return [...new Set(this.agents.flatMap(a => a.tags))];
       }
     }">

  <h2 class="text-xl font-semibold mb-4">Agent 标签管理</h2>

  <!-- 标签筛选栏 -->
  <div class="flex gap-2 mb-4 flex-wrap">
    <button @click="filterTag = ''"
            :class="!filterTag ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'"
            class="px-3 py-1 rounded-full text-sm transition">
      全部
    </button>
    <template x-for="tag in allTags" :key="tag">
      <button @click="filterTag = tag"
              :class="filterTag === tag ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'"
              class="px-3 py-1 rounded-full text-sm transition"
              x-text="tag">
      </button>
    </template>
  </div>

  <!-- Agent 卡片列表 -->
  <div class="grid grid-cols-3 gap-4">
    <template x-for="agent in filteredAgents" :key="agent.id">
      <div class="bg-white rounded-lg border p-4 hover:shadow-md transition">
        <div class="flex justify-between items-start mb-2">
          <h3 class="font-medium" x-text="agent.name"></h3>
          <span :class="agent.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
                class="text-xs px-2 py-0.5 rounded"
                x-text="agent.status === 'active' ? '运行中' : '已停用'">
          </span>
        </div>
        <div class="flex gap-1 flex-wrap mb-3">
          <template x-for="tag in agent.tags" :key="tag">
            <span class="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded" x-text="tag"></span>
          </template>
        </div>
        <button @click="selectedAgent = agent; showAddModal = true"
                class="text-sm text-primary hover:underline">
          + 添加标签
        </button>
      </div>
    </template>
  </div>

  <!-- 添加标签弹窗 -->
  <div x-show="showAddModal" x-cloak
       class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 w-96" @click.away="showAddModal = false">
      <h3 class="text-lg font-medium mb-4">添加标签</h3>
      <p class="text-sm text-gray-500 mb-2">为 <span class="font-medium" x-text="selectedAgent?.name"></span> 添加标签</p>
      <input x-model="newTag" type="text" placeholder="输入标签名称"
             class="w-full border rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary/50">
      <div class="flex justify-end gap-2">
        <button @click="showAddModal = false"
                class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded">
          取消
        </button>
        <button @click="if(newTag && selectedAgent) { selectedAgent.tags.push(newTag); newTag=''; showAddModal=false; }"
                class="px-4 py-2 text-sm bg-primary text-white rounded hover:bg-blue-600">
          确认添加
        </button>
      </div>
    </div>
  </div>

</div>
```
