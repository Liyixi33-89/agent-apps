import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Layout, Menu, Avatar, Button, Drawer, Typography, Space, Tooltip,
} from 'antd';
import {
  DashboardOutlined, RobotOutlined, BookOutlined, BranchesOutlined,
  MessageOutlined, SettingOutlined, LogoutOutlined, MenuOutlined,
  ThunderboltOutlined, AppstoreOutlined, CloudOutlined, ApiOutlined,
} from '@ant-design/icons';
import { useAdminStore } from '../store';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const navItems = [
  { path: '/',                label: '仪表盘',    icon: <DashboardOutlined /> },
  { path: '/agents',          label: 'Agent 管理', icon: <RobotOutlined /> },
  { path: '/knowledge',       label: '知识库管理', icon: <BookOutlined /> },
  { path: '/pipelines',       label: '流水线管理', icon: <BranchesOutlined /> },
  { path: '/chats',           label: '对话记录',   icon: <MessageOutlined /> },
  { path: '/prompts',         label: '提示词管理', icon: <ThunderboltOutlined /> },
  { path: '/vibe-templates',  label: '模板市场',   icon: <AppstoreOutlined /> },
  { path: '/vibe-apps',       label: '已发布应用', icon: <CloudOutlined /> },
  { path: '/mcp',             label: 'MCP 管理',   icon: <ApiOutlined /> },
  { path: '/settings',        label: '系统设置',   icon: <SettingOutlined /> },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { username, logout } = useAdminStore();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const selectedKey = navItems.find((item) =>
    item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
  )?.path ?? '/';

  const menuItems = navItems.map(({ path, label, icon }) => ({
    key: path,
    icon,
    label: <Link to={path} onClick={() => setDrawerOpen(false)}>{label}</Link>,
  }));

  const siderContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center shadow-sm flex-shrink-0">
          <RobotOutlined style={{ color: 'white', fontSize: 16 }} />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-800">Admin</div>
          <div className="text-xs text-slate-400">管理后台</div>
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

      {/* 底部用户区 */}
      <div className="px-3 py-3 border-t border-slate-100">
        <div className="flex items-center gap-2 px-3 py-2 mb-1 rounded-lg bg-slate-50">
          <Avatar size={24} style={{ backgroundColor: '#0284c7', fontSize: 11 }}>
            {username?.[0]?.toUpperCase() || 'A'}
          </Avatar>
          <Text className="text-sm text-slate-600 truncate flex-1">{username}</Text>
        </div>
        <Button
          type="text"
          icon={<LogoutOutlined />}
          onClick={handleLogout}
          className="w-full text-left text-slate-400 hover:text-red-500"
          aria-label="退出登录"
        >
          退出登录
        </Button>
      </div>
    </div>
  );

  return (
    <Layout className="h-screen overflow-hidden">
      {/* 桌面侧边栏 */}
      <Sider
        width={220}
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
        width={220}
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
          <span className="text-sm font-semibold text-slate-800">Agency Admin</span>
        </Header>

        <Content className="overflow-y-auto bg-slate-50">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
