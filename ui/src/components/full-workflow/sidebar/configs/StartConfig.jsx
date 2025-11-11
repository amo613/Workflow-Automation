import FormField from '../FormField.jsx';

/**
 * Start Node Configuration
 */
export default function StartConfig({
  localData,
  handleUpdate,
  availableVariables,
}) {
  return (
    <>
      <div
        style={{ marginBottom: '1rem', color: '#94a3b8', fontSize: '0.875rem' }}
      >
        This is the entry point of your workflow. Configure input parameters
        that will be available to all nodes.
      </div>
      <FormField
        label="Input Parameters (JSON)"
        name="input_parameters"
        value={localData.input_parameters}
        onChange={value => handleUpdate('input_parameters', value)}
        placeholder='{"userId": "", "email": ""}'
        multiline
        availableVariables={availableVariables}
      />
    </>
  );
}
