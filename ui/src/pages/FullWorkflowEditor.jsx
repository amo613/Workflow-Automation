import WorkflowEditorLayout from '../components/full-workflow/WorkflowEditorLayout.jsx';
import { useFullWorkflowEditorLogic } from '../hooks/fullWorkflow/useFullWorkflowEditorLogic.js';

function FullWorkflowEditor() {
  const { loading, executionTracking, handleSwitchToCallFlow, ...layoutProps } =
    useFullWorkflowEditorLogic();

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: '18px',
          color: '#667eea',
          fontWeight: 600,
        }}
      >
        Loading workflow...
      </div>
    );
  }

  return (
    <WorkflowEditorLayout
      {...layoutProps}
      executedEdges={executionTracking.executedEdges}
      onSwitchToCallFlow={handleSwitchToCallFlow}
    />
  );
}

export default FullWorkflowEditor;
