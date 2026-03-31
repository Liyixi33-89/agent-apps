import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  Monitor, RefreshCw, Maximize2, Minimize2, Play, Code2,
  Copy, Check, Sparkles, Smartphone, Download,
  ImagePlus, X, Globe, MousePointer2, MousePointerClick, Crosshair, Atom,
} from 'lucide-react';
import { buildHtmlFromParts } from './utils';
import { CODE_TABS, REACT_CODE_TABS } from './constants';
import ReactPreview from './ReactPreview';
import type { CodeParts, PreviewTab, CodeTab } from './types';

// 懒加载 Monaco Editor，避免影响首屏
const MonacoEditor = lazy(() => import('@monaco-editor/react'));

// 移动端预览宽度
const MOBILE_WIDTH = 390;

const MONACO_LANG: Record<CodeTab, string> = {
  html: 'html',
  css:  'css',
  js:   'javascript',
  jsx:  'javascript',
};

// ─── 选中元素信息 ────────────────────────────────────────────────────────────

export interface SelectedElementInfo {
  tagName: string;       // 如 div、button、h1
  id: string;            // 元素 id（可能为空）
  classList: string[];   // class 列表
  textContent: string;   // 截断后的文本内容
  outerHTML: string;     // 截断后的 outerHTML
  selector: string;      // 最优 CSS 选择器
  styles: Record<string, string>; // 关键内联/计算样式
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface UIPreviewPanelProps {
  codeParts: CodeParts | null;
  prevCodeParts: CodeParts | null;
  lang: 'zh' | 'en';
  isStreaming: boolean;
  isFromPreviousSession?: boolean;
  uploadedImage?: string | null;       // base64 图片（来自父组件）
  isReactMode?: boolean;               // React 模式（由父组件控制）
  onReactModeChange?: (val: boolean) => void; // 切换 React 模式回调
  onCodePartsChange: (parts: CodeParts) => void;
  onClearPreview?: () => void;
  onImageUpload?: (base64: string) => void;
  onImageClear?: () => void;
  onPublish?: () => void;              // 发布到模板市场
  onElementSelect?: (info: SelectedElementInfo) => void; // 选中元素回调
}

// ─── 组件 ─────────────────────────────────────────────────────────────────────

const UIPreviewPanel = ({
  codeParts,
  prevCodeParts,
  lang,
  isStreaming,
  isFromPreviousSession = false,
  uploadedImage,
  isReactMode: isReactModeProp = false,
  onReactModeChange,
  onCodePartsChange,
  onClearPreview,
  onImageUpload,
  onImageClear,
  onPublish,
  onElementSelect,
}: UIPreviewPanelProps) => {
  const [activeTab, setActiveTab] = useState<PreviewTab>('preview');
  const [activeCodeTab, setActiveCodeTab] = useState<CodeTab>('html');
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeError, setIframeError] = useState<string | null>(null);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // 元素选择模式
  const [selectMode, setSelectMode] = useState(false);
  const [selectedEl, setSelectedEl] = useState<SelectedElementInfo | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const historyIframeRef = useRef<HTMLIFrameElement>(null);
  const [historyIframeLoading, setHistoryIframeLoading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // 本地编辑状态（与父组件同步）
  const [localParts, setLocalParts] = useState<CodeParts>({ html: '', css: '', js: '' });

  // React 模式：父组件传入的 prop 优先，其次是 AI 返回的 isReact 标记
  const isReactMode = isReactModeProp || !!(codeParts?.isReact || localParts?.isReact);

  // 切换 React 模式：通知父组件
  const handleToggleReactMode = () => {
    const next = !isReactMode;
    onReactModeChange?.(next);
    setActiveCodeTab(next ? 'jsx' : 'html');
  };

  useEffect(() => {
    if (!codeParts) return;
    // React 模式：直接同步 jsx 字段
    if (codeParts.isReact) {
      setLocalParts(codeParts);
      setActiveCodeTab('jsx');
      return;
    }
    if (codeParts.isFullHtml && codeParts.html) {
      const styleMatch = codeParts.html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      const scriptContents: string[] = [];
      const scriptRegex = /<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;
      let m: RegExpExecArray | null;
      while ((m = scriptRegex.exec(codeParts.html)) !== null) {
        if (m[1].trim()) scriptContents.push(m[1].trim());
      }
      setLocalParts({
        html: codeParts.html,
        css: styleMatch?.[1]?.trim() ?? '',
        js: scriptContents.join('\n\n'),
        isFullHtml: true,
      });
    } else {
      setLocalParts(codeParts);
    }
  }, [codeParts]);

  // ─── 元素选择模式：向 iframe 注入选择脚本 ──────────────────────────────────

  /** 构建注入到 iframe 的选择器脚本 */
  const buildSelectorScript = useCallback(() => `
    (function() {
      if (window.__vibeSelectMode) return;
      window.__vibeSelectMode = true;

      const HIGHLIGHT_ID = '__vibe_highlight__';
      const OVERLAY_ID   = '__vibe_overlay__';

      // 半透明遮罩（阻止 iframe 内部点击穿透到真实交互）
      let overlay = document.getElementById(OVERLAY_ID);
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;cursor:crosshair;';
        document.body.appendChild(overlay);
      }

      // 高亮框
      let highlight = document.getElementById(HIGHLIGHT_ID);
      if (!highlight) {
        highlight = document.createElement('div');
        highlight.id = HIGHLIGHT_ID;
        highlight.style.cssText = [
          'position:fixed',
          'pointer-events:none',
          'z-index:2147483647',
          'border:2px solid #7c3aed',
          'background:rgba(124,58,237,0.08)',
          'border-radius:3px',
          'transition:all 0.08s ease',
          'box-shadow:0 0 0 1px rgba(124,58,237,0.3)',
        ].join(';');
        document.body.appendChild(highlight);
      }

      let hoveredEl = null;

      const getSelector = (el) => {
        if (el.id) return '#' + el.id;
        const tag = el.tagName.toLowerCase();
        const classes = Array.from(el.classList).slice(0, 3).join('.');
        return classes ? tag + '.' + classes : tag;
      };

      const getKeyStyles = (el) => {
        const cs = window.getComputedStyle(el);
        return {
          color: cs.color,
          backgroundColor: cs.backgroundColor,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          padding: cs.padding,
          margin: cs.margin,
          borderRadius: cs.borderRadius,
          display: cs.display,
          width: cs.width,
          height: cs.height,
        };
      };

      overlay.addEventListener('mousemove', (e) => {
        overlay.style.pointerEvents = 'none';
        const real = document.elementFromPoint(e.clientX, e.clientY);
        overlay.style.pointerEvents = '';
        if (!real || real === highlight || real === overlay) return;
        hoveredEl = real;
        const rect = real.getBoundingClientRect();
        highlight.style.left   = rect.left   + 'px';
        highlight.style.top    = rect.top    + 'px';
        highlight.style.width  = rect.width  + 'px';
        highlight.style.height = rect.height + 'px';
        highlight.style.display = 'block';
      });

      overlay.addEventListener('mouseleave', () => {
        highlight.style.display = 'none';
        hoveredEl = null;
      });

      overlay.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        overlay.style.pointerEvents = 'none';
        const real = document.elementFromPoint(e.clientX, e.clientY);
        overlay.style.pointerEvents = '';
        if (!real || real === highlight || real === overlay) return;

        const info = {
          tagName: real.tagName.toLowerCase(),
          id: real.id || '',
          classList: Array.from(real.classList),
          textContent: (real.textContent || '').trim().slice(0, 120),
          outerHTML: real.outerHTML.slice(0, 400),
          selector: getSelector(real),
          styles: getKeyStyles(real),
        };

        // 固定高亮框（变为实线选中态）
        highlight.style.border = '2px solid #7c3aed';
        highlight.style.background = 'rgba(124,58,237,0.12)';
        highlight.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.25)';

        window.parent.postMessage({ type: '__vibe_element_selected__', info }, '*');
      });
    })();
  `, []);

  /** 移除 iframe 内注入的选择器脚本 */
  const removeSelectorScript = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    try {
      const doc = iframe.contentDocument;
      if (!doc) return;
      doc.getElementById('__vibe_overlay__')?.remove();
      doc.getElementById('__vibe_highlight__')?.remove();
      (iframe.contentWindow as any).__vibeSelectMode = false;
    } catch { /* 跨域时忽略 */ }
  }, []);

  /** 切换选择模式 */
  const handleToggleSelectMode = useCallback(() => {
    setSelectMode((prev) => {
      const next = !prev;
      if (!next) {
        removeSelectorScript();
        setSelectedEl(null);
      }
      return next;
    });
  }, [removeSelectorScript]);

  /** 监听 iframe postMessage */
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type !== '__vibe_element_selected__') return;
      const info = e.data.info as SelectedElementInfo;
      setSelectedEl(info);
      onElementSelect?.(info);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelect]);

  /** selectMode 开启时，iframe 加载完成后注入脚本 */
  useEffect(() => {
    if (!selectMode) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    const inject = () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (iframe.contentWindow as any)?.eval(buildSelectorScript());
      } catch { /* 忽略 */ }
    };
    // 如果 iframe 已加载则立即注入，否则等 onLoad
    if (iframe.contentDocument?.readyState === 'complete') inject();
    iframe.addEventListener('load', inject);
    return () => iframe.removeEventListener('load', inject);
  }, [selectMode, buildSelectorScript]);

  // 切换 selectMode 时重置选中
  useEffect(() => {
    if (!selectMode) setSelectedEl(null);
  }, [selectMode]);

  // ─── 写入 iframe —— Blob URL 方式 ────────────────────────────────────────────

  // 写入 iframe —— Blob URL 方式
  const writeToIframe = useCallback((html: string) => {
    if (!iframeRef.current) return;
    const prevSrc = iframeRef.current.src;
    if (prevSrc?.startsWith('blob:')) URL.revokeObjectURL(prevSrc);
    setIframeError(null);
    setIframeLoading(true);
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
    iframeRef.current.src = URL.createObjectURL(blob);
  }, []);

  // codeParts 变化时自动渲染（非 React 模式），并重置选中状态
  useEffect(() => {
    if (codeParts && !codeParts.isReact) {
      writeToIframe(buildHtmlFromParts(codeParts));
      setSelectedEl(null);
    }
  }, [codeParts, writeToIframe]);

  // Mobile / Desktop 切换时，新 iframe 节点挂载后重新写入内容（非 React 模式）
  useEffect(() => {
    if (codeParts && !codeParts.isReact) writeToIframe(buildHtmlFromParts(codeParts));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  // prevCodeParts 变化时写入历史 iframe
  useEffect(() => {
    if (!prevCodeParts || !historyIframeRef.current) return;
    const blob = new Blob([buildHtmlFromParts(prevCodeParts)], { type: 'text/html; charset=utf-8' });
    setHistoryIframeLoading(true);
    historyIframeRef.current.src = URL.createObjectURL(blob);
  }, [prevCodeParts]);

  // isFromPreviousSession 变为 true 时自动切换到历史 Tab
  useEffect(() => {
    if (isFromPreviousSession) setActiveTab('history');
  }, [isFromPreviousSession]);

  // ─── 操作 ──────────────────────────────────────────────────────────────────

  const handleRun = () => {
    onCodePartsChange(localParts);
    if (!localParts.isReact) writeToIframe(buildHtmlFromParts(localParts));
    setActiveTab('preview');
  };

  const handleRefresh = () => {
    if (localParts.isReact) {
      // React 模式：强制触发重新渲染（通过更新 codeParts 触发 ReactPreview）
      onCodePartsChange({ ...localParts });
    } else {
      writeToIframe(buildHtmlFromParts(localParts));
    }
  };

  const handleCopy = async () => {
    let text = '';
    if (activeTab === 'history') {
      text = prevCodeParts ? buildHtmlFromParts(prevCodeParts) : '';
    } else if (activeTab === 'preview') {
      text = codeParts
        ? (codeParts.isReact ? (codeParts.jsx ?? '') : buildHtmlFromParts(codeParts))
        : '';
    } else {
      // 代码 Tab：取当前激活的子 Tab 内容
      text = (localParts[activeCodeTab as keyof typeof localParts] as string) ?? '';
    }
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (isReactMode && codeParts?.jsx) {
      // React 模式：下载 JSX 文件
      const blob = new Blob([codeParts.jsx], { type: 'text/plain; charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vibe-component-${Date.now()}.jsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      return;
    }
    const html =
      activeTab === 'history' && prevCodeParts
        ? buildHtmlFromParts(prevCodeParts)
        : codeParts
        ? buildHtmlFromParts(codeParts)
        : null;
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vibe-ui-${Date.now()}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  };

  const handleOpenExternal = () => {
    const html =
      activeTab === 'history' && prevCodeParts
        ? buildHtmlFromParts(prevCodeParts)
        : codeParts
        ? buildHtmlFromParts(codeParts)
        : null;
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleCodeChange = (tab: CodeTab, value: string) => {
    setLocalParts((prev) => ({ ...prev, [tab]: value }));
  };

  // 图片上传处理
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      onImageUpload?.(base64);
    };
    reader.readAsDataURL(file);
    // 重置 input，允许重复上传同一文件
    e.target.value = '';
  };

  const hasContent = !!codeParts;
  const hasHistory = isFromPreviousSession && !!prevCodeParts;

  return (
    <div
      className={`flex flex-col bg-gray-950 border-l border-gray-800 ${
        isFullscreen ? 'fixed inset-0 z-50' : 'flex-1 min-w-0'
      }`}
    >
      {/* ── 顶栏 ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 flex-shrink-0 bg-gray-900">
        {/* 主 Tab */}
        <div className="flex items-center gap-1 bg-gray-800/80 rounded-lg p-0.5">
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'preview' ? 'bg-violet-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setActiveTab('preview')}
            aria-label="预览 UI"
            tabIndex={0}
          >
            <Monitor className="w-3.5 h-3.5" />
            {lang === 'zh' ? '预览' : 'Preview'}
          </button>
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'code' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setActiveTab('code')}
            aria-label="查看代码"
            tabIndex={0}
          >
            <Code2 className="w-3.5 h-3.5" />
            {lang === 'zh' ? '代码' : 'Code'}
          </button>

          {/* 历史预览 Tab */}
          {hasHistory && (
            <div className={`flex items-center rounded-md transition-all ${
              activeTab === 'history'
                ? 'bg-amber-500/20 ring-1 ring-amber-500/30'
                : 'hover:bg-gray-700/50'
            }`}>
              <button
                className={`flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 text-xs font-medium transition-all ${
                  activeTab === 'history' ? 'text-amber-300' : 'text-amber-500/70 hover:text-amber-400'
                }`}
                onClick={() => setActiveTab('history')}
                aria-label={lang === 'zh' ? '历史预览' : 'History preview'}
                tabIndex={0}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                {lang === 'zh' ? '历史' : 'History'}
              </button>
              <button
                className={`p-1 mr-0.5 rounded transition-colors ${
                  activeTab === 'history'
                    ? 'text-amber-400/70 hover:text-amber-200 hover:bg-amber-500/20'
                    : 'text-amber-500/40 hover:text-amber-400 hover:bg-gray-700'
                }`}
                onClick={(e) => { e.stopPropagation(); onClearPreview?.(); setActiveTab('preview'); }}
                aria-label={lang === 'zh' ? '关闭历史预览' : 'Close history'}
                tabIndex={0}
                title={lang === 'zh' ? '关闭历史预览' : 'Close history'}
              >
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M2 2l8 8M10 2l-8 8" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* 右侧操作区 */}
        <div className="flex items-center gap-1">
          {isStreaming && (
            <span className="text-xs text-violet-400 flex items-center gap-1.5 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20 mr-1">
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
              {lang === 'zh' ? '生成中...' : 'Generating...'}
            </span>
          )}

          {/* React 模式切换按钮（始终显示） */}
          <button
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all mr-1 ${
              isReactMode
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30'
                : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800 border border-gray-700/40'
            }`}
            onClick={handleToggleReactMode}
            tabIndex={0}
            aria-label={lang === 'zh' ? '切换 React 模式' : 'Toggle React mode'}
            title={lang === 'zh' ? (isReactMode ? '当前：React 模式（点击切换为 HTML 模式）' : '当前：HTML 模式（点击切换为 React 模式）') : (isReactMode ? 'React mode (click to switch to HTML)' : 'HTML mode (click to switch to React)')}
          >
            <Atom className="w-3.5 h-3.5" />
            React
          </button>

          {/* 元素选择模式按钮（仅预览 Tab 显示） */}
          {activeTab === 'preview' && hasContent && (
            <button
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all mr-1 ${
                selectMode
                  ? 'bg-violet-600 text-white shadow-sm ring-1 ring-violet-400/40'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800 border border-gray-700/40'
              }`}
              onClick={handleToggleSelectMode}
              tabIndex={0}
              aria-label={lang === 'zh' ? '元素选择模式' : 'Element select mode'}
              title={lang === 'zh' ? '开启后点击页面元素，可将其交给 AI 修改' : 'Click elements to select and ask AI to modify'}
            >
              {selectMode
                ? <MousePointerClick className="w-3.5 h-3.5" />
                : <MousePointer2 className="w-3.5 h-3.5" />}
              {lang === 'zh' ? (selectMode ? '选择中' : '选元素') : (selectMode ? 'Selecting' : 'Select')}
            </button>
          )}

          {/* Mobile / Desktop 切换（仅预览 Tab 显示） */}
          {activeTab === 'preview' && hasContent && (
            <div className="flex items-center gap-0.5 bg-gray-800/60 rounded-lg p-0.5 mr-1">
              <button
                className={`p-1.5 rounded-md transition-all ${
                  !isMobile ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
                onClick={() => setIsMobile(false)}
                tabIndex={0}
                aria-label="Desktop"
                title="Desktop"
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
              <button
                className={`p-1.5 rounded-md transition-all ${
                  isMobile ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
                onClick={() => setIsMobile(true)}
                tabIndex={0}
                aria-label="Mobile (390px)"
                title="Mobile (390px)"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 图片上传按钮（Vision 参考图） */}
          {onImageUpload && (
            <>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageFileChange}
                aria-label="上传参考图"
              />
              <button
                className={`p-1.5 rounded-lg transition-colors ${
                  uploadedImage
                    ? 'text-violet-400 bg-violet-500/15 border border-violet-500/30'
                    : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
                }`}
                onClick={() => imageInputRef.current?.click()}
                tabIndex={0}
                aria-label={lang === 'zh' ? '上传参考图' : 'Upload reference image'}
                title={lang === 'zh' ? '上传参考图（Vision 模式）' : 'Upload reference image (Vision mode)'}
              >
                <ImagePlus className="w-3.5 h-3.5" />
              </button>
              {uploadedImage && onImageClear && (
                <button
                  className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                  onClick={onImageClear}
                  tabIndex={0}
                  aria-label={lang === 'zh' ? '清除参考图' : 'Clear image'}
                  title={lang === 'zh' ? '清除参考图' : 'Clear image'}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}

          {/* 代码 Tab 运行按钮 */}
          {activeTab === 'code' && hasContent && (
            <button
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
              onClick={handleRun}
              aria-label="运行代码"
              tabIndex={0}
            >
              <Play className="w-3 h-3" />
              {lang === 'zh' ? '运行' : 'Run'}
            </button>
          )}

          {/* 刷新 */}
          {activeTab === 'preview' && hasContent && (
            <button
              className="p-1.5 text-gray-400 hover:text-gray-100 rounded-lg hover:bg-gray-800 transition-colors"
              onClick={handleRefresh}
              aria-label="刷新预览"
              tabIndex={0}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* 复制 */}
          {(hasContent || (activeTab === 'history' && hasHistory)) && (
            <button
              className="p-1.5 text-gray-400 hover:text-gray-100 rounded-lg hover:bg-gray-800 transition-colors"
              onClick={handleCopy}
              aria-label="复制"
              tabIndex={0}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* 下载 HTML */}
          {(hasContent || (activeTab === 'history' && hasHistory)) && (
            <button
              className="p-1.5 text-gray-400 hover:text-gray-100 rounded-lg hover:bg-gray-800 transition-colors"
              onClick={handleDownload}
              aria-label={lang === 'zh' ? '下载 HTML' : 'Download HTML'}
              title={lang === 'zh' ? '下载 HTML 文件' : 'Download HTML'}
              tabIndex={0}
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

          {/* 发布到模板市场 */}
          {hasContent && onPublish && (
            <button
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white text-xs font-medium transition-all border border-emerald-500/30 hover:border-emerald-500"
              onClick={onPublish}
              tabIndex={0}
              aria-label={lang === 'zh' ? '发布到模板市场' : 'Publish to market'}
              title={lang === 'zh' ? '发布到模板市场' : 'Publish to market'}
            >
              <Globe className="w-3.5 h-3.5" />
              {lang === 'zh' ? '发布' : 'Publish'}
            </button>
          )}

          {/* 全屏 */}
          <button
            className="p-1.5 text-gray-400 hover:text-gray-100 rounded-lg hover:bg-gray-800 transition-colors"
            onClick={() => setIsFullscreen((f) => !f)}
            aria-label={isFullscreen ? '退出全屏' : '全屏预览'}
            tabIndex={0}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ── 参考图预览条 ──────────────────────────────────────────────────── */}
      {uploadedImage && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/8 border-b border-violet-500/15 flex-shrink-0">
          <img src={uploadedImage} alt="参考图" className="w-8 h-8 rounded-md object-cover border border-violet-500/20" />
          <span className="text-[11px] text-violet-400/80 flex-1">
            {lang === 'zh' ? '已上传参考图，AI 将参考此图生成 UI' : 'Reference image uploaded, AI will use it'}
          </span>
          {onImageClear && (
            <button
              className="text-[11px] text-violet-400/60 hover:text-violet-300 transition-colors px-1.5 py-0.5 rounded hover:bg-violet-500/10"
              onClick={onImageClear}
              tabIndex={0}
              aria-label="清除参考图"
            >
              {lang === 'zh' ? '清除' : 'Clear'}
            </button>
          )}
        </div>
      )}

      {/* ── 内容区 ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {/* 历史预览 Tab */}
        <div className={`flex-1 overflow-hidden ${activeTab === 'history' ? 'flex' : 'hidden'}`}>
          {hasHistory ? (
            <div className="relative w-full h-full">
              <iframe
                ref={historyIframeRef}
                className="w-full h-full border-0 bg-white"
                title="History Preview"
                sandbox="allow-scripts allow-same-origin"
                onLoad={() => setHistoryIframeLoading(false)}
              />
              {historyIframeLoading && (
                <div className="absolute inset-0 bg-gray-950/80 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    {lang === 'zh' ? '渲染中...' : 'Rendering...'}
                  </div>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gray-950/85 border-t border-amber-500/15 px-3 py-1.5 flex items-center gap-2 pointer-events-none">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60 flex-shrink-0" />
                <span className="text-[10px] text-amber-400/60">
                  {lang === 'zh' ? '上一次会话的预览（只读）' : 'Previous session preview (read-only)'}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {/* 预览 Tab */}
        <div className={`flex-1 overflow-hidden ${activeTab === 'preview' ? 'flex' : 'hidden'}`}>
          {hasContent ? (
            <div className="relative w-full h-full flex items-center justify-center bg-gray-950 overflow-auto">
              {/* 设备容器 */}
              {isReactMode ? (
                /* React 模式：直接渲染 ReactPreview */
                isMobile ? (
                  <div className="flex-shrink-0 flex flex-col items-center py-6 h-full">
                    <div
                      className="relative flex flex-col bg-gray-900 rounded-[2.5rem] shadow-2xl border-2 border-gray-700/80 overflow-hidden"
                      style={{ width: MOBILE_WIDTH, height: '100%', maxHeight: 780 }}
                    >
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-gray-900 rounded-b-2xl z-10 flex items-center justify-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-700" />
                        <span className="w-8 h-1 rounded-full bg-gray-700" />
                      </div>
                      <div className="flex-1 overflow-hidden mt-5">
                        <ReactPreview jsx={codeParts?.jsx ?? ''} lang={lang} className="w-full h-full" />
                      </div>
                      <div className="flex-shrink-0 h-6 flex items-center justify-center bg-gray-900">
                        <span className="w-24 h-1 rounded-full bg-gray-700" />
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] text-gray-600">Mobile · {MOBILE_WIDTH}px</p>
                  </div>
                ) : (
                  <ReactPreview jsx={codeParts?.jsx ?? ''} lang={lang} className="w-full h-full" />
                )
              ) : isMobile ? (
                /* 手机外框 */
                <div className="flex-shrink-0 flex flex-col items-center py-6 h-full">
                  <div
                    className="relative flex flex-col bg-gray-900 rounded-[2.5rem] shadow-2xl border-2 border-gray-700/80 overflow-hidden"
                    style={{ width: MOBILE_WIDTH, height: '100%', maxHeight: 780 }}
                  >
                    {/* 刘海 */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-gray-900 rounded-b-2xl z-10 flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-700" />
                      <span className="w-8 h-1 rounded-full bg-gray-700" />
                    </div>
                    <iframe
                      ref={iframeRef}
                      className="flex-1 border-0 bg-white mt-5"
                      title="UI Preview Mobile"
                      sandbox="allow-scripts allow-same-origin"
                      onLoad={() => setIframeLoading(false)}
                      onError={() => {
                        setIframeLoading(false);
                        setIframeError(lang === 'zh' ? '预览加载失败' : 'Preview failed to load');
                      }}
                    />
                    {/* 底部 Home 条 */}
                    <div className="flex-shrink-0 h-6 flex items-center justify-center bg-gray-900">
                      <span className="w-24 h-1 rounded-full bg-gray-700" />
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-gray-600">Mobile · {MOBILE_WIDTH}px</p>
                </div>
              ) : (
                /* 桌面全宽 */
                <div className="w-full h-full">
                  <iframe
                  ref={iframeRef}
                    className="w-full h-full border-0 bg-white"
                    title="UI Preview"
                    sandbox="allow-scripts allow-same-origin"
                    onLoad={() => setIframeLoading(false)}
                    onError={() => {
                      setIframeLoading(false);
                      setIframeError(lang === 'zh' ? '预览加载失败' : 'Preview failed to load');
                    }}
                  />
                </div>
              )}

              {/* 加载遮罩 */}
              {iframeLoading && (
                <div className="absolute inset-0 bg-gray-950/80 flex items-center justify-center pointer-events-none">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    {lang === 'zh' ? '渲染中...' : 'Rendering...'}
                  </div>
                </div>
              )}

              {/* 错误提示条 */}
              {iframeError && (
                <div className="absolute bottom-0 left-0 right-0 bg-red-950/90 border-t border-red-800/60 px-3 py-2 flex items-center gap-2">
                  <span className="text-red-400 text-xs">⚠ {iframeError}</span>
                  <button
                    className="ml-auto text-[10px] text-red-400 hover:text-red-200 underline"
                    onClick={() => { setIframeError(null); handleRefresh(); }}
                    tabIndex={0}
                    aria-label="重试"
                  >
                    {lang === 'zh' ? '重试' : 'Retry'}
                  </button>
                </div>
              )}

              {/* 选择模式提示条 */}
              {selectMode && !selectedEl && (
                <div className="absolute top-0 left-0 right-0 flex items-center justify-center gap-2 py-2 bg-violet-900/80 border-b border-violet-500/30 pointer-events-none">
                  <Crosshair className="w-3.5 h-3.5 text-violet-300 animate-pulse" />
                  <span className="text-xs text-violet-200">
                    {lang === 'zh' ? '点击页面中的任意元素来选中它' : 'Click any element on the page to select it'}
                  </span>
                </div>
              )}

              {/* 已选中元素信息条 */}
              {selectMode && selectedEl && (
                <div className="absolute bottom-0 left-0 right-0 bg-gray-950/95 border-t border-violet-500/30 px-3 py-2.5 flex items-center gap-2.5 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="flex-shrink-0 px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 text-[10px] font-mono font-semibold">
                      {selectedEl.selector}
                    </span>
                    {selectedEl.textContent && (
                      <span className="text-xs text-gray-400 truncate">
                        "{selectedEl.textContent.slice(0, 40)}{selectedEl.textContent.length > 40 ? '…' : ''}"
                      </span>
                    )}
                  </div>
                  <button
                    className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors"
                    onClick={() => onElementSelect?.(selectedEl)}
                    tabIndex={0}
                    aria-label="将选中元素发送给 AI"
                  >
                    <MousePointerClick className="w-3 h-3" />
                    {lang === 'zh' ? '问 AI' : 'Ask AI'}
                  </button>
                  <button
                    className="flex-shrink-0 p-1 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
                    onClick={() => setSelectedEl(null)}
                    tabIndex={0}
                    aria-label="取消选中"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* 空状态 */
            <div className="flex flex-col items-center justify-center w-full h-full gap-6 p-8">
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500/10 to-sky-500/10 flex items-center justify-center border border-violet-500/15">
                  <Monitor className="w-9 h-9 text-violet-500/35" />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center">
                  <Sparkles className="w-2.5 h-2.5 text-violet-400/60" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm font-semibold text-gray-400">
                  {lang === 'zh' ? 'UI 实时预览' : 'Live UI Preview'}
                </p>
                <p className="text-xs text-gray-600 max-w-xs leading-relaxed">
                  {lang === 'zh'
                    ? '在左侧描述你想要的界面，AI 将生成可交互的 UI 并在此处实时渲染'
                    : 'Describe your UI on the left, AI will generate and render it here'}
                </p>
              </div>
              <div className="flex items-center gap-5 text-[11px] text-gray-600 bg-gray-900/50 rounded-xl px-4 py-2.5 border border-gray-800/60">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-orange-500/50 rounded-full" />HTML</span>
                <span className="w-px h-3 bg-gray-800" />
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-sky-500/50 rounded-full" />CSS</span>
                <span className="w-px h-3 bg-gray-800" />
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-yellow-500/50 rounded-full" />JavaScript</span>
                <span className="w-px h-3 bg-gray-800" />
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-cyan-500/50 rounded-full" />React JSX</span>
              </div>
            </div>
          )}
        </div>

        {/* 代码 Tab —— Monaco Editor */}
        <div className={`flex-1 overflow-hidden flex flex-col ${activeTab === 'code' ? 'flex' : 'hidden'}`}>
          {/* 代码子 Tab */}
          <div className="flex items-center gap-0 border-b border-gray-800 bg-gray-900 flex-shrink-0 px-3">
            {(isReactMode ? REACT_CODE_TABS : CODE_TABS).map((tab) => (
              <button
                key={tab.key}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${
                  activeCodeTab === tab.key
                    ? `border-current ${tab.color} bg-gray-800/40`
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
                onClick={() => setActiveCodeTab(tab.key)}
                aria-label={`${tab.label} 代码`}
                tabIndex={0}
              >
                <span className={`w-2 h-2 rounded-full ${
                  tab.key === 'html' ? 'bg-orange-400' :
                  tab.key === 'css'  ? 'bg-sky-400' :
                  tab.key === 'jsx'  ? 'bg-cyan-400' : 'bg-yellow-400'
                }`} />
                {tab.label}
                {localParts[tab.key as keyof typeof localParts] && (
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                )}
              </button>
            ))}
            {/* React 模式标识 */}
            {isReactMode && (
              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 font-medium">
                React
              </span>
            )}
            <div className="ml-auto text-[10px] text-gray-500 py-2">
              {lang === 'zh' ? '编辑后点击「运行」刷新预览' : 'Edit then click "Run" to refresh'}
            </div>
          </div>

          {/* Monaco 编辑器 */}
          {(isReactMode ? REACT_CODE_TABS : CODE_TABS).map((tab) => (
            <div
              key={tab.key}
              className={`flex-1 overflow-hidden ${activeCodeTab === tab.key ? 'flex' : 'hidden'}`}
            >
              <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center bg-gray-950">
                  <span className="text-xs text-gray-500">{lang === 'zh' ? '加载编辑器...' : 'Loading editor...'}</span>
                </div>
              }>
                <MonacoEditor
                  height="100%"
                  language={MONACO_LANG[tab.key]}
                  value={localParts[tab.key as keyof typeof localParts] as string ?? ''}
                  onChange={(val) => handleCodeChange(tab.key, val ?? '')}
                  theme="vs-dark"
                  options={{
                    fontSize: 13,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    folding: true,
                    automaticLayout: true,
                    tabSize: 2,
                    formatOnPaste: true,
                    padding: { top: 12, bottom: 12 },
                  }}
                />
              </Suspense>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UIPreviewPanel;
