---
name: pipeline-orchestrator
description: "AI 开发 Pipeline 编排器。根据任务类型（Feature/Bug/Refactor/Hotfix）自动选择并串联对应的 Skill 工作流，默认采用 Review-First 模式（规划 → 设计评审 → 编码 → 代码审查），强制执行 Quality Gates，支持断点恢复和并行执行。借鉴 Kiro Spec-Driven Development + BMAD-METHOD Planning/Development 分离 + Zencoder Quality Gates + ChatDev 角色对话质证。"
triggers:
  - 开始开发
  - start pipeline
  - 新功能
  - new feature
  - 工作流
  - workflow
  - pipeline
  - 启动流程
---

# Pipeline-Orchestrator — AI 开发 Pipeline 编排器

## 目标

作为所有 Skill 的"总指挥"，根据任务类型自动编排 Skill 执行顺序，强制执行 Quality Gates，确保每次代码变更都经过审查和测试。

**核心隐喻**：你是一个"CI/CD Pipeline"——不是简单地按顺序调用 Skill，而是一个有状态、有门禁、可恢复的工作流引擎。每个 Gate 不通过就不能进入下一阶段。

**核心理念（Review-First）**：借鉴 Kiro 的 Spec-Driven Development 和 BMAD-METHOD 的 Planning/Development 分离——**先生成设计文档，人工审批后再编码**。AI 不是起点，而是终点；设计评审才是编码的起点。

---

## 设计原则

1. **Review-First（先审后写）**：设计文档生成后必须经过人工审批，确认后才能进入编码阶段（借鉴 Kiro Spec-Driven Development）
2. **Quality Gates 强制执行**：设计评审不通过 → 不能编码；代码审查不通过 → 不能生成测试（借鉴 Zencoder）
3. **三阶段分离**：规划阶段（Planning）→ 设计评审（Design Review）→ 编码阶段（Coding）→ 代码审查（Code Review）→ 交付阶段（Delivery），阶段之间有明确的门禁（借鉴 BMAD-METHOD）
4. **反馈闭环**：Review 发现问题 → 自动修复 → Re-review，最多 3 轮（借鉴 ChatDev 对话质证）
5. **断点恢复**：Pipeline 中断后可从上次完成的步骤继续，不重复执行
6. **并行优化**：无依赖的 Skill 可并行执行（如后端设计和前端设计）
7. **上下文感知**：Auto Attached 规则——根据变更文件类型自动加载对应规范（借鉴 MDC）

---

## 预定义工作流

### 🚀 Feature 工作流（新功能开发）— 默认 Review-First 模式

```
完整流程（三阶段 + 两道门禁）：

┌─ Phase 1: 规划阶段 ─────────────────────────────────────────┐
│ BRD → PRD → Story Split → UI Spec → [BE Design ∥ FE Design] │
└──────────────────────────────────────────────────────────────┘
                              ↓
                 ⛔ Gate 1: 设计评审（design-review）
                 人工审批：✅ 确认 / ✏️ 修改 / ❌ 打回
                              ↓
┌─ Phase 2: 编码阶段 ─────────────────────────────────────────┐
│ DB Migration → [BE Code ∥ FE Code]                           │
└──────────────────────────────────────────────────────────────┘
                              ↓
                 ⛔ Gate 2: 代码审查（code-review）
                              ↓
┌─ Phase 3: 交付阶段 ─────────────────────────────────────────┐
│ Test Gen → KB Update → Changelog                             │
└──────────────────────────────────────────────────────────────┘

⛔ = Quality Gate（必须通过才能继续）
∥ = 可并行执行
```

> **--auto 模式**：添加 `--auto` 参数可跳过 Gate 1（设计评审），直接从规划进入编码。适用于单人快速迭代或紧急场景。Gate 2（代码审查）不可跳过。

### 🐛 Bug 工作流（Bug 修复）

```
Bug Report → Bug Fix → Code Review ⛔ → Test Gen → KB Update
```

### ♻️ Refactor 工作流（代码重构）

```
Target Module → Refactor → Code Review ⛔ → Test Gen → KB Update
```

### 🔥 Hotfix 工作流（紧急修复）

```
Bug Report → Bug Fix → Code Review ⛔ → KB Update
（跳过测试生成，但标注 ⚠️ 待补充测试）
（自动启用 --auto 模式，跳过设计评审）
```

### 📋 Planning-Only 工作流（仅规划）

```
BRD → PRD → Story Split → UI Spec → [BE Design ∥ FE Design] → Design Review
（不生成代码，仅输出规划文档 + 设计评审摘要）
```

---

## 输入

| 参数 | 必填 | 说明 |
|------|------|------|
| **任务类型** | ✅ | `feature` / `bug` / `refactor` / `hotfix` / `planning` |
| **任务描述** | ✅ | 任务的简要描述 |
| **版本号** | 否 | 如 `v1.0.1`，Feature 工作流必填 |
| **BRD/Bug 报告** | 否 | 原始需求或 Bug 描述 |
| **目标文件** | 否 | Refactor 工作流需要指定目标文件 |
| **跳过步骤** | 否 | 指定跳过某些步骤（如"跳过 Demo 生成"） |
| **--auto** | 否 | 自动模式，跳过 Gate 1（设计评审），直接从规划进入编码。适用于单人快速迭代 |

## 输出

| 文件 | 说明 |
|------|------|
| `version-doc/{版本号}/pipeline-status.md` | Pipeline 执行状态文件（用于断点恢复） |
| 各 Skill 的输出文件 | 按工作流顺序生成 |

---

## Pipeline 状态文件格式

```markdown
# Pipeline Status — {版本号}

**任务类型**：{feature/bug/refactor/hotfix}
**任务描述**：{描述}
**执行模式**：{Review-First / Auto}
**启动时间**：{timestamp}
**当前阶段**：{阶段名}
**总体状态**：{🟢 进行中 / ✅ 完成 / ❌ 失败 / ⏸️ 暂停}

## 执行记录

| # | 阶段 | Skill | 状态 | 开始时间 | 完成时间 | Phase | 备注 |
|---|------|-------|------|---------|---------|-------|------|
| 1 | 需求分析 | brd-normalize | ✅ 完成 | 10:00 | 10:05 | Phase 1 规划 | — |
| 2 | PRD 生成 | prd-brd-to-prd | ✅ 完成 | 10:05 | 10:15 | Phase 1 规划 | — |
| 3 | 故事拆分 | story-split | ✅ 完成 | 10:15 | 10:25 | Phase 1 规划 | 拆分为 5 个 Story |
| 4 | UI 设计规范 | prd-to-ui-spec | ✅ 完成 | 10:25 | 10:35 | Phase 1 规划 | — |
| 5 | 后端设计 | prd-to-backend-design | ✅ 完成 | 10:25 | 10:40 | Phase 1 规划 | 可与 #4 并行 |
| 6 | 前端设计 | prd-to-frontend-design | ✅ 完成 | 10:25 | 10:40 | Phase 1 规划 | 可与 #4 并行 |
| 7 | ⛔ 设计评审 | design-review | ⏸️ 等待审批 | 10:40 | — | ⛔ Gate 1 | 等待人工确认 |
| 8 | DB 迁移 | db-migration | ⏳ 待执行 | — | — | Phase 2 编码 | 依赖 #7 通过 |
| 9 | 后端编码 | gen-backend-code | ⏳ 待执行 | — | — | Phase 2 编码 | 依赖 #7 通过 |
| 10 | 前端编码 | gen-frontend-code | ⏳ 待执行 | — | — | Phase 2 编码 | 依赖 #7 通过 |
| 11 | ⛔ 代码审查 | code-review | ⏳ 待执行 | — | — | ⛔ Gate 2 | Quality Gate |
| 12 | 测试生成 | gen-test-code | ⏳ 待执行 | — | — | Phase 3 交付 | 依赖 #11 通过 |
| 13 | KB 更新 | doc-code-to-kb | ⏳ 待执行 | — | — | Phase 3 交付 | — |
| 14 | 变更日志 | changelog-gen | ⏳ 待执行 | — | — | Phase 3 交付 | — |

## Quality Gate 记录

| Gate | 类型 | 状态 | 轮次 | 决策 | 备注 |
|------|------|------|------|------|------|
| Gate 1 | 设计评审 | ⏸️ 等待审批 | — | — | 等待人工确认 |
| Gate 2 | 代码审查 | ⏳ 待执行 | — | — | — |
```

---

## 编排流程

### 第 0 步：版本号冲突检测 + 断点恢复检查

1. **版本号冲突检测**（🆕 新增）：
   - 检查 `version-doc/{版本号}/` 目录是否已存在
   - 如果存在 → 读取 `pipeline-status.md`，检查其中的**任务描述**是否与当前任务一致
     - **一致** → 视为断点恢复，进入步骤 2
     - **不一致** → ⛔ **拒绝执行**，输出错误信息：
       ```
       ❌ 版本号冲突：version-doc/{版本号}/ 已被「{已有任务描述}」占用。
       请使用新的版本号（建议：{下一个版本号}）。
       
       已有版本：
       - v1.2.0: Agent 收藏功能
       - v1.3.0: Agent 评分评价功能
       
       建议下一个版本号：v1.4.0
       ```
   - 如果不存在 → 正常创建，进入步骤 1

   **自动版本号推荐**：扫描 `version-doc/` 下所有 `v*` 目录，取最大版本号 +0.1.0 作为建议版本号。

2. **断点恢复检查**：
   - 检查 `version-doc/{版本号}/pipeline-status.md` 是否存在
     - 存在且任务描述一致 → 读取状态文件，从最后一个 `⏳ 待执行` 或 `❌ 失败` 的步骤继续
     - 不存在 → 创建新的状态文件，从头开始
   - 检查各 Skill 的输出文件是否已存在
     - 已存在 → 标记对应步骤为 `✅ 完成`，跳过

### 第 0.5 步：检查上版本遗留技术债务（🆕 新增）

> 防止技术债务跨版本累积。每次启动新 Pipeline 前，自动扫描上一个版本的 Code Review 报告中未修复的 🟡 问题。

**执行流程**：

1. **扫描历史版本目录**：读取 `version-doc/` 下所有 `v*` 目录，按版本号降序排列
2. **读取上一个版本的 Code Review 报告**：
   - 查找 `version-doc/{上一版本号}/review/` 目录下的审查报告文件
   - 提取其中所有 🟡 建议修复的问题
3. **读取上一个版本的 Sprint 报告**（如有）：
   - 查找 `version-doc/{上一版本号}/sprint-report.md`
   - 提取"技术债务"章节中的未修复项
4. **汇总遗留债务清单**：

```markdown
## 📋 上版本遗留技术债务

**来源版本**：{上一版本号}

| # | 来源 | 问题编号 | 问题描述 | 涉及文件 | 建议修复方式 |
|---|------|---------|---------|---------|------------|
| 1 | Code Review | CR-001 | IAgent 接口缺少 favoriteCount | Agent.ts | 补充接口字段 |
| 2 | Code Review | CR-002 | FavoriteButton props 同步 | FavoriteButton.tsx | 添加 useEffect |
```

5. **决策**：
   - 如果遗留债务 ≤ 3 个 → 在当前 Pipeline 的编码阶段顺带修复，标注到 pipeline-status.md
   - 如果遗留债务 > 3 个 → 输出警告，建议先用 Bug 工作流清理债务，再启动新 Feature
   - 如果无遗留债务 → 输出 `✅ 无遗留技术债务`，继续下一步

6. **将债务清单写入 Pipeline 状态文件**：
   - 在 `pipeline-status.md` 中新增"遗留债务"章节
   - 编码阶段完成后，检查债务是否已修复，更新状态

**此步骤不可跳过**——即使用户指定"跳过步骤"，技术债务检查仍然执行。

---

### 第 1 步：确定工作流

根据任务类型选择预定义工作流：

```typescript
const workflows = {
  feature: [
    // ── Phase 1: 规划阶段 ──
    { skill: 'brd-normalize', phase: '需求分析', parallel: false, stage: 'planning' },
    { skill: 'prd-brd-to-prd', phase: 'PRD 生成', parallel: false, stage: 'planning' },
    { skill: 'story-split', phase: '故事拆分', parallel: false, stage: 'planning' },
    { skill: 'prd-to-ui-spec', phase: 'UI 设计', parallel: true, group: 'design', stage: 'planning' },
    { skill: 'prd-to-backend-design', phase: '后端设计', parallel: true, group: 'design', stage: 'planning' },
    { skill: 'prd-to-frontend-design', phase: '前端设计', parallel: true, group: 'design', stage: 'planning' },
    // ── ⛔ Gate 1: 设计评审（--auto 模式可跳过）──
    { skill: 'design-review', phase: '设计评审', parallel: false, gate: true, gateType: 'design-review', skippableByAuto: true },
    // ── Phase 2: 编码阶段 ──
    { skill: 'db-migration', phase: 'DB 迁移', parallel: false, stage: 'coding' },
    { skill: 'gen-backend-code', phase: '后端编码', parallel: true, group: 'coding', stage: 'coding' },
    { skill: 'gen-frontend-code', phase: '前端编码', parallel: true, group: 'coding', stage: 'coding' },
    // ── ⛔ Gate 2: 代码审查（不可跳过）──
    { skill: 'code-review', phase: '代码审查', parallel: false, gate: true, gateType: 'code-review' },
    // ── Phase 3: 交付阶段 ──
    { skill: 'gen-test-code', phase: '测试生成', parallel: false, stage: 'delivery' },
    { skill: 'doc-code-to-kb', phase: 'KB 更新', parallel: false, stage: 'delivery' },
    { skill: 'changelog-gen', phase: '变更日志', parallel: false, stage: 'delivery' },
  ],
  bug: [
    { skill: 'bug-fix', phase: 'Bug 修复', parallel: false },
    { skill: 'code-review', phase: '代码审查', parallel: false, gate: true },
    { skill: 'gen-test-code', phase: '测试生成', parallel: false },
    { skill: 'doc-code-to-kb', phase: 'KB 更新', parallel: false },
  ],
  refactor: [
    { skill: 'refactor', phase: '代码重构', parallel: false },
    { skill: 'code-review', phase: '代码审查', parallel: false, gate: true },
    { skill: 'gen-test-code', phase: '测试生成', parallel: false },
    { skill: 'doc-code-to-kb', phase: 'KB 更新', parallel: false },
  ],
  hotfix: [
    { skill: 'bug-fix', phase: 'Bug 修复', parallel: false },
    { skill: 'code-review', phase: '代码审查', parallel: false, gate: true },
    { skill: 'doc-code-to-kb', phase: 'KB 更新', parallel: false },
  ],
  planning: [
    { skill: 'brd-normalize', phase: '需求分析', parallel: false, stage: 'planning' },
    { skill: 'prd-brd-to-prd', phase: 'PRD 生成', parallel: false, stage: 'planning' },
    { skill: 'story-split', phase: '故事拆分', parallel: false, stage: 'planning' },
    { skill: 'prd-to-ui-spec', phase: 'UI 设计', parallel: true, group: 'design', stage: 'planning' },
    { skill: 'prd-to-backend-design', phase: '后端设计', parallel: true, group: 'design', stage: 'planning' },
    { skill: 'prd-to-frontend-design', phase: '前端设计', parallel: true, group: 'design', stage: 'planning' },
    // Planning-Only 也执行设计评审，输出评审摘要供人工参考
    { skill: 'design-review', phase: '设计评审', parallel: false, gate: false, stage: 'planning' },
  ],
};
```

### 第 2 步：逐步执行 Skill（Phase 1 — 规划阶段）

对工作流中 `stage: 'planning'` 的步骤逐步执行：

#### 2.1 检查前置条件

- 该步骤的依赖步骤是否已完成？
- 该步骤是否已被标记为跳过？
- 该步骤的输出文件是否已存在？

#### 2.2 执行 Skill

- 调用对应 Skill 的编排流程
- 实时更新 `pipeline-status.md` 中的状态

#### 2.3 并行执行优化

同一 `group` 的步骤可以并行执行：
- `design` 组：UI 设计 ∥ 后端设计 ∥ 前端设计
- `coding` 组：后端编码 ∥ 前端编码

提示用户："以下步骤可以并行执行，建议在多个会话中同时进行"

#### 2.4 更新状态

每个步骤完成后：
1. 更新 `pipeline-status.md` 中的状态为 `✅ 完成`
2. 记录完成时间
3. 如果步骤失败 → 标记为 `❌ 失败`，记录错误信息

### 第 2.5 步：⛔ Gate 1 — 设计评审（🆕 新增）

> **核心理念**：借鉴 Kiro 的 Spec-Driven Development——设计文档是编码的"合同"，人工审批后才能进入编码阶段。这是 Review-First 模式的核心门禁。

**执行流程**：

1. **调用 `design-review` Skill**：
   - 读取 Phase 1 生成的所有设计文档（`be-*.md`、`fe-*.md`、`ui-spec.md`、`stories/*.md`）
   - 生成**变更清单摘要**（新增/修改哪些文件、每个文件改什么）
   - 标注**关键设计决策点**（需人工确认的部分）
   - 输出**影响范围分析**（改这个文件会影响哪些其他文件）
   - 将评审摘要写入 `version-doc/{版本号}/review/design-review.md`

2. **等待人工审批**：
   - 输出评审摘要，提示用户选择：
     - ✅ **确认，开始编码** → Gate 通过，进入 Phase 2
     - ✏️ **修改后确认** → 用户指出需要修改的部分，AI 修改设计文档后重新评审
     - ❌ **打回重做** → 回到 Phase 1 的对应步骤重新执行
   - 修改后确认的闭环最多 3 轮

3. **`--auto` 模式处理**：
   - 如果启用了 `--auto` 参数 → 跳过人工审批，自动通过 Gate 1
   - 仍然执行 `design-review` Skill 生成评审摘要（用于记录和追溯）
   - 在 pipeline-status.md 中标注 `⚡ 自动通过（--auto 模式）`

4. **Gate 1 状态记录**：

```markdown
## Gate 1 — 设计评审记录

| 轮次 | 状态 | 人工决策 | 修改内容 | 时间 |
|------|------|---------|---------|------|
| 1 | ✏️ 修改后确认 | 修改 API 接口定义 | 将 PUT 改为 PATCH | 10:30 |
| 2 | ✅ 确认 | 开始编码 | — | 10:45 |
```

### 第 3 步：逐步执行 Skill（Phase 2 — 编码阶段）

> Gate 1 通过后，进入编码阶段。对工作流中 `stage: 'coding'` 的步骤逐步执行。
> **重要**：编码 Skill 必须读取 Phase 1 生成的已审批设计文档作为输入，严格按设计文档编码，不自由发挥。

### 第 4 步：⛔ Gate 2 — 代码审查

当遇到标记为 `gateType: 'code-review'` 的步骤时，执行 Quality Gate 逻辑：

#### 4.1 Code Review Gate

```
执行 code-review Skill
↓
评分 ≥ ⭐⭐⭐（合格）？
├── 是 → Gate 通过 ✅，继续下一步
└── 否 → 进入反馈闭环
         ↓
         自动修复 🔴 问题（调用对应的修复逻辑）
         ↓
         Re-review（第 2 轮）
         ↓
         评分 ≥ ⭐⭐⭐？
         ├── 是 → Gate 通过 ✅
         └── 否 → 再次修复 + Re-review（第 3 轮）
                  ↓
                  评分 ≥ ⭐⭐⭐？
                  ├── 是 → Gate 通过 ✅
                  └── 否 → Gate 失败 ❌
                           标记 Pipeline 为 ⏸️ 暂停
                           输出："代码审查 3 轮未通过，需要人工介入"
```

#### 4.2 反馈闭环详情（借鉴 ChatDev 对话质证）

每轮 Review → Fix → Re-review 的过程：

1. **Review 阶段**：`code-review` Skill 输出问题列表
2. **Fix 阶段**：
   - 对每个 🔴 必须修复的问题，自动生成修复代码
   - 修复代码直接应用到源文件
   - 记录修复内容到 Quality Gate 记录
3. **Re-review 阶段**：
   - 重新执行 `code-review`，但只检查上一轮的 🔴 问题是否已修复
   - 同时检查修复是否引入新问题

### 第 5 步：Auto Attached 规则（借鉴 MDC）

根据当前步骤涉及的文件类型，自动加载对应的规范：

| 文件模式 | 自动加载的规范 | 来源 |
|---------|-------------|------|
| `server/src/routes/*.ts` | 后端 API 路由规范 | KB `01_index_api.md` |
| `server/src/models/*.ts` | Model 定义规范 | KB `02_index_model.md` |
| `server/src/services/*.ts` | Service 编码规范 | KB `03_index_service.md` |
| `*/src/pages/*.tsx` | 页面组件规范 | KB `01_index_page.md` |
| `*/src/components/*.tsx` | 公共组件规范 | KB `02_index_component.md` |
| `*/src/api/*.ts` | API 封装规范 | KB `03_index_api.md` |
| `*/src/stores/*.ts` | Store 规范 | KB `04_index_store.md` |

**执行方式**：在 `code-review` 和代码生成 Skill 执行前，自动读取匹配的 KB 文件作为上下文。

### 第 6 步：逐步执行 Skill（Phase 3 — 交付阶段）

> Gate 2 通过后，进入交付阶段。对工作流中 `stage: 'delivery'` 的步骤逐步执行。

### 第 7 步：Pipeline 完成

```markdown
## 🎉 Pipeline 完成

**任务类型**：{type}
**任务描述**：{description}
**版本号**：{version}
**总耗时**：{duration}

### 执行摘要

| 指标 | 值 |
|------|-----|
| 执行模式 | {Review-First / --auto} |
| 总步骤数 | {N} |
| 完成步骤 | {N} |
| 跳过步骤 | {N} |
| Gate 1（设计评审）轮次 | {N}（或 ⚡ 自动通过） |
| Gate 2（代码审查）轮次 | {N} |
| 生成/修改文件数 | {N} |

### Quality Gate 结果

| Gate | 最终结果 | 轮次 | 备注 |
|------|---------|------|------|
| Gate 1 设计评审 | ✅ 人工确认 | 2 | 第 1 轮修改了 API 定义 |
| Gate 2 代码审查 | ⭐⭐⭐⭐ 良好 | 2 | 🔴 0 / 🟡 3 |
### 生成的产出物

| 类型 | 文件 | 说明 |
|------|------|------|
| PRD | version-doc/{v}/prd/prd.md | 产品需求文档 |
| 设计 | version-doc/{v}/design/*.md | 技术设计文档 |
| 代码 | server/src/... | 后端代码 |
| 代码 | web/src/... | 前端代码 |
| 测试 | */__tests__/*.test.ts(x) | 测试用例 |
| KB | kb/... | 知识库更新 |
| 日志 | version-doc/{v}/CHANGELOG.md | 变更日志 |

### 建议下一步

1. 运行 `npm run dev` 验证功能
2. 运行测试 `npm test` 确认全部通过
3. 提交代码并创建 PR
```

---

## 约束

### 编排约束

1. **Gate 2（代码审查）不可跳过**：即使用户指定"跳过步骤"或 `--auto` 模式，也不能跳过 Gate 2
2. **Gate 1（设计评审）默认不可跳过**：只有 `--auto` 模式或 Hotfix 工作流可以跳过 Gate 1
3. **技术债务检查不可跳过**：第 0.5 步的遗留债务检查是强制步骤，不受"跳过步骤"参数影响
4. **KB 更新不可跳过**：`doc-code-to-kb` 步骤是强制步骤，不允许标记为 `⏭️ 跳过`。如果增量更新耗时过长，至少更新索引文件（第二层）
5. **反馈闭环最多 3 轮**：超过 3 轮未通过，暂停 Pipeline 等待人工介入
6. **状态文件必须实时更新**：每个步骤完成后立即写入状态文件
7. **并行步骤的依赖检查**：并行组内的步骤无依赖，但并行组之间有依赖
8. **编码必须基于已审批的设计文档**：Phase 2 的编码 Skill 必须读取 Phase 1 生成的设计文档作为输入，不能自由发挥

### Hotfix 特殊规则

1. Hotfix 工作流跳过测试生成，但在 Pipeline 完成后标注 `⚠️ 待补充测试`
2. Hotfix 的 Code Review Gate 标准降低为 ⭐⭐（需改进）即可通过
3. Hotfix 完成后自动提醒："请在下一个 Sprint 中补充测试用例"

### 断点恢复规则

1. 恢复时只执行 `⏳ 待执行` 和 `❌ 失败` 的步骤
2. `✅ 完成` 的步骤不重复执行（除非用户明确要求"重新执行"）
3. Quality Gate 失败后恢复时，从 Gate 步骤重新开始（不跳过）

### 边界条件处理

| 场景 | 处理方式 |
|------|---------|
| 用户未指定任务类型 | 根据输入内容自动判断（有 BRD → feature，有错误日志 → bug） |
| 用户未指定版本号 | Feature 工作流：询问版本号；Bug/Refactor：不需要版本号 |
| 某个 Skill 不存在 | 跳过该步骤，标注 `⚠️ Skill 不可用` |
| Pipeline 中途用户要求变更 | 暂停当前步骤，更新工作流，从变更点继续 |
| 并行步骤中一个失败 | 其他并行步骤继续执行，失败的步骤标记为 `❌ 失败` |

---

## Few-Shot 示例

### 示例 1：启动 Feature 工作流（默认 Review-First 模式）

**用户输入**：
> 开始开发 v1.2.0 版本，需求是给 Agent 增加标签管理功能

**Pipeline 响应**：

```markdown
## 🚀 Feature Pipeline 启动（Review-First 模式）

**版本号**：v1.2.0
**任务描述**：Agent 标签管理功能
**执行模式**：Review-First（设计评审后再编码）
**工作流**：Feature（14 步 = 6 规划 + 1 评审 + 3 编码 + 1 审查 + 3 交付）

### 执行计划

| # | 阶段 | Skill | 预估 | 依赖 | 阶段 |
|---|------|-------|------|------|------|
| 1 | 需求分析 | brd-normalize | 5min | — | Phase 1 规划 |
| 2 | PRD 生成 | prd-brd-to-prd | 10min | #1 | Phase 1 规划 |
| 3 | 故事拆分 | story-split | 10min | #2 | Phase 1 规划 |
| 4 | UI 设计 | prd-to-ui-spec | 15min | #2 | Phase 1 规划 |
| 5 | 后端设计 | prd-to-backend-design | 15min | #2（可与 #4 并行） | Phase 1 规划 |
| 6 | 前端设计 | prd-to-frontend-design | 15min | #2（可与 #4 并行） | Phase 1 规划 |
| 7 | ⛔ 设计评审 | design-review | — | #4,#5,#6 | ⛔ Gate 1 |
| 8 | DB 迁移 | db-migration | 5min | #7 通过 | Phase 2 编码 |
| 9 | 后端编码 | gen-backend-code | 20min | #7 通过 | Phase 2 编码 |
| 10 | 前端编码 | gen-frontend-code | 20min | #7 通过（可与 #9 并行） | Phase 2 编码 |
| 11 | ⛔ 代码审查 | code-review | 10min | #9, #10 | ⛔ Gate 2 |
| 12 | 测试生成 | gen-test-code | 15min | #11 通过 | Phase 3 交付 |
| 13 | KB 更新 | doc-code-to-kb | 5min | #12 | Phase 3 交付 |
| 14 | 变更日志 | changelog-gen | 5min | #13 | Phase 3 交付 |

**预估总耗时**：~2.5 小时（不含人工评审等待时间）

正在执行 Phase 1（规划阶段）...
正在执行第 1 步：需求分析...
```

### 示例 1.5：启动 Feature 工作流（--auto 模式）

**用户输入**：
> 开始开发 v1.2.0 版本，需求是给 Agent 增加标签管理功能 --auto

**Pipeline 响应**：

```markdown
## 🚀 Feature Pipeline 启动（⚡ Auto 模式）

**版本号**：v1.2.0
**任务描述**：Agent 标签管理功能
**执行模式**：Auto（跳过设计评审，直接编码）

⚠️ Auto 模式已启用：Gate 1（设计评审）将自动通过，Gate 2（代码审查）仍然执行。

正在执行第 1 步：需求分析...
```

### 示例 2：断点恢复

**用户输入**：
> 继续 v1.2.0 的开发

**Pipeline 响应**：

```markdown
## ⏯️ Pipeline 恢复

检测到 v1.2.0 的 Pipeline 状态文件，上次执行到第 8 步（后端编码）。

### 已完成的步骤（跳过）

| # | 阶段 | 状态 |
|---|------|------|
| 1-7 | 需求分析 → DB 迁移 | ✅ 全部完成 |

### 从第 8 步继续

正在执行第 8 步：后端编码...
```

### 示例 3：Gate 1 设计评审（Review-First 模式）

```markdown
## ⛔ Gate 1 — 设计评审

Phase 1（规划阶段）已完成，请审阅以下设计文档：

### 📋 变更清单摘要

#### 后端变更

| # | 文件 | 操作 | 变更内容 | 影响范围 |
|---|------|------|---------|----------|
| 1 | `server/src/models/Tag.ts` | 🆕 新增 | Tag Model（name, userId, color） | 新文件 |
| 2 | `server/src/models/Agent.ts` | ✏️ 修改 | IAgent 接口增加 tags: string[] | 影响所有 Agent 查询 |
| 3 | `server/src/services/tagService.ts` | 🆕 新增 | CRUD + 按用户查询 | 新文件 |
| 4 | `server/src/routes/tags.ts` | 🆕 新增 | 5 个 API 端点 | 新文件 |
| 5 | `server/src/index.ts` | ✏️ 修改 | 注册 tagRouter | 1 行变更 |

#### 前端变更

| # | 文件 | 操作 | 变更内容 | 影响范围 |
|---|------|------|---------|----------|
| 1 | `web/src/types/index.ts` | ✏️ 修改 | 新增 ITag 接口 | 类型定义 |
| 2 | `web/src/api/index.ts` | ✏️ 修改 | 新增 4 个 Tag API 函数 | API 层 |
| 3 | `web/src/components/TagSelector.tsx` | 🆕 新增 | 标签选择器组件 | 新文件 |
| 4 | `web/src/pages/AgentsPage.tsx` | ✏️ 修改 | 集成标签筛选 | 列表页 |

### ⚠️ 关键设计决策（需确认）

1. Tag 是用户级还是全局级？（当前设计：用户级）
2. Agent.tags 存 tagId 还是 tagName？（当前设计：存 tagId）
3. 删除标签时已关联 Agent 如何处理？（当前设计：级联移除引用）

---

请选择：
- ✅ 确认，开始编码
- ✏️ 修改后确认（请指出需要修改的部分）
- ❌ 打回重做
```

**用户回复**：
> ✅ 确认，开始编码

```markdown
✅ Gate 1 通过！进入 Phase 2（编码阶段）...
正在执行第 8 步：DB 迁移...
```

### 示例 4：Quality Gate 反馈闭环

```markdown
## ⛔ Gate 2 — 代码审查（第 1 轮）

**评分**：⭐⭐ 需改进
**🔴 必须修复**：3 个
**🟡 建议修复**：5 个

Gate 未通过，进入反馈闭环...

### 自动修复 🔴 问题

| # | 问题 | 修复 | 状态 |
|---|------|------|------|
| CR-001 | 缺少认证中间件 | 添加 requireAuth | ✅ 已修复 |
| CR-002 | 缺少输入校验 | 添加参数校验 | ✅ 已修复 |
| CR-003 | 错误处理不完整 | 添加 try-catch | ✅ 已修复 |

### Re-review（第 2 轮）

**评分**：⭐⭐⭐⭐ 良好
**🔴 必须修复**：0 个
**🟡 建议修复**：4 个

✅ Quality Gate 通过！继续下一步...
```
