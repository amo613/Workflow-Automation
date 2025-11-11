/**
 * DraggableVariable Component
 * Renders a draggable variable field
 */
export default function DraggableVariable({
  fieldKey,
  value,
  path,
  onDragStart,
}) {
  const fullPath = path ? `${path}.${fieldKey}` : fieldKey;
  const displayValue =
    typeof value === 'object' ? JSON.stringify(value) : String(value);
  const variableExpression = path
    ? `{{${path}.${fieldKey}}}`
    : `{{${fieldKey}}}`;

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
      <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{fullPath}</div>
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
