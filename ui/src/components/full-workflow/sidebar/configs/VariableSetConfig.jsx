import FormField from '../FormField.jsx';
import ErrorConfig from './ErrorConfig.jsx';

/**
 * Variable Set Node Configuration
 */
export default function VariableSetConfig({
  localData,
  handleUpdate,
  availableVariables,
  nodes = [],
  currentNodeId,
}) {
  return (
    <>
      <FormField
        label="Variable Name"
        name="variable_name"
        value={localData.variable_name}
        onChange={value => handleUpdate('variable_name', value)}
        placeholder="userName"
      />
      <FormField
        label="Value"
        name="value"
        value={localData.value}
        onChange={value => handleUpdate('value', value)}
        placeholder="Use {{previous.output}} or {{variable}}"
        multiline
        availableVariables={availableVariables}
      />

      <ErrorConfig
        localData={localData}
        handleUpdate={handleUpdate}
        nodes={nodes}
        currentNodeId={currentNodeId}
      />
    </>
  );
}
