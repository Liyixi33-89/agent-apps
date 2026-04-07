import { lazy, Suspense } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { Spin, Result, Button } from 'antd';
import Layout from './components/Layout';

// 路由懒加载
const HomePage = lazy(() => import('./pages/HomePage'));
const AgentsPage = lazy(() => import('./pages/AgentsPage'));
const AgentDetailPage = lazy(() => import('./pages/AgentDetailPage'));
const VibeCodingPage = lazy(() => import('./pages/VibeCodingPage'));
const TemplateMarketPage = lazy(() => import('./pages/TemplateMarketPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const KnowledgePage = lazy(() => import('./pages/KnowledgePage'));
const PipelinesPage = lazy(() => import('./pages/PipelinesPage'));
const AgentPlanPage = lazy(() => import('./pages/AgentPlanPage'));
const PreviewPage = lazy(() => import('./pages/PreviewPage'));

// 全局加载指示器
const PageLoading = () => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <Spin size="large" tip="页面加载中..." />
  </div>
);

// 404 页面
const NotFoundPage = () => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <Result
      status="404"
      title="404"
      subTitle="抱歉，您访问的页面不存在"
      extra={
        <Link to="/">
          <Button type="primary">返回首页</Button>
        </Link>
      }
    />
  </div>
);

// 主站布局包装（保持原有 children 模式）
const MainRoutes = () => (
  <Layout>
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/agents/:slug" element={<AgentDetailPage />} />
        <Route path="/vibe" element={<VibeCodingPage />} />
        <Route path="/market" element={<TemplateMarketPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/chat/:sessionId" element={<ChatPage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/pipelines" element={<PipelinesPage />} />
        <Route path="/plan" element={<AgentPlanPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  </Layout>
);

const App = () => {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        {/* 预览页面（全屏，不带 Layout） */}
        <Route path="/preview/:id" element={<PreviewPage />} />
        {/* 主站路由 */}
        <Route path="/*" element={<MainRoutes />} />
      </Routes>
    </Suspense>
  );
};

export default App;
