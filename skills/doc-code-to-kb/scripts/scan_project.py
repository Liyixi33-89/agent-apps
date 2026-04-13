#!/usr/bin/env python3
"""
Project Scanner — 深度扫描 TypeScript/React/Koa Monorepo 项目。
提取符号表和索引信息，输出 JSON。

支持技术栈：
- 后端: Koa + TypeScript + Mongoose
- 前端: React + TypeScript + Vite + TailwindCSS + Antd + Zustand

Usage:
    python3 scan_project.py <project_root>
"""

import os, sys, json, re
from pathlib import Path

IGNORE_DIRS = {
    "node_modules", ".git", "__pycache__", "dist", "build",
    ".codebuddy", ".vscode", ".idea", "target", ".gradle",
    ".cache", "coverage", "tmp", "temp", ".nuxt", ".output",
    "public", "seed-data", "skills",
}

IGNORE_FILES = {".DS_Store", "Thumbs.db", ".gitignore", ".env", ".env.example"}

SOURCE_EXTS = {".ts", ".tsx", ".js", ".jsx"}


def should_ignore(name, is_dir=False):
    """判断是否应忽略该文件/目录。"""
    if name.startswith(".") and name not in (".github", ".env.example"):
        return True
    return name in (IGNORE_DIRS if is_dir else IGNORE_FILES)


# ─────────────────────── TS/TSX/JS/JSX 通用扫描 ───────────────────────

def scan_ts_file(file_path):
    """扫描单个 TS/TSX/JS/JSX 文件，提取符号信息。"""
    try:
        content = open(file_path, encoding="utf-8", errors="ignore").read()
    except Exception:
        return None

    info = {
        "file": file_path,
        "imports": [],
        "exports": [],
        "functions": [],
        "components": [],
        "interfaces": [],
        "types": [],
        "hooks": [],
        "constants": [],
    }

    # 提取 import 语句
    for m in re.finditer(r'import\s+(?:type\s+)?(?:\{([^}]+)\}|(\w+))\s+from\s+["\']([^"\']+)["\']', content):
        named = m.group(1)
        default_import = m.group(2)
        source = m.group(3)
        if named:
            names = [n.strip().split(' as ')[0].strip() for n in named.split(',')]
            info["imports"].append({"names": names, "source": source, "type": "named"})
        if default_import:
            info["imports"].append({"names": [default_import], "source": source, "type": "default"})

    # 提取 export 的函数
    for m in re.finditer(r'export\s+(?:async\s+)?(?:function|const)\s+(\w+)', content):
        info["exports"].append(m.group(1))

    # 提取 export default
    default_export = re.search(r'export\s+default\s+(?:function\s+)?(\w+)', content)
    if default_export:
        info["exports"].append(default_export.group(1))

    # 提取函数定义（包括箭头函数）
    for m in re.finditer(r'(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*\S+\s*)?=>)', content):
        name = m.group(1) or m.group(2)
        if name:
            info["functions"].append(name)

    # 提取 React 组件（大写开头的函数/const + 返回 JSX）
    for m in re.finditer(r'(?:export\s+)?(?:const|function)\s+([A-Z]\w+)', content):
        name = m.group(1)
        if name not in info["components"]:
            info["components"].append(name)

    # 提取 interface
    for m in re.finditer(r'(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{', content):
        iface = {"name": m.group(1), "extends": m.group(2) or ""}
        # 提取字段（简化版）
        start = m.end()
        brace_count = 1
        pos = start
        while pos < len(content) and brace_count > 0:
            if content[pos] == '{':
                brace_count += 1
            elif content[pos] == '}':
                brace_count -= 1
            pos += 1
        body = content[start:pos - 1]
        fields = []
        for fm in re.finditer(r'(\w+)(\?)?:\s*([^;\n]+)', body):
            fields.append({
                "name": fm.group(1),
                "optional": bool(fm.group(2)),
                "type": fm.group(3).strip().rstrip(';'),
            })
        iface["fields"] = fields
        info["interfaces"].append(iface)

    # 提取 type 别名
    for m in re.finditer(r'(?:export\s+)?type\s+(\w+)\s*=\s*([^;\n]+)', content):
        info["types"].append({"name": m.group(1), "value": m.group(2).strip()})

    # 提取 React Hooks 调用
    for m in re.finditer(r'(use\w+)\s*\(', content):
        hook = m.group(1)
        if hook not in info["hooks"]:
            info["hooks"].append(hook)

    # 提取导出的常量
    for m in re.finditer(r'export\s+const\s+(\w+)\s*(?::\s*\S+\s*)?=\s*(?![\s(])', content):
        name = m.group(1)
        if name[0].isupper() and name not in info["constants"]:
            # 跳过组件（已在 components 中）
            pass
        elif name not in info["constants"]:
            info["constants"].append(name)

    return info


# ─────────────────────── Koa 后端扫描 ───────────────────────

def scan_koa_route(file_path):
    """扫描 Koa 路由文件，提取 API 端点。"""
    try:
        content = open(file_path, encoding="utf-8", errors="ignore").read()
    except Exception:
        return None

    info = {
        "file": file_path,
        "name": os.path.splitext(os.path.basename(file_path))[0],
        "endpoints": [],
    }

    # 提取 router.method(path, ...) 模式
    for m in re.finditer(
        r'router\.(get|post|put|patch|delete)\s*\(\s*["\']([^"\']+)["\']',
        content, re.IGNORECASE
    ):
        method = m.group(1).upper()
        path = m.group(2)

        # 检查是否有中间件
        middlewares = []
        line_start = content.rfind('\n', 0, m.start()) + 1
        line_end = content.find('\n', m.end())
        line = content[line_start:line_end] if line_end > 0 else content[line_start:]

        for mw in re.finditer(r'(requireAuth|requireAdmin|requireRole)', line):
            middlewares.append(mw.group(1))

        info["endpoints"].append({
            "method": method,
            "path": path,
            "middlewares": middlewares,
        })

    return info


def scan_mongoose_model(file_path):
    """扫描 Mongoose Model 文件，提取 Schema 字段。"""
    try:
        content = open(file_path, encoding="utf-8", errors="ignore").read()
    except Exception:
        return None

    info = {
        "file": file_path,
        "name": os.path.splitext(os.path.basename(file_path))[0],
        "fields": [],
        "interfaces": [],
        "indexes": [],
        "methods": [],
        "statics": [],
    }

    # 提取 interface 定义
    for m in re.finditer(r'(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+\w+)?\s*\{([^}]+)\}', content, re.DOTALL):
        iface_name = m.group(1)
        body = m.group(2)
        fields = []
        for fm in re.finditer(r'(\w+)(\?)?:\s*([^;\n]+)', body):
            fields.append({
                "name": fm.group(1),
                "optional": bool(fm.group(2)),
                "type": fm.group(3).strip().rstrip(';'),
            })
        info["interfaces"].append({"name": iface_name, "fields": fields})

    # 提取 Schema 字段（简化版：匹配 key: { type: ... } 模式）
    schema_match = re.search(r'new\s+(?:mongoose\.)?Schema\s*\(\s*\{(.*?)\}\s*[,)]', content, re.DOTALL)
    if schema_match:
        schema_body = schema_match.group(1)
        for fm in re.finditer(r'(\w+)\s*:\s*\{([^}]+)\}', schema_body):
            field_name = fm.group(1)
            field_body = fm.group(2)

            field_info = {"name": field_name}

            type_match = re.search(r'type\s*:\s*(\w+)', field_body)
            if type_match:
                field_info["type"] = type_match.group(1)

            field_info["required"] = "required" in field_body and "true" in field_body.lower()
            field_info["unique"] = "unique" in field_body and "true" in field_body.lower()

            ref_match = re.search(r'ref\s*:\s*["\'](\w+)["\']', field_body)
            if ref_match:
                field_info["ref"] = ref_match.group(1)

            default_match = re.search(r'default\s*:\s*([^,\n]+)', field_body)
            if default_match:
                field_info["default"] = default_match.group(1).strip()

            enum_match = re.search(r'enum\s*:\s*\[([^\]]+)\]', field_body)
            if enum_match:
                field_info["enum"] = enum_match.group(1).strip()

            info["fields"].append(field_info)

        # 简单字段（key: Type 模式）
        for fm in re.finditer(r'(\w+)\s*:\s*(String|Number|Boolean|Date|ObjectId|Mixed|Buffer|Map)\b', schema_body):
            field_name = fm.group(1)
            if not any(f["name"] == field_name for f in info["fields"]):
                info["fields"].append({"name": field_name, "type": fm.group(2)})

    # 提取 model 名
    model_match = re.search(r'mongoose\.model\s*[<(]\s*["\']?(\w+)', content)
    if model_match:
        info["model_name"] = model_match.group(1)

    return info


def scan_koa_service(file_path):
    """扫描 Service 文件，提取导出函数和依赖。"""
    try:
        content = open(file_path, encoding="utf-8", errors="ignore").read()
    except Exception:
        return None

    info = {
        "file": file_path,
        "name": os.path.splitext(os.path.basename(file_path))[0],
        "exports": [],
        "imports": [],
        "dependencies": {"models": [], "services": [], "external": []},
    }

    # 提取 import
    for m in re.finditer(r'import\s+(?:type\s+)?(?:\{([^}]+)\}|(\w+))\s+from\s+["\']([^"\']+)["\']', content):
        source = m.group(3)
        names = []
        if m.group(1):
            names = [n.strip().split(' as ')[0].strip() for n in m.group(1).split(',')]
        elif m.group(2):
            names = [m.group(2)]

        if '../models/' in source or '/models/' in source:
            info["dependencies"]["models"].extend(names)
        elif '../services/' in source or '/services/' in source:
            info["dependencies"]["services"].extend(names)
        elif not source.startswith('.'):
            info["dependencies"]["external"].append(source)

        info["imports"].append({"names": names, "source": source})

    # 提取导出函数
    for m in re.finditer(r'export\s+(?:async\s+)?(?:function|const)\s+(\w+)', content):
        info["exports"].append(m.group(1))

    # 提取类导出
    for m in re.finditer(r'export\s+(?:default\s+)?class\s+(\w+)', content):
        info["exports"].append(m.group(1))

    return info


def scan_koa_middleware(file_path):
    """扫描中间件文件。"""
    try:
        content = open(file_path, encoding="utf-8", errors="ignore").read()
    except Exception:
        return None

    info = {
        "file": file_path,
        "name": os.path.splitext(os.path.basename(file_path))[0],
        "exports": [],
    }

    for m in re.finditer(r'export\s+(?:async\s+)?(?:function|const)\s+(\w+)', content):
        info["exports"].append(m.group(1))

    return info


def scan_server(server_root):
    """扫描 Koa 后端项目。"""
    result = {
        "name": "server",
        "path": server_root,
        "tech": "koa-typescript",
        "routes": [],
        "models": [],
        "services": [],
        "middleware": [],
        "config": [],
        "scripts": [],
        "db": [],
    }

    src = os.path.join(server_root, "src")
    if not os.path.isdir(src):
        return result

    # 扫描路由
    routes_dir = os.path.join(src, "routes")
    if os.path.isdir(routes_dir):
        for fn in sorted(os.listdir(routes_dir)):
            if fn.endswith(".ts"):
                fp = os.path.join(routes_dir, fn)
                route_info = scan_koa_route(fp)
                if route_info:
                    route_info["rel_path"] = os.path.relpath(fp, server_root)
                    result["routes"].append(route_info)

    # 扫描 Models
    models_dir = os.path.join(src, "models")
    if os.path.isdir(models_dir):
        for fn in sorted(os.listdir(models_dir)):
            if fn.endswith(".ts"):
                fp = os.path.join(models_dir, fn)
                model_info = scan_mongoose_model(fp)
                if model_info:
                    model_info["rel_path"] = os.path.relpath(fp, server_root)
                    result["models"].append(model_info)

    # 扫描 Services
    services_dir = os.path.join(src, "services")
    if os.path.isdir(services_dir):
        for fn in sorted(os.listdir(services_dir)):
            if fn.endswith(".ts"):
                fp = os.path.join(services_dir, fn)
                svc_info = scan_koa_service(fp)
                if svc_info:
                    svc_info["rel_path"] = os.path.relpath(fp, server_root)
                    result["services"].append(svc_info)

    # 扫描中间件
    mw_dir = os.path.join(src, "middleware")
    if os.path.isdir(mw_dir):
        for fn in sorted(os.listdir(mw_dir)):
            if fn.endswith(".ts"):
                fp = os.path.join(mw_dir, fn)
                mw_info = scan_koa_middleware(fp)
                if mw_info:
                    mw_info["rel_path"] = os.path.relpath(fp, mw_dir)
                    result["middleware"].append(mw_info)

    # 扫描配置
    config_dir = os.path.join(src, "config")
    if os.path.isdir(config_dir):
        for fn in sorted(os.listdir(config_dir)):
            if fn.endswith(".ts"):
                fp = os.path.join(config_dir, fn)
                ts_info = scan_ts_file(fp)
                if ts_info:
                    ts_info["rel_path"] = os.path.relpath(fp, server_root)
                    result["config"].append(ts_info)

    # 扫描脚本
    scripts_dir = os.path.join(src, "scripts")
    if os.path.isdir(scripts_dir):
        for fn in sorted(os.listdir(scripts_dir)):
            if fn.endswith(".ts"):
                fp = os.path.join(scripts_dir, fn)
                ts_info = scan_ts_file(fp)
                if ts_info:
                    ts_info["rel_path"] = os.path.relpath(fp, server_root)
                    result["scripts"].append(ts_info)

    # 扫描 db
    db_dir = os.path.join(src, "db")
    if os.path.isdir(db_dir):
        for fn in sorted(os.listdir(db_dir)):
            if fn.endswith(".ts"):
                fp = os.path.join(db_dir, fn)
                ts_info = scan_ts_file(fp)
                if ts_info:
                    ts_info["rel_path"] = os.path.relpath(fp, server_root)
                    result["db"].append(ts_info)

    # 扫描入口文件
    index_file = os.path.join(src, "index.ts")
    if os.path.exists(index_file):
        result["entry"] = scan_ts_file(index_file)
        if result["entry"]:
            result["entry"]["rel_path"] = "src/index.ts"

    return result


# ─────────────────────── React 前端扫描 ───────────────────────

def scan_react_page(file_path):
    """扫描 React 页面组件，提取详细信息。"""
    try:
        content = open(file_path, encoding="utf-8", errors="ignore").read()
    except Exception:
        return None

    info = scan_ts_file(file_path) or {}
    info["file"] = file_path
    info["name"] = os.path.splitext(os.path.basename(file_path))[0]

    # 提取 useState 调用
    states = []
    for m in re.finditer(r'const\s+\[(\w+),\s*(\w+)\]\s*=\s*useState(?:<([^>]+)>)?\s*\(([^)]*)\)', content):
        states.append({
            "name": m.group(1),
            "setter": m.group(2),
            "type": m.group(3) or "",
            "initial": m.group(4).strip() or "",
        })
    info["states"] = states

    # 提取 useEffect 数量
    info["effect_count"] = len(re.findall(r'useEffect\s*\(', content))

    # 提取 API 调用（api.xxx 模式）
    api_calls = list(set(re.findall(r'api\.(\w+)', content)))
    info["api_calls"] = api_calls

    # 提取事件处理函数
    handlers = []
    for m in re.finditer(r'const\s+(handle\w+)\s*=', content):
        handlers.append(m.group(1))
    info["handlers"] = handlers

    return info


def scan_react_component(file_path):
    """扫描 React 公共组件。"""
    try:
        content = open(file_path, encoding="utf-8", errors="ignore").read()
    except Exception:
        return None

    info = scan_ts_file(file_path) or {}
    info["file"] = file_path
    info["name"] = os.path.splitext(os.path.basename(file_path))[0]

    # 提取 Props 接口
    props_match = re.search(r'interface\s+(\w*Props\w*)\s*\{([^}]+)\}', content, re.DOTALL)
    if props_match:
        props = []
        for fm in re.finditer(r'(\w+)(\?)?:\s*([^;\n]+)', props_match.group(2)):
            props.append({
                "name": fm.group(1),
                "optional": bool(fm.group(2)),
                "type": fm.group(3).strip().rstrip(';'),
            })
        info["props"] = props
    else:
        info["props"] = []

    return info


def scan_react_project(project_root, project_name=""):
    """扫描单个 React 前端项目。"""
    result = {
        "name": project_name or os.path.basename(project_root),
        "path": project_root,
        "tech": "react-typescript",
        "pages": [],
        "components": [],
        "api_files": [],
        "store_files": [],
        "types_files": [],
        "hooks": [],
    }

    src = os.path.join(project_root, "src")
    if not os.path.isdir(src):
        return result

    # 扫描页面
    pages_dir = os.path.join(src, "pages")
    if os.path.isdir(pages_dir):
        for dp, dns, fns in os.walk(pages_dir):
            dns[:] = [d for d in dns if not should_ignore(d, is_dir=True)]
            for fn in sorted(fns):
                if fn.endswith((".tsx", ".jsx")):
                    fp = os.path.join(dp, fn)
                    page_info = scan_react_page(fp)
                    if page_info:
                        page_info["rel_path"] = os.path.relpath(fp, project_root)
                        result["pages"].append(page_info)
                elif fn.endswith((".ts", ".js")) and not fn.endswith(".d.ts"):
                    fp = os.path.join(dp, fn)
                    ts_info = scan_ts_file(fp)
                    if ts_info:
                        ts_info["rel_path"] = os.path.relpath(fp, project_root)
                        # 判断是 hook 还是工具文件
                        name = os.path.splitext(fn)[0]
                        if name.startswith("use"):
                            result["hooks"].append(ts_info)
                        else:
                            # 作为页面辅助文件
                            result["pages"].append(ts_info)

    # 扫描组件
    components_dir = os.path.join(src, "components")
    if os.path.isdir(components_dir):
        for fn in sorted(os.listdir(components_dir)):
            if fn.endswith((".tsx", ".jsx")):
                fp = os.path.join(components_dir, fn)
                comp_info = scan_react_component(fp)
                if comp_info:
                    comp_info["rel_path"] = os.path.relpath(fp, project_root)
                    result["components"].append(comp_info)

    # 扫描 API
    api_dir = os.path.join(src, "api")
    if os.path.isdir(api_dir):
        for fn in sorted(os.listdir(api_dir)):
            if fn.endswith((".ts", ".js")):
                fp = os.path.join(api_dir, fn)
                api_info = scan_ts_file(fp)
                if api_info:
                    api_info["rel_path"] = os.path.relpath(fp, project_root)
                    result["api_files"].append(api_info)

    # 扫描 Store
    store_dir = os.path.join(src, "store")
    if os.path.isdir(store_dir):
        for fn in sorted(os.listdir(store_dir)):
            if fn.endswith((".ts", ".js")):
                fp = os.path.join(store_dir, fn)
                store_info = scan_ts_file(fp)
                if store_info:
                    store_info["rel_path"] = os.path.relpath(fp, project_root)
                    result["store_files"].append(store_info)

    # 扫描 Types
    types_dir = os.path.join(src, "types")
    if os.path.isdir(types_dir):
        for fn in sorted(os.listdir(types_dir)):
            if fn.endswith((".ts", ".js")) and not fn.endswith(".d.ts"):
                fp = os.path.join(types_dir, fn)
                types_info = scan_ts_file(fp)
                if types_info:
                    types_info["rel_path"] = os.path.relpath(fp, project_root)
                    result["types_files"].append(types_info)

    # 扫描 App.tsx（路由定义）
    app_file = os.path.join(src, "App.tsx")
    if os.path.exists(app_file):
        result["app"] = scan_ts_file(app_file)
        if result["app"]:
            result["app"]["rel_path"] = "src/App.tsx"

            # 提取路由定义
            try:
                app_content = open(app_file, encoding="utf-8", errors="ignore").read()
                routes = []
                for m in re.finditer(r'<Route\s+[^>]*path\s*=\s*["\']([^"\']+)["\'][^>]*element\s*=\s*\{[^}]*<(\w+)', app_content):
                    routes.append({"path": m.group(1), "component": m.group(2)})
                # 也匹配 element 在 path 前面的情况
                for m in re.finditer(r'<Route\s+[^>]*element\s*=\s*\{[^}]*<(\w+)[^>]*\}[^>]*path\s*=\s*["\']([^"\']+)["\']', app_content):
                    routes.append({"path": m.group(2), "component": m.group(1)})
                result["routes"] = routes
            except Exception:
                result["routes"] = []

    return result


# ─────────────────────── 主入口 ───────────────────────

def detect_monorepo(root):
    """检测 Monorepo 结构。"""
    pkg_path = os.path.join(root, "package.json")
    if not os.path.exists(pkg_path):
        return None

    try:
        pkg = json.load(open(pkg_path, encoding="utf-8", errors="ignore"))
        workspaces = pkg.get("workspaces", [])
        if workspaces:
            return {
                "name": pkg.get("name", os.path.basename(root)),
                "version": pkg.get("version", ""),
                "workspaces": workspaces,
            }
    except Exception:
        pass
    return None


def scan_project(root):
    """扫描整个项目。"""
    root = os.path.abspath(root)
    if not os.path.isdir(root):
        return {"error": f"Not a directory: {root}"}

    monorepo = detect_monorepo(root)

    result = {
        "project_root": root,
        "project_name": monorepo["name"] if monorepo else os.path.basename(root),
        "project_type": "monorepo" if monorepo else "single",
        "monorepo": monorepo,
        "server": None,
        "frontend_projects": [],
    }

    if monorepo:
        # Monorepo 模式：扫描各 workspace
        for ws in monorepo["workspaces"]:
            ws_path = os.path.join(root, ws)
            if not os.path.isdir(ws_path):
                continue

            ws_pkg_path = os.path.join(ws_path, "package.json")
            if not os.path.exists(ws_pkg_path):
                continue

            try:
                ws_pkg = json.load(open(ws_pkg_path, encoding="utf-8", errors="ignore"))
            except Exception:
                continue

            all_deps = {}
            for k in ("dependencies", "devDependencies"):
                all_deps.update(ws_pkg.get(k, {}))

            # 判断是后端还是前端
            if "koa" in all_deps or "express" in all_deps or "fastify" in all_deps:
                result["server"] = scan_server(ws_path)
            elif "react" in all_deps or "vue" in all_deps:
                result["frontend_projects"].append(
                    scan_react_project(ws_path, ws_pkg.get("name", ws))
                )
    else:
        # 单项目模式
        pkg_path = os.path.join(root, "package.json")
        if os.path.exists(pkg_path):
            try:
                pkg = json.load(open(pkg_path, encoding="utf-8", errors="ignore"))
                all_deps = {}
                for k in ("dependencies", "devDependencies"):
                    all_deps.update(pkg.get(k, {}))

                if "koa" in all_deps or "express" in all_deps:
                    result["server"] = scan_server(root)
                elif "react" in all_deps:
                    result["frontend_projects"].append(scan_react_project(root))
            except Exception:
                pass

    return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 scan_project.py <project_root>", file=sys.stderr)
        sys.exit(1)
    print(json.dumps(scan_project(sys.argv[1]), ensure_ascii=False, indent=2))
