import { useEffect, useRef, useState, useCallback } from 'react';
import * as Babel from '@babel/standalone';

interface ReactPreviewProps {
  jsx: string;
  lang?: 'zh' | 'en';
  className?: string;
  /** 运行时 API 基础路径，如 /api/vibe-runtime/{appId}，传入后 fetch 会代理到真实后端 */
  runtimeApiBase?: string;
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

export const compileJsx = (jsxCode: string): { code: string; error: null } | { code: null; error: string } => {
  try {
    // ── 预处理 1：移除所有 import 语句（浏览器端无法解析模块导入）──────────
    // 支持前导空格、多行 import、各种 import 格式
    let cleaned = jsxCode
      // 多行 import：import { \n  A, \n  B \n } from 'xxx'
      .replace(/^\s*import\s+\{[\s\S]*?\}\s+from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
      // 单行 import：import X from 'xxx' / import { A, B } from 'xxx'
      .replace(/^\s*import\s+.*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
      // 副作用 import：import 'xxx' / import "xxx"
      .replace(/^\s*import\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
      // import type 语句（TypeScript）
      .replace(/^\s*import\s+type\s+.*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
      // 动态 import 赋值：const X = await import('xxx')
      .replace(/^\s*(?:const|let|var)\s+\w+\s*=\s*(?:await\s+)?import\s*\([^)]+\)\s*;?\s*$/gm, '')
      // require 语句
      .replace(/^\s*(?:const|let|var)\s+.*?=\s*require\s*\([^)]+\)\s*;?\s*$/gm, '')
      .trim();

    // ── 预处理 2：移除 TypeScript 独立类型声明（interface / type / enum）────
    // 支持多行 interface/type/enum，使用非贪婪匹配
    cleaned = cleaned
      // 多行 interface（支持嵌套大括号）
      .replace(/^\s*(?:export\s+)?interface\s+\w+[\s\S]*?^\s*\}\s*;?\s*$/gm, '')
      // 单行 type alias
      .replace(/^\s*(?:export\s+)?type\s+\w+\s*=\s*[^;]+;\s*$/gm, '')
      // 多行 type alias（带大括号）
      .replace(/^\s*(?:export\s+)?type\s+\w+\s*=\s*\{[\s\S]*?^\s*\}\s*;?\s*$/gm, '')
      // enum
      .replace(/^\s*(?:export\s+)?enum\s+\w+\s*\{[\s\S]*?^\s*\}\s*;?\s*$/gm, '');

    // ── 预处理 3：移除 AI 生成的渲染入口代码（由模板统一控制）────────────
    // 渲染入口由 buildReactIframeHtml 模板统一管理，AI 代码中的渲染调用必须移除
    cleaned = cleaned
      // ReactDOM.render(<App />, document.getElementById('root'))
      .replace(/^\s*ReactDOM\.render\s*\([\s\S]*?\)\s*;?\s*$/gm, '')
      // ReactDOM.createRoot(document.getElementById('root')).render(<App />)
      .replace(/^\s*(?:const|let|var)\s+\w+\s*=\s*ReactDOM\.createRoot\s*\([^)]*\)\s*;?\s*$/gm, '')
      .replace(/^\s*\w+\.render\s*\(\s*<[^>]+\s*\/>\s*\)\s*;?\s*$/gm, '')
      // 单行 createRoot(...).render(...)
      .replace(/^\s*ReactDOM\.createRoot\s*\([^)]*\)\.render\s*\([\s\S]*?\)\s*;?\s*$/gm, '')
      // root.render(<App />) — 常见的分步写法
      .replace(/^\s*root\.render\s*\([\s\S]*?\)\s*;?\s*$/gm, '')
      // document.getElementById('root') 独立赋值行（无害但冗余）
      // 不移除，因为可能被其他代码引用
      .trim();

    // 处理 export default：支持多种形式
    // 1. export default function Foo() {} → function Foo() {} \n const __VibeApp__ = Foo;
    // 2. export default class Foo {} → class Foo {} \n const __VibeApp__ = Foo;
    // 3. export default Foo; → const __VibeApp__ = Foo;
    // 4. export default () => {} → const __VibeApp__ = () => {}
    // 5. export default function() {} → const __VibeApp__ = function() {}

    // 先处理 export default function/class 带名称的情况
    // 保留原始声明（其他代码可能引用），再追加 __VibeApp__ 赋值
    cleaned = cleaned.replace(
      /^export\s+default\s+(function|class)\s+([A-Z][A-Za-z0-9_]*)\s*/m,
      (_, keyword, name) => `${keyword} ${name} `
    );
    // 如果上面替换成功，追加 __VibeApp__ 赋值
    const namedExportMatch = jsxCode.match(/^export\s+default\s+(?:function|class)\s+([A-Z][A-Za-z0-9_]*)/m);
    if (namedExportMatch && !cleaned.includes('__VibeApp__')) {
      cleaned += `\nconst __VibeApp__ = ${namedExportMatch[1]};`;
    }

    // 处理 export default 匿名函数/箭头函数/标识符
    cleaned = cleaned
      .replace(/^export\s+default\s+/m, 'const __VibeApp__ = ')
      // 移除命名导出（export { xxx }）
      .replace(/^export\s+\{[^}]*\}\s*;?\s*$/gm, '')
      // 移除 export 关键字但保留声明（export const/function/class → const/function/class）
      .replace(/^export\s+(const|let|var|function|class)\s+/gm, '$1 ');

    // 如果没有 __VibeApp__，尝试从代码中推断组件名并追加赋值
    if (!cleaned.includes('__VibeApp__')) {
      // 匹配 const/function 声明的组件名（首字母大写）
      const componentMatch = cleaned.match(/(?:const|function|class)\s+([A-Z][A-Za-z0-9_]*)\s*(?:=|\(|\{|extends)/m);
      if (componentMatch) {
        cleaned += `\nconst __VibeApp__ = ${componentMatch[1]};`;
      }
    }

    const result = Babel.transform(cleaned, {
      presets: ['react', 'typescript'],
      filename: 'vibe-preview.tsx',
    });

    return { code: result.code ?? '', error: null };
  } catch (err) {
    return { code: null, error: err instanceof Error ? err.message : String(err) };
  }
};

// ─── 构建 iframe HTML（内嵌 React + 编译后代码）────────────────────────────

export const buildReactIframeHtml = (compiledCode: string, options?: { runtimeApiBase?: string }): string => {
  const runtimeApiBase = options?.runtimeApiBase || '';
  return `<!DOCTYPE html>
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

      // ── API 代理/Mock 层 ──────────────────────────────────────────────
      // runtimeApiBase 不为空时：将 /api/xxx 代理到 /api/vibe-runtime/{appId}/xxx（真实后端）
      // runtimeApiBase 为空时：返回 mock 数据（后端未部署）
      const _originalFetch = window.fetch.bind(window);
      const _runtimeApiBase = '${runtimeApiBase}';
      window.fetch = function(url, opts) {
        if (typeof url === 'string' && url.startsWith('/api/')) {
          if (_runtimeApiBase) {
            // 已部署模式：将 /api/users → /api/vibe-runtime/{appId}/users
            var entityPath = url.replace(/^\\/api\\//, '');
            var realUrl = _runtimeApiBase + '/' + entityPath;
            console.info('[Vibe Runtime] 代理 API:', url, '→', realUrl);
            return _originalFetch(realUrl, opts);
          } else {
            // 未部署模式：返回 mock 数据
            console.info('[Vibe Mock] 拦截 API 请求:', url, '→ 返回模拟数据');
            var mockResponse = {
              success: true,
              data: [],
              pagination: { page: 1, limit: 20, total: 0 },
              message: 'Mock response - 后端 API 未部署'
            };
            return Promise.resolve(new Response(JSON.stringify(mockResponse), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }));
          }
        }
        return _originalFetch(url, opts);
      };

      // ── axios mock（如果 AI 生成的代码使用了 axios）──────────────────────
      window.axios = {
        create: function() { return window.axios; },
        get: function(url) { return window.fetch(url).then(function(r){ return r.json().then(function(d){ return {data:d}; }); }); },
        post: function(url, body) { return window.fetch(url, {method:'POST',body:JSON.stringify(body)}).then(function(r){ return r.json().then(function(d){ return {data:d}; }); }); },
        put: function(url, body) { return window.fetch(url, {method:'PUT',body:JSON.stringify(body)}).then(function(r){ return r.json().then(function(d){ return {data:d}; }); }); },
        delete: function(url) { return window.fetch(url, {method:'DELETE'}).then(function(r){ return r.json().then(function(d){ return {data:d}; }); }); },
        defaults: { baseURL: '', headers: { common: {} } },
        interceptors: { request: { use: function(){} }, response: { use: function(){} } }
      };

      // ── 常用库 mock（防止 AI 生成的代码引用未加载的库报错）──────────────
      if (!window.antd) window.antd = new Proxy({}, { get: function(t,p) { return function() { return null; }; } });
      if (!window.dayjs) window.dayjs = function(d) { var _d = d ? new Date(d) : new Date(); return { format: function(f) { return _d.toLocaleDateString(); }, toDate: function() { return _d; }, isValid: function() { return true; } }; };
      if (!window.moment) window.moment = window.dayjs;

      // 拦截 AI 代码中可能残留的 ReactDOM.render / createRoot 调用
      // 防止 AI 代码自行渲染导致与模板渲染入口冲突
      var _noop = function() {
        console.warn('[Vibe] 已拦截 AI 代码中的 ReactDOM.render/createRoot 调用，渲染由模板统一管理');
        return { render: function(){}, unmount: function(){} };
      };
      var _origCreateRoot = ReactDOM.createRoot;
      var _origRender = ReactDOM.render;
      ReactDOM.createRoot = _noop;
      ReactDOM.render = function() { _noop(); };

      try {
        // Babel 编译可能生成 CommonJS 风格的 exports 对象
        var exports = {};
        var module = { exports: exports };

        ${compiledCode}

        // 恢复 ReactDOM 原始方法（供模板自己使用）
        ReactDOM.createRoot = _origCreateRoot;
        ReactDOM.render = _origRender;

        // 尝试找到默认导出的组件
        var __VibeRoot__ = (typeof __VibeApp__ !== 'undefined') ? __VibeApp__ : null;

        // 处理 Babel 编译后的 exports.default 格式
        if (!__VibeRoot__ && exports && exports.default) {
          __VibeRoot__ = exports.default;
        }
        if (!__VibeRoot__ && module.exports && module.exports !== exports) {
          __VibeRoot__ = module.exports;
        }

        // 如果 __VibeRoot__ 是对象（而非函数），尝试取 .default 属性
        if (__VibeRoot__ && typeof __VibeRoot__ === 'object' && __VibeRoot__.default) {
          __VibeRoot__ = __VibeRoot__.default;
        }

        // 降级：扫描所有局部变量，找首字母大写的函数/类组件
        if (!__VibeRoot__) {
          var __candidates__ = [typeof App !== 'undefined' && App, typeof Main !== 'undefined' && Main, typeof Page !== 'undefined' && Page, typeof Dashboard !== 'undefined' && Dashboard, typeof AdminDashboard !== 'undefined' && AdminDashboard, typeof Counter !== 'undefined' && Counter, typeof Home !== 'undefined' && Home, typeof Layout !== 'undefined' && Layout, typeof AdminPanel !== 'undefined' && AdminPanel, typeof ManagementSystem !== 'undefined' && ManagementSystem, typeof EcommerceDashboard !== 'undefined' && EcommerceDashboard, typeof OrderManagement !== 'undefined' && OrderManagement, typeof ProductManagement !== 'undefined' && ProductManagement, typeof UserManagement !== 'undefined' && UserManagement].filter(Boolean);
          __VibeRoot__ = __candidates__[0] || null;
        }

        // 最终校验：确保 __VibeRoot__ 是函数（React 组件）
        if (__VibeRoot__ && typeof __VibeRoot__ === 'object' && !__VibeRoot__.$$typeof) {
          // 可能是 { default: Component } 或其他包装对象，尝试取第一个函数属性
          var _keys = Object.keys(__VibeRoot__);
          for (var _i = 0; _i < _keys.length; _i++) {
            if (typeof __VibeRoot__[_keys[_i]] === 'function') {
              __VibeRoot__ = __VibeRoot__[_keys[_i]];
              break;
            }
          }
        }

        if (!__VibeRoot__ || (typeof __VibeRoot__ !== 'function' && typeof __VibeRoot__ !== 'object')) {
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
};

// ─── ReactPreview 组件 ───────────────────────────────────────────────────────

const ReactPreview = ({ jsx, lang = 'zh', className = '', runtimeApiBase }: ReactPreviewProps) => {
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

    const html = buildReactIframeHtml(result.code!, { runtimeApiBase });
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });

    if (iframeRef.current) {
      const prevSrc = iframeRef.current.src;
      if (prevSrc?.startsWith('blob:')) URL.revokeObjectURL(prevSrc);
      iframeRef.current.src = URL.createObjectURL(blob);
    }
  }, [runtimeApiBase]);

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
