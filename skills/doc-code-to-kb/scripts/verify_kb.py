#!/usr/bin/env python3
"""
Knowledge Base Verifier — 知识库全量覆盖度验证
适配 TypeScript/React/Koa Monorepo 项目。

对比 progress.md 中的文件清单与实际 KB 目录中的文件，
验证覆盖度并输出结构化报告。

Usage:
    python3 verify_kb.py <kb_root>
"""

import sys
import os
import re
import json
from pathlib import Path


def read_progress(kb_root: str) -> dict:
    """读取 progress.md，返回各模块的文件状态。"""
    progress_path = os.path.join(kb_root, "progress.md")
    if not os.path.exists(progress_path):
        return {"error": "progress.md not found"}

    with open(progress_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    modules = {}
    current_module = ""

    for line in lines:
        line = line.rstrip()

        if line.startswith("## ") and not line.startswith("## 根级别"):
            current_module = line[3:].strip()
            modules[current_module] = {"done": [], "remaining": []}

        if "- ✅" in line:
            match = re.match(r"- ✅\s+(.+?)\s+\(", line)
            if match and current_module:
                modules[current_module]["done"].append(match.group(1).strip())

        elif "- ⬜" in line:
            match = re.match(r"- ⬜\s+(.+)", line)
            if match and current_module:
                modules[current_module]["remaining"].append(match.group(1).strip())

    return modules


def scan_kb_directory(kb_root: str) -> dict:
    """扫描 KB 目录结构，返回各模块实际文件列表。"""
    result = {}

    for type_dir in ("server", "frontend"):
        type_path = os.path.join(kb_root, type_dir)
        if not os.path.isdir(type_path):
            continue

        for mod_name in sorted(os.listdir(type_path)):
            mod_path = os.path.join(type_path, mod_name)
            if not os.path.isdir(mod_path):
                continue

            module_key = f"{type_dir}/{mod_name}"
            mod_files = {
                "layer2": [],
                "api": [],
                "services": [],
                "pages": [],
            }

            # 扫描根目录下的 .md 文件（第二层）
            for f in sorted(os.listdir(mod_path)):
                fp = os.path.join(mod_path, f)
                if os.path.isfile(fp) and f.endswith(".md") and f != "progress.md":
                    mod_files["layer2"].append(f)

            # 扫描子目录（第三层）
            for subdir in ("api", "services", "pages"):
                subdir_path = os.path.join(mod_path, subdir)
                if os.path.isdir(subdir_path):
                    for f in sorted(os.listdir(subdir_path)):
                        if f.endswith(".md"):
                            mod_files[subdir].append(f"{subdir}/{f}")

            result[module_key] = mod_files

    return result


def verify_format(file_path: str) -> bool:
    """简单格式检查：文件非空且包含 Markdown 标题或表格。"""
    if not os.path.exists(file_path):
        return False

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read(2000)
    except Exception:
        return False

    if len(content.strip()) < 10:
        return False

    has_heading = bool(re.search(r"^#{1,4}\s+", content, re.MULTILINE))
    has_table = "|" in content

    return has_heading or has_table


def verify_kb(kb_root: str) -> dict:
    """执行全量验证，返回结构化报告。"""
    kb_root = os.path.abspath(kb_root)

    # 1. 读取进度文件
    progress = read_progress(kb_root)
    if "error" in progress:
        return {
            "status": "error",
            "message": progress["error"],
            "recommendation": "先执行 gen_progress.py init 初始化进度清单",
        }

    # 2. 扫描实际目录
    actual = scan_kb_directory(kb_root)

    # 3. 逐模块验证
    modules_report = []
    total_missing = []
    total_format_issues = []

    for mod_key, prog_info in progress.items():
        mod_report = {
            "name": mod_key,
            "layer2": {"expected": 0, "actual": 0, "status": "pass", "missing": []},
            "layer3": {},
        }

        actual_mod = actual.get(mod_key, {
            "layer2": [], "api": [], "services": [], "pages": [],
        })

        # 统计第二层
        all_expected = prog_info["done"] + prog_info["remaining"]
        layer2_expected = [f for f in all_expected if "/" not in f]
        layer2_actual = actual_mod.get("layer2", [])

        mod_report["layer2"]["expected"] = len(layer2_expected)
        mod_report["layer2"]["actual"] = len(layer2_actual)

        missing_l2 = [f for f in layer2_expected if f not in layer2_actual]
        if missing_l2:
            mod_report["layer2"]["status"] = "fail"
            mod_report["layer2"]["missing"] = missing_l2
            total_missing.extend([f"{mod_key}/{f}" for f in missing_l2])

        # 统计第三层各子目录
        for subdir in ("api", "services", "pages"):
            expected_files = [f for f in all_expected if f.startswith(f"{subdir}/")]
            actual_files = actual_mod.get(subdir, [])

            if not expected_files and not actual_files:
                continue

            subdir_report = {
                "expected": len(expected_files),
                "actual": len(actual_files),
                "status": "pass",
                "missing": [],
            }

            missing = [f for f in expected_files if f not in actual_files]
            if missing:
                subdir_report["status"] = "fail"
                subdir_report["missing"] = missing
                total_missing.extend([f"{mod_key}/{f}" for f in missing])

            mod_report["layer3"][subdir] = subdir_report

        # 格式抽检
        mod_path = os.path.join(kb_root, mod_key.replace("/", os.sep))
        for f in layer2_actual:
            if f.startswith("0") and f.endswith(".md"):
                fp = os.path.join(mod_path, f)
                if not verify_format(fp):
                    total_format_issues.append(f"{mod_key}/{f}")

        modules_report.append(mod_report)

    # 4. 进度残留统计
    progress_remaining = sum(
        len(info["remaining"]) for info in progress.values()
    )

    # 5. 汇总
    overall_status = "pass"
    if total_missing or progress_remaining > 0:
        overall_status = "fail"

    recommendation = ""
    if total_missing:
        if len(total_missing) <= 10:
            recommendation = "补生成以下文件: " + ", ".join(total_missing)
        else:
            recommendation = f"有 {len(total_missing)} 个文件缺失，建议执行 gen_progress.py status 查看详情后逐个补生成"
    elif progress_remaining > 0:
        recommendation = f"progress.md 中有 {progress_remaining} 个文件未标记完成，请检查是否已生成但忘记执行 done"
    elif total_format_issues:
        recommendation = f"格式检查发现 {len(total_format_issues)} 个文件可能格式异常: " + ", ".join(total_format_issues[:5])

    return {
        "status": overall_status,
        "kb_root": kb_root,
        "modules": modules_report,
        "summary": {
            "total_modules": len(modules_report),
            "total_missing_files": len(total_missing),
            "progress_remaining": progress_remaining,
            "format_issues": len(total_format_issues),
        },
        "missing_files": total_missing,
        "format_issues": total_format_issues,
        "recommendation": recommendation or "全部通过，知识库完整",
    }


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 verify_kb.py <kb_root>")
        print("  Verifies KB completeness against progress.md and outputs JSON report.")
        sys.exit(1)

    result = verify_kb(sys.argv[1])
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
