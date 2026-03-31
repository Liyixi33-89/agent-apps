import type { CodeParts } from './types';

// 移除 HTML 中的 integrity 属性，避免 SRI 校验失败
export const sanitizeHtml = (html: string): string =>
  html.replace(/\s+integrity="[^"]*"/gi, '').replace(/\s+integrity='[^']*'/gi, '');

// 需要自动注入的 CDN 脚本/样式（如果 HTML 中已有则跳过）
const CDN_INJECTIONS = [
  { tag: 'script', attr: 'src', url: 'https://cdn.tailwindcss.com', check: 'tailwindcss.com' },
  { tag: 'link', attr: 'href', url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css', check: 'font-awesome' },
  { tag: 'script', attr: 'src', url: 'https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js', check: 'echarts' },
];

// 向完整 HTML 的 <head> 中注入缺失的 CDN
const injectCdnToFullHtml = (html: string): string => {
  let result = html;
  const headInjections: string[] = [];
  for (const cdn of CDN_INJECTIONS) {
    if (!result.includes(cdn.check)) {
      if (cdn.tag === 'script') {
        headInjections.push(`  <script src="${cdn.url}"><\/script>`);
      } else {
        headInjections.push(`  <link rel="stylesheet" href="${cdn.url}" crossorigin="anonymous" />`);
      }
    }
  }
  if (headInjections.length > 0) {
    if (result.includes('</head>')) {
      result = result.replace('</head>', `${headInjections.join('\n')}\n</head>`);
    } else {
      result = headInjections.join('\n') + '\n' + result;
    }
  }
  return result;
};

// 修复被截断的 HTML：自动补全缺失的闭合标签
const repairTruncatedHtml = (html: string): string => {
  let result = html.trim();
  if (!result.includes('</body>')) result += '\n</body>';
  if (!result.includes('</html>')) result += '\n</html>';
  return result;
};

// 从 AI 输出中提取完整 HTML 或分段代码
export const extractCodeParts = (markdown: string): CodeParts => {
  const fullHtmlMatch = markdown.match(/```html\n([\s\S]*?)```/i);
  const doctypeMatch = markdown.match(/(<!DOCTYPE[\s\S]*?<\/html>)/i);
  const truncatedHtmlMatch = !fullHtmlMatch
    ? markdown.match(/```html\n([\s\S]+)$/i)
    : null;

  const rawHtml =
    fullHtmlMatch?.[1] ??
    doctypeMatch?.[1] ??
    truncatedHtmlMatch?.[1] ??
    null;

  if (rawHtml) {
    const fullHtml = repairTruncatedHtml(rawHtml);
    return { html: fullHtml, css: '', js: '', isFullHtml: true };
  }

  const cssMatch = markdown.match(/```css\n([\s\S]*?)```/i);
  const jsMatch = markdown.match(/```(?:js|javascript)\n([\s\S]*?)```/i);
  const bodyMatch = markdown.match(/```(?:html|jsx?)\n([\s\S]*?)```/i);

  return {
    html: bodyMatch?.[1]?.trim() ?? '',
    css: cssMatch?.[1]?.trim() ?? '',
    js: jsMatch?.[1]?.trim() ?? '',
    isFullHtml: false,
  };
};

// 全局错误捕获脚本 —— 注入到每个预览 HTML 中，防止 AI 生成代码的运行时错误导致白屏
const ERROR_GUARD_SCRIPT = `
<script>
(function() {
  var _errors = [];
  window.onerror = function(msg, src, line, col, err) {
    _errors.push({ msg: msg, line: line, col: col });
    var bar = document.getElementById('__vibe_err_bar__');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = '__vibe_err_bar__';
      bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#1a0a0a;border-top:1px solid #7f1d1d;color:#fca5a5;font-size:11px;font-family:monospace;padding:6px 12px;z-index:99999;max-height:80px;overflow-y:auto;';
      document.body && document.body.appendChild(bar);
    }
    bar.innerHTML = _errors.map(function(e){ return '⚠ ' + e.msg + (e.line ? ' (line ' + e.line + ')' : ''); }).join('<br/>');
    return false;
  };
  window.addEventListener('unhandledrejection', function(e) {
    window.onerror && window.onerror(String(e.reason), '', 0, 0, null);
  });
})();
<\/script>`;

// 将 CodeParts 组合成完整可运行 HTML
export const buildHtmlFromParts = (parts: CodeParts): string => {
  if (parts.isFullHtml && parts.html) {
    const html = sanitizeHtml(injectCdnToFullHtml(parts.html));
    // 在 </head> 前注入错误捕获脚本
    if (html.includes('</head>')) {
      return html.replace('</head>', `${ERROR_GUARD_SCRIPT}\n</head>`);
    }
    return ERROR_GUARD_SCRIPT + '\n' + html;
  }
  return sanitizeHtml(`<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vibe UI Preview</title>
  ${ERROR_GUARD_SCRIPT}
  <script src="https://cdn.tailwindcss.com"><\/script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" crossorigin="anonymous" />
  <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"><\/script>
  ${parts.css ? `<style>\n${parts.css}\n</style>` : ''}
</head>
<body>
${parts.html}
${parts.js ? `<script>\n${parts.js}\n<\/script>` : ''}
</body>
</html>`);
};

// 过滤掉 markdown 中的代码块，只保留文字说明
export const stripCodeBlocks = (markdown: string): string =>
  markdown.replace(/```[\s\S]*?```/g, '').trim();

// 从 AI 输出中提取 React JSX/TSX 代码（isReact 模式专用）
export const extractReactCodeParts = (markdown: string): CodeParts => {
  // 优先匹配完整 jsx/tsx 代码块
  const jsxMatch =
    markdown.match(/```(?:tsx|jsx)\n([\s\S]*?)```/i) ??
    markdown.match(/```(?:tsx|jsx)\n([\s\S]+)$/i);

  if (jsxMatch) {
    return { html: '', css: '', js: '', jsx: jsxMatch[1].trim(), isReact: true };
  }

  // 降级：尝试提取普通 html/js 代码块
  return { ...extractCodeParts(markdown), isReact: false };
};
