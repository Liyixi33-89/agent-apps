import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { PromptCategory } from './types';

interface PromptCategoryListProps {
  categories: PromptCategory[];
  lang: 'zh' | 'en';
  onSelect: (prompt: string) => void;
}

const PromptCategoryList = ({ categories, lang, onSelect }: PromptCategoryListProps) => {
  const [openCategory, setOpenCategory] = useState<number | null>(null);

  const handleToggle = (idx: number) => {
    setOpenCategory((prev) => (prev === idx ? null : idx));
  };

  return (
    <div className="flex flex-col gap-1.5 pt-1">
      {/* 标题区 */}
      <div className="flex items-center gap-2 px-1 mb-2">
        <div className="flex-1 h-px bg-gray-800" />
        <p className="text-[10px] text-gray-500 font-medium tracking-wider uppercase">
          {lang === 'zh' ? '选择场景快速开始' : 'Quick Start'}
        </p>
        <div className="flex-1 h-px bg-gray-800" />
      </div>

      {categories.map((cat, idx) => (
        <div key={idx} className="rounded-xl overflow-hidden border border-gray-800/60 hover:border-gray-700/80 transition-colors">
          {/* 分类标题 */}
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

          {/* 提示词列表 */}
          {openCategory === idx && (
            <div className="flex flex-col divide-y divide-gray-800/40 bg-gray-900/20">
              {cat.prompts.map((p, pIdx) => (
                <button
                  key={pIdx}
                  className="text-left text-xs text-gray-500 hover:text-gray-200 hover:bg-gray-800/60 px-3 py-2.5 transition-all flex items-start gap-2 group"
                  onClick={() => onSelect(lang === 'zh' ? p.zh : p.en)}
                  aria-label={lang === 'zh' ? p.zh : p.en}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onSelect(lang === 'zh' ? p.zh : p.en)}
                >
                  <span className="text-gray-600 group-hover:text-violet-400 flex-shrink-0 mt-0.5 transition-colors">›</span>
                  <span className="leading-relaxed">{lang === 'zh' ? p.zh : p.en}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default PromptCategoryList;
