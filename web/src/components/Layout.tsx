import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Layout, Menu, Button, Drawer, Space, Tooltip, Tag,
} from 'antd';
import {
  HomeOutlined, RobotOutlined, ThunderboltOutlined, AppstoreOutlined,
  MessageOutlined, BookOutlined, BranchesOutlined, MenuOutlined,
  GlobalOutlined, ApiOutlined, SafetyCertificateOutlined, CheckSquareOutlined,
  TeamOutlined, LoginOutlined, UserOutlined, BulbOutlined,
  DeploymentUnitOutlined, ShareAltOutlined, ApartmentOutlined,
} from '@ant-design/icons';
import { useAppStore } from '../store';
import { fetchOverview, fetchOAuthProviders } from '../api';

const { Sider, Header, Content } = Layout;

const navItems = [
  { path: '/',          labelZh: '首页',        labelEn: 'Home',            icon: <HomeOutlined />,              exact: true  },
  { path: '/agents',    labelZh: 'Agent 库',    labelEn: 'Agents',          icon: <RobotOutlined />,             exact: false },
  { path: '/vibe',      labelZh: 'Vibe Coding', labelEn: 'Vibe Coding',     icon: <ThunderboltOutlined />,       exact: true  },
  { path: '/market',    labelZh: '模板市场',     labelEn: 'Template Market', icon: <AppstoreOutlined />,          exact: false },
  { path: '/chat',      labelZh: '对话',         labelEn: 'Chat',            icon: <MessageOutlined />,           exact: false },
  { path: '/knowledge', labelZh: '知识库',       labelEn: 'Knowledge',       icon: <BookOutlined />,              exact: false },
  { path: '/pipelines', labelZh: '工作流',       labelEn: 'Workflows',       icon: <BranchesOutlined />,          exact: false },
  { path: '/plan',      labelZh: '任务规划',     labelEn: 'Plan & Execute',  icon: <CheckSquareOutlined />,       exact: false },
  { path: '/multi-agent', labelZh: '多Agent协作',  labelEn: 'Multi-Agent',     icon: <TeamOutlined />,              exact: false },
  { path: '/memory',      labelZh: 'Agent 记忆',   labelEn: 'Memory',          icon: <BulbOutlined />,              exact: false },
  { path: '/skills',      labelZh: 'Skill 编排',   labelEn: 'Skills',          icon: <DeploymentUnitOutlined />,    exact: false },
  { path: '/knowledge-graph', labelZh: '知识图谱',  labelEn: 'Knowledge Graph', icon: <ApartmentOutlined />,         exact: false },
  { path: '/agent-market', labelZh: 'Agent 市场',   labelEn: 'Agent Market',    icon: <ShareAltOutlined />,          exact: false },
];

interface LayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { lang, setLang, activeProvider, setActiveProvider } = useAppStore();
  const [oauthProviders, setOauthProviders] = useState<Array<{ key: string; name: string; icon: string; enabled: boolean }>>([]);
  const isLoggedIn = !!localStorage.getItem('token');
  const username = localStorage.getItem('username');

  // 应用启动时从后端同步真实的 activeProvider
  useEffect(() => {
    fetchOverview()
      .then((data) => {
        if (data.providers?.active) {
          setActiveProvider(data.providers.active);
        }
      })
      .catch((err) => console.warn('同步 Provider 配置失败:', err));

    // 加载 OAuth Provider 列表
    fetchOAuthProviders()
      .then((data) => setOauthProviders(data.filter((p) => p.enabled)))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleLang = () => setLang(lang === 'zh' ? 'en' : 'zh');
  const handleToggleProvider = () => setActiveProvider(activeProvider === 'ollama' ? 'openai' : 'ollama');

  const selectedKey = navItems.find(({ path, exact }) =>
    exact ? location.pathname === path : location.pathname === path || location.pathname.startsWith(path + '/')
  )?.path ?? '/';

  const menuItems = navItems.map(({ path, labelZh, labelEn, icon }) => ({
    key: path,
    icon,
    label: <Link to={path} onClick={() => setDrawerOpen(false)}>{lang === 'zh' ? labelZh : labelEn}</Link>,
  }));

  const siderContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center shadow-sm flex-shrink-0">
          <RobotOutlined style={{ color: 'white', fontSize: 16 }} />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-800">Agency Agents</div>
          <div className="text-xs text-slate-400">AI 开发平台</div>
        </div>
      </div>

      {/* 导航菜单 */}
      <div className="flex-1 overflow-y-auto py-2">
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          style={{ border: 'none', background: 'transparent' }}
        />
      </div>

      {/* 底部工具栏 */}
      <div className="px-3 py-3 border-t border-slate-100 space-y-1">
        {/* Provider 切换 */}
        <Tooltip title="切换 AI 提供商">
          <Button
            type="text"
            size="small"
            icon={<ApiOutlined />}
            onClick={handleToggleProvider}
            className="w-full text-left text-slate-500 hover:text-slate-800"
            aria-label="切换 AI 提供商"
          >
            <span className="flex-1 text-left text-xs">
              {activeProvider === 'ollama' ? '🦙 Ollama' : '🤖 OpenAI'}
            </span>
            <Tag color="default" className="text-xs ml-auto">切换</Tag>
          </Button>
        </Tooltip>

        {/* 语言切换 */}
        <Button
          type="text"
          size="small"
          icon={<GlobalOutlined />}
          onClick={handleToggleLang}
          className="w-full text-left text-slate-500 hover:text-slate-800"
          aria-label="切换语言"
        >
          <span className="text-xs">{lang === 'zh' ? '中文' : 'English'}</span>
        </Button>

        {/* 管理后台入口 */}
        <a
          href={`${window.location.protocol}//${window.location.hostname}:5174/`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="管理后台"
          tabIndex={0}
        >
          <Button
            type="text"
            size="small"
            icon={<SafetyCertificateOutlined />}
            className="w-full text-left text-slate-400 hover:text-violet-600"
          >
            <span className="text-xs">管理后台</span>
          </Button>
        </a>

        {/* OAuth 登录 / 用户信息 */}
        {isLoggedIn ? (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-sky-50">
            <UserOutlined style={{ fontSize: 12, color: '#0284c7' }} />
            <span className="text-xs text-sky-700 truncate flex-1">{username || '已登录'}</span>
            <Button
              type="text"
              size="small"
              className="text-[10px] text-slate-400 hover:text-red-500 p-0"
              onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('username'); window.location.reload(); }}
              aria-label="退出登录"
            >
              退出
            </Button>
          </div>
        ) : oauthProviders.length > 0 ? (
          <div className="space-y-0.5">
            {oauthProviders.map((p) => (
              <a
                key={p.key}
                href={`/api/oauth/${p.key}`}
                aria-label={`${p.name} 登录`}
                tabIndex={0}
              >
                <Button
                  type="text"
                  size="small"
                  icon={<LoginOutlined />}
                  className="w-full text-left text-slate-500 hover:text-sky-600"
                >
                  <span className="text-xs">{p.icon} {p.name} 登录</span>
                </Button>
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <Layout className="h-screen overflow-hidden">
      {/* 桌面侧边栏 */}
      <Sider
        width={240}
        className="hidden lg:flex flex-col bg-white border-r border-slate-200 shadow-sm"
        style={{ background: '#fff' }}
      >
        {siderContent}
      </Sider>

      {/* 移动端抽屉 */}
      <Drawer
        placement="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={240}
        styles={{ body: { padding: 0 } }}
        className="lg:hidden"
      >
        {siderContent}
      </Drawer>

      <Layout>
        {/* 移动端顶部栏 */}
        <Header
          className="lg:hidden flex items-center gap-3 px-4 bg-white border-b border-slate-200 shadow-sm"
          style={{ height: 52, lineHeight: '52px', padding: '0 16px' }}
        >
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setDrawerOpen(true)}
            aria-label="打开菜单"
          />
          <span className="text-sm font-semibold text-slate-800">Agency Agents</span>
          <Space className="ml-auto">
            <Button type="text" size="small" icon={<GlobalOutlined />} onClick={handleToggleLang} aria-label="切换语言" />
            <Button type="text" size="small" icon={<ApiOutlined />} onClick={handleToggleProvider} aria-label="切换提供商" />
          </Space>
        </Header>

        <Content className="overflow-y-auto bg-slate-50">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
