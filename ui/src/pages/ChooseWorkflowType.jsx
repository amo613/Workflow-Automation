import { useNavigate } from 'react-router-dom';

function ChooseWorkflowType() {
  const navigate = useNavigate();

  const handleChooseCallFlow = () => {
    navigate('/workflows');
  };

  const handleChooseFullWorkflow = () => {
    navigate('/fullWorkflows');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <div
        style={{
          maxWidth: '800px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: '2.5rem',
            fontWeight: 700,
            color: 'white',
            marginBottom: '1rem',
          }}
        >
          Choose Workflow Type
        </h1>
        <p
          style={{
            fontSize: '1.25rem',
            color: 'rgba(255, 255, 255, 0.9)',
            marginBottom: '3rem',
          }}
        >
          Select the type of workflow you want to create
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2rem',
            marginTop: '2rem',
          }}
        >
          {/* Call Flow Card */}
          <div
            onClick={handleChooseCallFlow}
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '2.5rem',
              cursor: 'pointer',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.3s ease',
              border: '2px solid transparent',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-8px)';
              e.currentTarget.style.boxShadow =
                '0 20px 60px rgba(0, 0, 0, 0.15)';
              e.currentTarget.style.borderColor = '#667eea';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow =
                '0 10px 40px rgba(0, 0, 0, 0.1)';
              e.currentTarget.style.borderColor = 'transparent';
            }}
          >
            <div
              style={{
                fontSize: '4rem',
                marginBottom: '1.5rem',
              }}
            >
              📞
            </div>
            <h2
              style={{
                fontSize: '1.75rem',
                fontWeight: 600,
                color: '#1a202c',
                marginBottom: '1rem',
              }}
            >
              Call Flow
            </h2>
            <p
              style={{
                fontSize: '1rem',
                color: '#4a5568',
                lineHeight: '1.6',
                marginBottom: '1.5rem',
              }}
            >
              Create conversational workflows for phone calls. Define what the
              AI agent says during the conversation, including steps,
              conditions, and responses.
            </p>
            <div
              style={{
                display: 'inline-block',
                padding: '0.75rem 1.5rem',
                background: '#667eea',
                color: 'white',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '1rem',
              }}
            >
              Create Call Flow →
            </div>
          </div>

          {/* Full Workflow Card */}
          <div
            onClick={handleChooseFullWorkflow}
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '2.5rem',
              cursor: 'pointer',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.3s ease',
              border: '2px solid transparent',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-8px)';
              e.currentTarget.style.boxShadow =
                '0 20px 60px rgba(0, 0, 0, 0.15)';
              e.currentTarget.style.borderColor = '#764ba2';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow =
                '0 10px 40px rgba(0, 0, 0, 0.1)';
              e.currentTarget.style.borderColor = 'transparent';
            }}
          >
            <div
              style={{
                fontSize: '4rem',
                marginBottom: '1.5rem',
              }}
            >
              ⚙️
            </div>
            <h2
              style={{
                fontSize: '1.75rem',
                fontWeight: 600,
                color: '#1a202c',
                marginBottom: '1rem',
              }}
            >
              Full Workflow
            </h2>
            <p
              style={{
                fontSize: '1rem',
                color: '#4a5568',
                lineHeight: '1.6',
                marginBottom: '1.5rem',
              }}
            >
              Create complete automation workflows with webhooks, HTTP requests,
              database queries, and more. Connect multiple services and automate
              complex processes.
            </p>
            <div
              style={{
                display: 'inline-block',
                padding: '0.75rem 1.5rem',
                background: '#764ba2',
                color: 'white',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '1rem',
              }}
            >
              Create Full Workflow →
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChooseWorkflowType;
