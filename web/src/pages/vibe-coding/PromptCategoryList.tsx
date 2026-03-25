import { useState } from 'react';
import { ChevronDown, Star, StarOff } from 'lucide-react';
import type { PromptCategory, FavoritePrompt } from './types';

interface PromptCategoryListProps {
  categories: PromptCategory[];
  lang: 'zh' | 'en';
  favorites: FavoritePrompt[];
  onSelect: (prompt: string) => void;
  onAddFavorite: (text: string) => void;
  onRemoveFavorite: (id: string) => void;
  isFavorite: (text: string) => boolean;
}

const PromptCategoryList = ({
  categories,
  lang,
  favorites,
  onSelect,
  onAddFavorite,
  onRemoveFavorite,
  isFavorite,
}: PromptCategoryListProps) => {
  const [openCategory, setOpenCategory] = useState<number | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);

  const handleToggle = (idx: number) => {
    setOpenCategory((prev) => (prev === idx ? null : idx));
  };

  const handleFavoriteClick = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    if (isFavorite(text)) {
      const fav = favorites.find((f) => f.text === text);
      if (fav) onRemoveFavorite(fav.id);
    } else {
      onAddFavorite(text);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 pt-1">
      {/* 标题区 */}
      <div className="flex items-center gap-2 px-1 mb-1">
        <div className="flex-1 h-px bg-gray-800" />
        <p className="text-[10px] text-gray-500 font-medium tracking-wider uppercase">
          {lang === 'zh' ? '选择场景快速开始' : 'Quick Start'}
        </p>
        <div className="flex-1 h-px bg-gray-800" />
      </div>

      {/* 收藏提示词区 */}
      {favorites.length > 0 && (
        <div className="rounded-xl overflow-hidden border border-amber-500/20 hover:border-amber-500/30 transition-colors">
          <button
            className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-all ${
              showFavorites
                ? 'bg-amber-500/10 text-amber-300'
                : 'bg-gray-900/40 text-amber-500/70 hover:bg-amber-500/8 hover:text-amber-400'
            }`}
            onClick={() => setShowFavorites((v) => !v)}
            aria-label="我的收藏"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setShowFavorites((v) => !v)}
          >
            <span className="flex items-center gap-1.5">
              <Star className="w-3 h-3" />
              {lang === 'zh' ? `我的收藏 (${favorites.length})` : `Favorites (${favorites.length})`}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${showFavorites ? 'rotate-180' : ''}`}
            />
          </button>
          {showFavorites && (
            <div className="flex flex-col divide-y divide-gray-800/40 bg-gray-900/20">
              {favorites.map((fav) => (
                <div
                  key={fav.id}
                  className="flex items-start gap-2 px-3 py-2.5 hover:bg-gray-800/60 transition-all group"
                >
                  <button
                    className="flex-1 text-left text-xs text-gray-500 hover:text-gray-200 transition-colors leading-relaxed"
                    onClick={() => onSelect(fav.text)}
                    tabIndex={0}
                    aria-label={fav.text}
                    onKeyDown={(e) => e.key === 'Enter' && onSelect(fav.text)}
                  >
                    {fav.text}
                  </button>
                  <button
                    className="flex-shrink-0 p-0.5 text-amber-400/60 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    onClick={() => onRemoveFavorite(fav.id)}
                    tabIndex={0}
                    aria-label="取消收藏"
                    title="取消收藏"
                  >
                    <StarOff className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 分类列表 */}
      {categories.map((cat, idx) => (
        <div key={idx} className="rounded-xl overflow-hidden border border-gray-800/60 hover:border-gray-700/80 transition-colors">
          <button
            className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-all ${
              openCategory === idx
                ? 'bg-gray-800/80 text-gray-200'
                : 'bg-gray-900/40 text-gray-400 hover:bg-gray-800/50 hover:text-gray-300'
            }`}
            onClick={() => handleToggle(idx)}
            aria-label={`展开 ${lang === 'zh' ? cat.label.zh : cat.label.en}`}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleToggle(idx)}
          >
            <span className="font-semibold">
              {lang === 'zh' ? cat.label.zh : cat.label.en}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${
                openCategory === idx ? 'rotate-180' : ''
              }`}
            />
          </button>

          {openCategory === idx && (
            <div className="flex flex-col divide-y divide-gray-800/40 bg-gray-900/20">
              {cat.prompts.map((p, pIdx) => {
                const text = lang === 'zh' ? p.zh : p.en;
                const starred = isFavorite(text);
                return (
                  <div
                    key={pIdx}
                    className="flex items-start gap-2 px-3 py-2.5 hover:bg-gray-800/60 transition-all group"
                  >
                    <button
                      className="flex-1 text-left text-xs text-gray-500 hover:text-gray-200 transition-all flex items-start gap-2"
                      onClick={() => onSelect(text)}
                      aria-label={text}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && onSelect(text)}
                    >
                      <span className="text-gray-600 group-hover:text-violet-400 flex-shrink-0 mt-0.5 transition-colors">›</span>
                      <span className="leading-relaxed">{text}</span>
                    </button>
                    {/* 收藏按钮 */}
                    <button
                      className={`flex-shrink-0 p-0.5 transition-all ${
                        starred
                          ? 'text-amber-400 opacity-100'
                          : 'text-gray-600 hover:text-amber-400 opacity-0 group-hover:opacity-100'
                      }`}
                      onClick={(e) => handleFavoriteClick(e, text)}
                      tabIndex={0}
                      aria-label={starred ? '取消收藏' : '收藏此提示词'}
                      title={starred ? '取消收藏' : '收藏'}
                    >
                      <Star className={`w-3 h-3 ${starred ? 'fill-amber-400' : ''}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default PromptCategoryList;
