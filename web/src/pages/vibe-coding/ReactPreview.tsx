import { useEffect, useRef, useState, useCallback } from 'react';
import * as Babel from '@babel/standalone';

interface ReactPreviewProps {
  jsx: string;
  lang?: 'zh' | 'en';
  className?: string;
}

// ─── 错误边界容器 HTML ────────────────────────────────────────────────────────

const ERROR_CONTAINER_STYLE = `
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #1a0a0a;
  border-top: 1px solid #7f1d1d;
  color: #fca5a5;
  font-size: 11px;
  font-family: monospace;
  padding: 6px 12px;
  z-index: 99999;
  max-height: 80px;
  overflow-y: auto;
`;

// ─── 将 JSX 编译为可执行 JS ──────────────────────────────────────────────────

const compileJsx = (jsxCode: string): { code: string; error: null } | { code: null; error: string } => {
  try {
    // 预处理：移除 import 语句（浏览器端无法解析模块导入）
    let cleaned = jsxCode
      .replace(/^import\s+.*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
      .replace(/^import\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
      .trim();

    // 处理 export default：支持多种形式
    // 1. export default function Foo() {} → const __VibeApp__ = function Foo() {}
    // 2. export default class Foo {} → const __VibeApp__ = class Foo {}
    // 3. export default Foo; → const __VibeApp__ = Foo;
    // 4. export default () => {} → const __VibeApp__ = () => {}
    cleaned = cleaned
      .replace(/^export\s+default\s+/m, 'const __VibeApp__ = ')
      .replace(/^export\s+\{[^}]*\}\s*;?\s*$/gm, '');

    // 如果没有 __VibeApp__，尝试从代码中推断组件名并追加赋值
    if (!cleaned.includes('__VibeApp__')) {
      // 匹配 const/function 声明的组件名（首字母大写）
      const componentMatch = cleaned.match(/(?:const|function|class)\s+([A-Z][A-Za-z0-9_]*)\s*(?:=|\(|\{|extends)/m);
      if (componentMatch) {
        cleaned += `\nconst __VibeApp__ = ${componentMatch[1]};`;
      }
    }

    const result = Babel.transform(cleaned, {
      presets: ['react'],
      filename: 'vibe-preview.jsx',
    });

    return { code: result.code ?? '', error: null };
  } catch (err) {
    return { code: null, error: err instanceof Error ? err.message : String(err) };
  }
};

// ─── 构建 iframe HTML（内嵌 React + 编译后代码）────────────────────────────

const buildReactIframeHtml = (compiledCode: string): string => `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>React Preview</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" crossorigin="anonymous" />
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>
  <script>
    // 全局错误捕获
    window.onerror = function(msg, src, line, col) {
      var bar = document.getElementById('__vibe_err_bar__');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = '__vibe_err_bar__';
        bar.style.cssText = '${ERROR_CONTAINER_STYLE.replace(/\n\s*/g, ' ')}';
        document.body && document.body.appendChild(bar);
      }
      bar.innerHTML = '⚠ ' + msg + (line ? ' (line ' + line + ')' : '');
      return false;
    };
    window.addEventListener('unhandledrejection', function(e) {
      window.onerror && window.onerror(String(e.reason), '', 0, 0);
    });
  <\/script>
</head>
<body>
  <div id="root"></div>
  <script>
    (function() {
      const React = window.React;
      const ReactDOM = window.ReactDOM;
      const useState = React.useState;
      const useEffect = React.useEffect;
      const useCallback = React.useCallback;
      const useRef = React.useRef;
      const useMemo = React.useMemo;
      const useReducer = React.useReducer;
      const useContext = React.useContext;
      const createContext = React.createContext;
      const Fragment = React.Fragment;

      try {
        ${compiledCode}

        // 尝试找到默认导出的组件
        var __VibeRoot__ = (typeof __VibeApp__ !== 'undefined') ? __VibeApp__ : null;

        // 降级：扫描所有局部变量，找首字母大写的函数/类组件
        if (!__VibeRoot__) {
          var __candidates__ = [typeof App !== 'undefined' && App, typeof Main !== 'undefined' && Main, typeof Page !== 'undefined' && Page, typeof Dashboard !== 'undefined' && Dashboard, typeof AdminDashboard !== 'undefined' && AdminDashboard, typeof Counter !== 'undefined' && Counter, typeof Home !== 'undefined' && Home].filter(Boolean);
          __VibeRoot__ = __candidates__[0] || null;
        }

        if (!__VibeRoot__) {
          throw new Error('未找到可渲染的 React 组件，请确保有 export default 的组件');
        }

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(__VibeRoot__));
      } catch(e) {
        window.onerror(e.message || String(e), '', 0, 0);
        document.getElementById('root').innerHTML =
          '<div style="padding:24px;color:#f87171;font-family:monospace;font-size:13px;">' +
          '<strong>渲染错误</strong><br/>' + (e.message || String(e)) + '</div>';
      }
    })();
  <\/script>
</body>
</html>`;

// ─── ReactPreview 组件 ───────────────────────────────────────────────────────

const ReactPreview = ({ jsx, lang = 'zh', className = '' }: ReactPreviewProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const renderJsx = useCallback((jsxCode: string) => {
    if (!jsxCode.trim()) return;

    setIsLoading(true);
    setCompileError(null);

    const result = compileJsx(jsxCode);

    if (result.error) {
      setCompileError(result.error);
      setIsLoading(false);
      return;
    }

    const html = buildReactIframeHtml(result.code!);
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });

    if (iframeRef.current) {
      const prevSrc = iframeRef.current.src;
      if (prevSrc?.startsWith('blob:')) URL.revokeObjectURL(prevSrc);
      iframeRef.current.src = URL.createObjectURL(blob);
    }
  }, []);

  useEffect(() => {
    renderJsx(jsx);
  }, [jsx, renderJsx]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0 bg-white"
        title="React Preview"
        sandbox="allow-scripts allow-same-origin"
        onLoad={() => setIsLoading(false)}
        onError={() => setIsLoading(false)}
      />

      {/* 加载遮罩 */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-950/80 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            {lang === 'zh' ? '编译渲染中...' : 'Compiling...'}
          </div>
        </div>
      )}

      {/* 编译错误提示 */}
      {compileError && (
        <div className="absolute bottom-0 left-0 right-0 bg-red-950/95 border-t border-red-800/60 px-3 py-2">
          <p className="text-red-400 text-xs font-mono">
            <span className="font-bold">编译错误：</span>{compileError}
          </p>
        </div>
      )}
    </div>
  );
};

export default ReactPreview;
