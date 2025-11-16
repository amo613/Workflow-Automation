import FormField from '../FormField.jsx';
import VariableAutocomplete from '../../VariableAutocomplete.jsx';

/**
 * Call Agent Node Configuration
 */
export default function CallAgentConfig({
  localData,
  handleUpdate,
  availableVariables,
  workflows,
}) {
  return (
    <>
      <FormField
        label="Use Existing Workflow"
        name="use_existing"
        type="select"
        value={localData.use_existing ? 'true' : 'false'}
        onChange={value => handleUpdate('use_existing', value === 'true')}
        options={[
          { value: 'false', label: 'Create New Prompt' },
          { value: 'true', label: 'Use Existing Call Flow Workflow' },
        ]}
      />
      {localData.use_existing ? (
        <FormField
          label="Call Flow Workflow"
          name="workflow_id"
          type="select"
          value={localData.workflow_id || ''}
          onChange={value => handleUpdate('workflow_id', parseInt(value, 10))}
          options={(workflows || []).map(wf => ({
            value: wf.id,
            label: `${wf.name} (ID: ${wf.id})`,
          }))}
          placeholder="Select a workflow..."
        />
      ) : (
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
            Prompt
          </label>
          <VariableAutocomplete
            value={localData.prompt || ''}
            onChange={e => handleUpdate('prompt', e.target.value)}
            availableVariables={availableVariables}
            placeholder="Enter call prompt..."
            multiline
          />
        </div>
      )}
      <FormField
        label="Voice"
        name="voice"
        type="select"
        value={localData.voice || 'alloy'}
        onChange={value => handleUpdate('voice', value)}
        options={[
          { value: 'alloy', label: 'Alloy' },
          { value: 'echo', label: 'Echo' },
          { value: 'fable', label: 'Fable' },
          { value: 'onyx', label: 'Onyx' },
          { value: 'nova', label: 'Nova' },
          { value: 'shimmer', label: 'Shimmer' },
        ]}
      />
      <FormField
        label="Phone Number"
        name="phone_number"
        value={localData.phone_number}
        onChange={value => handleUpdate('phone_number', value)}
        placeholder="+1234567890 or {{phoneNumber}}"
        availableVariables={availableVariables}
      />
    </>
  );
}
