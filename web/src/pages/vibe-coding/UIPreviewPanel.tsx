import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Monitor, RefreshCw, Maximize2, Minimize2, Play, Code2,
  Copy, Check, Sparkles,
} from 'lucide-react';
import { buildHtmlFromParts } from './utils';
import { CODE_TABS } from './constants';
import type { CodeParts, PreviewTab, CodeTab } from './types';

interface UIPreviewPanelProps {
  codeParts: CodeParts | null;
  lang: 'zh' | 'en';
  isStreaming: boolean;
  onCodePartsChange: (parts: CodeParts) => void;
}

const UIPreviewPanel = ({ codeParts, lang, isStreaming, onCodePartsChange }: UIPreviewPanelProps) => {
  const [activeTab, setActiveTab] = useState<PreviewTab>('preview');
  const [activeCodeTab, setActiveCodeTab] = useState<CodeTab>('html');
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 本地编辑状态（与父组件同步）
  const [localParts, setLocalParts] = useState<CodeParts>({ html: '', css: '', js: '' });

  useEffect(() => {
    if (!codeParts) return;
    // isFullHtml 模式：从完整 HTML 中拆分 css/js 供代码面板展示
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

  // 写入 iframe —— 使用 Blob URL 方式，让浏览器完整解析 HTML 文档
  const writeToIframe = useCallback((html: string) => {
    if (!iframeRef.current) return;
    const prevSrc = iframeRef.current.src;
    if (prevSrc && prevSrc.startsWith('blob:')) {
      URL.revokeObjectURL(prevSrc);
    }
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    iframeRef.current.src = url;
  }, []);

  // codeParts 变化时自动渲染到 iframe
  useEffect(() => {
    if (codeParts) {
      writeToIframe(buildHtmlFromParts(codeParts));
    }
  }, [codeParts, writeToIframe]);

  const handleRun = () => {
    onCodePartsChange(localParts);
    writeToIframe(buildHtmlFromParts(localParts));
    setActiveTab('preview');
  };

  const handleRefresh = () => {
    writeToIframe(buildHtmlFromParts(localParts));
  };

  const handleCopy = async () => {
    const text = activeTab === 'preview'
      ? (codeParts ? buildHtmlFromParts(codeParts) : '')
      : localParts[activeCodeTab];
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCodeChange = (tab: CodeTab, value: string) => {
    setLocalParts((prev) => ({ ...prev, [tab]: value }));
  };

  const hasContent = !!codeParts;

  return (
    <div
      className={`flex flex-col bg-gray-950 border-l border-gray-800 ${
        isFullscreen ? 'fixed inset-0 z-50' : 'flex-1 min-w-0'
      }`}
    >
      {/* 顶栏 */}
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
        </div>

        {/* 右侧操作 */}
        <div className="flex items-center gap-1">
          {isStreaming && (
            <span className="text-xs text-violet-400 flex items-center gap-1.5 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20 mr-1">
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
              {lang === 'zh' ? '生成中...' : 'Generating...'}
            </span>
          )}
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
          {hasContent && (
            <button
              className="p-1.5 text-gray-400 hover:text-gray-100 rounded-lg hover:bg-gray-800 transition-colors"
              onClick={handleCopy}
              aria-label="复制"
              tabIndex={0}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
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

      {/* 内容区 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* 预览 Tab */}
        <div className={`flex-1 overflow-hidden ${activeTab === 'preview' ? 'flex' : 'hidden'}`}>
          {hasContent ? (
            <iframe
              ref={iframeRef}
              className="w-full h-full border-0 bg-white"
              title="UI Preview"
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
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
              </div>
            </div>
          )}
        </div>

        {/* 代码 Tab */}
        <div className={`flex-1 overflow-hidden flex flex-col ${activeTab === 'code' ? 'flex' : 'hidden'}`}>
          {/* 代码子 Tab */}
          <div className="flex items-center gap-0 border-b border-gray-800 bg-gray-900 flex-shrink-0 px-3">
            {CODE_TABS.map((tab) => (
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
                  tab.key === 'css'  ? 'bg-sky-400' : 'bg-yellow-400'
                }`} />
                {tab.label}
                {localParts[tab.key] && (
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                )}
              </button>
            ))}
            <div className="ml-auto text-[10px] text-gray-500 py-2">
              {lang === 'zh' ? '编辑后点击「运行」刷新预览' : 'Edit then click "Run" to refresh'}
            </div>
          </div>

          {/* 代码编辑区 */}
          {CODE_TABS.map((tab) => (
            <div
              key={tab.key}
              className={`flex-1 overflow-hidden ${activeCodeTab === tab.key ? 'flex' : 'hidden'}`}
            >
              <textarea
                className="w-full h-full bg-gray-950 text-gray-200 text-xs font-mono p-4 resize-none outline-none border-0 leading-relaxed"
                value={localParts[tab.key]}
                onChange={(e) => handleCodeChange(tab.key, e.target.value)}
                placeholder={tab.placeholder}
                spellCheck={false}
                aria-label={`编辑 ${tab.label} 代码`}
                tabIndex={0}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UIPreviewPanel;
