---
name: db-migration
description: "基于后端设计文档中的 Model 变更，生成安全的 MongoDB 数据库迁移脚本。支持增量迁移（新增字段、修改字段、新增索引）和数据迁移（历史数据格式转换），每个迁移脚本都支持回滚。"
triggers:
  - 数据迁移
  - db migration
  - Schema 变更
  - 数据库迁移
  - 迁移脚本
  - migrate
---

# DB-Migration — 数据库迁移脚本生成

## 目标

基于后端设计文档中的 Model 变更定义，生成安全的 MongoDB 迁移脚本。每个迁移脚本都包含 `up`（执行迁移）和 `down`（回滚迁移）两个方法，确保数据库变更可追踪、可回滚。

**核心隐喻**：你是一个"DBA"——对数据库的每次变更都小心翼翼。先备份，再迁移，能回滚。绝不在生产环境上"试试看"。

---

## 设计原则

1. **增量迁移**：每次变更一个独立的迁移脚本，不修改已有的迁移脚本
2. **可回滚**：每个迁移都有对应的回滚逻辑
3. **幂等性**：迁移脚本可以安全地重复执行（已迁移的跳过）
4. **数据安全**：涉及数据删除/修改的操作必须先备份
5. **顺序执行**：迁移脚本按时间戳排序，顺序执行

---

## 输入

| 参数 | 必填 | 说明 |
|------|------|------|
| **设计文档** | ✅ | `version-doc/{版本号}/design/be-*.md`，提取 Model 变更 |
| **版本号** | ✅ | 如 `v1.0.1`，用于定位设计文档和命名迁移脚本 |
| **迁移类型** | 否 | `schema`（Schema 变更）/ `data`（数据迁移）/ `both`，默认 `both` |

**版本号获取规则**：
1. 如果用户直接指定了版本号 → 使用用户指定的
2. 如果文件路径中包含版本号 → 从路径提取
3. 如果以上未提供 → **向用户询问版本号**，不可跳过

## 输出

**输出位置**：`server/src/migrations/`

| 文件 | 说明 |
|------|------|
| `{timestamp}-{description}.ts` | 迁移脚本文件 |
| `migration-log.md` | 迁移日志（记录所有迁移的执行状态） |

---

## 编排流程

### 第 0 步：检查前置条件

1. 检查设计文档是否存在
   - 不存在 → 提示用户先执行 `prd-to-backend-design` Skill
2. 检查 `server/src/migrations/` 目录是否存在
   - 不存在 → 创建目录
3. 检查是否有迁移运行器（`server/src/scripts/migrate.ts`）
   - 不存在 → 生成迁移运行器

### 第 1 步：读取设计文档，提取 Model 变更

读取 `version-doc/{版本号}/design/be-*.md`，提取所有 Model 变更：

| 变更类型 | 提取内容 |
|---------|---------|
| 新增 Model | Schema 定义、索引定义 |
| 新增字段 | 字段名、类型、默认值、是否必填 |
| 修改字段 | 字段名、旧类型→新类型、数据转换规则 |
| 删除字段 | 字段名（需确认是否有历史数据） |
| 新增索引 | 索引字段、索引类型（unique/compound/text） |
| 删除索引 | 索引名称 |

### 第 2 步：查阅 KB 获取现有 Schema

读取 `kb/server/server/02_index_model.md`，了解现有 Model 的 Schema 定义，确认：
- 变更的字段是否真的不存在（避免重复添加）
- 现有数据量级（影响迁移策略）
- 现有索引列表（避免重复创建）

### 第 3 步：设计迁移策略

对每个 Model 变更，设计迁移策略：

| 变更类型 | 迁移策略 |
|---------|---------|
| 新增可选字段 | 直接添加，无需数据迁移 |
| 新增必填字段 | 先添加为可选 + 默认值 → 填充历史数据 → 改为必填 |
| 修改字段类型 | 新增临时字段 → 数据转换 → 删除旧字段 → 重命名 |
| 删除字段 | 备份数据 → 删除字段 |
| 新增唯一索引 | 先检查重复数据 → 处理重复 → 创建索引 |

### 第 4 步：生成迁移脚本

#### 迁移脚本模板

```typescript
// server/src/migrations/{timestamp}-{description}.ts
import mongoose from 'mongoose';

interface Migration {
  name: string;
  description: string;
  version: string;
  up: (db: mongoose.Connection) => Promise<void>;
  down: (db: mongoose.Connection) => Promise<void>;
}

const migration: Migration = {
  name: '{timestamp}-{description}',
  description: '{变更描述}',
  version: '{版本号}',

  async up(db: mongoose.Connection) {
    const collection = db.collection('{collectionName}');

    // === Schema 变更 ===
    // 新增字段
    await collection.updateMany(
      { {newField}: { $exists: false } },
      { $set: { {newField}: {defaultValue} } }
    );

    // 新增索引
    await collection.createIndex(
      { {indexField}: 1 },
      { name: 'idx_{indexField}', background: true }
    );

    console.log(`✅ Migration up: {description}`);
  },

  async down(db: mongoose.Connection) {
    const collection = db.collection('{collectionName}');

    // === 回滚 ===
    // 删除新增字段
    await collection.updateMany(
      {},
      { $unset: { {newField}: '' } }
    );

    // 删除新增索引
    await collection.dropIndex('idx_{indexField}');

    console.log(`⏪ Migration down: {description}`);
  },
};

export default migration;
```

#### 迁移运行器模板（首次生成）

```typescript
// server/src/scripts/migrate.ts
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';

interface MigrationRecord {
  name: string;
  executedAt: Date;
  version: string;
}

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

const getMigrationModel = (db: mongoose.Connection) => {
  const schema = new mongoose.Schema<MigrationRecord>({
    name: { type: String, required: true, unique: true },
    executedAt: { type: Date, default: Date.now },
    version: { type: String, required: true },
  });
  return db.model<MigrationRecord>('Migration', schema);
};

const runMigrations = async (direction: 'up' | 'down' = 'up') => {
  const db = mongoose.connection;
  const MigrationModel = getMigrationModel(db);

  // 获取已执行的迁移
  const executed = await MigrationModel.find({}).sort({ name: 1 });
  const executedNames = new Set(executed.map(m => m.name));

  // 获取所有迁移文件
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.ts') || f.endsWith('.js'))
    .sort();

  if (direction === 'up') {
    // 执行未执行的迁移
    for (const file of files) {
      const name = path.basename(file, path.extname(file));
      if (executedNames.has(name)) continue;

      console.log(`⏳ Running migration: ${name}`);
      const migration = require(path.join(MIGRATIONS_DIR, file)).default;
      await migration.up(db);
      await MigrationModel.create({ name, version: migration.version });
      console.log(`✅ Completed: ${name}`);
    }
  } else {
    // 回滚最后一个迁移
    const last = executed[executed.length - 1];
    if (!last) {
      console.log('No migrations to rollback');
      return;
    }

    const file = files.find(f => f.startsWith(last.name));
    if (file) {
      console.log(`⏪ Rolling back: ${last.name}`);
      const migration = require(path.join(MIGRATIONS_DIR, file)).default;
      await migration.down(db);
      await MigrationModel.deleteOne({ name: last.name });
      console.log(`✅ Rolled back: ${last.name}`);
    }
  }
};

export { runMigrations };
```

### 第 5 步：生成迁移日志

```markdown
# 迁移日志

| 迁移文件 | 版本 | 描述 | 状态 |
|---------|------|------|------|
| {timestamp}-{desc}.ts | {version} | {description} | ⏳ 待执行 |
```

### 第 6 步：自检

- [ ] 每个 Model 变更都有对应的迁移脚本
- [ ] 每个迁移脚本都有 `up` 和 `down` 方法
- [ ] `down` 方法能正确回滚 `up` 的变更
- [ ] 涉及数据删除的操作有备份逻辑
- [ ] 新增唯一索引前有重复数据检查
- [ ] 迁移脚本可以安全地重复执行（幂等性）

### 第 7 步：输出摘要

```
## 数据库迁移脚本生成完成

- 设计文档：version-doc/{版本号}/design/be-{feature}.md
- 迁移文件数：{N} 个

| # | 迁移文件 | 变更类型 | 影响 Model |
|---|---------|---------|-----------|
| 1 | {file} | {type} | {model} |

执行迁移：
- 开发环境：`npx ts-node server/src/scripts/migrate.ts up`
- 回滚：`npx ts-node server/src/scripts/migrate.ts down`

建议下一步：
1. 在开发环境执行迁移验证
2. 确认数据正确后，使用 `gen-backend-code` 生成对应的后端代码
```

---

## 约束

### 迁移约束

1. **不修改已有迁移脚本**：每次变更都是新的迁移文件
2. **时间戳唯一**：迁移文件名以时间戳开头，确保唯一性和顺序
3. **回滚必须完整**：`down` 方法必须能完全撤销 `up` 的变更
4. **不直接删除数据**：删除操作必须先备份到临时集合
5. **大数据量分批处理**：超过 10000 条记录的更新使用 bulkWrite 分批执行

### 边界条件处理

| 场景 | 处理方式 |
|------|---------|
| 设计文档不存在 | 提示用户先生成设计文档 |
| 迁移目录不存在 | 自动创建 |
| 迁移运行器不存在 | 自动生成 |
| 变更涉及删除字段 | 生成备份逻辑，标注 `⚠️ 不可逆操作` |
| 新增唯一索引但有重复数据 | 生成重复数据检查 + 处理脚本 |
