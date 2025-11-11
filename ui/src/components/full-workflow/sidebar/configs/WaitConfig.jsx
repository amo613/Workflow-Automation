import FormField from '../FormField.jsx';

/**
 * Wait Node Configuration
 */
export default function WaitConfig({ localData, handleUpdate }) {
  return (
    <FormField
      label="Duration (seconds)"
      name="duration"
      type="number"
      value={localData.duration || 0}
      onChange={value => handleUpdate('duration', parseInt(value, 10) || 0)}
      placeholder="5"
      style={{ min: 0 }}
    />
  );
}
