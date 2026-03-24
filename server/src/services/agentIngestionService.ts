import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import slugify from 'slugify';
import { glob } from 'glob';
import { Agent } from '../models/Agent.js';
import { Category } from '../models/Category.js';
import { Pipeline } from '../models/Pipeline.js';
// 静态翻译词典，无需网络/大模型

// ─── 分类字典（中英文映射）────────────────────────────────────────────────────

const CATEGORY_DICT: Record<string, { zh: string; en: string; icon: string; color: string; sortOrder: number }> = {
  engineering: { zh: '工程开发', en: 'Engineering', icon: '⚙️', color: 'blue', sortOrder: 1 },
  product: { zh: '产品设计', en: 'Product Design', icon: '🎁', color: 'purple', sortOrder: 2 },
  design: { zh: '设计创意', en: 'Design', icon: '🎨', color: 'violet', sortOrder: 3 },
  marketing: { zh: '市场营销', en: 'Marketing', icon: '📣', color: 'orange', sortOrder: 4 },
  'paid-media': { zh: '付费媒体', en: 'Paid Media', icon: '💸', color: 'amber', sortOrder: 5 },
  sales: { zh: '销售业务', en: 'Sales', icon: '💼', color: 'yellow', sortOrder: 6 },
  strategy: { zh: '战略规划', en: 'Strategy', icon: '♟️', color: 'sky', sortOrder: 7 },
  academic: { zh: '学术研究', en: 'Academic', icon: '🎓', color: 'cyan', sortOrder: 8 },
  'project-management': { zh: '项目管理', en: 'Project Management', icon: '📋', color: 'teal', sortOrder: 9 },
  support: { zh: '客户支持', en: 'Support', icon: '🎧', color: 'green', sortOrder: 10 },
  testing: { zh: '测试质量', en: 'Testing', icon: '🧪', color: 'lime', sortOrder: 11 },
  specialized: { zh: '专业领域', en: 'Specialized', icon: '🔭', color: 'indigo', sortOrder: 12 },
  'game-development': { zh: '游戏开发', en: 'Game Development', icon: '🎮', color: 'pink', sortOrder: 13 },
  'spatial-computing': { zh: '空间计算', en: 'Spatial Computing', icon: '🥽', color: 'rose', sortOrder: 14 },
  data: { zh: '数据分析', en: 'Data Analysis', icon: '📊', color: 'emerald', sortOrder: 15 },
  operations: { zh: '运营管理', en: 'Operations', icon: '🔧', color: 'stone', sortOrder: 16 },
  writing: { zh: '内容写作', en: 'Writing', icon: '✍️', color: 'fuchsia', sortOrder: 17 },
  finance: { zh: '财务金融', en: 'Finance', icon: '💰', color: 'green', sortOrder: 18 },
  hr: { zh: '人力资源', en: 'Human Resources', icon: '👥', color: 'blue', sortOrder: 19 },
  legal: { zh: '法律合规', en: 'Legal', icon: '⚖️', color: 'red', sortOrder: 20 },
  general: { zh: '通用助手', en: 'General', icon: '🤖', color: 'slate', sortOrder: 99 }
};

// ─── 从目录路径推断分类 ────────────────────────────────────────────────────────

const inferCategoryFromPath = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const parts = normalized.split('/');

  // 优先：父目录名精确匹配分类 key（如 design/xxx.md → design）
  const parentDir = parts[parts.length - 2] || '';
  if (CATEGORY_DICT[parentDir]) return parentDir;

  // 次优：路径中某个目录段精确匹配分类 key（如 game-development/unity/xxx.md → game-development）
  for (const key of Object.keys(CATEGORY_DICT)) {
    if (parts.some((p) => p === key)) return key;
  }

  // 兜底：路径字符串包含分类 key
  for (const key of Object.keys(CATEGORY_DICT)) {
    if (normalized.includes(`/${key}/`) || normalized.includes(`/${key}-`)) {
      return key;
    }
  }

  return 'general';
};

// ─── 从 Markdown 内容提取章节 ─────────────────────────────────────────────────

const extractSections = (content: string) => {
  const lines = content.split('\n');
  const sections: Array<{ key: string; heading: { zh: string; en: string }; markdown: { zh: string; en: string }; order: number }> = [];
  let currentHeading = '';
  let currentLines: string[] = [];
  let order = 0;

  const flushSection = () => {
    if (!currentHeading) return;
    const markdown = currentLines.join('\n').trim();
    const key = slugify(currentHeading, { lower: true, strict: true }) || `section-${order}`;
    sections.push({
      key,
      heading: { zh: currentHeading, en: currentHeading },
      markdown: { zh: markdown, en: markdown },
      order: order++
    });
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flushSection();
      currentHeading = line.replace(/^##\s+/, '').trim();
      currentLines = [];
    } else if (currentHeading) {
      currentLines.push(line);
    }
  }
  flushSection();
  return sections;
};

// ─── 从 Markdown 提取标签 ─────────────────────────────────────────────────────

const extractTags = (content: string, frontmatter: Record<string, unknown>): string[] => {
  const tags = new Set<string>();

  // 从 frontmatter 提取
  if (Array.isArray(frontmatter.tags)) {
    frontmatter.tags.forEach((t: unknown) => typeof t === 'string' && tags.add(t.toLowerCase()));
  }

  // 从内容提取关键词（简单启发式）
  const keywords = ['AI', 'LLM', 'API', 'TypeScript', 'Python', 'React', 'Node.js', 'MongoDB', 'Docker', 'Kubernetes'];
  for (const kw of keywords) {
    if (content.includes(kw)) tags.add(kw.toLowerCase());
  }

  return Array.from(tags).slice(0, 10);
};

// ─── 从 Markdown 提取能力列表 ─────────────────────────────────────────────────

const extractCapabilities = (content: string): Array<{ zh: string; en: string }> => {
  const capabilities: Array<{ zh: string; en: string }> = [];
  const lines = content.split('\n');
  let inCapSection = false;

  for (const line of lines) {
    if (/能力|capabilities|skills|功能/i.test(line) && line.startsWith('#')) {
      inCapSection = true;
      continue;
    }
    if (inCapSection && line.startsWith('#')) {
      inCapSection = false;
    }
    if (inCapSection && /^[-*]\s+/.test(line)) {
      const text = line.replace(/^[-*]\s+/, '').trim();
      if (text) capabilities.push({ zh: text, en: text });
    }
  }

  return capabilities.slice(0, 10);
};

// ─── 从 Markdown 提取工作流节点 ───────────────────────────────────────────────

const extractWorkflowNodes = (content: string) => {
  const nodes: Array<{
    nodeId: string;
    label: { zh: string; en: string };
    type: string;
    dependsOn: string[];
    promptHint: { zh: string; en: string };
    modelType: 'text' | 'vision';
  }> = [];

  const lines = content.split('\n');
  let inWorkflowSection = false;
  let nodeIndex = 0;

  for (const line of lines) {
    if (/工作流|workflow|流程|process/i.test(line) && line.startsWith('#')) {
      inWorkflowSection = true;
      continue;
    }
    if (inWorkflowSection && line.startsWith('# ')) {
      inWorkflowSection = false;
    }
    if (inWorkflowSection && /^\d+\.\s+/.test(line)) {
      const text = line.replace(/^\d+\.\s+/, '').trim();
      if (text) {
        const nodeId = `node-${nodeIndex}`;
        const isVision = /图片|图像|视觉|image|vision|screenshot/i.test(text);
        nodes.push({
          nodeId,
          label: { zh: text, en: text },
          type: nodeIndex === 0 ? 'input' : nodeIndex === nodes.length ? 'output' : 'process',
          dependsOn: nodeIndex > 0 ? [`node-${nodeIndex - 1}`] : [],
          promptHint: { zh: `执行：${text}`, en: `Execute: ${text}` },
          modelType: isVision ? 'vision' : 'text'
        });
        nodeIndex++;
      }
    }
  }

  return nodes;
};

// ─── 批量翻译英文字段为中文 ──────────────────────────────────────────────────────

interface TranslateTarget {
  name: string;
  description: string;
  vibe: string;
  sectionHeadings: string[];
  capabilities: string[];
}

interface TranslateResult {
  name: string;
  description: string;
  vibe: string;
  sectionHeadings: string[];
  capabilities: string[];
}

// ─── 静态翻译词典（Agent 名称 + 通用术语）────────────────────────────────────

// Agent 名称精确映射
const AGENT_NAME_DICT: Record<string, string> = {
  // Academic
  'Anthropologist': '人类学家',
  'Geographer': '地理学家',
  'Historian': '历史学家',
  'Narratologist': '叙事学家',
  'Psychologist': '心理学家',
  'Study Abroad Advisor': '留学顾问',
  'Cultural Intelligence Strategist': '文化智能策略师',
  'French Consulting Market Navigator': '法国咨询市场导航师',
  'Korean Business Navigator': '韩国商务导航师',
  // Design
  'Brand Guardian': '品牌守护者',
  'Image Prompt Engineer': '图像提示工程师',
  'Inclusive Visuals Specialist': '包容性视觉专家',
  'UI Designer': 'UI 设计师',
  'UX Architect': 'UX 架构师',
  'UX Researcher': 'UX 研究员',
  'Visual Storyteller': '视觉叙事师',
  'Whimsy Injector': '创意注入师',
  // Engineering
  'AI Data Remediation Engineer': 'AI 数据修复工程师',
  'AI Engineer': 'AI 工程师',
  'Autonomous Optimization Architect': '自主优化架构师',
  'Backend Architect': '后端架构师',
  'Code Reviewer': '代码审查员',
  'Data Engineer': '数据工程师',
  'Database Optimizer': '数据库优化师',
  'DevOps Automator': 'DevOps 自动化工程师',
  'Embedded Firmware Engineer': '嵌入式固件工程师',
  'Feishu Integration Developer': '飞书集成开发者',
  'Frontend Developer': '前端开发者',
  'Git Workflow Master': 'Git 工作流专家',
  'Incident Response Commander': '事故响应指挥官',
  'Rapid Prototyper': '快速原型工程师',
  'Security Engineer': '安全工程师',
  'Senior Developer': '高级开发工程师',
  'Software Architect': '软件架构师',
  'Solidity Smart Contract Engineer': 'Solidity 智能合约工程师',
  'SRE (Site Reliability Engineer)': '站点可靠性工程师',
  'Technical Writer': '技术文档工程师',
  'Threat Detection Engineer': '威胁检测工程师',
  'WeChat Mini Program Developer': '微信小程序开发者',
  'Accessibility Auditor': '无障碍审计师',
  'Agentic Identity & Trust Architect': 'AI 身份与信任架构师',
  'Agents Orchestrator': 'Agent 编排师',
  'Automation Governance Architect': '自动化治理架构师',
  'Behavioral Nudge Engine': '行为助推引擎',
  'Blockchain Security Auditor': '区块链安全审计师',
  'Infrastructure Maintainer': '基础设施维护工程师',
  'LSP/Index Engineer': 'LSP/索引工程师',
  'MCP Memory Integration': 'MCP 记忆集成工程师',
  'Model QA Specialist': '模型质量保证专家',
  'Terminal Integration Specialist': '终端集成专家',
  'ZK Steward': 'ZK 协议管理员',
  // IDE Integrations
  'Aider Integration': 'Aider 集成专家',
  'Claude Code Integration': 'Claude Code 集成专家',
  'Cursor Integration': 'Cursor 集成专家',
  'Gemini CLI Integration': 'Gemini CLI 集成专家',
  'GitHub Copilot Integration': 'GitHub Copilot 集成专家',
  'OpenClaw Integration': 'OpenClaw 集成专家',
  'Windsurf Integration': 'Windsurf 集成专家',
  // Game Development
  'Game Audio Engineer': '游戏音频工程师',
  'Game Designer': '游戏设计师',
  'Level Designer': '关卡设计师',
  'Narrative Designer': '叙事设计师',
  'Technical Artist': '技术美术',
  'Blender Add-on Engineer': 'Blender 插件工程师',
  'Godot Gameplay Scripter': 'Godot 游戏脚本工程师',
  'Godot Multiplayer Engineer': 'Godot 多人游戏工程师',
  'Godot Shader Developer': 'Godot 着色器开发者',
  'Unity Gameplay Engineer': 'Unity 游戏工程师',
  'Unity Architect': 'Unity 架构师',
  'Unity Editor Tool Developer': 'Unity 编辑器工具开发者',
  'Unity Multiplayer Engineer': 'Unity 多人游戏工程师',
  'Unity Shader Graph Artist': 'Unity 着色器图艺术家',
  'Unreal Engine Specialist': '虚幻引擎专家',
  'Unreal Multiplayer Architect': '虚幻多人游戏架构师',
  'Unreal Systems Engineer': '虚幻系统工程师',
  'Unreal Technical Artist': '虚幻技术美术',
  'Roblox Avatar Creator': 'Roblox 角色创作者',
  'Roblox Experience Designer': 'Roblox 体验设计师',
  'Roblox Systems Scripter': 'Roblox 系统脚本工程师',
  // Marketing
  'App Store Optimizer': '应用商店优化师',
  'Book Co-Author': '图书联合作者',
  'China Ecommerce Operator': '中国电商运营专家',
  'China E-Commerce Operator': '中国电商运营专家',
  'Baidu SEO Specialist': '百度 SEO 专家',
  'AI Citation Strategist': 'AI 引用策略师',
  'Brand Storyteller': '品牌故事讲述者',
  'Community Manager': '社区运营经理',
  'Content Strategist': '内容策略师',
  'Content Creator': '内容创作者',
  'Conversion Copywriter': '转化文案师',
  'Email Marketing Specialist': '邮件营销专家',
  'Growth Hacker': '增长黑客',
  'Influencer Marketing Manager': '网红营销经理',
  'Market Research Analyst': '市场调研分析师',
  'PR Specialist': '公关专家',
  'SEO Specialist': 'SEO 专家',
  'Social Media Manager': '社交媒体运营经理',
  'Social Media Strategist': '社交媒体策略师',
  'Video Marketing Specialist': '视频营销专家',
  'Bilibili Content Strategist': 'B站内容策略师',
  'Carousel Growth Engine': '轮播增长引擎',
  'Douyin Strategist': '抖音策略师',
  'Healthcare Marketing Compliance Specialist': '医疗营销合规专家',
  'Instagram Curator': 'Instagram 内容策划师',
  'Kuaishou Strategist': '快手策略师',
  'LinkedIn Content Creator': 'LinkedIn 内容创作者',
  'Livestream Commerce Coach': '直播电商教练',
  'Podcast Strategist': '播客策略师',
  'Private Domain Operator': '私域运营专家',
  'Short-Video Editing Coach': '短视频剪辑教练',
  'TikTok Strategist': 'TikTok 策略师',
  'Trend Researcher': '趋势研究员',
  'Twitter Engager': 'Twitter 互动专家',
  'WeChat Official Account Manager': '微信公众号运营经理',
  'Weibo Strategist': '微博策略师',
  'Xiaohongshu Specialist': '小红书运营专家',
  'Zhihu Strategist': '知乎策略师',
  'Cross-Border E-Commerce Specialist': '跨境电商专家',
  // Product
  'Product Manager': '产品经理',
  'Product Strategist': '产品策略师',
  'Product Designer': '产品设计师',
  'Product Analyst': '产品分析师',
  'Growth Product Manager': '增长产品经理',
  'Mobile Product Manager': '移动端产品经理',
  'Developer Advocate': '开发者布道师',
  'Discovery Coach': '探索教练',
  // Data
  'Data Analyst': '数据分析师',
  'Data Scientist': '数据科学家',
  'Business Intelligence Analyst': '商业智能分析师',
  'ML Engineer': '机器学习工程师',
  'Data Visualization Specialist': '数据可视化专家',
  'Analytics Reporter': '数据分析报告师',
  'Experiment Tracker': '实验追踪师',
  'Performance Benchmarker': '性能基准测试师',
  'Search Query Analyst': '搜索查询分析师',
  // Finance
  'Financial Analyst': '财务分析师',
  'Investment Analyst': '投资分析师',
  'CFO Advisor': 'CFO 顾问',
  'Tax Specialist': '税务专家',
  'Risk Manager': '风险管理师',
  'Accounts Payable Agent': '应付账款专员',
  'Finance Tracker': '财务追踪师',
  // HR
  'HR Manager': '人力资源经理',
  'Recruiter': '招聘专员',
  'Recruitment Specialist': '招聘专家',
  'Talent Acquisition Specialist': '人才招募专家',
  'Learning & Development Specialist': '学习与发展专家',
  'Corporate Training Designer': '企业培训设计师',
  // Legal
  'Legal Advisor': '法律顾问',
  'Contract Specialist': '合同专家',
  'Compliance Officer': '合规官',
  'Compliance Auditor': '合规审计师',
  'Legal Compliance Checker': '法律合规检查员',
  // Operations
  'Operations Manager': '运营经理',
  'Process Optimizer': '流程优化师',
  'Supply Chain Manager': '供应链经理',
  'Supply Chain Strategist': '供应链策略师',
  'Project Coordinator': '项目协调员',
  'Studio Operations': '工作室运营',
  'Studio Producer': '工作室制作人',
  'Workflow Architect': '工作流架构师',
  'Workflow Optimizer': '工作流优化师',
  // Paid Media
  'Paid Media Specialist': '付费媒体专家',
  'Paid Media Auditor': '付费媒体审计师',
  'Paid Social Strategist': '付费社交策略师',
  'PPC Specialist': 'PPC 广告专家',
  'PPC Campaign Strategist': 'PPC 广告活动策略师',
  'Programmatic Advertising Specialist': '程序化广告专家',
  'Programmatic & Display Buyer': '程序化与展示广告采购师',
  'Ad Creative Strategist': '广告创意策略师',
  'Tracking & Measurement Specialist': '追踪与衡量专家',
  // Project Management
  'Project Manager': '项目经理',
  'Senior Project Manager': '高级项目经理',
  'Project Shepherd': '项目守护者',
  'Scrum Master': 'Scrum 敏捷教练',
  'Agile Coach': '敏捷教练',
  'Sprint Prioritizer': '迭代优先级规划师',
  'Jira Workflow Steward': 'Jira 工作流管理员',
  // Sales
  'Sales Manager': '销售经理',
  'Sales Coach': '销售教练',
  'Sales Engineer': '销售工程师',
  'Account Executive': '客户主管',
  'Account Strategist': '客户策略师',
  'Sales Development Representative': '销售开发代表',
  'Customer Success Manager': '客户成功经理',
  'Deal Strategist': '交易策略师',
  'Outbound Strategist': '外向销售策略师',
  'Proposal Strategist': '提案策略师',
  'Salesforce Architect': 'Salesforce 架构师',
  'Government Digital Presales Consultant': '政府数字化售前顾问',
  // Spatial Computing
  'AR Developer': 'AR 开发者',
  'VR Developer': 'VR 开发者',
  'Spatial UX Designer': '空间 UX 设计师',
  'macOS Spatial/Metal Engineer': 'macOS 空间/Metal 工程师',
  'visionOS Spatial Engineer': 'visionOS 空间工程师',
  'XR Cockpit Interaction Specialist': 'XR 座舱交互专家',
  'XR Immersive Developer': 'XR 沉浸式开发者',
  'XR Interface Architect': 'XR 界面架构师',
  // Strategy
  'Strategy Consultant': '战略顾问',
  'Business Analyst': '商业分析师',
  'Innovation Manager': '创新经理',
  // Support
  'Customer Support Specialist': '客户支持专家',
  'Technical Support Engineer': '技术支持工程师',
  'Support Responder': '支持响应专员',
  'Feedback Synthesizer': '反馈综合分析师',
  'Reality Checker': '现实核查员',
  // Testing
  'QA Engineer': 'QA 工程师',
  'Test Automation Engineer': '测试自动化工程师',
  'Performance Tester': '性能测试工程师',
  'API Tester': 'API 测试工程师',
  'Test Results Analyzer': '测试结果分析师',
  'Tool Evaluator': '工具评估师',
  // Writing
  'Content Writer': '内容写作者',
  'Copywriter': '文案策划',
  'Technical Editor': '技术编辑',
  'Blog Writer': '博客写作者',
  'Document Generator': '文档生成器',
  'Executive Summary Generator': '执行摘要生成器',
  // General / Specialized
  'General Assistant': '通用助手',
  'Research Assistant': '研究助手',
  'Pipeline Analyst': '流水线分析师',
  'Identity Graph Operator': '身份图谱运营师',
  'Data Consolidation Agent': '数据整合专员',
  'Sales Data Extraction Agent': '销售数据提取专员',
  'Evidence Collector': '证据收集员',
};

// 通用词汇替换规则（按词组长度降序，避免短词覆盖长词）
const TERM_REPLACEMENTS: Array<[RegExp, string]> = [
  // 职位/角色
  [/\bApp Store Optim\w+/gi, '应用商店优化'],
  [/\bSite Reliability Engineer/gi, '站点可靠性工程师'],
  [/\bSmart Contract/gi, '智能合约'],
  [/\bMachine Learning/gi, '机器学习'],
  [/\bArtificial Intelligence/gi, '人工智能'],
  [/\bNatural Language Processing/gi, '自然语言处理'],
  [/\bLarge Language Model/gi, '大语言模型'],
  [/\bReinforcement Learning/gi, '强化学习'],
  [/\bDeep Learning/gi, '深度学习'],
  // 技术术语
  [/\bApplication Programming Interface/gi, '应用程序接口'],
  [/\bContinuous Integration\/Continuous Deployment/gi, 'CI/CD'],
  [/\bInfrastructure as Code/gi, '基础设施即代码'],
  [/\bMicroservices Architecture/gi, '微服务架构'],
  [/\bEvent-Driven Architecture/gi, '事件驱动架构'],
  [/\bTest-Driven Development/gi, '测试驱动开发'],
  [/\bDomain-Driven Design/gi, '领域驱动设计'],
  // 动词短语
  [/\bOptimize\b/gi, '优化'],
  [/\bAnalyze\b/gi, '分析'],
  [/\bImplement\b/gi, '实现'],
  [/\bDevelop\b/gi, '开发'],
  [/\bDesign\b/gi, '设计'],
  [/\bManage\b/gi, '管理'],
  [/\bMonitor\b/gi, '监控'],
  [/\bAutomate\b/gi, '自动化'],
  [/\bDeploy\b/gi, '部署'],
  [/\bIntegrate\b/gi, '集成'],
  [/\bCollaborate\b/gi, '协作'],
  [/\bCoordinate\b/gi, '协调'],
  [/\bStreamline\b/gi, '精简'],
  [/\bEnhance\b/gi, '增强'],
  [/\bImprove\b/gi, '改进'],
  [/\bMaximize\b/gi, '最大化'],
  [/\bMinimize\b/gi, '最小化'],
  [/\bEnsure\b/gi, '确保'],
  [/\bFacilitate\b/gi, '促进'],
  [/\bLeverage\b/gi, '利用'],
  [/\bDrive\b/gi, '驱动'],
  [/\bScale\b/gi, '扩展'],
  [/\bTransform\b/gi, '转型'],
  [/\bDeliver\b/gi, '交付'],
  [/\bExecute\b/gi, '执行'],
  [/\bMaintain\b/gi, '维护'],
  [/\bRefactor\b/gi, '重构'],
  [/\bDebug\b/gi, '调试'],
  [/\bTest\b/gi, '测试'],
  [/\bReview\b/gi, '审查'],
  [/\bDocument\b/gi, '文档化'],
  [/\bResearch\b/gi, '研究'],
  [/\bCreate\b/gi, '创建'],
  [/\bBuild\b/gi, '构建'],
  [/\bLaunch\b/gi, '发布'],
  [/\bMeasure\b/gi, '衡量'],
  [/\bTrack\b/gi, '追踪'],
  [/\bReport\b/gi, '报告'],
  // 名词
  [/\bPerformance\b/gi, '性能'],
  [/\bSecurity\b/gi, '安全'],
  [/\bScalability\b/gi, '可扩展性'],
  [/\bReliability\b/gi, '可靠性'],
  [/\bAvailability\b/gi, '可用性'],
  [/\bMaintainability\b/gi, '可维护性'],
  [/\bWorkflow\b/gi, '工作流'],
  [/\bPipeline\b/gi, '流水线'],
  [/\bFramework\b/gi, '框架'],
  [/\bArchitecture\b/gi, '架构'],
  [/\bStrategy\b/gi, '策略'],
  [/\bSolution\b/gi, '解决方案'],
  [/\bRequirement\b/gi, '需求'],
  [/\bSpecification\b/gi, '规范'],
  [/\bDocumentation\b/gi, '文档'],
  [/\bDashboard\b/gi, '仪表盘'],
  [/\bAnalytics\b/gi, '分析'],
  [/\bMetrics\b/gi, '指标'],
  [/\bInsights\b/gi, '洞察'],
  [/\bBest Practices\b/gi, '最佳实践'],
  [/\bUser Experience\b/gi, '用户体验'],
  [/\bUser Interface\b/gi, '用户界面'],
  [/\bConversion Rate\b/gi, '转化率'],
  [/\bReturn on Investment\b/gi, '投资回报率'],
  [/\bKey Performance Indicator/gi, '关键绩效指标'],
  [/\bStakeholder\b/gi, '利益相关者'],
  [/\bRoadmap\b/gi, '路线图'],
  [/\bSprint\b/gi, '迭代冲刺'],
  [/\bBacklog\b/gi, '待办列表'],
  [/\bMilestone\b/gi, '里程碑'],
  [/\bDeadline\b/gi, '截止日期'],
  [/\bPriority\b/gi, '优先级'],
  [/\bFeedback\b/gi, '反馈'],
  [/\bIteration\b/gi, '迭代'],
  [/\bPrototype\b/gi, '原型'],
  [/\bMockup\b/gi, '设计稿'],
  [/\bWireframe\b/gi, '线框图'],
  [/\bComponent\b/gi, '组件'],
  [/\bModule\b/gi, '模块'],
  [/\bService\b/gi, '服务'],
  [/\bEndpoint\b/gi, '接口端点'],
  [/\bDatabase\b/gi, '数据库'],
  [/\bRepository\b/gi, '代码仓库'],
  [/\bDeployment\b/gi, '部署'],
  [/\bEnvironment\b/gi, '环境'],
  [/\bConfiguration\b/gi, '配置'],
  [/\bIntegration\b/gi, '集成'],
  [/\bAutomation\b/gi, '自动化'],
  [/\bOptimization\b/gi, '优化'],
  [/\bValidation\b/gi, '验证'],
  [/\bAuthentication\b/gi, '认证'],
  [/\bAuthorization\b/gi, '授权'],
  [/\bEncryption\b/gi, '加密'],
  [/\bCompliance\b/gi, '合规'],
  [/\bAudit\b/gi, '审计'],
  [/\bIncident\b/gi, '事故'],
  [/\bAlert\b/gi, '告警'],
  [/\bLog\b/gi, '日志'],
  [/\bCache\b/gi, '缓存'],
  [/\bLoad Balancer\b/gi, '负载均衡器'],
  [/\bContainer\b/gi, '容器'],
  [/\bOrchestration\b/gi, '编排'],
  [/\bCluster\b/gi, '集群'],
  [/\bNode\b/gi, '节点'],
  [/\bNetwork\b/gi, '网络'],
  [/\bStorage\b/gi, '存储'],
  [/\bBackup\b/gi, '备份'],
  [/\bRecovery\b/gi, '恢复'],
  [/\bMigration\b/gi, '迁移'],
  [/\bRefactoring\b/gi, '重构'],
  [/\bCode Review\b/gi, '代码审查'],
  [/\bUnit Test\b/gi, '单元测试'],
  [/\bIntegration Test\b/gi, '集成测试'],
  [/\bEnd-to-End Test\b/gi, '端到端测试'],
  [/\bLoad Test\b/gi, '负载测试'],
  [/\bStress Test\b/gi, '压力测试'],
  // 形容词
  [/\bScalable\b/gi, '可扩展的'],
  [/\bRobust\b/gi, '健壮的'],
  [/\bEfficient\b/gi, '高效的'],
  [/\bSecure\b/gi, '安全的'],
  [/\bReliable\b/gi, '可靠的'],
  [/\bMaintainable\b/gi, '可维护的'],
  [/\bFlexible\b/gi, '灵活的'],
  [/\bModular\b/gi, '模块化的'],
  [/\bReusable\b/gi, '可复用的'],
  [/\bTestable\b/gi, '可测试的'],
  [/\bAccessible\b/gi, '可访问的'],
  [/\bResponsive\b/gi, '响应式的'],
  [/\bIntelligent\b/gi, '智能的'],
  [/\bAutomated\b/gi, '自动化的'],
  [/\bData-driven\b/gi, '数据驱动的'],
  [/\bCloud-native\b/gi, '云原生的'],
  [/\bOpen-source\b/gi, '开源的'],
  [/\bReal-time\b/gi, '实时的'],
  [/\bHigh-performance\b/gi, '高性能的'],
  [/\bCross-platform\b/gi, '跨平台的'],
  [/\bFull-stack\b/gi, '全栈'],
  [/\bEnd-to-end\b/gi, '端到端'],
  // 章节标题常见词
  [/\bYour Identity & Memory\b/gi, '身份与记忆'],
  [/\bYour Core Mission\b/gi, '核心使命'],
  [/\bCritical Rules\b/gi, '关键规则'],
  [/\bTechnical Deliverables\b/gi, '技术交付物'],
  [/\bWorkflow Process\b/gi, '工作流程'],
  [/\bDeliverable Template\b/gi, '交付模板'],
  [/\bCommunication Style\b/gi, '沟通风格'],
  [/\bLearning & Memory\b/gi, '学习与记忆'],
  [/\bSuccess Metrics\b/gi, '成功指标'],
  [/\bAdvanced Capabilities\b/gi, '高级能力'],
  [/\bCore Capabilities\b/gi, '核心能力'],
  [/\bKey Responsibilities\b/gi, '主要职责'],
  [/\bBest Practices\b/gi, '最佳实践'],
  [/\bGetting Started\b/gi, '快速开始'],
  [/\bOverview\b/gi, '概述'],
  [/\bIntroduction\b/gi, '介绍'],
  [/\bBackground\b/gi, '背景'],
  [/\bObjectives\b/gi, '目标'],
  [/\bApproach\b/gi, '方法'],
  [/\bMethodology\b/gi, '方法论'],
  [/\bExamples\b/gi, '示例'],
  [/\bReferences\b/gi, '参考资料'],
  [/\bConclusion\b/gi, '总结'],
  [/\bSummary\b/gi, '摘要'],
  [/\bNext Steps\b/gi, '下一步'],
  [/\bAction Items\b/gi, '行动项'],
  [/\bKey Takeaways\b/gi, '关键要点'],
  [/\bFAQ\b/gi, '常见问题'],
  [/\bTroubleshooting\b/gi, '故障排查'],
  [/\bGlossary\b/gi, '术语表'],
  [/\bAppendix\b/gi, '附录'],
];

// 清理 MD 文件中的乱码特殊字符
const sanitizeText = (text: string): string =>
  text
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u024F\u2000-\u206F\u2E00-\u2E7F\u3000-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

// 静态翻译：先查精确词典，再做规则替换，完全离线
const translateOne = (text: string): string => {
  const clean = sanitizeText(text);
  if (!clean) return text;

  // 1. 精确匹配 Agent 名称词典
  const exactMatch = AGENT_NAME_DICT[clean];
  if (exactMatch) return exactMatch;

  // 2. 规则替换（按顺序逐条替换）
  let result = clean;
  for (const [pattern, replacement] of TERM_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
};

const translateAgentFields = (target: TranslateTarget): TranslateResult => ({
  name: translateOne(target.name),
  description: translateOne(target.description),
  vibe: translateOne(target.vibe),
  sectionHeadings: target.sectionHeadings.map(translateOne),
  capabilities: target.capabilities.map(translateOne),
});

// ─── 处理单个 Markdown 文件 ───────────────────────────────────────────────────

const processMarkdownFile = async (filePath: string, rootDir: string, translate = false) => {
  const raw = await fs.readFile(filePath, 'utf-8');
  const { data: frontmatter, content } = matter(raw);

  const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
  const fileName = path.basename(filePath, '.md');
  const categoryKey = inferCategoryFromPath(filePath);

  // 生成 slug
  const slug = slugify(frontmatter.slug || frontmatter.title || fileName, {
    lower: true,
    strict: true,
    locale: 'en'
  }) || fileName.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  // 提取名称
  const titleFromContent = content.match(/^#\s+(.+)/m)?.[1]?.trim() || fileName;
  const nameZh = (frontmatter.title as string) || titleFromContent;
  const nameEn = (frontmatter.titleEn as string) || nameZh;

  // 提取描述
  const descMatch = content.match(/^(?!#)[^\n]{20,200}/m);
  const descZh = (frontmatter.description as string) || descMatch?.[0]?.trim() || nameZh;
  const descEn = (frontmatter.descriptionEn as string) || descZh;

  // 提取 vibe（一句话介绍）
  const vibeZh = (frontmatter.vibe as string) || descZh.slice(0, 80);
  const vibeEn = (frontmatter.vibeEn as string) || vibeZh;

  const sections = extractSections(content);
  const tags = extractTags(content, frontmatter);
  const capabilities = extractCapabilities(content);
  const workflowNodes = extractWorkflowNodes(content);

  const wordCount = content.split(/\s+/).length;
  const isVisionAgent = /视觉|图像|image|vision|screenshot/i.test(content);

  // ── 翻译：将英文字段翻译为中文 ──────────────────────────────────────────────
  let finalNameZh = nameZh;
  let finalDescZh = descZh;
  let finalVibeZh = vibeZh;
  let finalSectionHeadingsZh = sections.map((s) => s.heading.zh);
  let finalCapabilitiesZh = capabilities.map((c) => c.zh);

  if (translate) {
    const translated = translateAgentFields({
      name: nameEn,
      description: descEn,
      vibe: vibeEn,
      sectionHeadings: sections.map((s) => s.heading.en),
      capabilities: capabilities.map((c) => c.en)
    });
    finalNameZh = translated.name;
    finalDescZh = translated.description;
    finalVibeZh = translated.vibe;
    finalSectionHeadingsZh = translated.sectionHeadings;
    finalCapabilitiesZh = translated.capabilities;
  }

  // 将翻译结果写回 sections 和 capabilities
  const localizedSections = sections.map((s, i) => ({
    ...s,
    heading: { zh: finalSectionHeadingsZh[i] ?? s.heading.en, en: s.heading.en }
  }));
  const localizedCapabilities = capabilities.map((c, i) => ({
    zh: finalCapabilitiesZh[i] ?? c.en,
    en: c.en
  }));

  return {
    slug,
    categoryKey,
    name: { zh: finalNameZh, en: nameEn },
    description: { zh: finalDescZh, en: descEn },
    vibe: { zh: finalVibeZh, en: vibeEn },
    emoji: (frontmatter.emoji as string) || '🤖',
    color: (frontmatter.color as string) || CATEGORY_DICT[categoryKey]?.color || 'slate',
    sourcePath: relativePath,
    rawMarkdown: raw,
    frontmatter: frontmatter as Record<string, unknown>,
    sections: localizedSections,
    tags,
    capabilities: localizedCapabilities,
    workflow: {
      summary: { zh: `${nameZh} 的工作流程`, en: `${nameEn} workflow` },
      nodes: workflowNodes
    },
    modelPreferences: {
      primary: isVisionAgent ? ('vision' as const) : ('text' as const),
      recommendedProvider: 'ollama' as const
    },
    stats: {
      sectionCount: sections.length,
      wordCount
    }
  };
};

// ─── 同步分类到数据库 ─────────────────────────────────────────────────────────

const syncCategories = async (categoryKeys: string[]) => {
  const uniqueKeys = [...new Set(categoryKeys)];
  let totalCategories = 0;

  for (const key of uniqueKeys) {
    const dict = CATEGORY_DICT[key] || CATEGORY_DICT.general;
    await Category.findOneAndUpdate(
      { key },
      {
        $set: {
          name: { zh: dict.zh, en: dict.en },
          icon: dict.icon,
          color: dict.color,
          sortOrder: dict.sortOrder
        }
      },
      { upsert: true, new: true }
    );
    totalCategories++;
  }

  // 更新每个分类的 agentCount
  for (const key of uniqueKeys) {
    const count = await Agent.countDocuments({ categoryKey: key });
    await Category.updateOne({ key }, { $set: { 'stats.agentCount': count } });
  }

  return totalCategories;
};

// ─── 主入口：从 Markdown 批量导入 Agent ──────────────────────────────────────

export interface IngestResult {
  totalAgents: number;
  totalCategories: number;
  created: number;
  updated: number;
  errors: Array<{ file: string; error: string }>;
}

export const ingestAgentsFromMarkdown = async (rootDir: string, translate = false): Promise<IngestResult> => {
  const result: IngestResult = {
    totalAgents: 0,
    totalCategories: 0,
    created: 0,
    updated: 0,
    errors: []
  };

  // 查找所有 Markdown 文件（排除 node_modules、.git 等）
  const mdFiles = await glob('**/*.md', {
    cwd: rootDir,
    absolute: true,
    ignore: [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**'
    ]
  });

  if (mdFiles.length === 0) {
    console.log('⚠️  未找到任何 Markdown 文件');
    return result;
  }

  console.log(`📂 找到 ${mdFiles.length} 个 Markdown 文件，开始处理...`);

  const categoryKeys: string[] = [];

  for (const filePath of mdFiles) {
    try {
      const agentData = await processMarkdownFile(filePath, rootDir, translate);
      categoryKeys.push(agentData.categoryKey);

      const existing = await Agent.findOne({ slug: agentData.slug });
      if (existing) {
        await Agent.updateOne({ slug: agentData.slug }, { $set: agentData });
        result.updated++;
      } else {
        await Agent.create(agentData);
        result.created++;
      }
      result.totalAgents++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ file: filePath, error: message });
      console.error(`❌ 处理失败: ${filePath}`, message);
    }
  }

  // 同步分类
  result.totalCategories = await syncCategories(categoryKeys);

  console.log(`✅ 导入完成：${result.totalAgents} 个 Agent（新建 ${result.created}，更新 ${result.updated}），${result.totalCategories} 个分类`);
  if (result.errors.length > 0) {
    console.warn(`⚠️  ${result.errors.length} 个文件处理失败`);
  }

  return result;
};
