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
              </Routes>
            </AdminLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

export default App;
