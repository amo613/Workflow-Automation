import FormField from '../FormField.jsx';
import { Lightbulb } from 'lucide-react';

export default function MergeConfig({ localData, handleUpdate }) {
  const mergeStrategies = [
    { value: 'array', label: 'Array - All results as array' },
    { value: 'first', label: 'First - Only first result' },
    { value: 'last', label: 'Last - Only last result' },
    { value: 'merge', label: 'Merge - Combine all into object' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FormField
        label="Merge Strategy"
        name="mergeStrategy"
        type="select"
        value={localData.mergeStrategy || 'array'}
        onChange={value => handleUpdate('mergeStrategy', value)}
        options={mergeStrategies}
      />

      <div
        style={{
          padding: '0.75rem',
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '6px',
          fontSize: '0.75rem',
          color: '#0369a1',
        }}
      >
        <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Lightbulb className="w-4 h-4" />
          How it works:
        </strong>
        <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.25rem' }}>
          <li>
            <strong>Array:</strong> Returns all branch results as an array
          </li>
          <li>
            <strong>First:</strong> Returns only the result from the first
            branch
          </li>
          <li>
            <strong>Last:</strong> Returns only the result from the last branch
          </li>
          <li>
            <strong>Merge:</strong> Combines all results into a single object
          </li>
        </ul>
      </div>
    </div>
  );
}
