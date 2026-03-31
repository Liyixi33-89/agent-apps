import { useState, useRef } from 'react';
import { Globe, X, Tag, Plus, Loader2, ImagePlus, Trash2, Rocket, Store } from 'lucide-react';
import { publishVibeTemplate, uploadTemplateImage, saveVibeApp } from '../../api';

import type { VibeHistoryItem } from './types';

interface PublishModalProps {
  item: VibeHistoryItem;
  lang: 'zh' | 'en';
  onSuccess: (publishedToMarket: boolean) => void;
  onClose: () => void;
}

const CATEGORY_OPTIONS = [
  { key: '官网/落地页', label: { zh: '落地页', en: 'Landing' } },
  { key: '后台管理',   label: { zh: '后台管理', en: 'Admin' } },
  { key: '电商',       label: { zh: '电商', en: 'E-commerce' } },
  { key: '工具/应用',  label: { zh: '工具应用', en: 'Tool' } },
  { key: '数据可视化', label: { zh: '数据可视化', en: 'Data Viz' } },
  { key: '游戏',       label: { zh: '游戏', en: 'Game' } },
  { key: '其他',       label: { zh: '其他', en: 'Other' } },
];

const PublishModal = ({ item, lang, onSuccess, onClose }: PublishModalProps) => {
  const [title, setTitle]               = useState(item.label.slice(0, 30));
  const [description, setDesc]          = useState('');
  const [category, setCategory]         = useState('官网/落地页');
  const [tagInput, setTagInput]         = useState('');
  const [tags, setTags]                 = useState<string[]>([]);
  const [publishing, setPublishing]     = useState(false);
  const [error, setError]               = useState('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [publishToMarket, setPublishToMarket] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const handleAddTag = () => {
    const t = tagInput.trim();
    if (!t || tags.includes(t) || tags.length >= 5) return;
    setTags((prev) => [...prev, t]);
    setTagInput('');
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbnailFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setThumbnailPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveImage = () => {
    setThumbnailFile(null);
    setThumbnailPreview(null);
  };

  const handlePublish = async () => {
    if (!title.trim()) return;
    setPublishing(true);
    setError('');
    try {
      let thumbnail: string | undefined;
      if (thumbnailFile) {
        setUploadingImg(true);
        thumbnail = await uploadTemplateImage(thumbnailFile);
        setUploadingImg(false);
      }

      const payload = {
        title:       title.trim(),
        description: description.trim(),
        category,
        author:      'me',
        codeParts:   item.codeParts,
        thumbnail,
        tags,
      };

      let backendId: string;

      if (publishToMarket) {
        // 发布到模板市场（isActive: true）
        const result = await publishVibeTemplate(payload);
        backendId = result._id;
      } else {
        // 仅保存应用到后端（isActive: false，不在市场展示）
        const result = await saveVibeApp(payload);
        backendId = result._id;
      }

      // 使用后端返回的 ID 打开预览页
      window.open(`/preview/${backendId}`, '_blank');

      onSuccess(publishToMarket);
    } catch (err: any) {
      setUploadingImg(false);
      setError(err?.response?.data?.message ?? (lang === 'zh' ? '发布失败，请重试' : 'Publish failed, please retry'));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[460px] bg-gray-900 border border-gray-700/60 rounded-2xl shadow-2xl overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-white">
              {lang === 'zh' ? '发布应用' : 'Publish App'}
            </span>
          </div>
          <button
            className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            onClick={onClose}
            tabIndex={0}
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 表单 */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* 错误提示 */}
          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* 标题 */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 font-medium">
              {lang === 'zh' ? '应用标题' : 'App Title'} <span className="text-red-400">*</span>
            </label>
            <input
              className="w-full bg-gray-800 border border-gray-700/60 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-violet-500/60 transition-colors"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={lang === 'zh' ? '给应用起个名字...' : 'App name...'}
              maxLength={50}
              aria-label="应用标题"
              tabIndex={0}
            />
          </div>

          {/* 描述 */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 font-medium">
              {lang === 'zh' ? '描述' : 'Description'}
            </label>
            <textarea
              className="w-full bg-gray-800 border border-gray-700/60 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-violet-500/60 transition-colors resize-none"
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={lang === 'zh' ? '简单描述这个应用的用途...' : 'Describe this app...'}
              rows={2}
              maxLength={200}
              aria-label="应用描述"
              tabIndex={0}
            />
          </div>

          {/* 发布到模板市场开关 */}
          <div className="flex items-center justify-between py-3 px-4 bg-gray-800/60 rounded-xl border border-gray-700/40">
            <div className="flex items-center gap-2.5">
              <Store className="w-4 h-4 text-emerald-400" />
              <div>
                <p className="text-sm text-gray-200 font-medium">
                  {lang === 'zh' ? '发布到模板市场' : 'Publish to Template Market'}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {lang === 'zh' ? '开启后将同步发布到模板市场供他人使用' : 'Enable to publish to the template market for others to use'}
                </p>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={publishToMarket}
              aria-label={lang === 'zh' ? '发布到模板市场' : 'Publish to Template Market'}
              tabIndex={0}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
                publishToMarket ? 'bg-emerald-600' : 'bg-gray-700'
              }`}
              onClick={() => setPublishToMarket((prev) => !prev)}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  publishToMarket ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* 以下字段仅在开启发布到模板市场时显示 */}
          {publishToMarket && (
            <>
              {/* 封面图上传 */}
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 font-medium">
                  {lang === 'zh' ? '封面图（可选）' : 'Cover Image (optional)'}
                </label>
                <input
                  ref={imgInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                  aria-label="上传封面图"
                />
                {thumbnailPreview ? (
                  <div className="relative group rounded-xl overflow-hidden border border-gray-700/60 bg-gray-800">
                    <img
                      src={thumbnailPreview}
                      alt="封面预览"
                      className="w-full h-36 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button
                        className="flex items-center gap-1.5 text-xs bg-gray-900/80 text-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                        onClick={() => imgInputRef.current?.click()}
                        tabIndex={0}
                        aria-label="更换图片"
                      >
                        <ImagePlus className="w-3.5 h-3.5" />
                        {lang === 'zh' ? '更换' : 'Change'}
                      </button>
                      <button
                        className="flex items-center gap-1.5 text-xs bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/30 transition-colors"
                        onClick={handleRemoveImage}
                        tabIndex={0}
                        aria-label="删除图片"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {lang === 'zh' ? '删除' : 'Remove'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="w-full h-28 rounded-xl border-2 border-dashed border-gray-700/60 hover:border-violet-500/50 bg-gray-800/40 hover:bg-gray-800/70 transition-all flex flex-col items-center justify-center gap-2 group"
                    onClick={() => imgInputRef.current?.click()}
                    tabIndex={0}
                    aria-label="上传封面图"
                  >
                    <ImagePlus className="w-6 h-6 text-gray-600 group-hover:text-violet-400 transition-colors" />
                    <span className="text-xs text-gray-600 group-hover:text-gray-400 transition-colors">
                      {lang === 'zh' ? '点击上传封面图' : 'Click to upload cover image'}
                    </span>
                    <span className="text-[10px] text-gray-700">
                      {lang === 'zh' ? 'PNG / JPG / WebP，最大 5MB' : 'PNG / JPG / WebP, max 5MB'}
                    </span>
                  </button>
                )}
              </div>

              {/* 分类 */}
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 font-medium">
                  {lang === 'zh' ? '分类' : 'Category'}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                        category === opt.key
                          ? 'bg-violet-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-700/40'
                      }`}
                      onClick={() => setCategory(opt.key)}
                      tabIndex={0}
                      aria-label={opt.label[lang]}
                    >
                      {opt.label[lang]}
                    </button>
                  ))}
                </div>
              </div>

              {/* 标签 */}
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 font-medium">
                  {lang === 'zh' ? '标签（最多 5 个）' : 'Tags (max 5)'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 bg-gray-800 border border-gray-700/60 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-violet-500/60 transition-colors"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    placeholder={lang === 'zh' ? '输入标签后回车' : 'Enter tag and press Enter'}
                    disabled={tags.length >= 5}
                    aria-label="添加标签"
                    tabIndex={0}
                  />
                  <button
                    className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition-colors border border-gray-700/40"
                    onClick={handleAddTag}
                    disabled={tags.length >= 5}
                    tabIndex={0}
                    aria-label="添加标签"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="flex items-center gap-1 text-[10px] bg-gray-800 text-gray-400 border border-gray-700/40 px-2 py-0.5 rounded-full"
                      >
                        <Tag className="w-2.5 h-2.5" />
                        {tag}
                        <button
                          className="hover:text-red-400 transition-colors ml-0.5"
                          onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                          tabIndex={0}
                          aria-label={`删除标签 ${tag}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-800">
          <button
            className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            onClick={onClose}
            tabIndex={0}
            aria-label="取消"
          >
            {lang === 'zh' ? '取消' : 'Cancel'}
          </button>
          <button
            className="text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg transition-colors flex items-center gap-2"
            onClick={handlePublish}
            disabled={!title.trim() || publishing}
            tabIndex={0}
            aria-label="发布"
          >
            {(publishing || uploadingImg)
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Rocket className="w-3.5 h-3.5" />
            }
            {lang === 'zh'
              ? (uploadingImg ? '上传图片...' : publishing ? '发布中...' : '发布')
              : (uploadingImg ? 'Uploading...' : publishing ? 'Publishing...' : 'Publish')
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default PublishModal;
