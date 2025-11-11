import FormField from '../FormField.jsx';

/**
 * Database Query Node Configuration
 */
export default function DatabaseQueryConfig({
  localData,
  handleUpdate,
  availableVariables,
}) {
  return (
    <>
      <FormField
        label="SQL Query"
        name="query"
        value={localData.query}
        onChange={value => handleUpdate('query', value)}
        placeholder="SELECT * FROM users WHERE id = $1"
        multiline
        availableVariables={availableVariables}
      />
      <FormField
        label="Parameters (JSON Array)"
        name="parameters"
        value={localData.parameters}
        onChange={value => handleUpdate('parameters', value)}
        placeholder='["{{userId}}", "{{email}}"]'
        multiline
        availableVariables={availableVariables}
      />
    </>
  );
}
