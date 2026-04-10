/**
 * @file config/mcpTemplates.ts
 * @description MCP Server 预置模板 — 常用 MCP Server 的快速配置
 *
 * 提供开箱即用的 MCP Server 模板，用户可一键添加：
 *   - Fetch（HTTP 请求）
 *   - Filesystem（文件系统操作）
 *   - GitHub（代码仓库管理）
 *   - SQLite（数据库查询）
 *   - Brave Search（网页搜索）
 *   - Puppeteer（浏览器自动化）
 */

export interface McpTemplate {
  key: string;
  name: string;
  description: string;
  icon: string;
  category: 'network' | 'filesystem' | 'database' | 'search' | 'automation' | 'development';
  transportType: 'stdio' | 'sse';
  stdioConfig?: {
    command: string;
    args: string[];
    env?: Record<string, string>;
  };
  sseConfig?: {
    url: string;
  };
  /** 安装说明 */
  installGuide: string;
  /** 预期的工具列表（供展示用） */
  expectedTools: Array<{ name: string; description: string }>;
}

export const MCP_TEMPLATES: McpTemplate[] = [
  {
    key: 'mcp-fetch',
    name: 'Fetch（HTTP 请求）',
    description: '发送 HTTP 请求，获取网页内容、调用 API。支持 GET/POST/PUT/DELETE 等方法。',
    icon: '🌐',
    category: 'network',
    transportType: 'stdio',
    stdioConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-fetch'],
    },
    installGuide: '无需额外安装，npx 会自动下载。确保已安装 Node.js 18+。',
    expectedTools: [
      { name: 'fetch', description: '发送 HTTP 请求并返回响应内容' },
    ],
  },
  {
    key: 'mcp-filesystem',
    name: 'Filesystem（文件系统）',
    description: '读写本地文件系统，支持文件的创建、读取、修改、删除和目录操作。',
    icon: '📁',
    category: 'filesystem',
    transportType: 'stdio',
    stdioConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/directory'],
    },
    installGuide: '需要指定允许访问的目录路径。将 args 中的路径替换为实际目录。',
    expectedTools: [
      { name: 'read_file', description: '读取文件内容' },
      { name: 'write_file', description: '写入文件内容' },
      { name: 'list_directory', description: '列出目录内容' },
      { name: 'create_directory', description: '创建目录' },
      { name: 'move_file', description: '移动/重命名文件' },
      { name: 'search_files', description: '搜索文件' },
    ],
  },
  {
    key: 'mcp-github',
    name: 'GitHub（代码仓库）',
    description: '管理 GitHub 仓库、Issue、PR、代码搜索等。需要 GitHub Personal Access Token。',
    icon: '🐙',
    category: 'development',
    transportType: 'stdio',
    stdioConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: '<your-token>' },
    },
    installGuide: '需要在 GitHub Settings > Developer settings > Personal access tokens 创建 Token，并填入 env 配置。',
    expectedTools: [
      { name: 'create_or_update_file', description: '创建或更新仓库文件' },
      { name: 'search_repositories', description: '搜索 GitHub 仓库' },
      { name: 'create_issue', description: '创建 Issue' },
      { name: 'create_pull_request', description: '创建 Pull Request' },
      { name: 'list_commits', description: '列出提交记录' },
    ],
  },
  {
    key: 'mcp-sqlite',
    name: 'SQLite（数据库）',
    description: '查询和管理 SQLite 数据库，支持 SQL 查询、表结构查看等。',
    icon: '🗄️',
    category: 'database',
    transportType: 'stdio',
    stdioConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sqlite', '--db-path', '/path/to/database.db'],
    },
    installGuide: '需要指定 SQLite 数据库文件路径。将 --db-path 后的路径替换为实际数据库文件。',
    expectedTools: [
      { name: 'read_query', description: '执行 SELECT 查询' },
      { name: 'write_query', description: '执行 INSERT/UPDATE/DELETE' },
      { name: 'create_table', description: '创建数据表' },
      { name: 'list_tables', description: '列出所有表' },
      { name: 'describe_table', description: '查看表结构' },
    ],
  },
  {
    key: 'mcp-brave-search',
    name: 'Brave Search（网页搜索）',
    description: '使用 Brave Search API 进行网页搜索，获取实时搜索结果。',
    icon: '🔍',
    category: 'search',
    transportType: 'stdio',
    stdioConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
      env: { BRAVE_API_KEY: '<your-api-key>' },
    },
    installGuide: '需要在 https://brave.com/search/api/ 注册并获取 API Key。',
    expectedTools: [
      { name: 'brave_web_search', description: '执行网页搜索' },
      { name: 'brave_local_search', description: '执行本地搜索（地点、商家等）' },
    ],
  },
  {
    key: 'mcp-puppeteer',
    name: 'Puppeteer（浏览器自动化）',
    description: '使用 Puppeteer 控制浏览器，支持页面截图、表单填写、数据抓取等。',
    icon: '🎭',
    category: 'automation',
    transportType: 'stdio',
    stdioConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    },
    installGuide: '需要安装 Chrome/Chromium 浏览器。首次运行会自动下载 Chromium。',
    expectedTools: [
      { name: 'puppeteer_navigate', description: '导航到指定 URL' },
      { name: 'puppeteer_screenshot', description: '截取页面截图' },
      { name: 'puppeteer_click', description: '点击页面元素' },
      { name: 'puppeteer_fill', description: '填写表单字段' },
      { name: 'puppeteer_evaluate', description: '在页面中执行 JavaScript' },
    ],
  },
  {
    key: 'mcp-memory',
    name: 'Memory（知识图谱记忆）',
    description: '基于知识图谱的持久化记忆系统，支持实体和关系的存储与检索。',
    icon: '🧠',
    category: 'database',
    transportType: 'stdio',
    stdioConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
    },
    installGuide: '无需额外安装。记忆数据存储在本地文件中。',
    expectedTools: [
      { name: 'create_entities', description: '创建知识实体' },
      { name: 'create_relations', description: '创建实体间关系' },
      { name: 'search_nodes', description: '搜索知识节点' },
      { name: 'open_nodes', description: '打开指定节点' },
    ],
  },
  {
    key: 'mcp-sequential-thinking',
    name: 'Sequential Thinking（思维链）',
    description: '提供结构化的思维链推理能力，帮助 Agent 进行复杂问题的分步推理。',
    icon: '🧩',
    category: 'automation',
    transportType: 'stdio',
    stdioConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    },
    installGuide: '无需额外安装。',
    expectedTools: [
      { name: 'sequentialthinking', description: '执行分步推理' },
    ],
  },
];

/** 按分类获取模板 */
export const getTemplatesByCategory = (category?: string): McpTemplate[] => {
  if (!category) return MCP_TEMPLATES;
  return MCP_TEMPLATES.filter(t => t.category === category);
};

/** 获取所有分类 */
export const getTemplateCategories = (): Array<{ key: string; name: string; count: number }> => {
  const categoryNames: Record<string, string> = {
    network: '网络请求',
    filesystem: '文件系统',
    database: '数据库',
    search: '搜索引擎',
    automation: '自动化',
    development: '开发工具',
  };

  const counts: Record<string, number> = {};
  for (const t of MCP_TEMPLATES) {
    counts[t.category] = (counts[t.category] || 0) + 1;
  }

  return Object.entries(categoryNames).map(([key, name]) => ({
    key,
    name,
    count: counts[key] || 0,
  }));
};
