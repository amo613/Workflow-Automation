import { Routes, Route } from 'react-router-dom';
import WorkflowList from './pages/WorkflowList';
import WorkflowEditor from './pages/WorkflowEditor';
import FullWorkflowList from './pages/FullWorkflowList';
import FullWorkflowEditor from './pages/FullWorkflowEditor';
import OAuthCallback from './pages/OAuthCallback';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OpenAITestPage from './pages/OpenAITestPage';
import MainLayout from './components/layout/MainLayout';
import { Toaster } from '@/components/ui/sonner';

function App() {
  return (
    <MainLayout>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/workflows" element={<WorkflowList />} />
        <Route path="/workflows/new" element={<WorkflowEditor />} />
        <Route path="/workflows/edit/:id" element={<WorkflowEditor />} />
        <Route path="/fullWorkflows" element={<FullWorkflowList />} />
        <Route path="/fullWorkflows/new" element={<FullWorkflowEditor />} />
        <Route
          path="/fullWorkflows/edit/:id"
          element={<FullWorkflowEditor />}
        />
        <Route
          path="/oauth-callback/:integrationType"
          element={<OAuthCallback />}
        />
        <Route path="/test-openai" element={<OpenAITestPage />} />
        <Route path="*" element={<FullWorkflowList />} />
      </Routes>
      <Toaster />
    </MainLayout>
  );
}

export default App;
