/**
 * DraggableVariable Component
 * Renders a draggable variable field
 */
export default function DraggableVariable({
  fieldKey,
  value,
  path,
  onDragStart,
  isArrayExtraction = false,
  isArrayExample = false,
}) {
  // Use path if provided, otherwise use fieldKey
  const fullPath = path || fieldKey;
  const displayValue =
    typeof value === 'object' ? JSON.stringify(value) : String(value);
  const variableExpression = `{{${fullPath}}}`;

  return (
    <div
      draggable
      onDragStart={e => {
        if (onDragStart) {
          onDragStart(e, variableExpression);
        } else {
          e.dataTransfer.setData('text/plain', variableExpression);
        }
      }}
      onClick={() => {
        navigator.clipboard.writeText(variableExpression);
      }}
      style={{
        padding: '0.5rem',
        margin: '0.25rem 0',
        background: '#2a2a2a',
        border: '1px solid #333',
        borderRadius: '4px',
        cursor: 'grab',
        fontSize: '0.75rem',
        color: '#3b82f6',
      }}
      title={`Click to copy: ${variableExpression}`}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.25rem',
        }}
      >
        <div style={{ fontWeight: 600 }}>{fullPath}</div>
        {isArrayExtraction && (
          <span
            style={{
              fontSize: '0.65rem',
              padding: '0.1rem 0.4rem',
              background: '#3b82f6',
              color: 'white',
              borderRadius: '3px',
              fontWeight: 600,
            }}
            title="Array extraction - returns all values as array"
          >
            Array
          </span>
        )}
        {isArrayExample && (
          <span
            style={{
              fontSize: '0.65rem',
              padding: '0.1rem 0.4rem',
              background: '#64748b',
              color: 'white',
              borderRadius: '3px',
              fontWeight: 600,
            }}
            title="Array item example"
          >
            Example
          </span>
        )}
      </div>
      <div
        style={{
          color: '#94a3b8',
          fontSize: '0.7rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {displayValue}
      </div>
    </div>
  );
}
