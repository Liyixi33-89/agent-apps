import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { compileJsx, compileJsxSync, preInitEsbuild } from './esbuildCompiler';

// 重新导出编译函数（保持向后兼容）
export { compileJsx, compileJsxSync };

// 初始化编译器（服务端模式下为空操作）
preInitEsbuild();

interface ReactPreviewProps {
  jsx: string;
  /** 服务端已编译好的 JS 代码，有则直接渲染，跳过二次编译 */
  compiledJs?: string;
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
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
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

    // ── 拦截原生模态框 API（sandbox 未设置 allow-modals，直接调用会报错）──
    window.alert   = function(msg) { console.info('[Vibe Mock] alert:', msg); };
    window.confirm = function(msg) { console.info('[Vibe Mock] confirm:', msg); return true; };
    window.prompt  = function(msg) { console.info('[Vibe Mock] prompt:', msg); return ''; };

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
      // MutationObserver 监听动态添加的 <a> 标签（页面卸载时自动 disconnect）
      try {
        var observer = new MutationObserver(function() { patchLinks(); });
        var _startObserver = function() {
          observer.observe(document.body, { childList: true, subtree: true });
        };
        if (document.body) {
          _startObserver();
        } else {
          document.addEventListener('DOMContentLoaded', _startObserver);
        }
        // 页面卸载时断开 observer，防止内存泄漏
        window.addEventListener('unload', function() { observer.disconnect(); });
        window.addEventListener('pagehide', function() { observer.disconnect(); });
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
      // 真正的 axios 实例既是函数又是对象：
      //   axios('/users')          → 函数调用（默认 GET）
      //   axios({ url, method })   → 函数调用（config 对象）
      //   axios.get('/users')      → 方法调用
      // AI 生成的代码可能使用以上任意方式，所以 shim 必须同时支持
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

        var _doRequest = function(method, url, body, reqConfig) {
          var fullUrl = _resolveUrl(url);
          var params = reqConfig && reqConfig.params;
          if (params) {
            var qs = new URLSearchParams(params).toString();
            fullUrl += (fullUrl.includes('?') ? '&' : '?') + qs;
          }
          var fetchOpts = { method: method.toUpperCase() };
          if (body !== undefined && body !== null && method !== 'get' && method !== 'GET') {
            fetchOpts.headers = { 'Content-Type': 'application/json' };
            fetchOpts.body = JSON.stringify(body);
          }
          return window.fetch(fullUrl, fetchOpts).then(function(r) {
            return r.json().catch(function() { return null; }).then(function(d) {
              return { data: d, status: r.status, statusText: r.statusText, headers: {}, config: {} };
            });
          });
        };

        // 核心：instance 是一个函数，支持 api('/url') 和 api({ url, method, data }) 两种调用方式
        var instance = function(urlOrConfig, cfgArg) {
          if (typeof urlOrConfig === 'string') {
            // api('/users') 或 api('/users', { params: ... })
            var method = (cfgArg && cfgArg.method) || 'GET';
            var body = cfgArg && cfgArg.data;
            return _doRequest(method, urlOrConfig, body, cfgArg);
          } else if (urlOrConfig && typeof urlOrConfig === 'object') {
            // api({ url: '/users', method: 'POST', data: {...} })
            var cfg = urlOrConfig;
            return _doRequest(cfg.method || 'GET', cfg.url || '/', cfg.data, cfg);
          }
          // 兜底：返回空 Promise
          return Promise.resolve({ data: null, status: 200 });
        };

        // 挂载方法属性，使 api.get() / api.post() 等也能工作
        instance.defaults = { baseURL: _baseURL, headers: { common: {} } };
        instance.interceptors = { request: { use: function(){}, eject: function(){} }, response: { use: function(){}, eject: function(){} } };
        instance.create = _createAxiosInstance;
        instance.get = function(url, cfg) { return _doRequest('GET', url, null, cfg); };
        instance.post = function(url, body, cfg) { return _doRequest('POST', url, body, cfg); };
        instance.put = function(url, body, cfg) { return _doRequest('PUT', url, body, cfg); };
        instance.patch = function(url, body, cfg) { return _doRequest('PATCH', url, body, cfg); };
        instance.delete = function(url, cfg) { return _doRequest('DELETE', url, null, cfg); };
        instance.head = function(url, cfg) { return _doRequest('HEAD', url, null, cfg); };
        instance.options = function(url, cfg) { return _doRequest('OPTIONS', url, null, cfg); };
        instance.request = instance; // axios.request(config) 等同于 axios(config)
        instance.isAxiosError = function() { return false; };
        instance.all = function(promises) { return Promise.all(promises); };
        instance.spread = function(fn) { return function(arr) { return fn.apply(null, arr); }; };

        return instance;
      };
      window.axios = _createAxiosInstance({});

      // ── 常见 API 变量 shim ──────────────────────────────────────────────
      // AI 生成的代码经常使用 api/request/http 等变量名来封装 HTTP 请求
      // import 被移除后这些变量未定义，需要提供 shim
      var api = _createAxiosInstance({});
      var request = _createAxiosInstance({});
      var http = _createAxiosInstance({});
      var client = _createAxiosInstance({});
      var service = _createAxiosInstance({});
      var instance = _createAxiosInstance({});
      var fetcher = _createAxiosInstance({});
      var $http = _createAxiosInstance({});
      var httpClient = _createAxiosInstance({});
      var apiClient = _createAxiosInstance({});
      var apiService = _createAxiosInstance({});
      var axiosInstance = _createAxiosInstance({});

      // ── 常见 UI 反馈 shim ──────────────────────────────────────────────
      // AI 生成的代码经常使用 toast/message/notification 等 UI 反馈函数
      var _noopNotify = function(msg) { console.info('[Vibe Mock]', typeof msg === 'string' ? msg : JSON.stringify(msg)); };
      _noopNotify.success = _noopNotify;
      _noopNotify.error = _noopNotify;
      _noopNotify.warning = _noopNotify;
      _noopNotify.info = _noopNotify;
      _noopNotify.loading = function() { return function() {}; };
      _noopNotify.destroy = function() {};
      _noopNotify.open = _noopNotify;
      var toast = _noopNotify;
      var message = _noopNotify;
      var notification = _noopNotify;
      var notify = _noopNotify;
      var alert = _noopNotify;
      var confirm = function(msg) { console.info('[Vibe Mock] confirm:', msg); return true; };
      var prompt = function(msg) { console.info('[Vibe Mock] prompt:', msg); return ''; };
      window.toast = toast;
      window.message = message;
      window.notification = notification;

      // ── 常见路由 shim ──────────────────────────────────────────────────
      var _noopNav = function(path) { console.info('[Vibe Mock] navigate:', path); };
      var navigate = _noopNav;
      var router = {
        push: _noopNav, replace: _noopNav, back: function() {},
        forward: function() {}, go: function() {},
        pathname: '/', query: {}, params: {},
        route: '/', asPath: '/', basePath: '',
        isReady: true, events: { on: function(){}, off: function(){}, emit: function(){} }
      };
      var useNavigate = function() { return _noopNav; };
      var useRouter = function() { return router; };
      var useParams = function() { return {}; };
      var useSearchParams = function() { return [new URLSearchParams(), function(){}]; };
      var useLocation = function() { return { pathname: '/', search: '', hash: '', state: null }; };
      var useHistory = function() { return { push: _noopNav, replace: _noopNav, goBack: function(){}, listen: function(){return function(){};} }; };
      var Link = function(props) { return _origCreateElement('a', { href: '#', onClick: function(e) { e.preventDefault(); }, style: props.style, className: props.className }, props.children); };
      var NavLink = Link;
      var Route = function(props) { return props.children || null; };
      var Routes = function(props) { return props.children || null; };
      var BrowserRouter = function(props) { return props.children || null; };
      var HashRouter = BrowserRouter;
      var MemoryRouter = BrowserRouter;
      var Switch = Routes;
      var Redirect = function() { return null; };
      var Outlet = function() { return null; };

      // ── 常见状态管理 shim ──────────────────────────────────────────────
      var useSelector = function(selector) { try { return selector({}); } catch(e) { return undefined; } };
      var useDispatch = function() { return function() {}; };
      var useStore = function() { return { getState: function(){ return {}; }, dispatch: function(){}, subscribe: function(){ return function(){}; } }; };
      var Provider = function(props) { return props.children || null; };

      // ── 常用库 mock ──────────────────────────────────────────────────────
      if (!window.antd) window.antd = new Proxy({}, { get: function(t,p) { return function() { return null; }; } });
      if (!window.dayjs) window.dayjs = function(d) { var _d = d ? new Date(d) : new Date(); return { format: function(f) { return _d.toLocaleDateString(); }, toDate: function() { return _d; }, isValid: function() { return true; }, add: function() { return window.dayjs(_d); }, subtract: function() { return window.dayjs(_d); }, startOf: function() { return window.dayjs(_d); }, endOf: function() { return window.dayjs(_d); }, isBefore: function() { return false; }, isAfter: function() { return false; }, diff: function() { return 0; }, valueOf: function() { return _d.getTime(); }, unix: function() { return Math.floor(_d.getTime()/1000); } }; };
      window.dayjs.extend = function() {};
      if (!window.moment) window.moment = window.dayjs;
      var dayjs = window.dayjs;
      var moment = window.moment;

      // ── lodash / underscore shim ──────────────────────────────────────
      var _ = {
        get: function(obj, path, def) { if (!obj) return def; var keys = typeof path === 'string' ? path.split('.') : path; var result = obj; for (var i = 0; i < keys.length; i++) { result = result && result[keys[i]]; if (result === undefined) return def; } return result; },
        set: function(obj, path, val) { if (!obj) return obj; var keys = typeof path === 'string' ? path.split('.') : path; var cur = obj; for (var i = 0; i < keys.length - 1; i++) { if (!cur[keys[i]]) cur[keys[i]] = {}; cur = cur[keys[i]]; } cur[keys[keys.length-1]] = val; return obj; },
        debounce: function(fn, ms) { var t; return function() { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function(){ fn.apply(c,a); }, ms||300); }; },
        throttle: function(fn, ms) { var last = 0; return function() { var now = Date.now(); if (now - last >= (ms||300)) { last = now; fn.apply(this, arguments); } }; },
        cloneDeep: function(v) { return JSON.parse(JSON.stringify(v)); },
        isEmpty: function(v) { if (!v) return true; if (Array.isArray(v)) return v.length === 0; if (typeof v === 'object') return Object.keys(v).length === 0; return false; },
        isEqual: function(a,b) { return JSON.stringify(a) === JSON.stringify(b); },
        uniq: function(arr) { return Array.from(new Set(arr)); },
        uniqBy: function(arr, key) { var seen = new Set(); return arr.filter(function(item) { var k = typeof key === 'function' ? key(item) : item[key]; if (seen.has(k)) return false; seen.add(k); return true; }); },
        groupBy: function(arr, key) { return arr.reduce(function(acc, item) { var k = typeof key === 'function' ? key(item) : item[key]; (acc[k] = acc[k] || []).push(item); return acc; }, {}); },
        sortBy: function(arr, key) { return arr.slice().sort(function(a,b) { var ak = typeof key === 'function' ? key(a) : a[key]; var bk = typeof key === 'function' ? key(b) : b[key]; return ak < bk ? -1 : ak > bk ? 1 : 0; }); },
        map: function(arr, fn) { return (arr || []).map(fn); },
        filter: function(arr, fn) { return (arr || []).filter(fn); },
        find: function(arr, fn) { return (arr || []).find(fn); },
        flatten: function(arr) { return (arr || []).flat(); },
        flattenDeep: function(arr) { return (arr || []).flat(Infinity); },
        omit: function(obj, keys) { var r = {}; for (var k in obj) { if (obj.hasOwnProperty(k) && keys.indexOf(k) === -1) r[k] = obj[k]; } return r; },
        pick: function(obj, keys) { var r = {}; keys.forEach(function(k) { if (obj.hasOwnProperty(k)) r[k] = obj[k]; }); return r; },
        merge: function() { return Object.assign.apply(null, [{}].concat(Array.from(arguments))); },
        noop: function() {},
        identity: function(v) { return v; },
        range: function(start, end, step) { if (end === undefined) { end = start; start = 0; } step = step || 1; var r = []; for (var i = start; i < end; i += step) r.push(i); return r; },
        chunk: function(arr, size) { var r = []; for (var i = 0; i < arr.length; i += size) r.push(arr.slice(i, i + size)); return r; },
        capitalize: function(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; },
        camelCase: function(s) { return s ? s.replace(/[-_\s]+(.)?/g, function(m,c) { return c ? c.toUpperCase() : ''; }) : ''; },
        kebabCase: function(s) { return s ? s.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase() : ''; },
        times: function(n, fn) { var r = []; for (var i = 0; i < n; i++) r.push(fn(i)); return r; },
      };
      window._ = _;

      // ── classnames / clsx shim ────────────────────────────────────────
      var classnames = function() {
        var classes = [];
        for (var i = 0; i < arguments.length; i++) {
          var arg = arguments[i];
          if (!arg) continue;
          if (typeof arg === 'string' || typeof arg === 'number') { classes.push(arg); }
          else if (Array.isArray(arg)) { classes.push(classnames.apply(null, arg)); }
          else if (typeof arg === 'object') { for (var key in arg) { if (arg.hasOwnProperty(key) && arg[key]) classes.push(key); } }
        }
        return classes.join(' ');
      };
      var clsx = classnames;
      var cx = classnames;
      var cn = classnames;
      window.classnames = classnames;
      window.clsx = clsx;

      // ── uuid shim ─────────────────────────────────────────────────────
      var uuidv4 = function() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }); };
      var uuid = { v4: uuidv4 };
      var nanoid = function(size) { var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; var id = ''; for (var i = 0; i < (size || 21); i++) id += chars[Math.random() * chars.length | 0]; return id; };

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
        // 编译后可能生成 CommonJS 风格的 exports 对象
        var exports = {};
        var module = { exports: exports };

        // ── 全局防御：安全的数组/对象访问 ──────────────────────────────────
        // 拦截 AI 代码中常见的 undefined.map() / undefined.filter() 等崩溃
        var _safeArray = function(v) { return Array.isArray(v) ? v : []; };
        // 全局辅助函数，AI 代码内部可直接使用
        window.__safeArr = _safeArray;

        // ── 全局防御：patch useEffect 防止无限渲染循环 ──────────────────────
        // AI 生成的代码经常在 useEffect 中 setState，且依赖项每次渲染都变化，导致无限循环
        // 策略：为每个 useEffect 实例追踪调用频率，超过阈值则自动跳过
        var _origUseEffect = React.useEffect;
        var _effectCallMap = new WeakMap();
        var _EFFECT_MAX_CALLS_PER_SECOND = 50; // 每秒最多触发 50 次
        React.useEffect = function(effect, deps) {
          // 如果没有依赖数组（每次渲染都执行），自动加上空数组防止无限循环
          if (deps === undefined) {
            console.warn('[Vibe Runtime] useEffect 缺少依赖数组，已自动修正为 []');
            return _origUseEffect.call(React, effect, []);
          }
          // 包装 effect 函数，添加频率限制
          var wrappedEffect = function() {
            var now = Date.now();
            var callInfo = _effectCallMap.get(wrappedEffect);
            if (!callInfo) {
              callInfo = { count: 0, windowStart: now };
              _effectCallMap.set(wrappedEffect, callInfo);
            }
            // 重置时间窗口
            if (now - callInfo.windowStart > 1000) {
              callInfo.count = 0;
              callInfo.windowStart = now;
            }
            callInfo.count++;
            if (callInfo.count > _EFFECT_MAX_CALLS_PER_SECOND) {
              console.error('[Vibe Runtime] useEffect 触发频率过高（' + callInfo.count + '次/秒），已自动阻止无限循环。请检查依赖项是否每次渲染都变化。');
              return; // 跳过执行，阻止无限循环
            }
            return effect();
          };
          return _origUseEffect.call(React, wrappedEffect, deps);
        };

        // ── 全局防御：patch React.createElement 自动修复 undefined props ──
        // 需要兜底为空数组的 prop 名称（覆盖 CrudPage 工厂模式的所有常见 props）
        var _arrayPropNames = {
          data:1, dataSource:1, items:1, columns:1, fields:1, rows:1, records:1,
          list:1, options:1, mockData:1, children:0, menus:1, tabs:1, tags:1,
          categories:1, permissions:1, roles:1, users:1, orders:1, products:1,
          selectedKeys:1, expandedKeys:1, checkedKeys:1, selectedRows:1,
          tableData:1, listData:1, formFields:1, tableColumns:1, menuItems:1,
          navItems:1, sidebarItems:1, breadcrumbs:1, steps:1, results:1
        };
        var _origCreateElement = React.createElement;
        React.createElement = function(type, props) {
          // 对函数组件进行全面的 props 防御
          if (typeof type === 'function') {
            // 确保 props 不为 null/undefined（防止组件内部解构报错）
            if (!props) props = {};
            var needPatch = false;
            // 修复 style 属性：undefined → {}，数组 → 合并为对象，非对象 → 清空
            if (props.style !== undefined && props.style !== null) {
              if (Array.isArray(props.style)) {
                needPatch = true;
              } else if (typeof props.style !== 'object') {
                needPatch = true;
              }
            }
            // 修复所有可能为数组的 props（undefined/null → []）
            for (var _apk in _arrayPropNames) {
              if (_arrayPropNames.hasOwnProperty(_apk) && _arrayPropNames[_apk] &&
                  _apk in props && (props[_apk] === undefined || props[_apk] === null)) {
                needPatch = true;
                break;
              }
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
              // 修复所有数组类型的 props
              for (var _apk2 in _arrayPropNames) {
                if (_arrayPropNames.hasOwnProperty(_apk2) && _arrayPropNames[_apk2] &&
                    (newProps[_apk2] === undefined || newProps[_apk2] === null)) {
                  newProps[_apk2] = [];
                }
              }
              var args = [type, newProps];
              for (var i = 2; i < arguments.length; i++) args.push(arguments[i]);
              return _origCreateElement.apply(React, args);
            }
            // 即使不需要 patch 具体属性，也要确保 props 不为 null
            if (props !== arguments[1]) {
              var args2 = [type, props];
              for (var j = 2; j < arguments.length; j++) args2.push(arguments[j]);
              return _origCreateElement.apply(React, args2);
            }
          } else if (props) {
            // 原生 HTML 元素：修复 style + 过滤非标准 DOM 属性
            // React 不认识驼峰命名的自定义 props（如 dataSource、columns、fields 等）
            // 这些是 LLM 生成代码中常见的 props 透传错误
            var _nonDomProps = {
              dataSource:1, columns:1, fields:1, mockData:1, apiName:1,
              onEdit:1, onDel:1, onDelete:1, onRemove:1, onAdd:1, onCreate:1,
              onSearch:1, onPageChange:1, onOk:1, onCancel:1, onConfirm:1,
              pageSize:1, currentPage:1, totalCount:1, totalPages:1,
              isOpen:1, isVisible:1, isLoading:1, isDisabled:1, isActive:1,
              showModal:1, showHeader:1, showFooter:1, showPagination:1,
              renderItem:1, renderCell:1, renderHeader:1, renderFooter:1,
              labelText:1, errorText:1, helperText:1, placeholderText:1,
              inputType:1, inputValue:1, fieldType:1, fieldName:1, fieldKey:1,
              sortKey:1, sortOrder:1, filterKey:1, filterValue:1
            };
            var needHtmlPatch = false;
            // 检查 style 是否需要修复
            if (props.style !== undefined && props.style !== null) {
              if (Array.isArray(props.style) || typeof props.style !== 'object') {
                needHtmlPatch = true;
              }
            }
            // 检查是否有非标准 DOM 属性
            if (!needHtmlPatch) {
              for (var pk in props) {
                if (props.hasOwnProperty(pk) && _nonDomProps[pk]) {
                  needHtmlPatch = true;
                  break;
                }
              }
            }
            // 额外检查：含大写字母且不是标准 React/DOM 属性的 prop 也过滤
            if (!needHtmlPatch) {
              for (var pk2 in props) {
                if (props.hasOwnProperty(pk2) && /[A-Z]/.test(pk2) &&
                    pk2 !== 'className' && pk2 !== 'htmlFor' && pk2 !== 'tabIndex' &&
                    pk2 !== 'autoFocus' && pk2 !== 'autoComplete' && pk2 !== 'autoPlay' &&
                    pk2 !== 'crossOrigin' && pk2 !== 'dateTime' && pk2 !== 'encType' &&
                    pk2 !== 'formAction' && pk2 !== 'formMethod' && pk2 !== 'formTarget' &&
                    pk2 !== 'frameBorder' && pk2 !== 'inputMode' && pk2 !== 'maxLength' &&
                    pk2 !== 'minLength' && pk2 !== 'noValidate' && pk2 !== 'readOnly' &&
                    pk2 !== 'rowSpan' && pk2 !== 'colSpan' && pk2 !== 'cellPadding' &&
                    pk2 !== 'cellSpacing' && pk2 !== 'charSet' && pk2 !== 'allowFullScreen' &&
                    pk2 !== 'dangerouslySetInnerHTML' && pk2 !== 'suppressContentEditableWarning' &&
                    pk2 !== 'suppressHydrationWarning' &&
                    pk2.slice(0,2) !== 'on' && pk2.slice(0,4) !== 'aria' && pk2.slice(0,4) !== 'data') {
                  needHtmlPatch = true;
                  break;
                }
              }
            }
            if (needHtmlPatch) {
              var htmlProps = {};
              for (var hk in props) {
                if (!props.hasOwnProperty(hk)) continue;
                // 跳过已知的非 DOM 属性
                if (_nonDomProps[hk]) continue;
                // 跳过含大写字母的非标准属性（但保留合法的 React DOM 属性和事件处理器）
                if (/[A-Z]/.test(hk) &&
                    hk !== 'className' && hk !== 'htmlFor' && hk !== 'tabIndex' &&
                    hk !== 'autoFocus' && hk !== 'autoComplete' && hk !== 'autoPlay' &&
                    hk !== 'crossOrigin' && hk !== 'dateTime' && hk !== 'encType' &&
                    hk !== 'formAction' && hk !== 'formMethod' && hk !== 'formTarget' &&
                    hk !== 'frameBorder' && hk !== 'inputMode' && hk !== 'maxLength' &&
                    hk !== 'minLength' && hk !== 'noValidate' && hk !== 'readOnly' &&
                    hk !== 'rowSpan' && hk !== 'colSpan' && hk !== 'cellPadding' &&
                    hk !== 'cellSpacing' && hk !== 'charSet' && hk !== 'allowFullScreen' &&
                    hk !== 'dangerouslySetInnerHTML' && hk !== 'suppressContentEditableWarning' &&
                    hk !== 'suppressHydrationWarning' &&
                    hk.slice(0,2) !== 'on' && hk.slice(0,4) !== 'aria' && hk.slice(0,4) !== 'data') continue;
                htmlProps[hk] = props[hk];
              }
              // 修复 style
              if (Array.isArray(htmlProps.style)) {
                var hMerged = {};
                for (var hi = 0; hi < htmlProps.style.length; hi++) {
                  var hs = htmlProps.style[hi];
                  if (hs && typeof hs === 'object') {
                    for (var hsk in hs) { if (hs.hasOwnProperty(hsk)) hMerged[hsk] = hs[hsk]; }
                  }
                }
                htmlProps.style = hMerged;
              } else if (htmlProps.style !== undefined && htmlProps.style !== null && typeof htmlProps.style !== 'object') {
                htmlProps.style = {};
              }
              var hArgs = [type, htmlProps];
              for (var hi2 = 2; hi2 < arguments.length; hi2++) hArgs.push(arguments[hi2]);
              return _origCreateElement.apply(React, hArgs);
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

        // ── 类型解包：处理 array / object 包装（支持多层递归）─────────
        // 辅助函数：判断是否为有效的 React 可渲染类型
        var _isRenderable = function(v) {
          return typeof v === 'function' || (v && typeof v === 'object' && v.$$typeof);
        };

        // 辅助函数：从对象中递归提取可渲染组件（最多 3 层）
        var _extractFromObject = function(obj, depth) {
          if (!obj || typeof obj !== 'object' || Array.isArray(obj) || depth > 3) return null;
          // 优先检查 .default
          if (obj.default && _isRenderable(obj.default)) return obj.default;
          if (obj.default && typeof obj.default === 'object') {
            var fromDefault = _extractFromObject(obj.default, depth + 1);
            if (fromDefault) return fromDefault;
          }
          // 检查 $$typeof（React 元素）
          if (obj.$$typeof) return obj;
          // 遍历所有 key，优先找函数
          var keys = Object.keys(obj);
          for (var i = 0; i < keys.length; i++) {
            if (typeof obj[keys[i]] === 'function') return obj[keys[i]];
          }
          // 再找嵌套对象中的函数
          for (var j = 0; j < keys.length; j++) {
            if (keys[j] === 'default') continue; // 已检查过
            var nested = obj[keys[j]];
            if (nested && typeof nested === 'object') {
              var found = _extractFromObject(nested, depth + 1);
              if (found) return found;
            }
          }
          return null;
        };

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

        // 对象解包（递归）
        if (__VibeRoot__ && typeof __VibeRoot__ === 'object' && !Array.isArray(__VibeRoot__) && !__VibeRoot__.$$typeof) {
          console.warn('[Vibe] __VibeRoot__ 是 object，尝试递归提取组件。keys:', Object.keys(__VibeRoot__).join(', '));
          var _extracted = _extractFromObject(__VibeRoot__, 0);
          if (_extracted) {
            console.info('[Vibe] 从 object 中提取到组件:', typeof _extracted === 'function' ? (_extracted.name || 'anonymous') : 'ReactElement');
            __VibeRoot__ = _extracted;
          }
        }

        // 降级：扫描所有局部变量，找首字母大写的函数/类组件
        if (!__VibeRoot__ || !_isRenderable(__VibeRoot__)) {
          var __candidates__ = [typeof CrudPage !== 'undefined' && CrudPage, typeof App !== 'undefined' && App, typeof Main !== 'undefined' && Main, typeof Page !== 'undefined' && Page, typeof Dashboard !== 'undefined' && Dashboard, typeof AdminDashboard !== 'undefined' && AdminDashboard, typeof Counter !== 'undefined' && Counter, typeof Home !== 'undefined' && Home, typeof Layout !== 'undefined' && Layout, typeof AdminPanel !== 'undefined' && AdminPanel, typeof ManagementSystem !== 'undefined' && ManagementSystem, typeof EcommerceDashboard !== 'undefined' && EcommerceDashboard, typeof OrderManagement !== 'undefined' && OrderManagement, typeof ProductManagement !== 'undefined' && ProductManagement, typeof UserManagement !== 'undefined' && UserManagement, typeof SystemManagement !== 'undefined' && SystemManagement, typeof BackendManagement !== 'undefined' && BackendManagement, typeof AdminSystem !== 'undefined' && AdminSystem, typeof CrudApp !== 'undefined' && CrudApp, typeof ManagementApp !== 'undefined' && ManagementApp, typeof AdminApp !== 'undefined' && AdminApp, typeof TodoApp !== 'undefined' && TodoApp, typeof ChatApp !== 'undefined' && ChatApp, typeof TaskManager !== 'undefined' && TaskManager, typeof DataTable !== 'undefined' && DataTable, typeof Calendar !== 'undefined' && Calendar, typeof Editor !== 'undefined' && Editor, typeof Viewer !== 'undefined' && Viewer, typeof Form !== 'undefined' && Form, typeof Table !== 'undefined' && Table, typeof List !== 'undefined' && List, typeof Gallery !== 'undefined' && Gallery, typeof Chart !== 'undefined' && Chart, typeof Sidebar !== 'undefined' && Sidebar, typeof Header !== 'undefined' && Header, typeof Footer !== 'undefined' && Footer, typeof Navigation !== 'undefined' && Navigation, typeof Modal !== 'undefined' && Modal, typeof Card !== 'undefined' && Card, typeof Profile !== 'undefined' && Profile, typeof Settings !== 'undefined' && Settings, typeof Login !== 'undefined' && Login, typeof Register !== 'undefined' && Register, typeof NotFound !== 'undefined' && NotFound, typeof ErrorPage !== 'undefined' && ErrorPage, typeof Landing !== 'undefined' && Landing, typeof Pricing !== 'undefined' && Pricing, typeof About !== 'undefined' && About, typeof Contact !== 'undefined' && Contact, typeof Blog !== 'undefined' && Blog, typeof Article !== 'undefined' && Article, typeof Shop !== 'undefined' && Shop, typeof Cart !== 'undefined' && Cart, typeof Checkout !== 'undefined' && Checkout, typeof Inventory !== 'undefined' && Inventory, typeof Analytics !== 'undefined' && Analytics, typeof Report !== 'undefined' && Report, typeof Monitor !== 'undefined' && Monitor, typeof Kanban !== 'undefined' && Kanban, typeof Board !== 'undefined' && Board, typeof Workspace !== 'undefined' && Workspace, typeof Studio !== 'undefined' && Studio, typeof Builder !== 'undefined' && Builder, typeof Designer !== 'undefined' && Designer, typeof Explorer !== 'undefined' && Explorer, typeof Browser !== 'undefined' && Browser, typeof Player !== 'undefined' && Player, typeof Recorder !== 'undefined' && Recorder, typeof Timer !== 'undefined' && Timer, typeof Clock !== 'undefined' && Clock, typeof Weather !== 'undefined' && Weather, typeof Map !== 'undefined' && Map, typeof Search !== 'undefined' && Search, typeof Feed !== 'undefined' && Feed, typeof Timeline !== 'undefined' && Timeline, typeof Notification !== 'undefined' && Notification, typeof Messenger !== 'undefined' && Messenger, typeof Inbox !== 'undefined' && Inbox].filter(function(c) { return typeof c === 'function'; });
          if (__candidates__.length > 0) {
            __VibeRoot__ = __candidates__[0];
            console.info('[Vibe] 降级使用候选组件:', __VibeRoot__.name || __VibeRoot__);
          }
        }

        // 最终二次校验
        if (Array.isArray(__VibeRoot__)) {
          throw new Error('组件解析结果为数组，无法渲染。请确保 export default 导出的是单个 React 组件。');
        }
        if (!__VibeRoot__ || !_isRenderable(__VibeRoot__)) {
          // 最后的兜底：如果 __VibeRoot__ 是 object，尝试将其作为 JSX 渲染（可能是 React.createElement 的返回值）
          if (__VibeRoot__ && typeof __VibeRoot__ === 'object') {
            console.warn('[Vibe] __VibeRoot__ 仍为 object，尝试包装为函数组件渲染。keys:', Object.keys(__VibeRoot__).slice(0, 5).join(', '));
            var _objRoot = __VibeRoot__;
            __VibeRoot__ = function VibeObjectWrapper() { return _objRoot; };
          } else {
            throw new Error('未找到可渲染的 React 组件（类型: ' + typeof __VibeRoot__ + '），请确保有 export default 的组件');
          }
        }

        // ── React Error Boundary（类组件，防止运行时错误白屏）──────────
        // 使用 eval 构造真正的 ES6 class（React 18 需要真正的 class 继承才能正确识别 getDerivedStateFromError）
        var VibeErrorBoundary;
        try {
          VibeErrorBoundary = eval('(class VibeErrorBoundary extends React.Component {' +
            'constructor(props) { super(props); this.state = { hasError: false, error: null }; }' +
            'static getDerivedStateFromError(error) { return { hasError: true, error: error }; }' +
            'componentDidCatch(error, info) {' +
            '  console.error("[Vibe ErrorBoundary]", error, info);' +
            '  if (typeof window.onerror === "function") { window.onerror(error.message || String(error), "", 0, 0); }' +
            '}' +
            'render() {' +
            '  if (this.state.hasError) {' +
            '    var errMsg = this.state.error ? (this.state.error.message || String(this.state.error)) : "未知错误";' +
            '    return _origCreateElement("div", { style: { padding: "24px", color: "#f87171", fontFamily: "monospace", fontSize: "13px", background: "#1a0a0a", minHeight: "100vh" } },' +
            '      _origCreateElement("strong", null, "⚠ 运行时错误"),' +
            '      _origCreateElement("br"),' +
            '      _origCreateElement("span", null, errMsg),' +
            '      _origCreateElement("br"),' +
            '      _origCreateElement("br"),' +
            '      _origCreateElement("span", { style: { color: "#94a3b8", fontSize: "11px" } }, "提示：这通常是 AI 生成的代码存在问题，请尝试重新生成或修改提示词。")' +
            '    );' +
            '  }' +
            '  return this.props.children;' +
            '}' +
          '})');
        } catch(_ebErr) {
          // eval 失败时降级为手动原型链继承
          console.warn('[Vibe] ES6 class ErrorBoundary 创建失败，降级为原型链继承:', _ebErr);
          VibeErrorBoundary = (function() {
            function EB(props) {
              React.Component.call(this, props);
              this.state = { hasError: false, error: null };
            }
            EB.prototype = Object.create(React.Component.prototype);
            EB.prototype.constructor = EB;
            EB.getDerivedStateFromError = function(error) {
              return { hasError: true, error: error };
            };
            EB.prototype.componentDidCatch = function(error, info) {
              console.error('[Vibe ErrorBoundary]', error, info);
              this.setState({ hasError: true, error: error });
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
        }

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

const ReactPreview = forwardRef<HTMLIFrameElement, ReactPreviewProps>(({ jsx, compiledJs, lang = 'zh', className = '', runtimeApiBase }, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 将内部 iframe ref 暴露给父组件（用于元素选择模式注入脚本）
  useImperativeHandle(ref, () => iframeRef.current as HTMLIFrameElement);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // 缓存编译结果，避免 runtimeApiBase 变化时重复编译
  const compiledCodeRef = useRef<string | null>(null);
  const lastJsxRef = useRef<string>('');
  const lastApiBaseRef = useRef<string>('');
  // 用于取消过期的异步编译任务
  const compileIdRef = useRef(0);

  // 组件卸载时释放最后一个 Blob URL，防止内存泄漏
  useEffect(() => {
    return () => {
      if (iframeRef.current) {
        const src = iframeRef.current.src;
        if (src?.startsWith('blob:')) URL.revokeObjectURL(src);
      }
    };
  }, []);

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

  // 用 ref 追踪最新的 runtimeApiBase，解决编译异步完成后闭包捕获旧值的问题
  const runtimeApiBaseRef = useRef(runtimeApiBase || '');
  useEffect(() => {
    runtimeApiBaseRef.current = runtimeApiBase || '';
  }, [runtimeApiBase]);

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

    // 🔧 核心优化：如果服务端已编译好代码（compiledJs），直接使用，跳过二次编译
    if (compiledJs && jsxChanged && !lastJsxRef.current) {
      // 仅在首次加载（lastJsxRef 为空）且有 compiledJs 时使用
      // 用户手动编辑代码后 compiledJs 不再适用，需要重新编译
      const latestApiBase = runtimeApiBaseRef.current;
      console.info('[ReactPreview] 使用服务端预编译代码，跳过二次编译。runtimeApiBase:', latestApiBase || '(空)');
      lastJsxRef.current = jsx;
      lastApiBaseRef.current = latestApiBase;
      compiledCodeRef.current = compiledJs;
      writeToIframe(compiledJs, latestApiBase);
      return;
    }

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

      // 🔧 关键修复：编译完成后使用 ref 获取最新的 runtimeApiBase
      // 而不是使用闭包捕获的旧值（解决 jsx 和 runtimeApiBase 同时变化时的时序问题）
      const latestApiBase = runtimeApiBaseRef.current;
      console.info('[ReactPreview] 编译完成，runtimeApiBase:', latestApiBase || '(空，将使用 Mock)', apiBase !== latestApiBase ? `(已从 "${apiBase}" 更新为 "${latestApiBase}")` : '');
      lastJsxRef.current = jsx;
      lastApiBaseRef.current = latestApiBase;
      compiledCodeRef.current = result.code;
      writeToIframe(result.code!, latestApiBase);
    }).catch((err) => {
      if (currentCompileId !== compileIdRef.current) return;
      const message = err instanceof Error ? err.message : String(err);
      console.error('[ReactPreview] 编译异常:', message);
      setCompileError(message);
      setIsLoading(false);
    });
  }, [jsx, compiledJs, runtimeApiBase, writeToIframe]);

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
});

ReactPreview.displayName = 'ReactPreview';

export default ReactPreview;
