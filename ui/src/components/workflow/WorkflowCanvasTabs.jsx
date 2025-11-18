import { useNavigate } from 'react-router-dom';
import {
  getLastCallFlowId,
  getLastFullWorkflowId,
} from '../../utils/callFlowStorage.js';

function WorkflowCanvasTabs({
  activeTab,
  onSelectFullWorkflow,
  onSelectCallWorkflow,
  children,
}) {
  const navigate = useNavigate();

  const handleFullClick = () => {
    if (activeTab === 'full') return;
    if (typeof onSelectFullWorkflow === 'function') {
      onSelectFullWorkflow();
    } else {
      const lastFullWorkflowId = getLastFullWorkflowId();
      if (lastFullWorkflowId) {
        navigate(`/fullWorkflows/edit/${lastFullWorkflowId}`);
      } else {
        navigate('/fullWorkflows');
      }
    }
  };

  const handleCallClick = () => {
    if (activeTab === 'call') return;
    if (typeof onSelectCallWorkflow === 'function') {
      onSelectCallWorkflow();
    } else {
      const lastCallFlowId = getLastCallFlowId();
      if (lastCallFlowId) {
        navigate(`/workflows/edit/${lastCallFlowId}`);
      } else {
        navigate('/workflows');
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div
        style={{
          borderBottom: '1px solid hsl(var(--border))',
          padding: '0.75rem 2rem',
          background: 'hsl(var(--background))',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            borderRadius: '999px',
            border: '1px solid hsl(var(--border))',
            background: 'hsl(var(--card))',
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          }}
          role="tablist"
          aria-label="Workflow canvas selector"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'full'}
            onClick={handleFullClick}
            style={{
              padding: '0.4rem 1.5rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              border: 'none',
              background:
                activeTab === 'full' ? 'hsl(var(--primary))' : 'transparent',
              color:
                activeTab === 'full'
                  ? 'hsl(var(--primary-foreground))'
                  : 'hsl(var(--muted-foreground))',
              cursor: activeTab === 'full' ? 'default' : 'pointer',
              transition: 'color 0.2s ease, background 0.2s ease',
            }}
          >
            Full Workflow
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'call'}
            onClick={handleCallClick}
            style={{
              padding: '0.4rem 1.5rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              border: 'none',
              background:
                activeTab === 'call' ? 'hsl(var(--primary))' : 'transparent',
              color:
                activeTab === 'call'
                  ? 'hsl(var(--primary-foreground))'
                  : 'hsl(var(--muted-foreground))',
              cursor: activeTab === 'call' ? 'default' : 'pointer',
              transition: 'color 0.2s ease, background 0.2s ease',
            }}
          >
            Call Flow
          </button>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}

export default WorkflowCanvasTabs;
