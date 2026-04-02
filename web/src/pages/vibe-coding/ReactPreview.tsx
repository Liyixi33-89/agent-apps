import { useEffect, useRef, useState, useCallback } from 'react';
import {
  compileJsx as esbuildCompileJsx,
  compileJsxSync as esbuildCompileJsxSync,
  preInitEsbuild,
} from './esbuildCompiler';

// ─── 重新导出编译函数（保持向后兼容）────────────────────────────────────────
// 异步版本（推荐）：使用 esbuild-wasm 完整编译 TypeScript/TSX
export const compileJsx = esbuildCompileJsx;
// 同步版本（降级兼容）：用于不方便使用 async 的场景
export const compileJsxSync = esbuildCompileJsxSync;

// 预初始化 esbuild WASM（避免首次编译延迟）
preInitEsbuild();

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

    // ── 导航拦截：防止 AI 生成的代码导致父页面刷新 ──────────────────────
    // 锁定 window.location，阻止任何页面跳转
    (function() {
      // 拦截 window.open
      window.open = function(url) {
        console.warn('[Vibe] 已拦截 window.open:', url);
        return null;
      };

      // 拦截 form submit
      document.addEventListener('submit', function(e) { e.preventDefault(); }, true);

      // 拦截 <a> 外链跳转（DOM ready 后处理）
      var patchLinks = function() {
        try {
          var anchors = document.querySelectorAll('a[href]');
          if (!anchors || !anchors.length) return;
          anchors.forEach(function(a) {
            try {
              var href = a.getAttribute('href');
              if (!href) return;
              href = href.trim();
              // 拦截绝对 URL、协议相对 URL、以及 / 开头的路径（会导致父页面跳转）
              if (/^https?:\\/\\//i.test(href) || /^\\/\\//i.test(href) || /^\\/[^/]/i.test(href) || href === '/') {
                a.removeAttribute('href');
                a.style.cursor = 'pointer';
                a.addEventListener('click', function(e) {
                  e.preventDefault();
                  e.stopPropagation();
                  console.warn('[Vibe] 已拦截链接跳转:', href);
                });
              }
            } catch(err) { /* 单个元素处理失败不影响其他 */ }
          });
        } catch(err) { /* patchLinks 整体异常兜底 */ }
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', patchLinks);
      } else {
        patchLinks();
      }
      // MutationObserver 监听动态添加的 <a> 标签
      try {
        var observer = new MutationObserver(function() { patchLinks(); });
        if (document.body) {
          observer.observe(document.body, { childList: true, subtree: true });
        } else {
          document.addEventListener('DOMContentLoaded', function() {
            observer.observe(document.body, { childList: true, subtree: true });
          });
        }
      } catch(e) { /* MutationObserver 不可用时忽略 */ }

      // 拦截 history.pushState / replaceState（防止 React Router 等修改 URL）
      try {
        var _origPushState = history.pushState;
        var _origReplaceState = history.replaceState;
        history.pushState = function() {
          console.warn('[Vibe] 已拦截 history.pushState');
        };
        history.replaceState = function() {
          console.warn('[Vibe] 已拦截 history.replaceState');
        };
      } catch(e) { /* 忽略 */ }
    })();
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
      const _originalFetch = window.fetch.bind(window);
      const _runtimeApiBase = '${runtimeApiBase}';
      // 获取父页面 origin，用于将相对路径转为绝对 URL（Blob URL 环境中 fetch 无法解析相对路径）
      var _parentOrigin = '';
      try { _parentOrigin = window.parent.location.origin; } catch(e) { _parentOrigin = window.location.origin; }
      // 如果 origin 是 blob: 或 null，回退到 location.ancestorOrigins 或空字符串
      if (!_parentOrigin || _parentOrigin === 'null' || _parentOrigin.startsWith('blob:')) {
        try { _parentOrigin = window.location.ancestorOrigins && window.location.ancestorOrigins[0] || ''; } catch(e) { _parentOrigin = ''; }
      }
      console.info('[Vibe iframe] _runtimeApiBase =', JSON.stringify(_runtimeApiBase), _runtimeApiBase ? '✅ 已部署模式' : '⚠️ Mock 模式', '| origin:', _parentOrigin);

      // 将相对路径转为绝对 URL（解决 Blob URL 环境下 fetch 无法解析相对路径的问题）
      var _toAbsoluteUrl = function(relativeUrl) {
        if (!relativeUrl) return relativeUrl;
        // 已经是绝对 URL，直接返回
        if (/^https?:\\/\\//.test(relativeUrl)) return relativeUrl;
        // 相对路径 → 拼接 origin
        if (_parentOrigin) return _parentOrigin + relativeUrl;
        return relativeUrl;
      };

      // 判断是否为 API 请求（需要代理/mock）
      var _isApiRequest = function(url) {
        if (url.startsWith('/api/')) return true;
        if (/^\\/v\\d+\\//.test(url)) return true;
        return false;
      };

      // 从 URL 中提取实体路径（去掉 /api/ 或 /v1/ 等前缀）
      var _extractEntityPath = function(url) {
        return url
          .replace(/^\\/api\\//, '')
          .replace(/^\\/v\\d+\\//, '');
      };

      // 包装 fetch 响应：确保 .json() 返回的数据中 data 字段始终是数组，并对错误状态打印日志
      var _wrapApiResponse = function(fetchPromise) {
        return fetchPromise.then(function(res) {
          var origJson = res.json.bind(res);
          res.json = function() {
            return origJson().then(function(body) {
              if (!res.ok) {
                console.warn('[Vibe Runtime] API 返回错误:', res.status, body && body.message || '');
              }
              if (body && typeof body === 'object') {
                if (body.data === undefined || body.data === null) body.data = [];
                if (!Array.isArray(body.data) && typeof body.data !== 'object') body.data = [];
                // 过滤掉数组中的 null/undefined 项（后端可能返回被删除的关联数据）
                if (Array.isArray(body.data)) {
                  body.data = body.data.filter(function(item) { return item != null; });
                }
              }
              return body;
            });
          };
          return res;
        });
      };

      // 确保写操作（POST/PUT/PATCH）带有 Content-Type: application/json
      var _ensureJsonHeaders = function(opts) {
        if (!opts) opts = {};
        var method = (opts.method || 'GET').toUpperCase();
        if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
          if (!opts.headers) opts.headers = {};
          // 如果没有设置 Content-Type，自动补充
          var hasContentType = false;
          if (opts.headers instanceof Headers) {
            hasContentType = opts.headers.has('Content-Type');
          } else if (typeof opts.headers === 'object') {
            for (var key in opts.headers) {
              if (key.toLowerCase() === 'content-type') { hasContentType = true; break; }
            }
          }
          if (!hasContentType && opts.body && typeof opts.body === 'string') {
            try { JSON.parse(opts.body); opts.headers['Content-Type'] = 'application/json'; } catch(e) { /* 非 JSON body，不补充 */ }
          }
          // 如果 body 是普通对象（非 FormData/Blob），自动 JSON.stringify
          if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData) && !(opts.body instanceof Blob) && !(opts.body instanceof ArrayBuffer)) {
            opts.body = JSON.stringify(opts.body);
            if (!hasContentType) opts.headers['Content-Type'] = 'application/json';
          }
        }
        return opts;
      };

      window.fetch = function(url, opts) {
        if (typeof url === 'string' && _isApiRequest(url)) {
          if (_runtimeApiBase) {
            var entityPath = _extractEntityPath(url);
            var realUrl = _toAbsoluteUrl(_runtimeApiBase + '/' + entityPath);
            opts = _ensureJsonHeaders(opts);
            console.info('[Vibe Runtime] 代理 API:', url, '→', realUrl);
            return _wrapApiResponse(_originalFetch(realUrl, opts));
          } else {
            console.info('[Vibe Mock] 拦截 API 请求:', url, '→ 返回模拟数据');
            var method = (opts && opts.method || 'GET').toUpperCase();
            var mockResponse;
            if (method === 'POST') {
              var postBody = {};
              try { postBody = JSON.parse(opts && opts.body || '{}'); } catch(e) {}
              mockResponse = { success: true, data: Object.assign({ _id: 'mock_' + Date.now() }, postBody), message: '创建成功（Mock）' };
            } else if (method === 'PUT' || method === 'PATCH') {
              mockResponse = { success: true, data: {}, message: '更新成功（Mock）' };
            } else if (method === 'DELETE') {
              mockResponse = { success: true, message: '删除成功（Mock）' };
            } else {
              mockResponse = {
                success: true,
                data: [],
                pagination: { page: 1, limit: 20, total: 0, pages: 0 },
                total: 0,
                message: 'Mock response - 后端 API 未部署'
              };
            }
            return Promise.resolve(new Response(JSON.stringify(mockResponse), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }));
          }
        }
        return _originalFetch(url, opts);
      };

      // ── axios mock ──────────────────────────────────────────────────────
      var _createAxiosInstance = function(config) {
        var _baseURL = (config && config.baseURL) || '';
        if (_baseURL.endsWith('/')) _baseURL = _baseURL.slice(0, -1);

        var _resolveUrl = function(url) {
          if (!url) return _toAbsoluteUrl(_baseURL || '/');
          if (url.startsWith('http')) return url;
          if (url.startsWith('/api/') && !_baseURL) return _toAbsoluteUrl(url);
          if (url.startsWith('/')) return _toAbsoluteUrl(_baseURL + url);
          return _toAbsoluteUrl(_baseURL + '/' + url);
        };

        var instance = {
          defaults: { baseURL: _baseURL, headers: { common: {} } },
          interceptors: { request: { use: function(){} }, response: { use: function(){} } },
          create: _createAxiosInstance,
          get: function(url, config) {
            var fullUrl = _resolveUrl(url);
            var params = config && config.params;
            if (params) {
              var qs = new URLSearchParams(params).toString();
              fullUrl += (fullUrl.includes('?') ? '&' : '?') + qs;
            }
            return window.fetch(fullUrl).then(function(r){ return r.json().then(function(d){ return {data:d, status: r.status}; }); });
          },
          post: function(url, body) {
            return window.fetch(_resolveUrl(url), {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}).then(function(r){ return r.json().then(function(d){ return {data:d, status: r.status}; }); });
          },
          put: function(url, body) {
            return window.fetch(_resolveUrl(url), {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}).then(function(r){ return r.json().then(function(d){ return {data:d, status: r.status}; }); });
          },
          patch: function(url, body) {
            return window.fetch(_resolveUrl(url), {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}).then(function(r){ return r.json().then(function(d){ return {data:d, status: r.status}; }); });
          },
          delete: function(url) {
            return window.fetch(_resolveUrl(url), {method:'DELETE'}).then(function(r){ return r.json().then(function(d){ return {data:d, status: r.status}; }); });
          },
        };
        return instance;
      };
      window.axios = _createAxiosInstance({});

      // ── 常用库 mock ──────────────────────────────────────────────────────
      if (!window.antd) window.antd = new Proxy({}, { get: function(t,p) { return function() { return null; }; } });
      if (!window.dayjs) window.dayjs = function(d) { var _d = d ? new Date(d) : new Date(); return { format: function(f) { return _d.toLocaleDateString(); }, toDate: function() { return _d; }, isValid: function() { return true; } }; };
      if (!window.moment) window.moment = window.dayjs;

      // 拦截 AI 代码中可能残留的 ReactDOM.render / createRoot 调用
      var _noop = function() {
        console.warn('[Vibe] 已拦截 AI 代码中的 ReactDOM.render/createRoot 调用，渲染由模板统一管理');
        return { render: function(){}, unmount: function(){} };
      };
      var _origCreateRoot = ReactDOM.createRoot;
      var _origRender = ReactDOM.render;
      ReactDOM.createRoot = _noop;
      ReactDOM.render = function() { _noop(); };

      try {
        // esbuild 编译后可能生成 CommonJS 风格的 exports 对象
        var exports = {};
        var module = { exports: exports };

        // ── 全局防御：patch React.createElement 自动修复 undefined data 和非法 style ──
        var _origCreateElement = React.createElement;
        React.createElement = function(type, props) {
          if (props) {
            var needPatch = false;
            // 修复 style 属性：数组 → 合并为对象，非对象 → 清空
            if (props.style !== undefined && props.style !== null) {
              if (Array.isArray(props.style)) {
                needPatch = true;
              } else if (typeof props.style !== 'object') {
                needPatch = true;
              }
            }
            // 修复 undefined/null 的 data/dataSource/items（仅函数组件）
            if (typeof type === 'function') {
              if (props.data === undefined || props.data === null) needPatch = true;
              if (props.dataSource === undefined || props.dataSource === null) needPatch = true;
              if (props.items === undefined || props.items === null) needPatch = true;
            }
            if (needPatch) {
              var newProps = {};
              for (var k in props) { if (props.hasOwnProperty(k)) newProps[k] = props[k]; }
              // 修复 style
              if (Array.isArray(newProps.style)) {
                var merged = {};
                for (var si = 0; si < newProps.style.length; si++) {
                  var s = newProps.style[si];
                  if (s && typeof s === 'object') {
                    for (var sk in s) { if (s.hasOwnProperty(sk)) merged[sk] = s[sk]; }
                  }
                }
                newProps.style = merged;
              } else if (newProps.style !== undefined && newProps.style !== null && typeof newProps.style !== 'object') {
                newProps.style = {};
              }
              // 修复 data/dataSource/items
              if (typeof type === 'function') {
                if (newProps.data === undefined || newProps.data === null) newProps.data = [];
                if (newProps.dataSource === undefined || newProps.dataSource === null) newProps.dataSource = [];
                if (newProps.items === undefined || newProps.items === null) newProps.items = [];
              }
              var args = [type, newProps];
              for (var i = 2; i < arguments.length; i++) args.push(arguments[i]);
              return _origCreateElement.apply(React, args);
            }
          }
          return _origCreateElement.apply(React, arguments);
        };

        ${compiledCode}

        // 恢复 ReactDOM 原始方法（供模板自己使用）
        ReactDOM.createRoot = _origCreateRoot;
        ReactDOM.render = _origRender;

        // 尝试找到默认导出的组件
        var __VibeRoot__ = (typeof __VibeApp__ !== 'undefined') ? __VibeApp__ : null;

        // 处理编译后的 exports.default 格式
        if (!__VibeRoot__ && exports && exports.default) {
          __VibeRoot__ = exports.default;
        }
        if (!__VibeRoot__ && module.exports && module.exports !== exports) {
          __VibeRoot__ = module.exports;
        }

        // ── 类型解包：处理 array / object 包装 ──────────────────────────
        if (Array.isArray(__VibeRoot__)) {
          console.warn('[Vibe] __VibeRoot__ 是数组，尝试取第一个函数元素');
          for (var _ai = 0; _ai < __VibeRoot__.length; _ai++) {
            if (typeof __VibeRoot__[_ai] === 'function') {
              __VibeRoot__ = __VibeRoot__[_ai];
              break;
            }
          }
          if (Array.isArray(__VibeRoot__)) __VibeRoot__ = null;
        }

        if (__VibeRoot__ && typeof __VibeRoot__ === 'object' && !Array.isArray(__VibeRoot__)) {
          if (__VibeRoot__.default) {
            __VibeRoot__ = __VibeRoot__.default;
          } else if (__VibeRoot__.$$typeof) {
            // 已经是 React 元素，保持不变
          } else {
            var _keys = Object.keys(__VibeRoot__);
            for (var _oi = 0; _oi < _keys.length; _oi++) {
              if (typeof __VibeRoot__[_keys[_oi]] === 'function') {
                __VibeRoot__ = __VibeRoot__[_keys[_oi]];
                break;
              }
            }
          }
        }

        // 降级：扫描所有局部变量，找首字母大写的函数/类组件
        if (!__VibeRoot__ || (typeof __VibeRoot__ !== 'function' && !(__VibeRoot__ && __VibeRoot__.$$typeof))) {
          var __candidates__ = [typeof App !== 'undefined' && App, typeof Main !== 'undefined' && Main, typeof Page !== 'undefined' && Page, typeof Dashboard !== 'undefined' && Dashboard, typeof AdminDashboard !== 'undefined' && AdminDashboard, typeof Counter !== 'undefined' && Counter, typeof Home !== 'undefined' && Home, typeof Layout !== 'undefined' && Layout, typeof AdminPanel !== 'undefined' && AdminPanel, typeof ManagementSystem !== 'undefined' && ManagementSystem, typeof EcommerceDashboard !== 'undefined' && EcommerceDashboard, typeof OrderManagement !== 'undefined' && OrderManagement, typeof ProductManagement !== 'undefined' && ProductManagement, typeof UserManagement !== 'undefined' && UserManagement, typeof SystemManagement !== 'undefined' && SystemManagement, typeof BackendManagement !== 'undefined' && BackendManagement, typeof AdminSystem !== 'undefined' && AdminSystem].filter(function(c) { return typeof c === 'function'; });
          if (__candidates__.length > 0) {
            __VibeRoot__ = __candidates__[0];
            console.info('[Vibe] 降级使用候选组件:', __VibeRoot__.name || __VibeRoot__);
          }
        }

        // 最终二次校验
        if (Array.isArray(__VibeRoot__)) {
          throw new Error('组件解析结果为数组，无法渲染。请确保 export default 导出的是单个 React 组件。');
        }
        if (!__VibeRoot__ || (typeof __VibeRoot__ !== 'function' && !(typeof __VibeRoot__ === 'object' && __VibeRoot__.$$typeof))) {
          throw new Error('未找到可渲染的 React 组件（类型: ' + typeof __VibeRoot__ + '），请确保有 export default 的组件');
        }

        // ── React Error Boundary（类组件，防止运行时错误白屏）──────────
        var VibeErrorBoundary = (function() {
          // 使用 class 语法确保 React 能正确识别 getDerivedStateFromError
          // 手动原型链继承在某些 React 版本中无法正确绑定 static 方法
          function EB(props) {
            // 调用父类构造函数
            React.Component.call(this, props);
            this.state = { hasError: false, error: null };
          }
          EB.prototype = Object.create(React.Component.prototype);
          EB.prototype.constructor = EB;
          // React 通过检查 constructor.getDerivedStateFromError 来判断是否为 Error Boundary
          // 同时也需要 componentDidCatch 作为兜底
          EB.getDerivedStateFromError = function(error) {
            return { hasError: true, error: error };
          };
          EB.prototype.componentDidCatch = function(error, info) {
            console.error('[Vibe ErrorBoundary]', error, info);
            // getDerivedStateFromError 可能未被调用（某些 React 版本的兼容性问题）
            // 在 componentDidCatch 中也设置 state 作为兜底
            this.setState({ hasError: true, error: error });
            // 同时显示到错误条
            if (typeof window.onerror === 'function') {
              window.onerror(error.message || String(error), '', 0, 0);
            }
          };
          EB.prototype.render = function() {
            if (this.state.hasError) {
              var errMsg = this.state.error ? (this.state.error.message || String(this.state.error)) : '未知错误';
              return _origCreateElement('div', {
                style: { padding: '24px', color: '#f87171', fontFamily: 'monospace', fontSize: '13px', background: '#1a0a0a', minHeight: '100vh' }
              },
                _origCreateElement('strong', null, '⚠ 运行时错误'),
                _origCreateElement('br'),
                _origCreateElement('span', null, errMsg),
                _origCreateElement('br'),
                _origCreateElement('br'),
                _origCreateElement('span', { style: { color: '#94a3b8', fontSize: '11px' } }, '提示：这通常是 AI 生成的代码存在问题，请尝试重新生成或修改提示词。')
              );
            }
            return this.props.children;
          };
          return EB;
        })();

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(_origCreateElement(VibeErrorBoundary, null, React.createElement(__VibeRoot__)));
      } catch(e) {
        if (typeof window.onerror === 'function') {
          window.onerror(e.message || String(e), '', 0, 0);
        } else {
          console.error('[Vibe] 渲染错误:', e);
        }
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
  // 缓存编译结果，避免 runtimeApiBase 变化时重复编译
  const compiledCodeRef = useRef<string | null>(null);
  const lastJsxRef = useRef<string>('');
  const lastApiBaseRef = useRef<string>('');
  // 用于取消过期的异步编译任务
  const compileIdRef = useRef(0);

  /** 将编译后的代码写入 iframe */
  const writeToIframe = useCallback((compiledCode: string, apiBase?: string) => {
    const html = buildReactIframeHtml(compiledCode, { runtimeApiBase: apiBase });
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });

    if (iframeRef.current) {
      const prevSrc = iframeRef.current.src;
      if (prevSrc?.startsWith('blob:')) URL.revokeObjectURL(prevSrc);
      iframeRef.current.src = URL.createObjectURL(blob);
    }
  }, []);

  /**
   * 统一的渲染 effect：
   * - jsx 变化 → 重新编译（异步）+ 渲染
   * - runtimeApiBase 变化（且已有编译结果）→ 只重建 HTML（不重新编译）
   */
  useEffect(() => {
    if (!jsx.trim()) {
      console.info('[ReactPreview] jsx 为空，跳过渲染。runtimeApiBase:', runtimeApiBase || '(空)');
      return;
    }

    const apiBase = runtimeApiBase || '';
    const jsxChanged = jsx !== lastJsxRef.current;
    const apiBaseChanged = apiBase !== lastApiBaseRef.current;

    console.info('[ReactPreview] useEffect 触发:', {
      jsxChanged,
      apiBaseChanged,
      apiBase: apiBase || '(空)',
      jsxLen: jsx.length,
      hasCachedCode: !!compiledCodeRef.current,
    });

    // 如果 jsx 和 apiBase 都没变，跳过
    if (!jsxChanged && !apiBaseChanged && compiledCodeRef.current) return;

    // 如果只有 apiBase 变了，且已有编译结果，直接重建 HTML
    if (!jsxChanged && apiBaseChanged && compiledCodeRef.current) {
      console.info('[ReactPreview] runtimeApiBase 变化，重建 iframe:', apiBase);
      lastApiBaseRef.current = apiBase;
      setIsLoading(true);
      writeToIframe(compiledCodeRef.current, apiBase);
      return;
    }

    // jsx 变了，需要重新编译（异步）
    setIsLoading(true);
    setCompileError(null);

    // 递增编译 ID，用于取消过期的编译任务
    const currentCompileId = ++compileIdRef.current;

    compileJsx(jsx).then((result) => {
      // 如果编译 ID 已过期（用户在编译期间又修改了代码），丢弃结果
      if (currentCompileId !== compileIdRef.current) {
        console.info('[ReactPreview] 编译结果已过期，丢弃');
        return;
      }

      if (result.error) {
        setCompileError(result.error);
        setIsLoading(false);
        compiledCodeRef.current = null;
        return;
      }

      console.info('[ReactPreview] esbuild 编译完成，runtimeApiBase:', apiBase || '(空，将使用 Mock)');
      lastJsxRef.current = jsx;
      lastApiBaseRef.current = apiBase;
      compiledCodeRef.current = result.code;
      writeToIframe(result.code!, apiBase);
    }).catch((err) => {
      if (currentCompileId !== compileIdRef.current) return;
      const message = err instanceof Error ? err.message : String(err);
      console.error('[ReactPreview] 编译异常:', message);
      setCompileError(message);
      setIsLoading(false);
    });
  }, [jsx, runtimeApiBase, writeToIframe]);

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
