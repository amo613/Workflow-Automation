import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import MainLayout from './components/layout/MainLayout';
import { Toaster } from '@/components/ui/sonner';

// Lazy load big components
const WorkflowEditor = lazy(() => import('./pages/WorkflowEditor'));
const FullWorkflowEditor = lazy(() => import('./pages/FullWorkflowEditor'));
const WorkflowList = lazy(() => import('./pages/WorkflowList'));
const FullWorkflowList = lazy(() => import('./pages/FullWorkflowList'));
const OpenAITestPage = lazy(() => import('./pages/OpenAITestPage'));

// small components can be imported regulary
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OAuthCallback from './pages/OAuthCallback';

function App() {
  return (
    <MainLayout>
      <Suspense fallback={<div>Loading...</div>}>
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
      </Suspense>
      <Toaster />
    </MainLayout>
  );
}

export default App;
