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

// 将 CodeParts 组合成完整可运行 HTML
export const buildHtmlFromParts = (parts: CodeParts): string => {
  if (parts.isFullHtml && parts.html) {
    return sanitizeHtml(injectCdnToFullHtml(parts.html));
  }
  return sanitizeHtml(`<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vibe UI Preview</title>
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
