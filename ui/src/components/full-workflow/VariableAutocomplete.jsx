import { useState, useRef, useEffect } from 'react';

/**
 * Variable Autocomplete Component
 * Shows available variables and allows insertion into text fields
 */
export default function VariableAutocomplete({
  value,
  onChange,
  availableVariables = [],
  placeholder = 'Enter text... Use {{variable}} for variables',
  onBlur,
  multiline = false,
  onDrop,
  onDragOver,
}) {
  const [showVariables, setShowVariables] = useState(false);
  const [variableField, setVariableField] = useState(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef(null);
  const previousValueRef = useRef('');

  useEffect(() => {
    previousValueRef.current = value || '';
  }, [value]);

  const handleChange = e => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setCursorPosition(cursorPos);

    // Check if user just typed {{
    if (
      newValue.length > previousValueRef.current.length &&
      newValue.substring(cursorPos - 2, cursorPos) === '{{' &&
      newValue.substring(cursorPos - 2, cursorPos + 1) !== '{{}'
    ) {
      // Show variable list
      setShowVariables(true);
      setVariableField('main');
    } else {
      // Check if cursor is inside {{ }}
      const textBeforeCursor = newValue.substring(0, cursorPos);
      const lastOpenBrace = textBeforeCursor.lastIndexOf('{{');
      const nextCloseBrace = newValue.indexOf('}}', cursorPos);

      if (
        lastOpenBrace !== -1 &&
        (nextCloseBrace === -1 || nextCloseBrace > cursorPos)
      ) {
        setShowVariables(true);
        setVariableField('main');
      } else {
        setShowVariables(false);
        setVariableField(null);
      }
    }

    previousValueRef.current = newValue;
    onChange(e);
  };

  const insertVariable = variablePath => {
    if (!inputRef.current) return;

    const currentValue = value || '';
    const cursorPos = cursorPosition;

    // Find the start of the current {{ }} block
    const textBeforeCursor = currentValue.substring(0, cursorPos);
    const lastOpenBrace = textBeforeCursor.lastIndexOf('{{');

    let newValue;
    if (lastOpenBrace !== -1) {
      // Replace content inside {{ }}
      const textAfterCursor = currentValue.substring(cursorPos);
      const nextCloseBrace = textAfterCursor.indexOf('}}');
      const afterCloseBrace =
        nextCloseBrace !== -1
          ? textAfterCursor.substring(nextCloseBrace + 2)
          : '';

      newValue =
        currentValue.substring(0, lastOpenBrace) +
        `{{${variablePath}}}` +
        afterCloseBrace;
    } else {
      // Insert new variable
      newValue =
        currentValue.substring(0, cursorPos) +
        `{{${variablePath}}}` +
        currentValue.substring(cursorPos);
    }

    // Create synthetic event
    const syntheticEvent = {
      target: {
        value: newValue,
        selectionStart:
          lastOpenBrace !== -1
            ? lastOpenBrace + variablePath.length + 4
            : cursorPos + variablePath.length + 4,
        selectionEnd:
          lastOpenBrace !== -1
            ? lastOpenBrace + variablePath.length + 4
            : cursorPos + variablePath.length + 4,
      },
    };

    onChange(syntheticEvent);

    // Set cursor position after insertion
    setTimeout(() => {
      if (inputRef.current) {
        const newCursorPos = syntheticEvent.target.selectionStart;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);

    setShowVariables(false);
    setVariableField(null);
  };

  const InputComponent = multiline ? 'textarea' : 'input';

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <InputComponent
        ref={inputRef}
        value={value || ''}
        onChange={handleChange}
        onBlur={onBlur}
        onFocus={e => {
          const cursorPos = e.target.selectionStart || 0;
          setCursorPosition(cursorPos);
          const textBeforeCursor = (value || '').substring(0, cursorPos);
          const lastOpenBrace = textBeforeCursor.lastIndexOf('{{');
          const nextCloseBrace = (value || '').indexOf('}}', cursorPos);

          if (
            lastOpenBrace !== -1 &&
            (nextCloseBrace === -1 || nextCloseBrace > cursorPos)
          ) {
            setShowVariables(true);
            setVariableField('main');
          }
        }}
        onDrop={e => {
          e.preventDefault();
          const variableExpression = e.dataTransfer.getData('text/plain');
          if (variableExpression && onDrop) {
            onDrop(e, variableExpression);
          } else if (variableExpression) {
            // Default: insert at cursor position
            const cursorPos = e.target.selectionStart || 0;
            const currentValue = value || '';
            const newValue =
              currentValue.substring(0, cursorPos) +
              variableExpression +
              currentValue.substring(cursorPos);
            const syntheticEvent = {
              target: {
                value: newValue,
                selectionStart: cursorPos + variableExpression.length,
                selectionEnd: cursorPos + variableExpression.length,
              },
            };
            onChange(syntheticEvent);
          }
        }}
        onDragOver={e => {
          e.preventDefault();
          if (onDragOver) {
            onDragOver(e);
          }
        }}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '0.75rem',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          fontSize: '0.875rem',
          fontFamily: 'inherit',
          ...(multiline ? { minHeight: '100px', resize: 'vertical' } : {}),
        }}
      />

      {/* Variable List */}
      {showVariables &&
        variableField === 'main' &&
        availableVariables.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '0.25rem',
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              maxHeight: '300px',
              overflowY: 'auto',
              zIndex: 1000,
            }}
          >
            <div
              style={{
                padding: '0.5rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#64748b',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}
            >
              Available Variables
            </div>
            {availableVariables.map((variable, index) => (
              <div
                key={index}
                onClick={() => insertVariable(variable.path)}
                style={{
                  padding: '0.75rem',
                  cursor: 'pointer',
                  borderBottom:
                    index < availableVariables.length - 1
                      ? '1px solid #f1f5f9'
                      : 'none',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#f8fafc';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'white';
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: '#1a202c',
                    marginBottom: '0.25rem',
                  }}
                >
                  {`{{${variable.path}}}`}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#64748b',
                    marginBottom: '0.25rem',
                  }}
                >
                  {variable.description}
                </div>
                {variable.value !== undefined && (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#94a3b8',
                      fontFamily: 'monospace',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={
                      typeof variable.value === 'object'
                        ? JSON.stringify(variable.value, null, 2)
                        : String(variable.value)
                    }
                  >
                    {typeof variable.value === 'object'
                      ? JSON.stringify(variable.value)
                      : String(variable.value)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
