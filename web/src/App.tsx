import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import AgentsPage from './pages/AgentsPage';
import AgentDetailPage from './pages/AgentDetailPage';
import VibeCodingPage from './pages/VibeCodingPage';
import ChatPage from './pages/ChatPage';
import KnowledgePage from './pages/KnowledgePage';
import PipelinesPage from './pages/PipelinesPage';

// 主站布局包装（保持原有 children 模式）
const MainRoutes = () => (
  <Layout>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/agents" element={<AgentsPage />} />
      <Route path="/agents/:slug" element={<AgentDetailPage />} />
      <Route path="/vibe" element={<VibeCodingPage />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/chat/:sessionId" element={<ChatPage />} />
      <Route path="/knowledge" element={<KnowledgePage />} />
      <Route path="/pipelines" element={<PipelinesPage />} />
    </Routes>
  </Layout>
);

const App = () => {
  return (
    <Routes>
      {/* 主站路由 */}
      <Route path="/*" element={<MainRoutes />} />
    </Routes>
  );
};

export default App;
