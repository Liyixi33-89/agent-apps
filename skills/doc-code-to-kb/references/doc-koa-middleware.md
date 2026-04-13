# 中间件与配置索引规范

## 生成目标

- `04_index_config.md` — 配置与中间件索引

## 分析流程

1. 扫描 `server/src/middleware/` 目录下所有 `.ts` 文件
2. 扫描 `server/src/config/` 目录下所有 `.ts` 文件
3. 检查 `server/src/db/` 目录下的数据库连接配置
4. 对每个文件：
   - 提取导出的中间件函数
   - 提取配置常量/环境变量
   - 识别中间件的执行顺序和条件

## 索引文件格式（04_index_config.md）

```markdown
# 配置与中间件索引

## 中间件

| # | 中间件名 | 文件 | 应用范围 | 说明 |
|---|---------|------|---------|------|
| 1 | requireAuth | middleware/auth.ts | 需认证路由 | JWT 认证校验 |
| 2 | requireAdmin | middleware/auth.ts | 管理端路由 | 管理员权限校验 |

### requireAuth

**文件**: server/src/middleware/auth.ts
**触发条件**: 路由声明时使用
**逻辑**:
1. 从 Authorization header 提取 JWT token
2. 验证 token 有效性
3. 将用户信息挂载到 ctx.state.user
4. 无效 token → 返回 401

## 配置

| # | 配置项 | 文件 | 说明 |
|---|--------|------|------|
| 1 | env | config/env.ts | 环境变量配置 |
| 2 | defaultPrompts | config/defaultPrompts.ts | 默认提示词模板 |

### env.ts

**文件**: server/src/config/env.ts
**环境变量**:

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| PORT | number | 3000 | 服务端口 |
| MONGODB_URI | string | — | MongoDB 连接串 |
| JWT_SECRET | string | — | JWT 密钥 |

## 数据库

| # | 文件 | 说明 |
|---|------|------|
| 1 | db/mongo.ts | MongoDB 连接管理 |
```
