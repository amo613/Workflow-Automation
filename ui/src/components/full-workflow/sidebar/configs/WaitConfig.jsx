import FormField from '../FormField.jsx';
import ErrorConfig from './ErrorConfig.jsx';

/**
 * Wait Node Configuration
 */
export default function WaitConfig({
  localData,
  handleUpdate,
  nodes = [],
  currentNodeId,
}) {
  return (
    <>
      <FormField
        label="Duration (seconds)"
        name="duration"
        type="number"
        value={localData.duration || 0}
        onChange={value => handleUpdate('duration', parseInt(value, 10) || 0)}
        placeholder="5"
        style={{ min: 0 }}
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
