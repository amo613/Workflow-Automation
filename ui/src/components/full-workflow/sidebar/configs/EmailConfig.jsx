import FormField from '../FormField.jsx';
import VariableAutocomplete from '../../VariableAutocomplete.jsx';
import ErrorConfig from './ErrorConfig.jsx';

/**
 * Email Node Configuration
 */
export default function EmailConfig({
  localData,
  handleUpdate,
  availableVariables,
  nodes = [],
  currentNodeId,
}) {
  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <label
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'white',
          }}
        >
          To (Recipient) <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <VariableAutocomplete
          value={localData.to || ''}
          onChange={e => handleUpdate('to', e.target.value)}
          availableVariables={availableVariables}
          placeholder="recipient@example.com or {{previous.output.email}}"
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'white',
          }}
        >
          Subject <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <VariableAutocomplete
          value={localData.subject || ''}
          onChange={e => handleUpdate('subject', e.target.value)}
          availableVariables={availableVariables}
          placeholder="Email subject or {{previous.output.subject}}"
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'white',
          }}
        >
          Text Body (Plain Text)
        </label>
        <VariableAutocomplete
          value={localData.text || ''}
          onChange={e => handleUpdate('text', e.target.value)}
          availableVariables={availableVariables}
          placeholder="Plain text email body..."
          multiline
          rows={6}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'white',
          }}
        >
          HTML Body (Optional)
        </label>
        <VariableAutocomplete
          value={localData.html || ''}
          onChange={e => handleUpdate('html', e.target.value)}
          availableVariables={availableVariables}
          placeholder="HTML email body (optional)..."
          multiline
          rows={6}
        />
        <div
          style={{
            fontSize: '0.75rem',
            color: '#94a3b8',
            marginTop: '0.25rem',
          }}
        >
          If both text and HTML are provided, HTML will be used.
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'white',
          }}
        >
          From Email (Optional)
        </label>
        <VariableAutocomplete
          value={localData.fromEmail || ''}
          onChange={e => handleUpdate('fromEmail', e.target.value)}
          availableVariables={availableVariables}
          placeholder="sender@example.com (uses settings default if empty)"
        />
        <div
          style={{
            fontSize: '0.75rem',
            color: '#94a3b8',
            marginTop: '0.25rem',
          }}
        >
          If not provided, uses the email from your settings.
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'white',
          }}
        >
          From Name (Optional)
        </label>
        <VariableAutocomplete
          value={localData.fromName || ''}
          onChange={e => handleUpdate('fromName', e.target.value)}
          availableVariables={availableVariables}
          placeholder="Sender Name (optional)"
        />
      </div>

      <div
        style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: '#1a1a1a',
          borderRadius: '8px',
          border: '1px solid #333',
        }}
      >
        <div
          style={{
            fontSize: '0.875rem',
            color: '#94a3b8',
            marginBottom: '0.5rem',
          }}
        >
          <strong style={{ color: 'white' }}>Note:</strong> Email credentials
          (SMTP settings) must be configured in the Settings tab. Attachments
          are not yet supported but will be added in a future update.
        </div>
      </div>

      <ErrorConfig
        localData={localData}
        handleUpdate={handleUpdate}
        nodes={nodes}
        currentNodeId={currentNodeId}
      />
    </>
  );
}
