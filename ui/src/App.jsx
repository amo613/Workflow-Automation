import { Routes, Route, Link, useLocation } from 'react-router-dom';
import WorkflowList from './pages/WorkflowList';
import WorkflowEditor from './pages/WorkflowEditor';
import ChooseWorkflowType from './pages/ChooseWorkflowType';
import FullWorkflowList from './pages/FullWorkflowList';
import FullWorkflowEditor from './pages/FullWorkflowEditor';
import OAuthCallback from './pages/OAuthCallback';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OpenAITestPage from './pages/OpenAITestPage';

function App() {
  const location = useLocation();
  const isAuthPage =
    location.pathname === '/login' || location.pathname === '/register';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: isAuthPage ? '#0b0f14' : '#f5f5f5',
      }}
    >
      {!isAuthPage && (
        <nav
          style={{
            background: 'white',
            padding: '1rem 2rem',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Link
            to="/choose"
            style={{
              textDecoration: 'none',
              color: '#333',
              fontSize: '1.25rem',
              fontWeight: 600,
            }}
          >
            Workflow Builder
          </Link>
          <Link
            to="/test-openai"
            style={{
              textDecoration: 'none',
              color: '#667eea',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              border: '1px solid #667eea',
            }}
          >
            Back to Test Page
          </Link>
        </nav>
      )}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/choose" element={<ChooseWorkflowType />} />
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
        <Route path="*" element={<ChooseWorkflowType />} />
      </Routes>
    </div>
  );
}

export default App;
