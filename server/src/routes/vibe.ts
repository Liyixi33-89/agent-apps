/**
 * @file routes/vibe.ts
 * @description § 7  Vibe Coding 路由（单步 + 流式）
 *
 * 路由列表：
 *   POST /api/vibe/generate         → 单步生成（非流式）
 *   POST /api/vibe/stream           → 流式生成（SSE）
 *
 * Pipeline 路由（4步多Agent流水线）见 routes/vibePipeline.ts
 */

import Router from '@koa/router';
import { Agent } from '../models/Agent.js';
import type { IAgent } from '../models/Agent.js';
import { callLLM } from '../services/llmService.js';
import { env } from '../config/env.js';
import { streamWithContinuation } from '../lib/llmUtils.js';

export const vibeRouter = new Router();

// ─── 单步生成（非流式）  POST /api/vibe/generate ─────────────────────────────

vibeRouter.post('/vibe/generate', async (ctx) => {
  const { prompt, agentSlug, provider = env.activeProvider, modelType = 'text' } = ctx.request.body as Record<string, string>;

  let systemPrompt = `你是一个专业的 Vibe Coding 助手，擅长根据用户的自然语言描述生成高质量代码。
请遵循以下原则：
1. 代码要完整可运行
2. 使用现代最佳实践
3. 添加必要的注释
4. 考虑错误处理
5. 代码风格要一致`;

  if (agentSlug) {
    const agent = await Agent.findOne({ slug: agentSlug }).lean() as IAgent | null;
    if (agent) {
      systemPrompt = agent.rawMarkdown.slice(0, 2000) + '\n\n' + systemPrompt;
    }
  }

  const response = await callLLM(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    { provider: provider as 'ollama' | 'codebuddy', modelType: modelType as 'text' | 'vision' }
  );

  ctx.body = { success: true, data: { content: response.content, provider: response.provider, model: response.model } };
});

// ─── 流式生成  POST /api/vibe/stream ─────────────────────────────────────────

vibeRouter.post('/vibe/stream', async (ctx) => {
  const {
    prompt,
    agentSlug,
    provider = env.activeProvider,
    modelType = 'text',
    currentHtml,   // 当前页面 HTML（元素修改模式时传入）
    isReact,       // React 模式：生成 JSX 组件代码
  } = ctx.request.body as Record<string, string>;

  const reactMode = isReact === 'true' || isReact === true as unknown as string;

  let systemPrompt: string;

  if (reactMode) {
    // ── React 模式：生成 JSX 组件 ─────────────────────────────────────────────
    systemPrompt = `你是一个专业的 React 前端工程师，擅长根据用户描述生成高质量的 React 函数组件。
【强制要求】
1. 使用 React 函数组件 + Hooks（useState、useEffect 等）
2. 使用原生 CSS 进行样式设计（通过内联 style 对象或组件内定义 styles 常量），禁止使用 Tailwind CSS、className 类名方式
3. 样式要精致美观、现代化，注重间距、圆角、阴影、配色等细节
4. 组件必须默认导出（export default）
5. 输出格式必须严格为：\`\`\`jsx\n...完整组件代码...\n\`\`\`
6. 代码必须完整可运行，不能有省略或占位符
7. 禁止使用 import 语句（代码运行在浏览器 script 标签中，React Hooks 已作为全局变量提供）
8. 禁止使用 require 语句
9. 禁止引用任何外部库（antd、axios、lodash 等都不能用，只能使用 React 内置 Hooks）
10. 禁止输出任何解释文字，只输出代码块
11. 如果需要调用 API，使用原生 fetch 函数
12. 【极其重要】确保所有括号（圆括号、花括号、方括号）严格配对闭合，尤其是多层嵌套的 React.createElement 调用和箭头函数。每个 ( 必须有对应的 )，每个 { 必须有对应的 }，每个 [ 必须有对应的 ]。括号不匹配会导致编译失败。
13. 【空值保护】遍历数组数据时必须做空值过滤和安全访问：使用 (data || []).filter(Boolean).map(...) 而非直接 data.map(...)。访问对象属性时使用可选链 item?.name 或默认值 item.name || ''，防止后端返回 null 数据导致运行时崩溃。
14. 【style 规范】style 属性必须是纯对象（如 style={{ color: 'red', padding: 8 }}），绝对禁止传入数组（如 style={[{}, {}]}），禁止传入字符串。多个样式对象请用展开运算符合并：style={{ ...baseStyle, ...activeStyle }}。

【示例结构】
\`\`\`jsx
const styles = {
  container: { padding: '24px', fontFamily: 'system-ui, sans-serif' },
  title: { fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a' },
};

const App = () => {
  const [count, setCount] = useState(0);
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>...</h1>
    </div>
  );
};
export default App;
\`\`\``;
  } else if (currentHtml) {
    // ── 修改模式：在现有代码基础上做局部修改 ──────────────────────────────────
    systemPrompt = `你是一个专业的前端工程师，负责对已有 HTML 页面进行精准修改。
【任务说明】
用户提供了一个已有的 HTML 页面，需要你根据指令对其进行局部修改。

【强制要求】
1. 只修改用户指定的部分，其余代码保持完全不变
2. 必须输出完整的 HTML 文件（从 <!DOCTYPE html> 到 </html>），不能省略任何部分
3. 输出格式必须严格为：\`\`\`html\n...完整修改后的代码...\n\`\`\`
4. 禁止输出任何解释文字，只输出代码块
5. 禁止重新设计页面，只做最小化修改`;
  } else {
    // ── 生成模式：全新生成页面 ────────────────────────────────────────────────
    systemPrompt = `你是一个专业的 Vibe Coding 前端工程师，擅长根据用户描述生成完整的单文件 HTML 页面。
【强制要求】
1. 必须输出完整的 HTML 文件，包含 <!DOCTYPE html> 到 </html> 的全部内容
2. 所有 CSS 写在 <style> 标签内，所有 JS 写在 <script> 标签内
3. 使用 Tailwind CSS CDN（https://cdn.tailwindcss.com）确保页面美观现代
4. 输出格式必须严格为：\`\`\`html\n...完整代码...\n\`\`\`
5. 代码必须完整可运行，不能有省略或占位符`;

    if (agentSlug) {
      const agent = await Agent.findOne({ slug: agentSlug }).lean() as IAgent | null;
      if (agent) systemPrompt = agent.rawMarkdown.slice(0, 2000);
    }
  }

  // 构建用户消息：修改模式时附带当前 HTML
  const userMessage = currentHtml
    ? `【当前页面代码】\n\`\`\`html\n${currentHtml}\n\`\`\`\n\n【修改指令】\n${prompt}`
    : prompt;

  ctx.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  ctx.status = 200;

  const stream = streamWithContinuation(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
    { provider, modelType }
  );

  const res = ctx.res;
  res.write('data: {"type":"start"}\n\n');

  for await (const chunk of stream) {
    if (chunk.delta) {
      res.write(`data: ${JSON.stringify({ type: 'delta', delta: chunk.delta })}\n\n`);
    }
    if (chunk.done) break;
  }

  res.write('data: {"type":"done"}\n\n');
  res.end();
});
