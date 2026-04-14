---
name: pipeline-orchestrator
description: "AI 开发 Pipeline 编排器。根据任务类型（Feature/Bug/Refactor/Hotfix）自动选择并串联对应的 Skill 工作流，强制执行 Quality Gates（代码审查必须通过、测试覆盖率达标），支持断点恢复和并行执行。借鉴 Zencoder Quality Gates + BMAD-METHOD 工作流 + ChatDev 角色对话质证。"
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

---

## 设计原则

1. **Quality Gates 强制执行**：代码审查不通过 → 不能生成测试；测试不通过 → 不能更新 KB（借鉴 Zencoder）
2. **反馈闭环**：Review 发现问题 → 自动修复 → Re-review，最多 3 轮（借鉴 ChatDev 对话质证）
3. **断点恢复**：Pipeline 中断后可从上次完成的步骤继续，不重复执行
4. **并行优化**：无依赖的 Skill 可并行执行（如后端设计和前端设计）
5. **上下文感知**：Auto Attached 规则——根据变更文件类型自动加载对应规范（借鉴 MDC）

---

## 预定义工作流

### 🚀 Feature 工作流（新功能开发）

```
完整流程：
BRD → PRD → Story Split → UI Spec → [BE Design ∥ FE Design] → DB Migration
→ [BE Code ∥ FE Code] → Code Review ⛔ → Test Gen → KB Update → Changelog

⛔ = Quality Gate（必须通过才能继续）
∥ = 可并行执行
```

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
```

### 📋 Planning-Only 工作流（仅规划）

```
BRD → PRD → Story Split → UI Spec → [BE Design ∥ FE Design]
（不生成代码，仅输出规划文档）
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
**启动时间**：{timestamp}
**当前阶段**：{阶段名}
**总体状态**：{🟢 进行中 / ✅ 完成 / ❌ 失败 / ⏸️ 暂停}

## 执行记录

| # | 阶段 | Skill | 状态 | 开始时间 | 完成时间 | 备注 |
|---|------|-------|------|---------|---------|------|
| 1 | 需求分析 | brd-normalize | ✅ 完成 | 10:00 | 10:05 | — |
| 2 | PRD 生成 | prd-brd-to-prd | ✅ 完成 | 10:05 | 10:15 | — |
| 3 | 故事拆分 | story-split | ✅ 完成 | 10:15 | 10:25 | 拆分为 5 个 Story |
| 4 | UI 设计规范 | prd-to-ui-spec | ⏳ 进行中 | 10:25 | — | — |
| 5 | 后端设计 | prd-to-backend-design | ⏳ 待执行 | — | — | 可与 #4 并行 |
| 6 | 前端设计 | prd-to-frontend-design | ⏳ 待执行 | — | — | 可与 #4 并行 |
| 7 | DB 迁移 | db-migration | ⏳ 待执行 | — | — | 依赖 #5 |
| 8 | 后端编码 | gen-backend-code | ⏳ 待执行 | — | — | 依赖 #5 |
| 9 | 前端编码 | gen-frontend-code | ⏳ 待执行 | — | — | 依赖 #6 |
| 10 | ⛔ 代码审查 | code-review | ⏳ 待执行 | — | — | Quality Gate |
| 11 | 测试生成 | gen-test-code | ⏳ 待执行 | — | — | 依赖 #10 通过 |
| 12 | KB 更新 | doc-code-to-kb | ⏳ 待执行 | — | — | — |
| 13 | 变更日志 | changelog-gen | ⏳ 待执行 | — | — | — |

## Quality Gate 记录

| Gate | 状态 | 轮次 | 问题数 | 备注 |
|------|------|------|--------|------|
| Code Review | ⏳ 待执行 | — | — | — |
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

### 第 1 步：确定工作流

根据任务类型选择预定义工作流：

```typescript
const workflows = {
  feature: [
    { skill: 'brd-normalize', phase: '需求分析', parallel: false },
    { skill: 'prd-brd-to-prd', phase: 'PRD 生成', parallel: false },
    { skill: 'story-split', phase: '故事拆分', parallel: false },
    { skill: 'prd-to-ui-spec', phase: 'UI 设计', parallel: true, group: 'design' },
    { skill: 'prd-to-backend-design', phase: '后端设计', parallel: true, group: 'design' },
    { skill: 'prd-to-frontend-design', phase: '前端设计', parallel: true, group: 'design' },
    { skill: 'db-migration', phase: 'DB 迁移', parallel: false },
    { skill: 'gen-backend-code', phase: '后端编码', parallel: true, group: 'coding' },
    { skill: 'gen-frontend-code', phase: '前端编码', parallel: true, group: 'coding' },
    { skill: 'code-review', phase: '代码审查', parallel: false, gate: true },
    { skill: 'gen-test-code', phase: '测试生成', parallel: false },
    { skill: 'doc-code-to-kb', phase: 'KB 更新', parallel: false },
    { skill: 'changelog-gen', phase: '变更日志', parallel: false },
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
    { skill: 'brd-normalize', phase: '需求分析', parallel: false },
    { skill: 'prd-brd-to-prd', phase: 'PRD 生成', parallel: false },
    { skill: 'story-split', phase: '故事拆分', parallel: false },
    { skill: 'prd-to-ui-spec', phase: 'UI 设计', parallel: true, group: 'design' },
    { skill: 'prd-to-backend-design', phase: '后端设计', parallel: true, group: 'design' },
    { skill: 'prd-to-frontend-design', phase: '前端设计', parallel: true, group: 'design' },
  ],
};
```

### 第 2 步：逐步执行 Skill

对工作流中的每个步骤：

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

### 第 3 步：Quality Gate 执行

当遇到标记为 `gate: true` 的步骤时，执行 Quality Gate 逻辑：

#### 3.1 Code Review Gate

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

#### 3.2 反馈闭环详情（借鉴 ChatDev 对话质证）

每轮 Review → Fix → Re-review 的过程：

1. **Review 阶段**：`code-review` Skill 输出问题列表
2. **Fix 阶段**：
   - 对每个 🔴 必须修复的问题，自动生成修复代码
   - 修复代码直接应用到源文件
   - 记录修复内容到 Quality Gate 记录
3. **Re-review 阶段**：
   - 重新执行 `code-review`，但只检查上一轮的 🔴 问题是否已修复
   - 同时检查修复是否引入新问题

### 第 4 步：Auto Attached 规则（借鉴 MDC）

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

### 第 5 步：Pipeline 完成

```markdown
## 🎉 Pipeline 完成

**任务类型**：{type}
**任务描述**：{description}
**版本号**：{version}
**总耗时**：{duration}

### 执行摘要

| 指标 | 值 |
|------|-----|
| 总步骤数 | {N} |
| 完成步骤 | {N} |
| 跳过步骤 | {N} |
| Quality Gate 轮次 | {N} |
| 生成/修改文件数 | {N} |

### Quality Gate 结果

| Gate | 最终评分 | 轮次 | 🔴 问题 | 🟡 问题 |
|------|---------|------|---------|---------|
| Code Review | ⭐⭐⭐⭐ | 2 | 0 | 3 |

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

1. **Quality Gate 不可跳过**：即使用户指定"跳过步骤"，也不能跳过 Quality Gate
2. **反馈闭环最多 3 轮**：超过 3 轮未通过，暂停 Pipeline 等待人工介入
3. **状态文件必须实时更新**：每个步骤完成后立即写入状态文件
4. **并行步骤的依赖检查**：并行组内的步骤无依赖，但并行组之间有依赖

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

### 示例 1：启动 Feature 工作流

**用户输入**：
> 开始开发 v1.2.0 版本，需求是给 Agent 增加标签管理功能

**Pipeline 响应**：

```markdown
## 🚀 Feature Pipeline 启动

**版本号**：v1.2.0
**任务描述**：Agent 标签管理功能
**工作流**：Feature（13 步）

### 执行计划

| # | 阶段 | Skill | 预估 | 依赖 |
|---|------|-------|------|------|
| 1 | 需求分析 | brd-normalize | 5min | — |
| 2 | PRD 生成 | prd-brd-to-prd | 10min | #1 |
| 3 | 故事拆分 | story-split | 10min | #2 |
| 4 | UI 设计 | prd-to-ui-spec | 15min | #2 |
| 5 | 后端设计 | prd-to-backend-design | 15min | #2（可与 #4 并行） |
| 6 | 前端设计 | prd-to-frontend-design | 15min | #2（可与 #4 并行） |
| 7 | DB 迁移 | db-migration | 5min | #5 |
| 8 | 后端编码 | gen-backend-code | 20min | #5 |
| 9 | 前端编码 | gen-frontend-code | 20min | #6（可与 #8 并行） |
| 10 | ⛔ 代码审查 | code-review | 10min | #8, #9 |
| 11 | 测试生成 | gen-test-code | 15min | #10 通过 |
| 12 | KB 更新 | doc-code-to-kb | 5min | #11 |
| 13 | 变更日志 | changelog-gen | 5min | #12 |

**预估总耗时**：~2.5 小时

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

### 示例 3：Quality Gate 反馈闭环

```markdown
## ⛔ Quality Gate — 代码审查（第 1 轮）

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
