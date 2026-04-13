#!/usr/bin/env python3
"""
Knowledge Base Progress Tracker — 知识库构建进度管理

管理 progress.md 文件，追踪每个待生成文件的完成状态。
适配 TypeScript/React/Koa Monorepo 项目。

Usage:
    python3 gen_progress.py init <kb_root> <scan_json_file>
    python3 gen_progress.py done <kb_root> <relative_filepath>
    python3 gen_progress.py status <kb_root>
"""

import sys
import os
import json
import re
from datetime import datetime
from pathlib import Path


# ─────────────────────── 常量 ───────────────────────

PROGRESS_FILE = "progress.md"

# Koa 后端模块的第二层索引文件
SERVER_LAYER2_FILES = [
    "00_project_map.md",
    "01_index_api.md",
    "02_index_model.md",
    "03_index_service.md",
    "04_index_config.md",
    "changelog.md",
]

# React 前端模块的第二层索引文件
REACT_LAYER2_FILES = [
    "00_project_map.md",
    "01_index_page.md",
    "02_index_component.md",
    "03_index_api.md",
    "04_index_store.md",
    "05_index_types.md",
    "changelog.md",
]

# Monorepo 根级别文件
ROOT_FILES = [
    "00_project_map.md",
]


# ─────────────────────── init 子命令 ───────────────────────

def cmd_init(kb_root: str, scan_json_path: str):
    """从 scan JSON 生成 progress.md，列出所有待生成文件。"""
    kb_root = os.path.abspath(kb_root)
    os.makedirs(kb_root, exist_ok=True)

    try:
        with open(scan_json_path, encoding="utf-8") as f:
            scan = json.load(f)
    except Exception as e:
        print(json.dumps({"error": f"Cannot read scan JSON: {e}"}, ensure_ascii=False))
        sys.exit(1)

    lines = ["# 知识库构建进度\n"]
    lines.append(f"> 初始化时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"> 项目类型: {scan.get('project_type', 'unknown')}\n")

    # 根级别文件
    if scan.get("project_type") == "monorepo":
        lines.append("## 根级别\n")
        lines.append("### 根级别文件\n")
        for f in ROOT_FILES:
            lines.append(f"- ⬜ {f}")
        lines.append("")

    # 后端 Server
    server = scan.get("server")
    if server:
        server_name = server.get("name", "server")
        lines.append(f"## server/{server_name}\n")

        # 第二层
        lines.append("### 第二层（索引文件）\n")
        for f in SERVER_LAYER2_FILES:
            lines.append(f"- ⬜ {f}")
        lines.append("")

        # 第三层 — api/（路由详情）
        routes = server.get("routes", [])
        if routes:
            lines.append("### 第三层（详情文件）\n")
            lines.append("#### api/\n")
            for route in routes:
                name = route.get("name", "unknown")
                lines.append(f"- ⬜ api/{name}.md")
            lines.append("")

        # 第三层 — services/
        services = server.get("services", [])
        if services:
            if not routes:
                lines.append("### 第三层（详情文件）\n")
            lines.append("#### services/\n")
            for svc in services:
                name = svc.get("name", "unknown")
                lines.append(f"- ⬜ services/{name}.md")
            lines.append("")

    # React 前端项目
    frontend_projects = scan.get("frontend_projects", [])
    for fe in frontend_projects:
        fe_name = fe.get("name", "unknown")
        lines.append(f"## frontend/{fe_name}\n")

        # 第二层
        lines.append("### 第二层（索引文件）\n")
        for f in REACT_LAYER2_FILES:
            lines.append(f"- ⬜ {f}")
        lines.append("")

        # 第三层 — pages/
        pages = fe.get("pages", [])
        page_tsx_files = [p for p in pages if p.get("rel_path", "").endswith((".tsx", ".jsx"))]
        if page_tsx_files:
            lines.append("### 第三层（详情文件）\n")
            lines.append("#### pages/\n")
            for page in page_tsx_files:
                name = page.get("name", "unknown")
                # 转为 kebab-case
                kebab = re.sub(r'([a-z])([A-Z])', r'\1-\2', name).lower()
                lines.append(f"- ⬜ pages/{kebab}.md")
            lines.append("")

    progress_path = os.path.join(kb_root, PROGRESS_FILE)
    with open(progress_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    # 统计
    total = sum(1 for line in lines if line.startswith("- ⬜"))
    print(json.dumps({
        "action": "init",
        "progress_file": progress_path,
        "total_files": total,
        "message": f"进度清单已生成，共 {total} 个待生成文件",
    }, ensure_ascii=False, indent=2))


# ─────────────────────── done 子命令 ───────────────────────

def cmd_done(kb_root: str, relative_filepath: str):
    """标记一个文件为已完成。"""
    kb_root = os.path.abspath(kb_root)
    progress_path = os.path.join(kb_root, PROGRESS_FILE)

    if not os.path.exists(progress_path):
        print(json.dumps({"error": "progress.md not found. Run 'init' first."}, ensure_ascii=False))
        sys.exit(1)

    with open(progress_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 归一化路径分隔符
    target = relative_filepath.replace("\\", "/").strip("/")
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    # 尝试精确匹配
    pattern_exact = f"- ⬜ {target}"
    replacement = f"- ✅ {target} ({now})"

    if pattern_exact in content:
        content = content.replace(pattern_exact, replacement, 1)
    else:
        # 尝试只匹配文件名部分
        basename = os.path.basename(target)
        parent = os.path.basename(os.path.dirname(target))
        short_path = f"{parent}/{basename}" if parent else basename

        pattern_short = f"- ⬜ {short_path}"
        replacement_short = f"- ✅ {short_path} ({now})"

        if pattern_short in content:
            content = content.replace(pattern_short, replacement_short, 1)
        else:
            # 最后尝试只匹配文件名
            found = False
            for line in content.split("\n"):
                if "⬜" in line and basename in line:
                    old_line = line
                    new_line = line.replace("⬜", "✅").rstrip() + f" ({now})"
                    content = content.replace(old_line, new_line, 1)
                    found = True
                    break

            if not found:
                print(json.dumps({
                    "action": "done",
                    "status": "not_found",
                    "file": target,
                    "message": f"未在 progress.md 中找到匹配项: {target}（可能已完成或不在清单中）",
                }, ensure_ascii=False, indent=2))
                return

    with open(progress_path, "w", encoding="utf-8") as f:
        f.write(content)

    print(json.dumps({
        "action": "done",
        "status": "marked",
        "file": target,
        "time": now,
        "message": f"已标记完成: {target}",
    }, ensure_ascii=False, indent=2))


# ─────────────────────── status 子命令 ───────────────────────

def cmd_status(kb_root: str):
    """输出当前进度摘要。"""
    kb_root = os.path.abspath(kb_root)
    progress_path = os.path.join(kb_root, PROGRESS_FILE)

    if not os.path.exists(progress_path):
        print(json.dumps({
            "action": "status",
            "status": "no_progress",
            "message": "progress.md 不存在，需要先执行 init",
        }, ensure_ascii=False, indent=2))
        return

    with open(progress_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    done_files = []
    remaining_files = []
    current_module = ""
    modules_summary = {}

    for line in lines:
        line = line.rstrip()

        # 检测模块
        if line.startswith("## ") and not line.startswith("## 根级别"):
            current_module = line[3:].strip()
            if current_module not in modules_summary:
                modules_summary[current_module] = {"done": 0, "remaining": 0, "remaining_files": []}

        # 统计完成/未完成
        if "- ✅" in line:
            match = re.match(r"- ✅\s+(.+?)\s+\(", line)
            if match:
                done_files.append(match.group(1))
                if current_module in modules_summary:
                    modules_summary[current_module]["done"] += 1

        elif "- ⬜" in line:
            match = re.match(r"- ⬜\s+(.+)", line)
            if match:
                filepath = match.group(1).strip()
                remaining_files.append(filepath)
                if current_module in modules_summary:
                    modules_summary[current_module]["remaining"] += 1
                    modules_summary[current_module]["remaining_files"].append(filepath)

    # 确定当前模块（第一个有未完成文件的模块）
    current = None
    for mod, info in modules_summary.items():
        if info["remaining"] > 0:
            current = mod
            break

    total = len(done_files) + len(remaining_files)
    print(json.dumps({
        "action": "status",
        "total": total,
        "done": len(done_files),
        "remaining": len(remaining_files),
        "progress_pct": round(len(done_files) / total * 100, 1) if total > 0 else 0,
        "current_module": current,
        "remaining_files": remaining_files,
        "modules": modules_summary,
        "message": f"进度: {len(done_files)}/{total} ({round(len(done_files)/total*100, 1) if total > 0 else 0}%)"
                   + (f"，当前模块: {current}" if current else "，全部完成！"),
    }, ensure_ascii=False, indent=2))


# ─────────────────────── 主入口 ───────────────────────

def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  gen_progress.py init <kb_root> <scan_json_file>")
        print("  gen_progress.py done <kb_root> <relative_filepath>")
        print("  gen_progress.py status <kb_root>")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "init":
        if len(sys.argv) < 4:
            print("Usage: gen_progress.py init <kb_root> <scan_json_file>")
            sys.exit(1)
        cmd_init(sys.argv[2], sys.argv[3])

    elif cmd == "done":
        if len(sys.argv) < 4:
            print("Usage: gen_progress.py done <kb_root> <relative_filepath>")
            sys.exit(1)
        cmd_done(sys.argv[2], sys.argv[3])

    elif cmd == "status":
        if len(sys.argv) < 3:
            print("Usage: gen_progress.py status <kb_root>")
            sys.exit(1)
        cmd_status(sys.argv[2])

    else:
        print(f"Unknown command: {cmd}")
        print("Available commands: init, done, status")
        sys.exit(1)


if __name__ == "__main__":
    main()
