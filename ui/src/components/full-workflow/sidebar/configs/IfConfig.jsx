import FormField from '../FormField.jsx';

/**
 * If Node Configuration
 */
export default function IfConfig({
  localData,
  handleUpdate,
  availableVariables,
}) {
  return (
    <>
      <FormField
        label="Condition 1"
        name="condition1"
        value={localData.condition1}
        onChange={value => handleUpdate('condition1', value)}
        placeholder="{{value}} or {{count}}"
        availableVariables={availableVariables}
      />
      <FormField
        label="Operator"
        name="operator"
        type="select"
        value={localData.operator || '=='}
        onChange={value => handleUpdate('operator', value)}
        options={[
          { value: '==', label: 'Equals (==)' },
          { value: '!=', label: 'Not Equals (!=)' },
          { value: '>', label: 'Greater Than (>)' },
          { value: '<', label: 'Less Than (<)' },
          { value: '>=', label: 'Greater or Equal (>=)' },
          { value: '<=', label: 'Less or Equal (<=)' },
          { value: 'contains', label: 'Contains' },
        ]}
      />
      <FormField
        label="Condition 2"
        name="condition2"
        value={localData.condition2}
        onChange={value => handleUpdate('condition2', value)}
        placeholder='"test" or 10 or {{otherValue}}'
        availableVariables={availableVariables}
      />
    </>
  );
}
