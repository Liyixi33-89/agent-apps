import { Routes, Route, Navigate } from 'react-router-dom';
import { useAdminStore } from './store';
import LoginPage from './pages/LoginPage';
import AdminLayout from './components/AdminLayout';
import DashboardPage from './pages/DashboardPage';
import AgentsAdminPage from './pages/AgentsAdminPage';
import KnowledgeAdminPage from './pages/KnowledgeAdminPage';
import PipelinesAdminPage from './pages/PipelinesAdminPage';
import ChatsAdminPage from './pages/ChatsAdminPage';
import SettingsPage from './pages/SettingsPage';
import PromptsAdminPage from './pages/PromptsAdminPage';
import VibeTemplatesAdminPage from './pages/VibeTemplatesAdminPage';
import VibeAppsAdminPage from './pages/VibeAppsAdminPage';
import McpAdminPage from './pages/McpAdminPage';
import SkillsAdminPage from './pages/SkillsAdminPage';
import RbacAdminPage from './pages/RbacAdminPage';
import TokenUsagePage from './pages/TokenUsagePage';
import EvaluationAdminPage from './pages/EvaluationAdminPage';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAdminStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AdminLayout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/agents" element={<AgentsAdminPage />} />
                <Route path="/knowledge" element={<KnowledgeAdminPage />} />
                <Route path="/pipelines" element={<PipelinesAdminPage />} />
                <Route path="/chats" element={<ChatsAdminPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/prompts" element={<PromptsAdminPage />} />
                <Route path="/vibe-templates" element={<VibeTemplatesAdminPage />} />
                <Route path="/vibe-apps" element={<VibeAppsAdminPage />} />
                <Route path="/mcp" element={<McpAdminPage />} />
                <Route path="/skills" element={<SkillsAdminPage />} />
                <Route path="/rbac" element={<RbacAdminPage />} />
                <Route path="/token-usage" element={<TokenUsagePage />} />
                <Route path="/evaluations" element={<EvaluationAdminPage />} />
              </Routes>
            </AdminLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

export default App;
