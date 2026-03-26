import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Store, Eye, Heart, Globe, Search, Tag, ExternalLink,
  ArrowLeft, Smartphone, Monitor, X, ChevronRight, Loader2, RefreshCw,
} from 'lucide-react';
import { fetchVibeTemplates, fetchVibeTemplate } from '../api';
import { buildHtmlFromParts } from './vibe-coding/utils';
import { useAppStore } from '../store';
import type { VibeTemplateItem, VibeTemplateDetail } from '../api';
import type { CodeParts } from './vibe-coding/types';

// ─── 分类 ─────────────────────────────────────────────────────────────────────

const CATEGORIES: { key: string; label: { zh: string; en: string } }[] = [
  { key: 'all',        label: { zh: '全部',     en: 'All' } },
  { key: '官网/落地页', label: { zh: '落地页',   en: 'Landing' } },
  { key: '后台管理',   label: { zh: '后台管理',  en: 'Admin' } },
  { key: '电商',       label: { zh: '电商',      en: 'E-commerce' } },
  { key: '工具/应用',  label: { zh: '工具应用',  en: 'Tool' } },
  { key: '数据可视化', label: { zh: '数据可视化', en: 'Data Viz' } },
  { key: '游戏',       label: { zh: '游戏',      en: 'Game' } },
  { key: '其他',       label: { zh: '其他',      en: 'Other' } },
];

// ─── 预览弹窗 ─────────────────────────────────────────────────────────────────

interface PreviewModalProps {
  item: VibeTemplateDetail;
  lang: 'zh' | 'en';
  onUse: (codeParts: CodeParts, title: string) => void;
  onClose: () => void;
}

const MOBILE_WIDTH = 390;

const PreviewModal = ({ item, lang, onUse, onClose }: PreviewModalProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const html = buildHtmlFromParts(item.codeParts);
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [item]);

  const handleOpenExternal = () => {
    const html = buildHtmlFromParts(item.codeParts);
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl h-[90vh] bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-semibold text-gray-800 truncate">{item.title}</span>
            {item.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="hidden sm:flex items-center gap-0.5 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Desktop / Mobile 切换 */}
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
              <button
                className={`p-1.5 rounded-md transition-all ${!isMobile ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                onClick={() => setIsMobile(false)}
                tabIndex={0}
                aria-label="Desktop 预览"
                title="Desktop"
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
              <button
                className={`p-1.5 rounded-md transition-all ${isMobile ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                onClick={() => setIsMobile(true)}
                tabIndex={0}
                aria-label="Mobile 预览"
                title="Mobile (390px)"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              className="p-1.5 text-gray-400 hover:text-sky-500 rounded-lg hover:bg-sky-50 transition-colors"
              onClick={handleOpenExternal}
              tabIndex={0}
              aria-label="在新标签页打开"
              title={lang === 'zh' ? '在新标签页打开' : 'Open in new tab'}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              className="text-sm bg-violet-600 hover:bg-violet-500 text-white px-4 py-1.5 rounded-lg transition-colors font-medium"
              onClick={() => { onUse(item.codeParts, item.title); onClose(); }}
              tabIndex={0}
              aria-label={lang === 'zh' ? '套用此模板' : 'Use Template'}
            >
              {lang === 'zh' ? '套用模板' : 'Use Template'}
            </button>
            <button
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={onClose}
              tabIndex={0}
              aria-label="关闭预览"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 预览区 */}
        <div className="flex-1 overflow-hidden bg-gray-50 flex items-center justify-center">
          {previewUrl ? (
            isMobile ? (
              /* 手机外框 */
              <div className="flex flex-col items-center py-6 h-full">
                <div
                  className="relative flex flex-col bg-gray-200 rounded-[2.5rem] shadow-2xl border-2 border-gray-300 overflow-hidden"
                  style={{ width: MOBILE_WIDTH, height: '100%', maxHeight: 780 }}
                >
                  {/* 刘海 */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-gray-200 rounded-b-2xl z-10 flex items-center justify-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                    <span className="w-8 h-1 rounded-full bg-gray-400" />
                  </div>
                  <iframe
                    src={previewUrl}
                    className="flex-1 border-0 bg-white mt-5"
                    title={`${item.title} Mobile Preview`}
                    sandbox="allow-scripts allow-same-origin"
                  />
                  <div className="flex-shrink-0 h-6 flex items-center justify-center bg-gray-200">
                    <span className="w-24 h-1 rounded-full bg-gray-400" />
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-gray-400">Mobile · {MOBILE_WIDTH}px</p>
              </div>
            ) : (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0 bg-white"
                title={`${item.title} Preview`}
                sandbox="allow-scripts allow-same-origin"
              />
            )
          ) : (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              {lang === 'zh' ? '加载预览...' : 'Loading preview...'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── 模板卡片 ─────────────────────────────────────────────────────────────────

interface TemplateCardProps {
  item: VibeTemplateItem;
  lang: 'zh' | 'en';
  onPreview: (item: VibeTemplateItem) => void;
  onUse: (item: VibeTemplateItem) => void;
}

const TemplateCard = ({ item, lang, onPreview, onUse }: TemplateCardProps) => (
  <div className="group rounded-2xl border border-gray-200 hover:border-gray-300 bg-white hover:shadow-md transition-all overflow-hidden flex flex-col">
    {/* 缩略图 */}
    <div
      className="relative h-40 bg-gray-50 cursor-pointer overflow-hidden flex-shrink-0"
      onClick={() => onPreview(item)}
      role="button"
      tabIndex={0}
      aria-label={`预览 ${item.title}`}
      onKeyDown={(e) => e.key === 'Enter' && onPreview(item)}
    >
      {item.thumbnail ? (
        <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Globe className="w-10 h-10 text-gray-300" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
        <span className="text-xs text-white bg-black/60 px-3 py-1.5 rounded-full flex items-center gap-1.5 font-medium">
          <Eye className="w-3.5 h-3.5" />
          {lang === 'zh' ? '点击预览' : 'Preview'}
        </span>
      </div>
    </div>

    {/* 信息区 */}
    <div className="p-3.5 flex flex-col flex-1">
      <div className="flex-1">
        <p className="text-sm font-semibold text-gray-800 truncate">{item.title}</p>
        {item.description && (
          <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
        )}
        {item.tags.length > 0 && (
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {item.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="flex items-center gap-0.5 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 操作栏 */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Heart className="w-3.5 h-3.5" />
            {item.likeCount}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-300">
            <Eye className="w-3.5 h-3.5" />
            {item.viewCount}
          </span>
        </div>
        <button
          className="text-xs bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5"
          onClick={() => onUse(item)}
          tabIndex={0}
          aria-label={lang === 'zh' ? '套用此模板' : 'Use template'}
        >
          {lang === 'zh' ? '套用' : 'Use'}
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  </div>
);

// ─── 主页面 ───────────────────────────────────────────────────────────────────

const TemplateMarketPage = () => {
  const navigate = useNavigate();
  const { lang } = useAppStore();

  const [templates, setTemplates]         = useState<VibeTemplateItem[]>([]);
  const [loading, setLoading]             = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchText, setSearchText]       = useState('');
  const [previewItem, setPreviewItem]     = useState<VibeTemplateDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchVibeTemplates({
        limit: 100,
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

  // 点击预览：先获取完整 codeParts
  const handlePreview = async (item: VibeTemplateItem) => {
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

  // 套用模板：获取 codeParts 后跳转到 Vibe Coding
  const handleUse = async (item: VibeTemplateItem) => {
    try {
      const detail = await fetchVibeTemplate(item._id);
      navigate('/vibe', { state: { templateCodeParts: detail.codeParts, templateTitle: detail.title } });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 顶部导航栏 */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-200 flex-shrink-0 bg-white">
        <button
          className="flex items-center gap-1.5 text-gray-400 hover:text-gray-700 transition-colors text-sm"
          onClick={() => navigate('/vibe')}
          tabIndex={0}
          aria-label="返回 Vibe Coding"
        >
          <ArrowLeft className="w-4 h-4" />
          {lang === 'zh' ? '返回' : 'Back'}
        </button>
        <div className="w-px h-5 bg-gray-200" />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-200">
            <Store className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <h1 className="text-base font-bold text-gray-800">
            {lang === 'zh' ? '模板市场' : 'Template Market'}
          </h1>
          <span className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full">
            {templates.length}
          </span>
        </div>
        <div className="ml-auto">
          <button
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors p-1.5 rounded-lg hover:bg-gray-100"
            onClick={loadTemplates}
            disabled={loading}
            tabIndex={0}
            aria-label="刷新"
            title={lang === 'zh' ? '刷新' : 'Refresh'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 搜索 + 分类栏 */}
      <div className="px-6 py-3 border-b border-gray-200 flex-shrink-0 flex items-center gap-4 flex-wrap bg-white">
        {/* 搜索框 */}
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 focus-within:border-gray-400 transition-colors w-64">
          <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <input
            className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder-gray-400"
            placeholder={lang === 'zh' ? '搜索模板、标签...' : 'Search templates, tags...'}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            aria-label="搜索模板"
            tabIndex={0}
          />
          {searchText && (
            <button
              className="text-gray-400 hover:text-gray-600 transition-colors"
              onClick={() => setSearchText('')}
              tabIndex={0}
              aria-label="清除搜索"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 分类 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              className={`text-xs px-3 py-1.5 rounded-full transition-all font-medium ${
                activeCategory === cat.key
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-300'
                  : 'text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 bg-white'
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

      {/* 模板网格 */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-sm text-gray-400">{lang === 'zh' ? '加载中...' : 'Loading...'}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center border border-gray-200 shadow-sm">
              <Store className="w-7 h-7 text-gray-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-400">
                {lang === 'zh' ? '暂无模板' : 'No templates yet'}
              </p>
              <p className="text-xs text-gray-300 mt-1">
                {lang === 'zh'
                  ? '在 Vibe Coding 中生成 UI 后，可发布到这里'
                  : 'Generate UI in Vibe Coding and publish it here'}
              </p>
            </div>
            <button
              className="text-sm text-violet-500 hover:text-violet-600 flex items-center gap-1.5 transition-colors"
              onClick={() => navigate('/vibe')}
              tabIndex={0}
              aria-label="去 Vibe Coding 创建"
            >
              {lang === 'zh' ? '去 Vibe Coding 创建' : 'Create in Vibe Coding'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map((item) => (
              <TemplateCard
                key={item._id}
                item={item}
                lang={lang}
                onPreview={handlePreview}
                onUse={handleUse}
              />
            ))}
          </div>
        )}
      </div>

      {/* 预览加载遮罩 */}
      {previewLoading && (
        <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
            <p className="text-sm text-gray-500">{lang === 'zh' ? '加载模板...' : 'Loading template...'}</p>
          </div>
        </div>
      )}

      {/* 预览弹窗 */}
      {previewItem && (
        <PreviewModal
          item={previewItem}
          lang={lang}
          onUse={(codeParts, title) => navigate('/vibe', { state: { templateCodeParts: codeParts, templateTitle: title } })}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </div>
  );
};

export default TemplateMarketPage;
