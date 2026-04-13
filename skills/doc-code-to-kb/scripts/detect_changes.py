#!/usr/bin/env python3
"""
Knowledge Base Update Detector — 检测变更，确定需要更新的索引文件。
适配 TypeScript/React/Koa Monorepo 项目。

Usage:
    python3 detect_changes.py <project_root> [--since DATE] [--files f1,f2]
"""

import os, sys, json, subprocess, argparse, re
from datetime import datetime
from collections import defaultdict

# 文件/目录 -> 影响类别
FILE_PATTERNS = {
    "package.json": "dependency",
    "package-lock.json": "dependency",
    "yarn.lock": "dependency",
    "pnpm-lock.yaml": "dependency",
    ".env": "config",
    ".env.example": "config",
    "tsconfig.json": "config",
    "vite.config": "config",
    "tailwind.config": "config",
    "postcss.config": "config",
    "Dockerfile": "config",
    "docker-compose": "config",
    ".github/": "cicd",
    ".gitlab-ci.yml": "cicd",
}

DIR_PATTERNS = {
    # Koa 后端
    "routes": "api",
    "models": "model",
    "services": "service",
    "middleware": "config",
    "config": "config",
    "db": "config",
    "scripts": "config",
    "utils": "util",
    # React 前端
    "pages": "page",
    "components": "component",
    "api": "api",
    "store": "store",
    "stores": "store",
    "types": "types",
    "hooks": "hook",
}

# 类别 -> 受影响的索引文件
IMPACT_MAP_SERVER = {
    "dependency": ["00_project_map.md"],
    "config": ["00_project_map.md", "04_index_config.md"],
    "api": ["01_index_api.md"],
    "model": ["02_index_model.md"],
    "service": ["03_index_service.md"],
    "util": ["04_index_config.md"],
    "source": ["01_index_api.md", "02_index_model.md", "03_index_service.md"],
}

IMPACT_MAP_FRONTEND = {
    "dependency": ["00_project_map.md"],
    "config": ["00_project_map.md"],
    "page": ["01_index_page.md"],
    "component": ["02_index_component.md"],
    "api": ["03_index_api.md"],
    "store": ["04_index_store.md"],
    "types": ["05_index_types.md"],
    "hook": ["01_index_page.md"],
    "source": ["01_index_page.md", "02_index_component.md"],
}

SOURCE_EXTS = {".ts", ".tsx", ".js", ".jsx"}


def detect_git_changes(root, since=None):
    """检测 Git 变更文件。"""
    try:
        subprocess.run(["git", "rev-parse", "--git-dir"], cwd=root, capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        return []

    files = set()
    cmds = [["git", "diff", "--name-only"], ["git", "diff", "--name-only", "--cached"]]
    if since:
        cmds.append(["git", "log", "--name-only", "--pretty=format:", f"--since={since}"])
    else:
        cmds.append(["git", "diff", "--name-only", "HEAD~1", "HEAD"])

    for cmd in cmds:
        try:
            r = subprocess.run(cmd, cwd=root, capture_output=True, text=True)
            if r.returncode == 0:
                files.update(f.strip() for f in r.stdout.strip().split("\n") if f.strip())
        except Exception:
            pass
    return sorted(files)


def categorize_file(filepath):
    """对文件进行分类。"""
    cats = set()
    basename = os.path.basename(filepath)
    ext = os.path.splitext(filepath)[1].lower()
    parts = filepath.replace("\\", "/").split("/")

    for pat, cat in FILE_PATTERNS.items():
        if basename.startswith(pat) or filepath.startswith(pat):
            cats.add(cat)

    for part in parts:
        if part.lower() in DIR_PATTERNS:
            cats.add(DIR_PATTERNS[part.lower()])

    if ext in SOURCE_EXTS and not cats:
        cats.add("source")

    return list(cats) if cats else ["source"]


def detect_workspace(filepath, workspaces):
    """检测文件属于哪个 workspace。"""
    for ws in workspaces:
        if filepath.startswith(ws + "/") or filepath.startswith(ws + "\\"):
            return ws
    return None


def determine_affected(changed_files, workspaces=None):
    """确定受影响的索引文件。"""
    server_affected = defaultdict(list)
    frontend_affected = defaultdict(lambda: defaultdict(list))
    root_affected = defaultdict(list)

    for f in changed_files:
        cats = categorize_file(f)
        ws = detect_workspace(f, workspaces) if workspaces else None

        if ws == "server":
            for cat in cats:
                for kb_file in IMPACT_MAP_SERVER.get(cat, []):
                    server_affected[kb_file].append(f)
        elif ws in ("web", "admin"):
            for cat in cats:
                for kb_file in IMPACT_MAP_FRONTEND.get(cat, []):
                    frontend_affected[ws][kb_file].append(f)
        else:
            for cat in cats:
                root_affected[cat].append(f)

    return dict(server_affected), {k: dict(v) for k, v in frontend_affected.items()}, dict(root_affected)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("project_root")
    parser.add_argument("--since")
    parser.add_argument("--files")
    args = parser.parse_args()

    root = os.path.abspath(args.project_root)
    if args.files:
        changed = [f.strip() for f in args.files.split(",")]
    else:
        changed = detect_git_changes(root, args.since)

    # 检测 workspaces
    workspaces = []
    pkg_path = os.path.join(root, "package.json")
    if os.path.exists(pkg_path):
        try:
            pkg = json.load(open(pkg_path, encoding="utf-8"))
            workspaces = pkg.get("workspaces", [])
        except Exception:
            pass

    server_affected, frontend_affected, root_affected = determine_affected(changed, workspaces)

    print(json.dumps({
        "project_root": root,
        "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "changed_files": changed,
        "server_affected": server_affected if server_affected else None,
        "frontend_affected": frontend_affected if frontend_affected else None,
        "root_affected": root_affected if root_affected else None,
        "summary": {
            "total_changes": len(changed),
            "server_kb_files_to_update": list(server_affected.keys()),
            "frontend_projects_to_update": list(frontend_affected.keys()),
        },
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
