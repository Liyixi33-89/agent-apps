import type { PromptCategory } from './types';

export const PROMPT_CATEGORIES: PromptCategory[] = [
  {
    label: { zh: '📱 手机官网', en: '📱 Mobile Site' },
    icon: '📱',
    color: 'text-sky-400 border-sky-500/30 bg-sky-500/5',
    prompts: [
      {
        zh: '一个 iPhone 风格的手机产品官网，全屏 Hero 区域展示手机渲染图，特性介绍、规格参数、购买按钮，深色主题',
        en: 'An iPhone-style phone product website with full-screen hero, features, specs, buy button, dark theme',
      },
      {
        zh: '一个 App 应用落地页，顶部导航 + 大标题 + 手机截图展示 + 功能特性 + 用户评价 + 下载按钮',
        en: 'An app landing page with nav, hero title, phone screenshots, features, reviews, download buttons',
      },
      {
        zh: '一个智能手表产品官网，渐变背景，产品 3D 展示区，核心功能卡片，价格方案，底部 CTA',
        en: 'A smartwatch product site with gradient bg, 3D product showcase, feature cards, pricing, CTA',
      },
    ],
  },
  {
    label: { zh: '🖥️ 后台管理', en: '🖥️ Admin Panel' },
    icon: '🖥️',
    color: 'text-violet-400 border-violet-500/30 bg-violet-500/5',
    prompts: [
      {
        zh: '一个电商后台管理系统，左侧深色导航栏，顶部 Header，数据统计卡片（订单/收入/用户/商品），订单数据表格，带状态标签和操作按钮',
        en: 'An e-commerce admin panel with dark sidebar, header, stat cards (orders/revenue/users/products), order table with status badges',
      },
      {
        zh: '一个 SaaS 数据分析 Dashboard，深色主题，KPI 卡片，柱状图和折线图（用 CSS 模拟），用户活跃度热力图，最近活动列表',
        en: 'A SaaS analytics dashboard, dark theme, KPI cards, bar/line charts (CSS simulated), activity heatmap, recent activity list',
      },
      {
        zh: '一个用户管理后台，侧边栏导航，用户列表表格（头像/姓名/角色/状态/操作），搜索过滤，分页，新增用户弹窗',
        en: 'A user management admin with sidebar, user table (avatar/name/role/status/actions), search, pagination, add user modal',
      },
    ],
  },
  {
    label: { zh: '🛍️ 电商落地页', en: '🛍️ E-commerce' },
    icon: '🛍️',
    color: 'text-orange-400 border-orange-500/30 bg-orange-500/5',
    prompts: [
      {
        zh: '一个潮牌服装电商首页，全屏 Banner 轮播，分类导航，新品推荐卡片网格，限时促销倒计时，品牌故事区',
        en: 'A fashion brand e-commerce homepage with banner carousel, category nav, new arrivals grid, countdown sale, brand story',
      },
      {
        zh: '一个商品详情页，大图展示 + 缩略图切换，商品名称/价格/评分，规格选择（颜色/尺码），加入购物车，相关推荐',
        en: 'A product detail page with image gallery, name/price/rating, variant selector (color/size), add to cart, related products',
      },
    ],
  },
  {
    label: { zh: '🎨 创意设计', en: '🎨 Creative' },
    icon: '🎨',
    color: 'text-pink-400 border-pink-500/30 bg-pink-500/5',
    prompts: [
      {
        zh: '一个设计师作品集网站，全屏深色背景，网格作品展示，悬停放大效果，个人简介，联系方式',
        en: 'A designer portfolio site, full-screen dark bg, grid works, hover zoom, bio, contact',
      },
      {
        zh: '一个 SaaS 产品定价页，三档套餐卡片（免费/专业/企业），功能对比列表，高亮推荐套餐，FAQ 折叠区',
        en: 'A SaaS pricing page with 3 tiers (free/pro/enterprise), feature comparison, highlighted plan, FAQ accordion',
      },
      {
        zh: '一个深色主题音乐播放器，专辑封面，歌词滚动，进度条，播放控制，播放列表侧边栏',
        en: 'A dark music player with album art, scrolling lyrics, progress bar, controls, playlist sidebar',
      },
    ],
  },
  {
    label: { zh: '🛠️ 工具应用', en: '🛠️ Tools' },
    icon: '🛠️',
    color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5',
    prompts: [
      {
        zh: '一个 Todo 任务管理应用，支持添加/完成/删除/优先级，分类标签，进度统计，拖拽排序动画',
        en: 'A Todo app with add/complete/delete/priority, category tags, progress stats, drag sort animation',
      },
      {
        zh: '一个在线简历生成器，左侧表单填写（姓名/经历/技能），右侧实时预览简历，支持导出',
        en: 'An online resume builder with left form (name/experience/skills) and right live preview, export support',
      },
    ],
  },
];

export const CODE_TABS = [
  { key: 'html' as const, label: 'HTML', color: 'text-orange-400', placeholder: '<!-- HTML 结构 -->' },
  { key: 'css'  as const, label: 'CSS',  color: 'text-sky-400',    placeholder: '/* CSS 样式 */' },
  { key: 'js'   as const, label: 'JS',   color: 'text-yellow-400', placeholder: '// JavaScript 逻辑' },
];

// React 模式下的代码 Tab（只有 JSX 一个 Tab）
export const REACT_CODE_TABS = [
  { key: 'jsx' as const, label: 'JSX', color: 'text-cyan-400', placeholder: '// React JSX 组件' },
];
