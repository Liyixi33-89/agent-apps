/**
 * @file routes/vibePipeline.ts
 * @description § 7  Vibe Coding — 多 Agent Pipeline（4步流水线）
 *
 * 执行顺序：
 *   Step 1 - 需求分析 Agent  → 拆解功能模块、数据结构、交互逻辑（纯文本）
 *   Step 2 - UI 设计 Agent   → 输出设计规范：配色、布局、组件风格、字体层级
 *   Step 3 - 代码生成 Agent  → 参考设计规范生成完整单文件 HTML（含 CSS + JS）
 *   Step 4 - 质检 Agent      → 检查并修复代码问题，输出最终可运行 HTML
 *
 * 路由列表：
 *   POST /api/vibe/pipeline         → Pipeline 流式生成（SSE）
 */

import Router from '@koa/router';
import { SystemPrompt } from '../models/SystemPrompt.js';
import type { ISystemPrompt } from '../models/SystemPrompt.js';
import { env } from '../config/env.js';
import { streamWithContinuation } from '../lib/llmUtils.js';

export const vibePipelineRouter = new Router();

// =============================================================================
// § 7a  Pipeline Prompt 常量
// =============================================================================
//
// 内置完整 Prompt（不依赖数据库 seed，确保开箱即用）
// 数据库中若有对应 key 则优先使用（支持后台热更新）
// =============================================================================

const FALLBACK_ANALYST_PROMPT = `你是一个专业的需求分析师。
请对用户的应用需求进行简洁的结构化分析，输出以下内容（纯文本，不要写代码）：
1. 应用类型判断（游戏 / 工具 / 管理系统 / 展示页面 / 其他）
2. 核心功能点列表（每个功能一行，按需求原文列出，不要增减）
3. 主要数据实体（如有，列出关键数据结构）
4. 关键交互流程（3-5 条，根据应用类型描述）
5. 推荐的 UI 布局方案（根据应用类型推荐：游戏→全屏画布、工具→单页简洁、管理系统→侧边栏导航、展示→卡片列表）

要求：简洁精炼，总字数不超过 500 字。`;

const FALLBACK_DESIGNER_PROMPT = `你是一个顶级 UI/UX 设计师，专精于现代 Web 应用的视觉设计。
请根据需求分析，输出一份完整的 UI 设计规范（纯文本，不要写代码），包含以下内容：

1. 【整体风格】
   - 设计风格：现代简约 / 科技感 / 商务专业 / 活泼清新（选一种并说明）
   - 整体色调：深色模式 / 浅色模式（选一种）

2. 【配色方案】
   - 主色（Primary）：给出具体 hex 值，如 #6366f1
   - 辅助色（Secondary）：给出具体 hex 值
   - 背景色（Background）：给出具体 hex 值
   - 卡片/面板背景色：给出具体 hex 值
   - 文字主色：给出具体 hex 值
   - 文字次色：给出具体 hex 值
   - 边框色：给出具体 hex 值
   - 成功/警告/危险色：给出具体 hex 值

3. 【布局结构】
   - 根据应用类型描述布局（游戏→全屏画布尺寸/网格大小；工具→单页居中布局；管理系统→侧边栏宽度/顶部栏高度；展示→卡片间距）
   - 内容区：描述主要区域的间距规范（如 gap-4、p-6）
   - 响应式：是否需要移动端适配

4. 【组件风格】
   - 按钮：圆角大小、主按钮/次按钮/危险按钮的具体样式
   - 输入框：边框样式、聚焦态、圆角
   - 表格：行高、斑马纹、悬停效果
   - 卡片：圆角、阴影、边框
   - 徽章/标签：状态色对应关系
   - 弹窗/模态框：遮罩、圆角、动画

5. 【字体层级】
   - 页面标题：字号、字重
   - 模块标题：字号、字重
   - 正文：字号
   - 辅助文字：字号、颜色

6. 【交互细节】
   - 过渡动画：transition 时长建议
   - 悬停效果：颜色变化描述
   - 加载状态：骨架屏 / 旋转图标

要求：设计规范要具体、可执行，配色要协调美观，风格要统一。总字数不超过 800 字。`;

const FALLBACK_BUILDER_PROMPT = `你是一个顶级全栈前端工程师，专精于生成完整可运行的单文件 HTML 应用。

【核心要求 - 必须严格遵守】
1. 输出格式：必须且只能输出一个完整的 HTML 文件，用 \`\`\`html 和 \`\`\` 包裹
2. 文件结构：<!DOCTYPE html> 开头，包含完整的 <head> 和 <body>
3. 样式策略（根据应用类型选择）：
   - 游戏类：使用 <style> 内联 CSS，禁止引入 Tailwind（游戏元素位置/尺寸由 JS/Canvas 动态控制，Tailwind 无法胜任）
   - 工具/管理系统/展示类：使用 Tailwind CSS CDN（<script src="https://cdn.tailwindcss.com"></script>）
4. 脚本：所有 JavaScript 写在 <script> 标签内，使用原生 JS（不依赖 Node.js/npm）
5. 功能完整性：需求中列出的每一个功能点都必须实现，一个都不能遗漏
6. 布局与渲染策略（根据需求类型严格选择）：
   - 【游戏类】必须使用 Canvas 2D API 渲染游戏画面：
     * 用 <canvas> 元素作为游戏主画布，通过 getContext('2d') 绘制所有游戏元素
     * 游戏循环必须使用 requestAnimationFrame（禁止用 setInterval 驱动渲染）
     * 键盘/触摸事件监听挂载到 document 或 canvas 上
     * 音效使用 Web Audio API（AudioContext）生成，无需外部音频文件
     * UI 控件（分数、按钮、难度选择）用 HTML+CSS 覆盖在 canvas 上方（position: absolute）
   - 【工具类】简洁单页布局，突出核心功能，Tailwind 布局
   - 【管理系统类】侧边栏导航 + 内容区，多模块切换，Tailwind 布局
   - 【展示类】卡片/列表布局，美观呈现，Tailwind 布局
7. 数据：如需模拟数据，使用 JavaScript 数组/对象（至少 8-15 条示例数据）
8. 图表（仅管理系统/数据展示类需要）：使用 ECharts CDN（https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js）
   - 图表容器必须设置明确的高度（如 height: 300px）
   - 初始化后必须调用 window.addEventListener('resize', () => chart.resize()) 实现自适应
9. 完整性：代码必须完整，不能有省略号、TODO、占位符或未完成的部分
10. 可运行：生成的 HTML 文件可以直接在浏览器中打开并正常使用

【禁止事项】
- 禁止使用 require()、import from（ES Module 除外）、Node.js API
- 禁止输出多个代码块
- 禁止在代码中留下 "// TODO"、"// 待实现"、"..." 等未完成标记
- 禁止使用需要后端 API 的功能（所有数据用前端模拟）
- 禁止只实现部分功能，必须实现需求中的全部功能
- 【重要】禁止使用 <form> 标签！所有表单布局必须用 <div> 替代，输入框直接使用 <input>/<select>/<textarea>，提交操作通过按钮的 onclick 事件处理，绝对不能出现 <form>、</form>、form.onsubmit、document.querySelector('form') 等任何与 form 相关的代码
- 【重要】严格根据用户需求决定布局，不要把游戏、工具等非管理系统需求做成后台管理系统的侧边栏+CRUD 形式
- 【重要】游戏类禁止用 div 网格模拟游戏画面，必须用 Canvas 2D 绘制；禁止用 setInterval 驱动游戏主循环，必须用 requestAnimationFrame`;

const FALLBACK_REVIEWER_PROMPT = `你是一个代码质检专家，专门检查和修复 HTML 应用代码。

【检查项目 - 必须逐项执行】
1. 语法检查：修复所有 JS/HTML/CSS 语法错误，包括：
   - 不完整的语句（如 'const a' 后面没有赋值、函数体未闭合、括号不匹配）
   - 截断的代码（代码在中间突然结束，必须补全）
   - 多余的或缺失的花括号/圆括号/方括号
   - 【极其重要】逐行检查所有括号（圆括号、花括号、方括号）是否严格配对闭合，尤其是多层嵌套的 React.createElement 调用和箭头函数。括号不匹配会导致编译失败。
   - 将所有 <form> 标签替换为 <div>，将 </form> 替换为 </div>，删除所有 form.onsubmit、document.querySelector('form')、document.getElementById('xxx-form').onsubmit 等 form 相关 JS 代码
2. 函数定义顺序检查（重点！）：
   - 找出所有在 bindEvents、init、DOMContentLoaded 等初始化函数中调用的函数名
   - 确认这些函数在调用前已经定义（使用 function 声明而非 const 箭头函数，因为 function 声明会提升）
   - 如果发现 'const xxx = () =>' 定义的函数被在定义之前调用，必须将其改为 'function xxx()' 声明形式
   - 特别检查：addXxx、deleteXxx、editXxx、updateXxx、renderXxx、showXxx、hideXxx 等常见函数名
3. 未定义引用检查：搜索所有函数调用，确认每个被调用的函数都有对应的定义
4. 游戏类专项检查（如果代码包含 <canvas> 或游戏逻辑）：
   - 确认使用了 requestAnimationFrame 驱动游戏主循环，如果用了 setInterval 驱动渲染帧，必须改为 requestAnimationFrame
   - 确认 canvas 有明确的宽高设置（width/height 属性或 CSS）
   - 确认键盘事件监听正确绑定（document.addEventListener('keydown', ...)）
   - 确认游戏结束后能正确停止循环（cancelAnimationFrame）
5. 功能完整性：对照原始需求，确认每一个功能点都有对应的实现，缺失的必须补全
6. 交互完整性：确保所有按钮、控件、交互都有对应的实现，不能有空函数或未绑定事件
7. 数据完整性：如需模拟数据，确保有足够的示例数据（至少 8 条）
8. 代码完整性：删除所有 TODO、占位符、省略号，补全所有未完成的代码
9. 图表自适应：检查所有 ECharts 图表是否绑定了 resize 事件，未绑定的必须补充：
   window.addEventListener('resize', () => chartInstance.resize())
10. CDN 可用性：确保使用的 CDN 链接正确

【输出要求】
- 必须输出完整的修复后 HTML 文件，用 \`\`\`html 和 \`\`\` 包裹
- 如果代码已经完整正确，直接原样输出（仍需用代码块包裹）
- 不要输出任何解释文字，只输出代码块`;

// =============================================================================
// § 7b  Pipeline 工具函数
// =============================================================================

/** 从数据库读取 Prompt，不存在则使用内置 fallback */
const getPrompt = async (key: string, fallback = ''): Promise<string> => {
  const doc = await SystemPrompt.findOne<ISystemPrompt>({ key, isActive: true }).lean();
  return doc?.content ?? fallback;
};

/** 加载所有 Pipeline Agent 的 Prompt（优先数据库，回退内置常量） */
const getPipelineAgents = async () => ({
  analyst:  await getPrompt('pipeline_analyst',  FALLBACK_ANALYST_PROMPT),
  designer: await getPrompt('pipeline_designer', FALLBACK_DESIGNER_PROMPT),
  builder:  await getPrompt('pipeline_builder',  FALLBACK_BUILDER_PROMPT),
  reviewer: await getPrompt('pipeline_reviewer', FALLBACK_REVIEWER_PROMPT),
});

/** 执行单个 Pipeline 步骤（非流式，返回完整内容） */
const runPipelineStep = async (
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: { provider: string; modelType: string }
): Promise<string> => {
  let result = '';
  const stream = streamWithContinuation(messages, options);
  for await (const chunk of stream) {
    if (chunk.delta) result += chunk.delta;
    if (chunk.done) break;
  }
  return result;
};

/** 从 LLM 输出中提取 HTML 代码块内容 */
const extractHtmlFromResult = (raw: string): string => {
  const fullMatch = raw.match(/```html\s*\n([\s\S]*?)\n?```/i);
  if (fullMatch) return fullMatch[1].trim();
  const openMatch = raw.match(/```html\s*\n([\s\S]+)$/i);
  if (openMatch) return openMatch[1].trim();
  const doctypeMatch = raw.match(/(<!DOCTYPE[\s\S]+)/i);
  if (doctypeMatch) return doctypeMatch[1].trim();
  return raw.trim();
};

/**
 * 修复 LLM 生成的 HTML 中常见的 JS 错误：
 *  1. 截断语句清理：移除末尾不完整的语句
 *  2. 将 <script> 块中所有 const/let 箭头函数提升为 function 声明，解决调用顺序问题
 */
const repairJsErrors = (html: string): string => {
  // ── HTML 层：将所有 <form> 标签替换为 <div> ──────────────────────────────
  let result = html.replace(/<form(\s[^>]*)?>/gi, (_m, attrs = '') => `<div${attrs}>`);
  result = result.replace(/<\/form>/gi, '</div>');

  // ── Script 层：修复 JS 代码中的常见错误 ─────────────────────────────────
  result = result.replace(/(<script(?:\s[^>]*)?>)([\s\S]*?)(<\/script>)/gi, (_match, open, body, close) => {
    let fixed = body;

    // ── 1. 清理末尾截断的不完整语句 ─────────────────────────────────────────
    fixed = fixed.replace(/\n[ \t]*(const|let|var|function)\s+\w*\s*[=({]?\s*$/gm, '');
    fixed = fixed.replace(/\n[ \t]*[a-zA-Z_$][a-zA-Z0-9_$]*\s*$/m, '');

    // ── 2. 将 const/let 箭头函数/普通函数表达式提升为 function 声明 ──────────
    fixed = fixed.replace(
      /^([ \t]*)(const|let)[ \t]+(\w+)[ \t]*=[ \t]*(?:function[ \t]*)?\(([^)]*)\)[ \t]*(?:=>[ \t]*)?\{/gm,
      (_m: string, indent: string, _kw: string, name: string, params: string) =>
        `${indent}function ${name}(${params}) {`
    );

    // ── 3. 清理 form 相关 JS 代码 ────────────────────────────────────────────
    fixed = fixed.replace(/[\w$.]+\.onsubmit\s*=\s*[^;]+;?/g, '// [vibe: form.onsubmit removed]');
    fixed = fixed.replace(/document\.querySelector\s*\(\s*['"]form[^'"]*['"]\s*\)/g, 'null');
    fixed = fixed.replace(/document\.getElementById\s*\(\s*['"][^'"]*-?form[^'"]*['"]\s*\)/g, 'null');
    fixed = fixed.replace(/document\.getElementsByTagName\s*\(\s*['"]form['"]\s*\)/g, '[]');

    return `${open}${fixed}${close}`;
  });

  return result;
};

/**
 * 全面净化 LLM 生成的 HTML，使其在严格沙箱 iframe 中安全运行
 *
 * 处理的沙箱受限 API：
 *  ① allow-forms    — form submit 拦截
 *  ② allow-modals   — alert/confirm/prompt 替换为内置 DOM Toast
 *  ③ allow-popups   — window.open 拦截
 *  ④ allow-top-nav  — 外链 <a> 改为 preventDefault + Toast 提示
 */
const sanitizeHtmlForSandbox = (html: string): string => {
  // ── 1. 净化 <form> 标签：移除 action / method / enctype ─────────────────
  let result = html.replace(/<form(\s[^>]*)?>/gi, (_match, attrs = '') => {
    let sanitized = (attrs as string)
      .replace(/\s+action\s*=\s*"[^"]*"/gi, '')
      .replace(/\s+action\s*=\s*'[^']*'/gi, '')
      .replace(/\s+action\s*=\s*[^\s>]*/gi, '')
      .replace(/\s+method\s*=\s*"[^"]*"/gi, '')
      .replace(/\s+method\s*=\s*'[^']*'/gi, '')
      .replace(/\s+method\s*=\s*[^\s>]*/gi, '')
      .replace(/\s+enctype\s*=\s*"[^"]*"/gi, '')
      .replace(/\s+enctype\s*=\s*'[^']*'/gi, '');

    const onsubmitMatch = sanitized.match(/onsubmit\s*=\s*"([^"]*)"/i);
    if (onsubmitMatch) {
      const existing = onsubmitMatch[1].trimEnd();
      const patched = existing.endsWith(';') ? `${existing} return false;` : `${existing}; return false;`;
      sanitized = sanitized.replace(/onsubmit\s*=\s*"[^"]*"/i, `onsubmit="${patched}"`);
    } else {
      sanitized += ' onsubmit="return false;"';
    }
    return `<form${sanitized}>`;
  });

  // ── 2. <button type="submit"> → type="button" + click 收集数据 ──────────
  result = result.replace(/<button([^>]*)\btype\s*=\s*["']submit["']([^>]*)>/gi, (_m, before, after) => {
    const combined = `${before}${after}`;
    if (/\bonclick\s*=/i.test(combined)) return `<button${before}type="button"${after}>`;
    const handler = `(function(btn){var f=btn.closest('form');if(!f)return;var d={};f.querySelectorAll('[name]').forEach(function(el){d[el.name]=el.value;});window.__vibeToast('📋 表单数据\\n'+JSON.stringify(d,null,2));})(this)`;
    return `<button${before}type="button"${after} onclick="${handler}">`;
  });

  // ── 3. <input type="submit"> → type="button" + click 收集数据 ───────────
  result = result.replace(/<input([^>]*)\btype\s*=\s*["']submit["']([^>]*)\/?>/gi, (_m: string, before: string, after: string) => {
    const combined = `${before}${after}`;
    if (/\bonclick\s*=/i.test(combined)) return `<input${before}type="button"${after}>`;
    const handler = `(function(btn){var f=btn.closest('form');if(!f)return;var d={};f.querySelectorAll('[name]').forEach(function(el){d[el.name]=el.value;});window.__vibeToast('📋 表单数据\\n'+JSON.stringify(d,null,2));})(this)`;
    return `<input${before}type="button"${after} onclick="${handler}">`;
  });

  // ── 4. <input type="reset"> → type="button" + 手动 reset ────────────────
  result = result.replace(/<input([^>]*)\btype\s*=\s*["']reset["']([^>]*)\/?>/gi, (_m: string, before: string, after: string) => {
    const combined = `${before}${after}`;
    if (/\bonclick\s*=/i.test(combined)) return `<input${before}type="button"${after}>`;
    return `<input${before}type="button"${after} onclick="(function(btn){var f=btn.closest('form');if(f)f.reset();})(this)">`;
  });

  // ── 5. <a target="_blank"> → 移除 target ────────────────────────────────
  result = result.replace(/<a([^>]*)\btarget\s*=\s*["']_blank["']([^>]*)>/gi, (_m, before, after) => {
    return `<a${before}${after}>`;
  });

  // ── 6. 注入运行时沙箱兜底脚本 ────────────────────────────────────────────
  const sandboxGuardScript = `<script>
/* ===== [vibe-sandbox-guard] ===== */
(function () {
  /* --- 全局 JS 运行时错误捕获 --- */
  window.onerror = function (msg, src, line, col, err) {
    var detail = err ? (err.message || String(err)) : String(msg);
    window.__vibeToast('⚠️ JS错误：' + detail + (line ? ' (行' + line + ')' : ''), 5000);
    return true;
  };
  window.addEventListener('unhandledrejection', function (e) {
    var reason = e.reason ? (e.reason.message || String(e.reason)) : 'Promise rejected';
    window.__vibeToast('⚠️ 异步错误：' + reason, 5000);
  });

  /* --- DOM Toast 实现（替代 alert/confirm/prompt） --- */
  var _toastContainer = null;
  function getToastContainer() {
    if (_toastContainer) return _toastContainer;
    _toastContainer = document.createElement('div');
    _toastContainer.id = '__vibe_toast_container';
    Object.assign(_toastContainer.style, {
      position: 'fixed', top: '16px', right: '16px', zIndex: '2147483647',
      display: 'flex', flexDirection: 'column', gap: '8px',
      maxWidth: '360px', fontFamily: 'system-ui,sans-serif', pointerEvents: 'none'
    });
    document.body.appendChild(_toastContainer);
    return _toastContainer;
  }

  window.__vibeToast = function (msg, duration) {
    var container = getToastContainer();
    var toast = document.createElement('div');
    Object.assign(toast.style, {
      background: 'rgba(30,30,40,0.95)', color: '#e2e8f0',
      padding: '10px 14px', borderRadius: '8px',
      fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre-wrap',
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      border: '1px solid rgba(139,92,246,0.4)',
      pointerEvents: 'auto', wordBreak: 'break-all',
      maxHeight: '200px', overflowY: 'auto',
      opacity: '0', transition: 'opacity 0.2s'
    });
    toast.textContent = msg;
    container.appendChild(toast);
    requestAnimationFrame(function () { toast.style.opacity = '1'; });
    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 250);
    }, duration || 3500);
  };

  /* --- 替换 alert / confirm / prompt --- */
  window.alert   = function (msg) { window.__vibeToast('ℹ️ ' + msg); };
  window.confirm = function (msg) { window.__vibeToast('❓ ' + msg); return true; };
  window.prompt  = function (msg) { window.__vibeToast('✏️ ' + msg); return ''; };

  /* --- 拦截 window.open --- */
  window.open = function (url) {
    window.__vibeToast('🔗 链接：' + (url || ''));
    return null;
  };

  /* --- 拦截所有 form submit 事件（兜底） --- */
  document.addEventListener('submit', function (e) { e.preventDefault(); }, true);

  /* --- 拦截外链 <a> 跳转（等 DOM ready 后处理） --- */
  var _reAbsUrl = new RegExp('^https?://', 'i');
  var _reProtoRel = new RegExp('^//', 'i');
  var patchLinks = function () {
    try {
      var anchors = document.querySelectorAll('a[href]');
      if (!anchors || !anchors.length) return;
      anchors.forEach(function (el) {
        try {
          if (!el || el.nodeType !== 1) return;
          var a = /** @type {HTMLAnchorElement} */ (el);
          var href = a.getAttribute('href');
          if (!href || typeof href !== 'string') return;
          href = href.trim();
          if (!href) return;
          if (_reAbsUrl.test(href) || _reProtoRel.test(href)) {
            a.removeAttribute('href');
            if (a.style) a.style.cursor = 'pointer';
            a.addEventListener('click', function (e) {
              if (e) e.preventDefault();
              if (window.__vibeToast) window.__vibeToast('🔗 外链：' + href);
            });
          }
        } catch (innerErr) { /* 单个元素处理失败不影响其他元素 */ }
      });
    } catch (err) { /* patchLinks 整体异常兜底 */ }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchLinks);
  } else {
    patchLinks();
  }

  /* --- ECharts 全局 resize 守卫 --- */
  (function patchECharts() {
    var _registeredCharts = [];
    var _resizeTimer = null;

    function resizeAll() {
      _registeredCharts = _registeredCharts.filter(function (c) {
        try { return !c.isDisposed(); } catch (e) { return false; }
      });
      _registeredCharts.forEach(function (c) {
        try { c.resize(); } catch (e) {}
      });
    }

    window.addEventListener('resize', function () {
      clearTimeout(_resizeTimer);
      _resizeTimer = setTimeout(resizeAll, 100);
    });

    function tryPatchEchartsInit() {
      if (typeof window.echarts === 'undefined') {
        setTimeout(tryPatchEchartsInit, 200);
        return;
      }
      var _originalInit = window.echarts.init.bind(window.echarts);
      window.echarts.init = function (dom, theme, opts) {
        var chart = _originalInit(dom, theme, opts);
        _registeredCharts.push(chart);
        if (dom && typeof ResizeObserver !== 'undefined') {
          var ro = new ResizeObserver(function () {
            clearTimeout(_resizeTimer);
            _resizeTimer = setTimeout(function () {
              try { if (!chart.isDisposed()) chart.resize(); } catch (e) {}
            }, 60);
          });
          ro.observe(dom);
        }
        return chart;
      };
    }
    tryPatchEchartsInit();
  })();
})();
</script>`;

  if (/<\/body>/i.test(result)) {
    result = result.replace(/<\/body>/i, `${sandboxGuardScript}\n</body>`);
  } else {
    result += `\n${sandboxGuardScript}`;
  }

  return result;
};

// =============================================================================
// § 7c  Pipeline 路由  POST /api/vibe/pipeline
// =============================================================================

vibePipelineRouter.post('/vibe/pipeline', async (ctx) => {
  const { prompt, provider = env.activeProvider, modelType = 'text' } = ctx.request.body as Record<string, string>;

  if (!prompt?.trim()) {
    ctx.status = 400;
    ctx.body = { success: false, message: '请提供需求描述' };
    return;
  }

  ctx.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  ctx.status = 200;

  const res = ctx.res;
  const opts = { provider, modelType };

  const send = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send({ type: 'start', steps: [
    { step: 1, total: 4, title: '📋 需求分析', status: 'pending' },
    { step: 2, total: 4, title: '🎨 UI 设计', status: 'pending' },
    { step: 3, total: 4, title: '⚡ 代码生成', status: 'pending' },
    { step: 4, total: 4, title: '🔧 质检优化', status: 'pending' },
  ] });

  try {
    const PIPELINE_AGENTS = await getPipelineAgents();

    // ── Step 1: 需求分析 ──────────────────────────────────────────────────────
    send({ type: 'step', step: 1, total: 4, title: '📋 需求分析中...', status: 'running' });

    const analysisResult = await runPipelineStep([
      { role: 'system', content: PIPELINE_AGENTS.analyst },
      { role: 'user', content: `请分析以下应用需求：\n\n${prompt}` }
    ], opts);

    send({ type: 'step', step: 1, total: 4, title: '📋 需求分析完成', status: 'done', content: analysisResult });

    // ── Step 2: UI 设计规范 ───────────────────────────────────────────────────
    send({ type: 'step', step: 2, total: 4, title: '🎨 UI 设计中...', status: 'running' });

    const designResult = await runPipelineStep([
      { role: 'system', content: PIPELINE_AGENTS.designer },
      {
        role: 'user',
        content: `请根据以下应用需求和需求分析，输出完整的 UI 设计规范。\n\n【原始需求】\n${prompt}\n\n【需求分析】\n${analysisResult}`
      }
    ], opts);

    send({ type: 'step', step: 2, total: 4, title: '🎨 UI 设计完成', status: 'done', content: designResult });

    // ── Step 3: 完整代码生成 ──────────────────────────────────────────────────
    send({ type: 'step', step: 3, total: 4, title: '⚡ 代码生成中...', status: 'running' });

    const buildResult = await runPipelineStep([
      { role: 'system', content: PIPELINE_AGENTS.builder },
      {
        role: 'user',
        content: `请根据以下需求和设计规范生成完整的单文件 HTML 应用。

【原始需求】
${prompt}

【需求分析】
${analysisResult}

【UI 设计规范 - 必须严格遵守】
${designResult}

【强制要求】
- 上述需求分析中列出的每一个功能模块都必须实现，一个都不能遗漏
- 必须严格按照 UI 设计规范中的配色方案、组件风格、布局结构实现，不能使用默认的灰白色调
- 根据需求类型选择合适的布局（游戏用全屏画布、工具用单页、管理系统用侧边栏），不要把游戏/工具类需求做成后台管理系统
- 【游戏类专项】如果需求是游戏，必须：① 用 <canvas> + Canvas 2D API 渲染游戏画面；② 用 requestAnimationFrame 驱动游戏主循环；③ 用 <style> 内联 CSS，不引入 Tailwind；④ 音效用 Web Audio API（AudioContext）生成
- 每个功能点都要有真实可交互的实现
- 如有图表，所有 ECharts 图表必须绑定 window resize 事件实现自适应，图表配色要与整体设计规范一致
- 代码必须完整，不能截断，不能有 TODO 或省略号

请直接输出完整的 HTML 代码，用 \`\`\`html 包裹。`
      }
    ], opts);

    send({ type: 'step', step: 3, total: 4, title: '⚡ 代码生成完成', status: 'done' });

    // ── Step 4: 代码质检与修复 ────────────────────────────────────────────────
    send({ type: 'step', step: 4, total: 4, title: '🔧 质检优化中...', status: 'running' });

    const builtHtml = sanitizeHtmlForSandbox(repairJsErrors(extractHtmlFromResult(buildResult)));

    const reviewResult = await runPipelineStep([
      { role: 'system', content: PIPELINE_AGENTS.reviewer },
      {
        role: 'user',
        content: `请检查并修复以下 HTML 应用代码：\n\n\`\`\`html\n${builtHtml}\n\`\`\``
      }
    ], opts);

    send({ type: 'step', step: 4, total: 4, title: '🔧 质检完成', status: 'done' });

    // ── 提取最终 HTML 并推送 ──────────────────────────────────────────────────
    const finalHtml = sanitizeHtmlForSandbox(repairJsErrors(extractHtmlFromResult(reviewResult)));
    const finalContent = `\`\`\`html\n${finalHtml}\n\`\`\``;

    send({ type: 'done', content: finalContent, analysis: analysisResult, design: designResult });

  } catch (err: any) {
    send({ type: 'error', message: err?.message || '生成失败，请重试' });
  } finally {
    res.end();
  }
});
