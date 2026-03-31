import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import { fetchVibeApp, fetchVibeTemplate } from '../api';
import { buildHtmlFromParts } from './vibe-coding/utils';
import { compileJsx, buildReactIframeHtml } from './vibe-coding/ReactPreview';
import type { CodeParts } from './vibe-coding/types';

// 后端返回的应用数据结构
interface AppData {
  _id: string;
  title: string;
  codeParts: CodeParts;
}

const PreviewPage = () => {
  const { id } = useParams<{ id: string }>();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [appData, setAppData] = useState<AppData | null>(null);
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

  // 构建预览 HTML 并写入 iframe
  useEffect(() => {
    if (!appData || !iframeRef.current) return;

    let html: string;
    const { codeParts } = appData;

    if (codeParts.isReact && codeParts.jsx) {
      // React 模式：编译 JSX
      const compiled = compileJsx(codeParts.jsx);
      if (compiled.error) {
        setError(`JSX 编译失败：${compiled.error}`);
        return;
      }
      html = buildReactIframeHtml(compiled.code!);
    } else {
      // HTML 模式
      html = buildHtmlFromParts(codeParts);
    }

    // 使用 srcdoc 写入 iframe，避免 blob URL 问题
    iframeRef.current.srcdoc = html;
  }, [appData]);

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
