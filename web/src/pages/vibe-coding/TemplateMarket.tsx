import { useState, useEffect, useCallback } from 'react';
import { Store, Eye, Heart, Globe, X, Search, Tag, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { fetchVibeTemplates, fetchVibeTemplate } from '../../api';
import { buildHtmlFromParts } from './utils';
import type { VibeTemplateDetail, VibeTemplateItem } from '../../api';
import type { CodeParts } from './types';

interface TemplateMarketProps {
  lang: 'zh' | 'en';
  onUse: (codeParts: CodeParts, title: string) => void;
  onClose: () => void;
}

const CATEGORIES = [
  { key: 'all',        label: { zh: '全部',     en: 'All' } },
  { key: '官网/落地页', label: { zh: '落地页',   en: 'Landing' } },
  { key: '后台管理',   label: { zh: '后台',      en: 'Admin' } },
  { key: '电商',       label: { zh: '电商',      en: 'E-commerce' } },
  { key: '工具/应用',  label: { zh: '工具',      en: 'Tool' } },
  { key: '数据可视化', label: { zh: '数据可视化', en: 'Data Viz' } },
  { key: '游戏',       label: { zh: '游戏',      en: 'Game' } },
  { key: '其他',       label: { zh: '其他',      en: 'Other' } },
];

const TemplateMarket = ({ lang, onUse, onClose }: TemplateMarketProps) => {
  const [templates, setTemplates]     = useState<VibeTemplateItem[]>([]);
  const [loading, setLoading]         = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchText, setSearchText]   = useState('');
  const [previewItem, setPreviewItem] = useState<VibeTemplateDetail | null>(null);
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchVibeTemplates({
        limit: 50,
        category: activeCategory !== 'all' ? activeCategory : undefined,
      });
      setTemplates(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // 生成预览 Blob URL
  useEffect(() => {
    if (!previewItem) { setPreviewUrl(null); return; }
    const html = buildHtmlFromParts(previewItem.codeParts);
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewItem]);

  // 客户端搜索过滤
  const filtered = templates.filter((t) => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });

  const handleOpenPreview = async (item: VibeTemplateItem) => {
    setPreviewLoading(true);
    try {
      const detail = await fetchVibeTemplate(item._id);
      setPreviewItem(detail);
    } catch (e) {
      console.error(e);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleOpenExternal = async (item: VibeTemplateItem) => {
    try {
      const detail = await fetchVibeTemplate(item._id);
      const html = buildHtmlFromParts(detail.codeParts);
      const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUseTemplate = () => {
    if (!previewItem) return;
    onUse(previewItem.codeParts, previewItem.title);
    onClose();
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">
            {lang === 'zh' ? '模板市场' : 'Template Market'}
          </span>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
            {templates.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            onClick={loadTemplates}
            disabled={loading}
            tabIndex={0}
            aria-label="刷新"
            title="刷新"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            onClick={onClose}
            tabIndex={0}
            aria-label="关闭"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 搜索 + 分类 */}
      <div className="px-3 py-2.5 border-b border-gray-800/60 flex-shrink-0 space-y-2">
        <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-2.5 py-1.5 border border-gray-700/40">
          <Search className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
          <input
            className="flex-1 bg-transparent text-xs text-gray-200 outline-none placeholder-gray-600"
            placeholder={lang === 'zh' ? '搜索模板...' : 'Search templates...'}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            aria-label="搜索模板"
            tabIndex={0}
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              className={`flex-shrink-0 text-[10px] px-2.5 py-1 rounded-full transition-all ${
                activeCategory === cat.key
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-gray-500 hover:text-gray-300 border border-transparent hover:border-gray-700'
              }`}
              onClick={() => setActiveCategory(cat.key)}
              tabIndex={0}
              aria-label={cat.label[lang]}
            >
              {cat.label[lang]}
            </button>
          ))}
        </div>
      </div>

      {/* 模板列表 */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
            <p className="text-xs text-gray-600">{lang === 'zh' ? '加载中...' : 'Loading...'}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-900 flex items-center justify-center">
              <Store className="w-5 h-5 text-gray-700" />
            </div>
            <p className="text-xs text-gray-600">
              {lang === 'zh' ? '暂无模板\n生成 UI 后可发布到这里' : 'No templates yet\nPublish your UI here'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => (
              <div
                key={item._id}
                className="group rounded-xl border border-gray-800/60 hover:border-gray-700 bg-gray-900/40 hover:bg-gray-900/80 transition-all overflow-hidden"
              >
                {/* 预览缩略图区 */}
                <div
                  className="relative h-28 bg-gray-900 cursor-pointer overflow-hidden"
                  onClick={() => handleOpenPreview(item)}
                  role="button"
                  tabIndex={0}
                  aria-label={`预览 ${item.title}`}
                  onKeyDown={(e) => e.key === 'Enter' && handleOpenPreview(item)}
                >
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Globe className="w-8 h-8 text-gray-700" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="text-[10px] text-white bg-black/60 px-2 py-1 rounded-full flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {lang === 'zh' ? '预览' : 'Preview'}
                    </span>
                  </div>
                </div>

                {/* 信息区 */}
                <div className="p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-200 truncate">{item.title}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>
                    </div>
                  </div>

                  {/* 标签 */}
                  {item.tags.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {item.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="flex items-center gap-0.5 text-[9px] text-gray-600 bg-gray-800/60 px-1.5 py-0.5 rounded-full">
                          <Tag className="w-2 h-2" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 操作栏 */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800/60">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[10px] text-gray-500">
                        <Heart className="w-3 h-3" />
                        {item.likeCount}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-gray-600">
                        <Eye className="w-3 h-3" />
                        {item.viewCount}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        className="text-[10px] text-gray-500 hover:text-sky-400 p-1 rounded hover:bg-sky-500/10 transition-colors"
                        onClick={() => handleOpenExternal(item)}
                        tabIndex={0}
                        aria-label="在新标签页打开"
                        title={lang === 'zh' ? '在新标签页打开' : 'Open in new tab'}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                      <button
                        className="text-[10px] bg-violet-600 hover:bg-violet-500 text-white px-2.5 py-1 rounded-lg transition-colors"
                        onClick={() => handleOpenPreview(item)}
                        tabIndex={0}
                        aria-label={lang === 'zh' ? '预览并使用' : 'Preview & Use'}
                      >
                        {lang === 'zh' ? '使用' : 'Use'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 预览弹窗 */}
      {(previewItem || previewLoading) && (
        <div className="absolute inset-0 z-50 bg-gray-950/95 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
            <span className="text-sm font-medium text-white">
              {previewItem?.title ?? (lang === 'zh' ? '加载中...' : 'Loading...')}
            </span>
            <div className="flex items-center gap-2">
              {previewItem && (
                <button
                  className="text-[10px] bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg transition-colors"
                  onClick={handleUseTemplate}
                  tabIndex={0}
                  aria-label="使用此模板"
                >
                  {lang === 'zh' ? '使用此模板' : 'Use Template'}
                </button>
              )}
              <button
                className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
                onClick={() => { setPreviewItem(null); setPreviewLoading(false); }}
                tabIndex={0}
                aria-label="关闭预览"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          {previewLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
            </div>
          ) : previewUrl ? (
            <iframe
              src={previewUrl}
              className="flex-1 border-0 bg-white"
              title={previewItem?.title}
              sandbox="allow-scripts allow-same-origin"
            />
          ) : null}
        </div>
      )}
    </div>
  );
};

export default TemplateMarket;
