import { useCallback } from 'react';
import { analyzeTaskComplexity } from '../../api';
import { extractCodeParts, extractReactCodeParts } from './utils';
import type { VibeSessionContext } from './useVibeSession';

/**
 * useVibeChat — 提取聊天相关的流式通信逻辑
 * 包含：handleSend（普通对话）、handleVibeStream（Vibe 生成）、handleSendWithContent（带内容发送）
 */
export const useVibeChat = (ctx: VibeSessionContext) => {
  const {
    lang,
    messages, setMessages,
    streaming, setStreaming,
    setContinuationCount, setIsContinuing,
    input, setInput,
    selectedAgent,
    provider, modelType,
    codeParts, setCodeParts,
    setIsFromPreviousSession,
    uploadedImage,
    isReactMode,
    abortRef,
    ensureSession,
    handleSaveHistory,
    setPlanComplexity,
  } = ctx;

  // ─── Vibe Stream 生成（供 simple 任务 / Pipeline 直接调用）──────────────────
  // currentHtml：传入时走"修改模式"，AI 在现有代码基础上做局部修改；不传时走"全新生成"

  const handleVibeStream = useCallback(async (content: string, currentHtml?: string, skipUserMsg = false) => {
    if (!content || streaming) return;

    if (!skipUserMsg) {
      setMessages((prev) => [...prev, {
        role: 'user' as const,
        content,
        timestamp: new Date().toISOString(),
      }]);
    }
    setStreaming(true);

    setMessages((prev) => [...prev, {
      role: 'assistant' as const,
      content: '',
      timestamp: new Date().toISOString(),
    }]);

    abortRef.current = new AbortController();
    setContinuationCount(0);
    setIsContinuing(false);

    try {
      const response = await fetch('/api/vibe/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: content,
          agentSlug: selectedAgent || undefined,
          provider,
          modelType,
          ...(currentHtml ? { currentHtml } : {}),
          ...(isReactMode ? { isReact: true } : {}),
        }),
        signal: abortRef.current.signal,
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.type === 'delta' && parsed.delta) {
              fullContent += parsed.delta;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullContent };
                return updated;
              });
            }
          } catch { /* 忽略 */ }
        }
      }

      const parts = isReactMode
        ? extractReactCodeParts(fullContent)
        : extractCodeParts(fullContent);
      if (parts.jsx || parts.html || parts.css || parts.js || parts.isFullHtml) {
        setCodeParts(parts);
        setIsFromPreviousSession(false);
        handleSaveHistory(content, parts);
      }

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          timestamp: new Date().toISOString(),
          provider,
        };
        return updated;
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: lang === 'zh' ? '❌ 生成失败，请检查服务连接' : '❌ Generation failed',
          };
          return updated;
        });
      }
    } finally {
      setStreaming(false);
      setIsContinuing(false);
      setContinuationCount(0);
    }
  }, [streaming, lang, selectedAgent, provider, modelType, isReactMode, abortRef, setMessages, setStreaming, setContinuationCount, setIsContinuing, setCodeParts, setIsFromPreviousSession, handleSaveHistory]);

  // ─── 带内容的普通发送（供 handlePipeline simple 分支调用）──────────────────

  const handleSendWithContent = useCallback(async (content: string, skipUserMsg = false) => {
    if (!content || streaming) return;

    if (!skipUserMsg) {
      setMessages((prev) => [...prev, {
        role: 'user' as const,
        content,
        timestamp: new Date().toISOString(),
      }]);
    }
    setStreaming(true);

    setMessages((prev) => [...prev, {
      role: 'assistant' as const,
      content: '',
      timestamp: new Date().toISOString(),
    }]);

    abortRef.current = new AbortController();
    setContinuationCount(0);
    setIsContinuing(false);

    try {
      const currentSession = await ensureSession();
      const requestBody: Record<string, unknown> = { sessionId: currentSession.sessionId, message: content };
      if (uploadedImage && modelType === 'vision') requestBody.imageBase64 = uploadedImage;

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: abortRef.current.signal,
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let toolStatusLines: string[] = [];

      const updateLastMsg = (text: string) => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: text };
          return updated;
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.slice(6));

            if (parsed.type === 'tool_calls_start') {
              const names = (parsed.toolCalls as Array<{ name: string }>)
                .map((tc) => `🔧 \`${tc.name}\``)
                .join('、');
              toolStatusLines = [`**正在调用工具：** ${names}`];
              updateLastMsg(toolStatusLines.join('\n'));
            }

            if (parsed.type === 'tool_executing') {
              toolStatusLines.push(`⏳ 执行 \`${parsed.toolName}\`...`);
              updateLastMsg(toolStatusLines.join('\n'));
            }

            if (parsed.type === 'tool_result') {
              const idx = toolStatusLines.reduce((found, l, i) => l.includes(`\`${parsed.toolName}\``) ? i : found, -1);
              const resultLine = parsed.success
                ? `✅ \`${parsed.toolName}\` → ${parsed.summary}`
                : `❌ \`${parsed.toolName}\` 失败：${parsed.summary}`;
              if (idx >= 0) toolStatusLines[idx] = resultLine;
              else toolStatusLines.push(resultLine);
              updateLastMsg(toolStatusLines.join('\n'));
            }

            if (parsed.type === 'generating') {
              toolStatusLines = [];
              fullContent = '';
              updateLastMsg('');
            }

            if (parsed.type === 'delta' && parsed.delta) {
              fullContent += parsed.delta;
              updateLastMsg(toolStatusLines.length > 0
                ? toolStatusLines.join('\n') + '\n\n' + fullContent
                : fullContent
              );
            }
          } catch { /* 忽略 */ }
        }
      }

      const parts = isReactMode
        ? extractReactCodeParts(fullContent)
        : extractCodeParts(fullContent);
      if (parts.jsx || parts.html || parts.css || parts.js || parts.isFullHtml) {
        setCodeParts(parts);
        setIsFromPreviousSession(false);
        handleSaveHistory(content, parts);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: lang === 'zh' ? '❌ 生成失败，请检查服务连接' : '❌ Generation failed',
          };
          return updated;
        });
      }
    } finally {
      setStreaming(false);
      setIsContinuing(false);
      setContinuationCount(0);
    }
  }, [streaming, lang, modelType, isReactMode, uploadedImage, abortRef, ensureSession, setMessages, setStreaming, setContinuationCount, setIsContinuing, setCodeParts, setIsFromPreviousSession, handleSaveHistory]);

  // ─── 发送消息（流式）——主入口 ──────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;

    setInput('');

    // 意图分析：根据 intent 和 complexity 决定走哪条路径
    try {
      const analysis = await analyzeTaskComplexity(trimmed);
      setPlanComplexity(analysis.complexity);

      // [element_modify] 标记：在现有页面基础上做局部修改
      if (trimmed.startsWith('[element_modify]')) {
        const currentHtml = codeParts?.isFullHtml
          ? codeParts.html
          : codeParts
            ? `<!DOCTYPE html><html><head><style>${codeParts.css || ''}</style></head><body>${codeParts.html || ''}<script>${codeParts.js || ''}</script></body></html>`
            : undefined;
        handleVibeStream(trimmed, currentHtml);
        return;
      }

      // 问答类 → 走 chat/stream 对话模式
      if (analysis.intent === 'qa') {
        // 继续往下走 chat/stream 逻辑
      } else if (analysis.complexity !== 'simple') {
        // moderate / complex 操作类 → 走 vibe/stream
        handleVibeStream(trimmed);
        return;
      } else {
        // simple + action → 也走 vibe/stream
        handleVibeStream(trimmed);
        return;
      }
    } catch {
      // 分析失败时降级为普通对话
    }

    // ── 普通对话流式 ──
    setMessages((prev) => [...prev, {
      role: 'user' as const,
      content: trimmed,
      timestamp: new Date().toISOString(),
    }]);
    setStreaming(true);

    setMessages((prev) => [...prev, {
      role: 'assistant' as const,
      content: '',
      timestamp: new Date().toISOString(),
    }]);

    abortRef.current = new AbortController();
    setContinuationCount(0);
    setIsContinuing(false);

    try {
      const currentSession = await ensureSession();

      const requestBody: Record<string, unknown> = {
        sessionId: currentSession.sessionId,
        message: trimmed,
      };
      if (uploadedImage && modelType === 'vision') {
        requestBody.imageBase64 = uploadedImage;
      }

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: abortRef.current.signal,
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let toolStatusLines: string[] = [];

      const updateLastMsg = (text: string) => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: text };
          return updated;
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.slice(6));

            if (parsed.type === 'tool_calls_start') {
              const names = (parsed.toolCalls as Array<{ name: string }>)
                .map((tc) => `🔧 \`${tc.name}\``)
                .join('、');
              toolStatusLines = [`**正在调用工具：** ${names}`];
              updateLastMsg(toolStatusLines.join('\n'));
            }

            if (parsed.type === 'tool_executing') {
              toolStatusLines.push(`⏳ 执行 \`${parsed.toolName}\`...`);
              updateLastMsg(toolStatusLines.join('\n'));
            }

            if (parsed.type === 'tool_result') {
              const idx = toolStatusLines.reduce((found, l, i) => l.includes(`\`${parsed.toolName}\``) ? i : found, -1);
              const resultLine = parsed.success
                ? `✅ \`${parsed.toolName}\` → ${parsed.summary}`
                : `❌ \`${parsed.toolName}\` 失败：${parsed.summary}`;
              if (idx >= 0) toolStatusLines[idx] = resultLine;
              else toolStatusLines.push(resultLine);
              updateLastMsg(toolStatusLines.join('\n'));
            }

            if (parsed.type === 'generating') {
              toolStatusLines = [];
              fullContent = '';
              updateLastMsg('');
            }

            if (parsed.type === 'delta') {
              if (parsed.delta === '' || parsed.delta === undefined) {
                setContinuationCount((c) => {
                  const next = c + 1;
                  setIsContinuing(next > 0);
                  return next;
                });
              } else {
                fullContent += parsed.delta;
                updateLastMsg(toolStatusLines.length > 0
                  ? toolStatusLines.join('\n') + '\n\n' + fullContent
                  : fullContent
                );
              }
            }
          } catch {
            // 忽略解析错误
          }
        }
      }

      const parts = isReactMode
        ? extractReactCodeParts(fullContent)
        : extractCodeParts(fullContent);
      if (parts.jsx || parts.html || parts.css || parts.js || parts.isFullHtml) {
        setCodeParts(parts);
        setIsFromPreviousSession(false);
        handleSaveHistory(trimmed, parts);
      }

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          timestamp: new Date().toISOString(),
          provider: currentSession.provider,
        };
        return updated;
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: lang === 'zh' ? '❌ 生成失败，请检查服务连接' : '❌ Generation failed, please check service connection',
            timestamp: new Date().toISOString(),
          };
          return updated;
        });
      }
    } finally {
      setStreaming(false);
      setIsContinuing(false);
      setContinuationCount(0);
    }
  }, [input, streaming, lang, codeParts, selectedAgent, provider, modelType, isReactMode, uploadedImage, abortRef, ensureSession, setInput, setMessages, setStreaming, setContinuationCount, setIsContinuing, setCodeParts, setIsFromPreviousSession, handleSaveHistory, setPlanComplexity, handleVibeStream]);

  return {
    handleSend,
    handleVibeStream,
    handleSendWithContent,
  };
};
