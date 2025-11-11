import FormField from '../FormField.jsx';

/**
 * Webhook Node Configuration
 */
export default function WebhookConfig({
  localData,
  handleUpdate,
  availableVariables,
  handleDrop,
}) {
  return (
    <>
      <FormField
        label="Webhook URL"
        name="url"
        value={localData.url}
        onChange={value => handleUpdate('url', value)}
        placeholder="https://example.com/webhook"
        onDrop={e => handleDrop(e, 'url')}
        onDragOver={e => e.preventDefault()}
      />
      <FormField
        label="Method"
        name="method"
        type="select"
        value={localData.method || 'POST'}
        onChange={value => handleUpdate('method', value)}
        options={[
          { value: 'GET', label: 'GET' },
          { value: 'POST', label: 'POST' },
          { value: 'PUT', label: 'PUT' },
          { value: 'DELETE', label: 'DELETE' },
        ]}
      />
      <FormField
        label="Body Template"
        name="body_template"
        value={localData.body_template}
        onChange={value => handleUpdate('body_template', value)}
        placeholder="Use {{variable}} for variables"
        multiline
        availableVariables={availableVariables}
      />
    </>
  );
}
