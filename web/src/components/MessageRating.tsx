/**
 * @file components/MessageRating.tsx
 * @description 消息评分组件 — 用户对 AI 回答进行评分和反馈
 */

import { useState } from 'react';
import { Star, MessageSquare, Send, X, Check } from 'lucide-react';
import { submitEvaluation } from '../api';

interface MessageRatingProps {
  agentSlug: string;
  chatId?: string;
  messageId?: string;
  userInput: string;
  agentOutput: string;
}

const MessageRating = ({ agentSlug, chatId, messageId, userInput, agentOutput }: MessageRatingProps) => {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitRating = async (selectedRating: number) => {
    setRating(selectedRating);
    setSubmitting(true);
    try {
      await submitEvaluation({
        agentSlug,
        chatId,
        messageId,
        rating: selectedRating,
        userInput: userInput.slice(0, 500),
        agentOutput: agentOutput.slice(0, 2000),
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Rating submit failed', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) return;
    setSubmitting(true);
    try {
      await submitEvaluation({
        agentSlug,
        chatId,
        messageId,
        rating: rating || 3,
        feedback: feedback.trim(),
        userInput: userInput.slice(0, 500),
        agentOutput: agentOutput.slice(0, 2000),
      });
      setSubmitted(true);
      setShowFeedback(false);
    } catch (err) {
      console.error('Feedback submit failed', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-1.5 mt-1">
        <Check className="w-3 h-3 text-emerald-500" />
        <span className="text-[10px] text-emerald-500">感谢反馈</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-1.5">
      {/* 星级评分 */}
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            className="p-0 border-0 bg-transparent cursor-pointer transition-transform hover:scale-110"
            onClick={() => handleSubmitRating(star)}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            disabled={submitting}
            tabIndex={0}
            aria-label={`评分 ${star} 星`}
          >
            <Star
              className={`w-3 h-3 transition-colors ${
                star <= (hoveredStar || rating)
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-slate-300'
              }`}
            />
          </button>
        ))}
      </div>

      {/* 反馈按钮 */}
      {!showFeedback && (
        <button
          className="p-0.5 text-slate-400 hover:text-sky-500 transition-colors border-0 bg-transparent cursor-pointer"
          onClick={() => setShowFeedback(true)}
          tabIndex={0}
          aria-label="添加文字反馈"
          title="添加文字反馈"
        >
          <MessageSquare className="w-3 h-3" />
        </button>
      )}

      {/* 反馈输入框 */}
      {showFeedback && (
        <div className="flex items-center gap-1 flex-1 max-w-xs">
          <input
            type="text"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmitFeedback()}
            placeholder="说说你的想法..."
            className="flex-1 text-[10px] px-2 py-1 rounded-md border border-slate-200 bg-white focus:outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100"
            autoFocus
            aria-label="反馈内容"
          />
          <button
            className="p-1 text-sky-500 hover:bg-sky-50 rounded transition-colors border-0 bg-transparent cursor-pointer"
            onClick={handleSubmitFeedback}
            disabled={submitting || !feedback.trim()}
            tabIndex={0}
            aria-label="提交反馈"
          >
            <Send className="w-3 h-3" />
          </button>
          <button
            className="p-1 text-slate-400 hover:bg-slate-100 rounded transition-colors border-0 bg-transparent cursor-pointer"
            onClick={() => setShowFeedback(false)}
            tabIndex={0}
            aria-label="取消反馈"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};

export default MessageRating;
