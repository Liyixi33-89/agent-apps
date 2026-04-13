#!/usr/bin/env python3
"""
从 scan_result.json 自动生成全量知识库文件。
一次性生成所有第二层索引文件和第三层详情文件。

Usage:
    python3 generate_kb.py <scan_json> <kb_root>
"""

import os, sys, json, re
from datetime import datetime


def kebab(name):
    """PascalCase/camelCase → kebab-case"""
    return re.sub(r'([a-z])([A-Z])', r'\1-\2', name).lower()


def load_scan(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def write_file(filepath, content):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  ✅ {os.path.relpath(filepath, kb_root)}")


# ═══════════════════════════════════════════════════════════════════════════════
# Server 知识库生成
# ═══════════════════════════════════════════════════════════════════════════════

def gen_server_api_index(server, out_dir):
    """生成 01_index_api.md"""
    lines = ["# API 路由索引\n"]
    lines.append("## 路由挂载\n")
    lines.append("| 路由文件 | 端点数 | 说明 |")
    lines.append("|---------|--------|------|")
    for r in server['routes']:
        lines.append(f"| {r['name']}.ts | {len(r['endpoints'])} | {r['name']} 相关 API |")

    lines.append("\n## 全量 API 列表\n")
    lines.append("| # | 方法 | 路径 | 中间件 | 路由文件 |")
    lines.append("|---|------|------|--------|---------|")
    idx = 1
    for r in server['routes']:
        for e in r['endpoints']:
            mw = ', '.join(e['middlewares']) if e['middlewares'] else '—'
            lines.append(f"| {idx} | {e['method']} | {e['path']} | {mw} | {r['name']}.ts |")
            idx += 1

    write_file(os.path.join(out_dir, '01_index_api.md'), '\n'.join(lines) + '\n')


def gen_server_api_details(server, out_dir):
    """生成 api/*.md 详情文件"""
    for r in server['routes']:
        lines = [f"# {r['name']} 路由\n"]
        lines.append(f"**文件**: server/src/routes/{r['name']}.ts")
        lines.append(f"**端点数**: {len(r['endpoints'])}\n")
        lines.append("## API 列表\n")
        for e in r['endpoints']:
            mw = ', '.join(e['middlewares']) if e['middlewares'] else '无'
            lines.append(f"### {e['method']} {e['path']}\n")
            lines.append(f"**中间件**: {mw}\n")
        write_file(os.path.join(out_dir, 'api', f"{r['name']}.md"), '\n'.join(lines) + '\n')


def gen_server_model_index(server, out_dir):
    """生成 02_index_model.md"""
    lines = ["# Mongoose Model 索引\n"]
    lines.append("## Model 总览\n")
    lines.append("| # | Model 名 | 文件 | 接口数 | 字段数 | 说明 |")
    lines.append("|---|---------|------|--------|--------|------|")
    idx = 1
    for m in server['models']:
        iface_count = len(m.get('interfaces', []))
        field_count = len(m.get('fields', []))
        lines.append(f"| {idx} | {m['name']} | models/{m['name']}.ts | {iface_count} | {field_count} | — |")
        idx += 1

    lines.append("\n## Model 详情\n")
    for m in server['models']:
        lines.append(f"### {m['name']}\n")
        lines.append(f"**文件**: server/src/models/{m['name']}.ts\n")

        # 接口
        for iface in m.get('interfaces', []):
            lines.append(f"**接口 `{iface['name']}`**:\n")
            if iface.get('fields'):
                lines.append("| 字段 | 类型 | 可选 |")
                lines.append("|------|------|------|")
                for f in iface['fields']:
                    opt = '✅' if f.get('optional') else '—'
                    lines.append(f"| {f['name']} | {f['type']} | {opt} |")
                lines.append("")

        # Schema 字段
        if m.get('fields'):
            lines.append("**Schema 字段**:\n")
            lines.append("| 字段 | 类型 | 必填 | 唯一 | 关联 | 默认值 |")
            lines.append("|------|------|------|------|------|--------|")
            for f in m['fields']:
                req = '✅' if f.get('required') else '—'
                uniq = '✅' if f.get('unique') else '—'
                ref = f.get('ref', '—')
                default = f.get('default', '—')
                ftype = f.get('type', '—')
                lines.append(f"| {f['name']} | {ftype} | {req} | {uniq} | {ref} | {default} |")
            lines.append("")

    write_file(os.path.join(out_dir, '02_index_model.md'), '\n'.join(lines) + '\n')


def gen_server_service_index(server, out_dir):
    """生成 03_index_service.md"""
    lines = ["# Service 索引\n"]
    lines.append("## Service 总览\n")
    lines.append("| # | Service 名 | 文件 | 导出函数数 | 依赖 Model | 依赖 Service |")
    lines.append("|---|-----------|------|-----------|-----------|-------------|")
    idx = 1
    for s in server['services']:
        exports_count = len(s.get('exports', []))
        models = ', '.join(s.get('dependencies', {}).get('models', [])) or '—'
        services = ', '.join(s.get('dependencies', {}).get('services', [])) or '—'
        lines.append(f"| {idx} | {s['name']} | services/{s['name']}.ts | {exports_count} | {models} | {services} |")
        idx += 1

    lines.append("\n## Service 摘要\n")
    for s in server['services']:
        lines.append(f"### {s['name']}\n")
        lines.append(f"**文件**: server/src/services/{s['name']}.ts\n")

        if s.get('exports'):
            lines.append("**导出函数**:\n")
            lines.append("| 函数 | 说明 |")
            lines.append("|------|------|")
            for exp in s['exports']:
                lines.append(f"| {exp} | — |")
            lines.append("")

        deps = s.get('dependencies', {})
        if deps.get('models') or deps.get('services') or deps.get('external'):
            lines.append("**依赖**:\n")
            lines.append("| 依赖 | 类型 | 用途 |")
            lines.append("|------|------|------|")
            for m in deps.get('models', []):
                lines.append(f"| {m} | Model | — |")
            for sv in deps.get('services', []):
                lines.append(f"| {sv} | Service | — |")
            for ext in deps.get('external', []):
                lines.append(f"| {ext} | 外部库 | — |")
            lines.append("")

    write_file(os.path.join(out_dir, '03_index_service.md'), '\n'.join(lines) + '\n')


def gen_server_service_details(server, out_dir):
    """生成 services/*.md 详情文件"""
    for s in server['services']:
        lines = [f"# {s['name']}\n"]
        lines.append(f"**文件**: server/src/services/{s['name']}.ts")
        exports_count = len(s.get('exports', []))
        complexity = '复杂' if exports_count >= 3 else '简单'
        lines.append(f"**复杂度**: {complexity}\n")

        lines.append("## 职责\n")
        lines.append(f"{s['name']} 业务逻辑服务。\n")

        deps = s.get('dependencies', {})
        if deps.get('models') or deps.get('services') or deps.get('external'):
            lines.append("## 依赖\n")
            lines.append("| 依赖 | 类型 | 用途 |")
            lines.append("|------|------|------|")
            for m in deps.get('models', []):
                lines.append(f"| {m} | Model | — |")
            for sv in deps.get('services', []):
                lines.append(f"| {sv} | Service | — |")
            for ext in deps.get('external', []):
                lines.append(f"| {ext} | 外部库 | — |")
            lines.append("")

        if s.get('exports'):
            if complexity == '简单':
                lines.append("## 导出函数\n")
                lines.append("| 函数 | 说明 |")
                lines.append("|------|------|")
                for exp in s['exports']:
                    lines.append(f"| {exp} | — |")
            else:
                lines.append("## 导出函数详情\n")
                for exp in s['exports']:
                    lines.append(f"### {exp}\n")
                    lines.append("⚠️ 待补充详细逻辑\n")
            lines.append("")

        write_file(os.path.join(out_dir, 'services', f"{s['name']}.md"), '\n'.join(lines) + '\n')


def gen_server_config_index(server, out_dir):
    """生成 04_index_config.md"""
    lines = ["# 配置与中间件索引\n"]

    # 中间件
    lines.append("## 中间件\n")
    lines.append("| # | 中间件名 | 文件 | 说明 |")
    lines.append("|---|---------|------|------|")
    idx = 1
    for mw in server.get('middleware', []):
        for exp in mw.get('exports', []):
            lines.append(f"| {idx} | {exp} | middleware/{mw['name']}.ts | — |")
            idx += 1
    lines.append("")

    # 配置
    lines.append("## 配置文件\n")
    lines.append("| # | 文件 | 导出 | 说明 |")
    lines.append("|---|------|------|------|")
    idx = 1
    for cfg in server.get('config', []):
        exports = ', '.join(cfg.get('exports', [])) or '—'
        lines.append(f"| {idx} | config/{os.path.basename(cfg.get('file',''))} | {exports} | — |")
        idx += 1
    lines.append("")

    # 数据库
    lines.append("## 数据库\n")
    lines.append("| # | 文件 | 说明 |")
    lines.append("|---|------|------|")
    for db in server.get('db', []):
        lines.append(f"| 1 | db/{os.path.basename(db.get('file',''))} | MongoDB 连接管理 |")
    lines.append("")

    write_file(os.path.join(out_dir, '04_index_config.md'), '\n'.join(lines) + '\n')


def gen_server_changelog(out_dir):
    """生成 changelog.md"""
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    content = f"""# Changelog

## {now} — 初始生成

- 从源码扫描自动生成知识库
- 覆盖全量路由、Model、Service、配置
"""
    write_file(os.path.join(out_dir, 'changelog.md'), content)


# ═══════════════════════════════════════════════════════════════════════════════
# React 前端知识库生成
# ═══════════════════════════════════════════════════════════════════════════════

def gen_react_project_map(fe, out_dir):
    """生成 00_project_map.md"""
    lines = [f"# {fe['name']} — 前端项目全景\n"]
    lines.append(f"**技术栈**: React + TypeScript + Antd + TailwindCSS + Zustand")
    lines.append(f"**路径**: {fe['path']}\n")

    lines.append("## 目录结构\n")
    lines.append("```")
    lines.append("src/")
    lines.append("├── App.tsx           # 根组件 + 路由")
    lines.append("├── api/              # API 请求封装")
    lines.append("├── components/       # 公共组件")
    lines.append("├── pages/            # 页面组件")
    lines.append("├── store/            # Zustand 状态管理")
    lines.append("└── types/            # TypeScript 类型定义")
    lines.append("```\n")

    # 路由表
    routes = fe.get('routes', [])
    if routes:
        lines.append("## 路由表\n")
        lines.append("| 路径 | 组件 |")
        lines.append("|------|------|")
        for r in routes:
            lines.append(f"| {r['path']} | {r['component']} |")
        lines.append("")

    lines.append("## 统计\n")
    lines.append(f"- 页面: {len(fe.get('pages', []))} 个")
    lines.append(f"- 组件: {len(fe.get('components', []))} 个")
    lines.append(f"- API 文件: {len(fe.get('api_files', []))} 个")
    lines.append(f"- Store 文件: {len(fe.get('store_files', []))} 个")
    lines.append(f"- Types 文件: {len(fe.get('types_files', []))} 个")
    lines.append(f"- Hooks: {len(fe.get('hooks', []))} 个")

    write_file(os.path.join(out_dir, '00_project_map.md'), '\n'.join(lines) + '\n')


def gen_react_page_index(fe, out_dir):
    """生成 01_index_page.md"""
    lines = ["# 页面索引\n"]

    # 路由表
    routes = fe.get('routes', [])
    if routes:
        lines.append("## 路由表\n")
        lines.append("| # | 路由路径 | 页面组件 |")
        lines.append("|---|---------|---------|")
        for i, r in enumerate(routes, 1):
            lines.append(f"| {i} | {r['path']} | {r['component']} |")
        lines.append("")

    # 页面列表
    pages = [p for p in fe.get('pages', []) if p.get('rel_path', '').endswith(('.tsx', '.jsx'))]
    lines.append("## 页面功能摘要\n")
    lines.append("| # | 页面 | 文件 | useState 数 | API 调用 | 事件处理 |")
    lines.append("|---|------|------|------------|---------|---------|")
    for i, p in enumerate(pages, 1):
        states = len(p.get('states', []))
        apis = ', '.join(p.get('api_calls', [])[:3]) or '—'
        handlers = len(p.get('handlers', []))
        lines.append(f"| {i} | {p['name']} | {p.get('rel_path','')} | {states} | {apis} | {handlers} |")
    lines.append("")

    write_file(os.path.join(out_dir, '01_index_page.md'), '\n'.join(lines) + '\n')


def gen_react_page_details(fe, out_dir):
    """生成 pages/*.md 详情文件"""
    pages = [p for p in fe.get('pages', []) if p.get('rel_path', '').endswith(('.tsx', '.jsx'))]
    for p in pages:
        name = p['name']
        kb_name = kebab(name)
        lines = [f"# {name}\n"]
        lines.append(f"**文件**: {p.get('rel_path', '')}")
        states_count = len(p.get('states', []))
        apis_count = len(p.get('api_calls', []))
        complexity = '复杂' if states_count >= 4 or apis_count >= 2 else '简单'
        lines.append(f"**复杂度**: {complexity}\n")

        lines.append("## 功能概述\n")
        lines.append(f"{name} 页面。\n")

        # 状态
        if p.get('states'):
            lines.append("## 状态管理\n")
            lines.append("| 状态 | setter | 类型 | 初始值 |")
            lines.append("|------|--------|------|--------|")
            for s in p['states']:
                lines.append(f"| {s['name']} | {s['setter']} | {s.get('type','—')} | {s.get('initial','—')} |")
            lines.append("")

        # API 调用
        if p.get('api_calls'):
            lines.append("## API 调用\n")
            lines.append("| API 方法 |")
            lines.append("|---------|")
            for a in p['api_calls']:
                lines.append(f"| api.{a} |")
            lines.append("")

        # Hooks
        if p.get('hooks'):
            lines.append("## Hooks\n")
            lines.append("| Hook |")
            lines.append("|------|")
            for h in p['hooks']:
                lines.append(f"| {h} |")
            lines.append("")

        # 事件处理
        if p.get('handlers'):
            lines.append("## 事件处理函数\n")
            lines.append("| 函数名 |")
            lines.append("|--------|")
            for h in p['handlers']:
                lines.append(f"| {h} |")
            lines.append("")

        write_file(os.path.join(out_dir, 'pages', f"{kb_name}.md"), '\n'.join(lines) + '\n')


def gen_react_component_index(fe, out_dir):
    """生成 02_index_component.md"""
    lines = ["# 公共组件索引\n"]
    comps = fe.get('components', [])
    if not comps:
        lines.append("> 该模块无公共组件\n")
    else:
        lines.append("## 组件总览\n")
        lines.append("| # | 组件名 | 文件 | Props 数 |")
        lines.append("|---|--------|------|---------|")
        for i, c in enumerate(comps, 1):
            props_count = len(c.get('props', []))
            lines.append(f"| {i} | {c['name']} | {c.get('rel_path','')} | {props_count} |")
        lines.append("")

        lines.append("## 组件详情\n")
        for c in comps:
            lines.append(f"### {c['name']}\n")
            lines.append(f"**文件**: {c.get('rel_path','')}\n")
            if c.get('props'):
                lines.append("**Props**:\n")
                lines.append("| Prop | 类型 | 可选 |")
                lines.append("|------|------|------|")
                for p in c['props']:
                    opt = '✅' if p.get('optional') else '—'
                    lines.append(f"| {p['name']} | {p['type']} | {opt} |")
                lines.append("")

    write_file(os.path.join(out_dir, '02_index_component.md'), '\n'.join(lines) + '\n')


def gen_react_api_index(fe, out_dir):
    """生成 03_index_api.md"""
    lines = ["# 前端 API 封装索引\n"]
    api_files = fe.get('api_files', [])
    if not api_files:
        lines.append("> 该模块无 API 封装文件\n")
    else:
        for af in api_files:
            lines.append(f"## {os.path.basename(af.get('file',''))}\n")
            lines.append(f"**文件**: {af.get('rel_path','')}\n")
            if af.get('exports'):
                lines.append("**导出函数**:\n")
                lines.append("| # | 函数名 |")
                lines.append("|---|--------|")
                for i, exp in enumerate(af['exports'], 1):
                    lines.append(f"| {i} | {exp} |")
                lines.append("")

    write_file(os.path.join(out_dir, '03_index_api.md'), '\n'.join(lines) + '\n')


def gen_react_store_index(fe, out_dir):
    """生成 04_index_store.md"""
    lines = ["# Zustand Store 索引\n"]
    stores = fe.get('store_files', [])
    if not stores:
        lines.append("> 该模块无 Store 文件\n")
    else:
        for sf in stores:
            lines.append(f"## {os.path.basename(sf.get('file',''))}\n")
            lines.append(f"**文件**: {sf.get('rel_path','')}\n")
            if sf.get('exports'):
                lines.append("**导出**:\n")
                lines.append("| 导出名 |")
                lines.append("|--------|")
                for exp in sf['exports']:
                    lines.append(f"| {exp} |")
                lines.append("")
            if sf.get('interfaces'):
                for iface in sf['interfaces']:
                    lines.append(f"**接口 `{iface['name']}`**:\n")
                    if iface.get('fields'):
                        lines.append("| 字段 | 类型 | 可选 |")
                        lines.append("|------|------|------|")
                        for f in iface['fields']:
                            opt = '✅' if f.get('optional') else '—'
                            lines.append(f"| {f['name']} | {f['type']} | {opt} |")
                        lines.append("")

    write_file(os.path.join(out_dir, '04_index_store.md'), '\n'.join(lines) + '\n')


def gen_react_types_index(fe, out_dir):
    """生成 05_index_types.md"""
    lines = ["# TypeScript 类型定义索引\n"]
    types_files = fe.get('types_files', [])
    if not types_files:
        lines.append("> 该模块无类型定义文件\n")
    else:
        for tf in types_files:
            lines.append(f"## {os.path.basename(tf.get('file',''))}\n")
            lines.append(f"**文件**: {tf.get('rel_path','')}\n")

            if tf.get('interfaces'):
                lines.append("### 接口\n")
                for iface in tf['interfaces']:
                    lines.append(f"#### {iface['name']}\n")
                    if iface.get('fields'):
                        lines.append("| 字段 | 类型 | 可选 |")
                        lines.append("|------|------|------|")
                        for f in iface['fields']:
                            opt = '✅' if f.get('optional') else '—'
                            lines.append(f"| {f['name']} | {f['type']} | {opt} |")
                        lines.append("")

            if tf.get('types'):
                lines.append("### 类型别名\n")
                lines.append("| 类型名 | 定义 |")
                lines.append("|--------|------|")
                for t in tf['types']:
                    lines.append(f"| {t['name']} | {t['value'][:60]} |")
                lines.append("")

    write_file(os.path.join(out_dir, '05_index_types.md'), '\n'.join(lines) + '\n')


def gen_react_changelog(out_dir):
    """生成 changelog.md"""
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    content = f"""# Changelog

## {now} — 初始生成

- 从源码扫描自动生成知识库
- 覆盖全量页面、组件、API、Store、Types
"""
    write_file(os.path.join(out_dir, 'changelog.md'), content)


# ═══════════════════════════════════════════════════════════════════════════════
# 主入口
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python3 generate_kb.py <scan_json> <kb_root>")
        sys.exit(1)

    scan_path = sys.argv[1]
    kb_root = os.path.abspath(sys.argv[2])
    scan = load_scan(scan_path)

    print("🚀 开始生成知识库...\n")

    # ─── Server ───
    server = scan.get('server')
    if server:
        server_dir = os.path.join(kb_root, 'server', 'server')
        print("📦 生成 Server 知识库:")
        gen_server_api_index(server, server_dir)
        gen_server_api_details(server, server_dir)
        gen_server_model_index(server, server_dir)
        gen_server_service_index(server, server_dir)
        gen_server_service_details(server, server_dir)
        gen_server_config_index(server, server_dir)
        gen_server_changelog(server_dir)
        print()

    # ─── Frontend ───
    for fe in scan.get('frontend_projects', []):
        fe_name = fe.get('name', 'unknown')
        fe_dir = os.path.join(kb_root, 'frontend', fe_name)
        print(f"📦 生成 {fe_name} 知识库:")
        gen_react_project_map(fe, fe_dir)
        gen_react_page_index(fe, fe_dir)
        gen_react_page_details(fe, fe_dir)
        gen_react_component_index(fe, fe_dir)
        gen_react_api_index(fe, fe_dir)
        gen_react_store_index(fe, fe_dir)
        gen_react_types_index(fe, fe_dir)
        gen_react_changelog(fe_dir)
        print()

    print("🎉 知识库生成完成！")
