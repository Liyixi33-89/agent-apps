import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { SelectedElementInfo } from './vibe-coding/UIPreviewPanel';
import {
  UIPreviewPanel,
  PublishModal,
  ChatSidebar,
  useVibeSession,
  useVibeChat,
  useVibePipeline,
} from './vibe-coding';
import type { CodeParts } from './vibe-coding';

// ─── 主页面 ────────────────────────────────────────────────────────────────────

const VibeCodingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // ─── 集中状态管理 ──────────────────────────────────────────────────────────
  const ctx = useVibeSession();

  const {
    lang,
    codeParts, setCodeParts,
    prevCodeParts, setPrevCodeParts,
    isFromPreviousSession, setIsFromPreviousSession,
    uploadedImage, setUploadedImage,
    isReactMode, setIsReactMode,
    isFullStackMode,
    runtimeApiBase, setRuntimeApiBase,
    setDeployedAppId,
    streaming,
    serverParts,
    dbSchema,
    publishTarget, setPublishTarget,
    input, setInput,
    setSideView,
    textareaRef,
    loadAgents,
    messagesEndRef,
    messages,
  } = ctx;

  // ─── 聊天逻辑 ─────────────────────────────────────────────────────────────
  const { handleSend, handleVibeStream, handleSendWithContent } = useVibeChat(ctx);

  // ─── Pipeline 逻辑 ────────────────────────────────────────────────────────
  const { handlePipeline } = useVibePipeline(ctx, handleVibeStream, handleSendWithContent);

  // ─── 初始化 ───────────────────────────────────────────────────────────────
  useEffect(() => { loadAgents(); }, [loadAgents]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, messagesEndRef]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input, textareaRef]);

  // ─── 接收模板市场传来的模板数据 ───────────────────────────────────────────
  useEffect(() => {
    const state = location.state as { templateCodeParts?: CodeParts; templateTitle?: string } | null;
    if (state?.templateCodeParts) {
      setCodeParts(state.templateCodeParts);
      setIsFromPreviousSession(false);
      if (state.templateTitle) setInput(state.templateTitle);
      navigate('/vibe', { replace: true, state: null });
    }
  }, [location.state, navigate, setCodeParts, setIsFromPreviousSession, setInput]);

  // ─── 元素选择回调 ────────────────────────────────────────────────────────
  const handleElementSelect = useCallback((info: SelectedElementInfo) => {
    const selectorHint = info.id ? `#${info.id}` : info.selector;
    const textHint = info.textContent
      ? `，内容为「${info.textContent.slice(0, 30)}${info.textContent.length > 30 ? '…' : ''}」`
      : '';
    const prompt = lang === 'zh'
      ? `[element_modify] 请修改选中的「${selectorHint}」元素${textHint}：`
      : `[element_modify] Please modify the selected "${selectorHint}" element${info.textContent ? ` with text "${info.textContent.slice(0, 30)}"` : ''}: `;
    setInput(prompt);
    setSideView('chat');
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, [lang, setInput, setSideView, textareaRef]);

  // ─── 渲染 ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* ── 左侧：对话侧边栏 ── */}
      <ChatSidebar
        ctx={ctx}
        onSend={handleSend}
        onPipeline={handlePipeline}
      />

      {/* ── 右侧：UI 预览主区域 ── */}
      <UIPreviewPanel
        codeParts={codeParts}
        prevCodeParts={prevCodeParts}
        lang={lang}
        isStreaming={streaming}
        isFromPreviousSession={isFromPreviousSession}
        uploadedImage={uploadedImage}
        isReactMode={isReactMode}
        isFullStackMode={isFullStackMode}
        runtimeApiBase={runtimeApiBase}
        onReactModeChange={setIsReactMode}
        onCodePartsChange={setCodeParts}
        onClearPreview={() => {
          setPrevCodeParts(null);
          setIsFromPreviousSession(false);
        }}
        onImageUpload={(base64) => setUploadedImage(base64)}
        onImageClear={() => setUploadedImage(null)}
        onElementSelect={handleElementSelect}
        onPublish={() => {
          if (!codeParts) return;
          setPublishTarget({
            id: `direct-${Date.now()}`,
            label: '当前作品',
            codeParts,
            createdAt: new Date().toISOString(),
          });
        }}
      />

      {/* ── 发布弹窗 ── */}
      {publishTarget && (
        <PublishModal
          item={publishTarget}
          lang={lang}
          isFullStack={isFullStackMode}
          serverParts={serverParts}
          dbSchema={dbSchema}
          onSuccess={(_, deployInfo) => {
            setPublishTarget(null);
            if (deployInfo?.runtimeApiBase) {
              setRuntimeApiBase(deployInfo.runtimeApiBase);
            }
            if (deployInfo?.appId) {
              setDeployedAppId(deployInfo.appId);
            }
          }}
          onClose={() => setPublishTarget(null)}
        />
      )}
    </div>
  );
};

export default VibeCodingPage;
