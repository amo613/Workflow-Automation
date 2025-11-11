import VariableAutocomplete from '../VariableAutocomplete.jsx';

/**
 * FormField Component
 * Reusable form field component with variable support
 */
export default function FormField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  options = [],
  multiline = false,
  availableVariables = [],
  onDrop,
  onDragOver,
  style = {},
}) {
  const baseInputStyle = {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #333',
    borderRadius: '8px',
    fontSize: '0.875rem',
    background: '#2a2a2a',
    color: 'white',
    ...style,
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'white',
  };

  if (type === 'select') {
    return (
      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>{label}</label>
        <select
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={baseInputStyle}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (availableVariables.length > 0 || multiline) {
    return (
      <div style={{ marginBottom: '1rem' }} data-field-name={name}>
        <label style={labelStyle}>{label}</label>
        <VariableAutocomplete
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          availableVariables={availableVariables}
          placeholder={placeholder}
          multiline={multiline}
          onDrop={onDrop}
          onDragOver={onDragOver}
        />
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '1rem' }} data-field-name={name}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onDrop={onDrop}
        onDragOver={onDragOver}
        style={baseInputStyle}
      />
    </div>
  );
}
