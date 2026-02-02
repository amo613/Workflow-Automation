import FormField from '../FormField.jsx';
import VariableAutocomplete from '../../VariableAutocomplete.jsx';
import ErrorConfig from './ErrorConfig.jsx';

/**
 * Gmail Node Configuration
 */
export default function GmailConfig({
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
        <div
          style={{
            fontSize: '0.75rem',
            color: '#94a3b8',
            marginTop: '0.25rem',
          }}
        >
          Multiple recipients: comma-separated or array format
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
          CC (Optional)
        </label>
        <VariableAutocomplete
          value={localData.cc || ''}
          onChange={e => handleUpdate('cc', e.target.value)}
          availableVariables={availableVariables}
          placeholder="cc@example.com or {{previous.output.cc}}"
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
          BCC (Optional)
        </label>
        <VariableAutocomplete
          value={localData.bcc || ''}
          onChange={e => handleUpdate('bcc', e.target.value)}
          availableVariables={availableVariables}
          placeholder="bcc@example.com or {{previous.output.bcc}}"
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
          placeholder="from@example.com (defaults to authenticated Gmail account)"
        />
        <div
          style={{
            fontSize: '0.75rem',
            color: '#94a3b8',
            marginTop: '0.25rem',
          }}
        >
          If not specified, uses the authenticated Gmail account email.
        </div>
      </div>

      <ErrorConfig
        localData={localData}
        handleUpdate={handleUpdate}
        availableVariables={availableVariables}
      />
    </>
  );
}


