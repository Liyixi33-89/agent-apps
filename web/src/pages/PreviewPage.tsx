import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import { fetchVibeApp, fetchVibeTemplate, fetchVibeAppRuntimeStatus } from '../api';
import { buildHtmlFromParts } from './vibe-coding/utils';
import { compileJsx, buildReactIframeHtml } from './vibe-coding/ReactPreview';
import type { CodeParts } from './vibe-coding/types';

// 后端返回的应用数据结构
interface AppData {
  _id: string;
  title: string;
  codeParts: CodeParts;
  isFullStack?: boolean;
  deployPath?: string;
}

const PreviewPage = () => {
  const { id } = useParams<{ id: string }>();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [appData, setAppData] = useState<AppData | null>(null);
  const [runtimeApiBase, setRuntimeApiBase] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 从后端 API 加载应用数据
  useEffect(() => {
    if (!id) {
      setError('缺少应用 ID');
      setLoading(false);
      return;
    }

    // 先尝试从 apps 接口获取，失败则尝试 templates 接口
    fetchVibeApp(id)
      .then((result) => {
        setAppData(result as unknown as AppData);
      })
      .catch(() => {
        // 可能是模板市场的 ID，尝试 templates 接口
        return fetchVibeTemplate(id).then((result) => {
          setAppData(result as unknown as AppData);
        });
      })
      .catch((err) => {
        console.error('加载应用失败:', err);
        setError('未找到该应用，可能已被删除');
      })
      .finally(() => setLoading(false));
  }, [id]);

  // 全栈应用：查询部署状态，获取 runtimeApiBase
  useEffect(() => {
    if (!appData || !id) return;

    // 如果数据库中已有 deployPath，直接使用
    if (appData.deployPath) {
      setRuntimeApiBase(appData.deployPath);
      return;
    }

    // 全栈应用：查询运行时部署状态
    if (appData.isFullStack) {
      fetchVibeAppRuntimeStatus(id)
        .then((status) => {
          if (status.deployed && status.basePath) {
            setRuntimeApiBase(status.basePath);
          }
        })
        .catch((err) => {
          console.warn('查询部署状态失败（将使用 Mock 模式）:', err);
        });
    }
  }, [appData, id]);

  // 构建预览 HTML 并写入 iframe（异步编译）
  useEffect(() => {
    if (!appData || !iframeRef.current) return;
    // 全栈应用等待 runtimeApiBase 就绪（deployPath 存在或已查询部署状态）
    // 非全栈应用不需要等待
    if (appData.isFullStack && !runtimeApiBase && appData.deployPath) return;

    const { codeParts } = appData;

    // 写入 iframe 的通用函数
    const writeHtml = (html: string) => {
      if (!iframeRef.current) return;
      const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
      const prevSrc = iframeRef.current.src;
      if (prevSrc?.startsWith('blob:')) URL.revokeObjectURL(prevSrc);
      iframeRef.current.src = URL.createObjectURL(blob);
    };

    if (codeParts.isReact && codeParts.jsx) {
      // React 模式：异步编译 JSX，传入 runtimeApiBase
      let cancelled = false;
      compileJsx(codeParts.jsx).then((compiled) => {
        if (cancelled) return;
        if (compiled.error) {
          setError(`JSX 编译失败：${compiled.error}`);
          return;
        }
        const html = buildReactIframeHtml(compiled.code!, { runtimeApiBase });
        writeHtml(html);
      }).catch((err) => {
        if (cancelled) return;
        setError(`JSX 编译异常：${err instanceof Error ? err.message : String(err)}`);
      });
      // cleanup：如果 effect 重新执行，取消上一次的异步编译
      return () => { cancelled = true; };
    } else {
      // HTML 模式（同步）
      writeHtml(buildHtmlFromParts(codeParts));
    }
  }, [appData, runtimeApiBase]);

  // 加载中状态
  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          <p className="text-sm text-gray-400">加载应用中...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error || !appData) {
    return (
      <div className="fixed inset-0 bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">无法加载应用</h2>
          <p className="text-sm text-gray-400">{error || '未知错误'}</p>
          <a
            className="mt-2 flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors"
            href="/vibe"
            tabIndex={0}
            aria-label="返回 Vibe Coding"
          >
            返回 Vibe Coding
          </a>
        </div>
      </div>
    );
  }

  // 正常预览 — 全屏 iframe
  return (
    <div className="fixed inset-0 bg-white">
      <iframe
        ref={iframeRef}
        className="w-full h-full border-none"
        title={appData.title}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
      />
    </div>
  );
};

export default PreviewPage;
