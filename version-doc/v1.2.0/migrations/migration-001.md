# 数据库迁移脚本 — v1.3.0 Agent 收藏功能

**版本**：v1.3.0
**日期**：2026-04-14
**来源设计**：`version-doc/v1.3.0/design/be-favorite.md`

---

## 迁移 001：创建 Favorite 集合 + Agent.favoriteCount 字段

### Up（正向迁移）

```javascript
// migration-v1.3.0-001-add-favorites.js

const up = async (db) => {
  // 1. 创建 favorites 集合索引
  const favorites = db.collection('favorites');

  // 联合唯一索引：防止重复收藏
  await favorites.createIndex(
    { userId: 1, agentId: 1 },
    { unique: true, name: 'idx_user_agent_unique' }
  );

  // 查询用户收藏列表（按时间倒序）
  await favorites.createIndex(
    { userId: 1, createdAt: -1 },
    { name: 'idx_user_created_desc' }
  );

  // 统计 Agent 收藏数
  await favorites.createIndex(
    { agentId: 1 },
    { name: 'idx_agent' }
  );

  // 2. 为 Agent 集合添加 favoriteCount 字段（默认值 0）
  const agents = db.collection('agents');
  await agents.updateMany(
    { favoriteCount: { $exists: false } },
    { $set: { favoriteCount: 0 } }
  );

  console.log('✅ Migration v1.3.0-001 UP: favorites 集合索引已创建，Agent.favoriteCount 已初始化');
};
```

### Down（回滚）

```javascript
const down = async (db) => {
  // 1. 删除 favorites 集合
  await db.collection('favorites').drop().catch(() => {});

  // 2. 移除 Agent.favoriteCount 字段
  await db.collection('agents').updateMany(
    {},
    { $unset: { favoriteCount: '' } }
  );

  console.log('✅ Migration v1.3.0-001 DOWN: favorites 集合已删除，Agent.favoriteCount 已移除');
};
```

### 验证

```javascript
const verify = async (db) => {
  // 检查索引
  const indexes = await db.collection('favorites').indexes();
  const hasUniqueIndex = indexes.some(i => i.name === 'idx_user_agent_unique');
  const hasUserCreatedIndex = indexes.some(i => i.name === 'idx_user_created_desc');
  const hasAgentIndex = indexes.some(i => i.name === 'idx_agent');

  // 检查 Agent.favoriteCount
  const agentWithoutField = await db.collection('agents').countDocuments({ favoriteCount: { $exists: false } });

  console.log(`索引检查: unique=${hasUniqueIndex}, userCreated=${hasUserCreatedIndex}, agent=${hasAgentIndex}`);
  console.log(`Agent 缺少 favoriteCount 的文档数: ${agentWithoutField}`);

  return hasUniqueIndex && hasUserCreatedIndex && hasAgentIndex && agentWithoutField === 0;
};
```

---

## 执行记录

| 环境 | 状态 | 执行时间 | 执行人 |
|------|------|---------|--------|
| dev | ⏳ 待执行 | — | — |
| staging | ⏳ 待执行 | — | — |
| production | ⏳ 待执行 | — | — |
