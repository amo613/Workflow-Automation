import FormField from '../FormField.jsx';

/**
 * Knowledge Base Query Node Configuration
 */
export default function KnowledgeBaseQueryConfig({
  localData,
  handleUpdate,
  availableVariables,
}) {
  return (
    <>
      <FormField
        label="Query"
        name="query"
        value={localData.query}
        onChange={value => handleUpdate('query', value)}
        placeholder="Search query or {{searchTerm}}"
        multiline
        availableVariables={availableVariables}
      />
      <FormField
        label="Limit"
        name="limit"
        type="number"
        value={localData.limit || 5}
        onChange={value => handleUpdate('limit', parseInt(value, 10) || 5)}
        placeholder="5"
        style={{ min: 1, max: 20 }}
      />
    </>
  );
}
