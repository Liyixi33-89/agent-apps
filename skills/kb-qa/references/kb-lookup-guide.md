# KB 索引查找快速参考

## 关键词 → 索引文件映射

当用户提问中包含以下关键词时，优先查找对应的索引文件：

### 后端关键词

| 关键词 | 索引文件 | 详情目录 |
|--------|---------|---------|
| API、接口、路由、endpoint、请求、响应、HTTP | `kb/server/server/01_index_api.md` | `kb/server/server/api/` |
| Model、模型、Schema、字段、集合、表、数据库 | `kb/server/server/02_index_model.md` | — |
| Service、服务、业务逻辑、调用链 | `kb/server/server/03_index_service.md` | `kb/server/server/services/` |
| 中间件、认证、JWT、权限、RBAC、配置、环境变量 | `kb/server/server/04_index_config.md` | — |
| 架构、技术栈、目录结构、模块关系 | `kb/server/server/00_project_map.md` | — |

### 前端关键词（Web 用户端）

| 关键词 | 索引文件 | 详情目录 |
|--------|---------|---------|
| 页面、路由、视图、交互、功能 | `kb/frontend/@agency/web/01_index_page.md` | `kb/frontend/@agency/web/pages/` |
| 组件、Props、公共组件 | `kb/frontend/@agency/web/02_index_component.md` | — |
| 前端 API、请求封装、axios | `kb/frontend/@agency/web/03_index_api.md` | — |
| Store、状态管理、Zustand | `kb/frontend/@agency/web/04_index_store.md` | — |
| 类型、TypeScript、interface、type | `kb/frontend/@agency/web/05_index_types.md` | — |

### 前端关键词（Admin 管理端）

| 关键词 | 索引文件 | 详情目录 |
|--------|---------|---------|
| 管理端、admin、后台管理 | `kb/frontend/@agency/admin/01_index_page.md` | `kb/frontend/@agency/admin/pages/` |

### 跨模块关键词

| 关键词 | 需要查找的索引 |
|--------|--------------|
| 前后端联调、全链路 | 前端 `03_index_api.md` + 后端 `01_index_api.md` |
| 数据流、状态流转 | 前端 `04_index_store.md` + 后端 `03_index_service.md` |
| 权限控制（全链路） | 后端 `04_index_config.md` + 后端 `01_index_api.md` |

## 常见问题类型 → 查找策略

### "某个功能是怎么实现的？"

1. 从 `00_project_map.md` 定位功能所在模块
2. 查前端 `01_index_page.md` 找到对应页面
3. 查页面详情 `pages/{page}.md` 了解 API 调用
4. 查后端 `01_index_api.md` 找到对应路由
5. 查后端 `03_index_service.md` 了解业务逻辑

### "某个 API 的参数和返回值？"

1. 查 `01_index_api.md` 找到 API 路径
2. 查 `api/{route}.md` 获取详细参数

### "某个数据表有哪些字段？"

1. 直接查 `02_index_model.md`

### "某个页面调用了哪些接口？"

1. 查 `01_index_page.md` 找到页面
2. 查 `pages/{page}.md` 获取 API 调用列表
3. 对照后端 `01_index_api.md` 确认接口详情

### "修改某个功能会影响哪些地方？"

1. 查 `02_index_model.md` 确认数据模型
2. 查 `03_index_service.md` 找到所有使用该 Model 的 Service
3. 查 `01_index_api.md` 找到所有调用该 Service 的路由
4. 查前端 `03_index_api.md` 找到所有调用该路由的前端函数
5. 查前端 `01_index_page.md` 找到所有使用该函数的页面
