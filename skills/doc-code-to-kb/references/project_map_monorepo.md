# {项目名} — 项目全景

## 项目概述

| 属性 | 值 |
|------|-----|
| 项目名 | {name} |
| 类型 | Monorepo (npm workspaces) |
| 包管理 | npm |
| 子项目 | server / web / admin |

## 技术栈

| 子项目 | 框架 | 语言 | UI | 状态管理 | 构建工具 |
|--------|------|------|-----|---------|---------|
| server | Koa | TypeScript | — | — | tsx / tsc |
| web | React 19 | TypeScript | Antd + TailwindCSS | Zustand | Vite |
| admin | React 19 | TypeScript | Antd + TailwindCSS | Zustand | Vite |

## 目录结构

```
apps/
├── package.json          # Monorepo 根配置
├── server/               # 后端服务
│   └── src/
│       ├── index.ts      # 入口
│       ├── config/       # 配置
│       ├── db/           # 数据库连接
│       ├── middleware/    # 中间件
│       ├── models/       # Mongoose 模型
│       ├── routes/       # 路由（API 层）
│       ├── services/     # 业务逻辑层
│       ├── scripts/      # 脚本工具
│       └── utils/        # 工具函数
├── web/                  # 用户前端
│   └── src/
│       ├── App.tsx       # 根组件 + 路由
│       ├── api/          # API 请求封装
│       ├── components/   # 公共组件
│       ├── pages/        # 页面组件
│       ├── store/        # Zustand 状态管理
│       └── types/        # TypeScript 类型定义
└── admin/                # 管理后台
    └── src/
        ├── App.tsx       # 根组件 + 路由
        ├── api/          # API 请求封装
        ├── components/   # 公共组件
        ├── pages/        # 页面组件
        └── store/        # Zustand 状态管理
```

## 模块关系

```
web (用户端) ──HTTP──→ server (后端) ←──HTTP── admin (管理端)
                          │
                          ↓
                      MongoDB
```
