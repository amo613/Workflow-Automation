import { Routes, Route, Link } from 'react-router-dom';
import WorkflowList from './pages/WorkflowList';
import WorkflowEditor from './pages/WorkflowEditor';

function App() {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
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
          to="/"
          style={{
            textDecoration: 'none',
            color: '#333',
            fontSize: '1.25rem',
            fontWeight: 600,
          }}
        >
          Workflow Builder
        </Link>
        <a
          href="/api/test-openai"
          style={{
            textDecoration: 'none',
            color: '#667eea',
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            border: '1px solid #667eea',
          }}
        >
          Back to Test Page
        </a>
      </nav>
      <Routes>
        <Route path="/" element={<WorkflowList />} />
        <Route path="/new" element={<WorkflowEditor />} />
        <Route path="/edit/:id" element={<WorkflowEditor />} />
      </Routes>
    </div>
  );
}

export default App;
