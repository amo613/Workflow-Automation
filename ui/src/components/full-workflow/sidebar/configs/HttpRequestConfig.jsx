import FormField from '../FormField.jsx';
import ErrorConfig from './ErrorConfig.jsx';

/**
 * HTTP Request Node Configuration
 */
export default function HttpRequestConfig({
  localData,
  handleUpdate,
  availableVariables,
  handleDrop,
  nodes = [],
  currentNodeId,
}) {
  return (
    <>
      <FormField
        label="URL"
        name="url"
        value={localData.url}
        onChange={value => handleUpdate('url', value)}
        placeholder="https://api.example.com/endpoint"
        availableVariables={availableVariables}
        onDrop={(e, variableExpression) => {
          const currentValue = localData.url || '';
          const cursorPos = e.target.selectionStart || currentValue.length;
          const newValue =
            currentValue.substring(0, cursorPos) +
            variableExpression +
            currentValue.substring(cursorPos);
          handleUpdate('url', newValue);
        }}
        onDragOver={e => e.preventDefault()}
      />
      <FormField
        label="Method"
        name="method"
        type="select"
        value={localData.method || 'GET'}
        onChange={value => handleUpdate('method', value)}
        options={[
          { value: 'GET', label: 'GET' },
          { value: 'POST', label: 'POST' },
          { value: 'PUT', label: 'PUT' },
          { value: 'DELETE', label: 'DELETE' },
        ]}
      />
      <FormField
        label="Headers (JSON)"
        name="headers"
        value={localData.headers}
        onChange={value => handleUpdate('headers', value)}
        placeholder='{"Authorization": "Bearer {{token}}"}'
        multiline
        availableVariables={availableVariables}
        onDrop={(e, variableExpression) => {
          const currentValue = localData.headers || '';
          const cursorPos = e.target.selectionStart || currentValue.length;
          const newValue =
            currentValue.substring(0, cursorPos) +
            variableExpression +
            currentValue.substring(cursorPos);
          handleUpdate('headers', newValue);
        }}
        onDragOver={e => e.preventDefault()}
      />
      <FormField
        label="Body (JSON)"
        name="body"
        value={localData.body}
        onChange={value => handleUpdate('body', value)}
        placeholder='{"name": "{{name}}", "email": "{{email}}"}'
        multiline
        availableVariables={availableVariables}
        onDrop={(e, variableExpression) => {
          const currentValue = localData.body || '';
          const cursorPos = e.target.selectionStart || currentValue.length;
          const newValue =
            currentValue.substring(0, cursorPos) +
            variableExpression +
            currentValue.substring(cursorPos);
          handleUpdate('body', newValue);
        }}
        onDragOver={e => e.preventDefault()}
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
