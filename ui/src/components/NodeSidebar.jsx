import { useState, useEffect, useRef } from 'react';
import { toCamelCase } from '../utils/variable-utils.js';

function NodeSidebar({
  selectedNode,
  onNodeUpdate,
  nodes,
  edges,
  onClose,
  knowledgeBase = [],
}) {
  const [localData, setLocalData] = useState({});
  const previousValueRef = useRef({});
  const [showVariables, setShowVariables] = useState(false);
  const [variableField, setVariableField] = useState(null);

  // Track the last selected node ID to prevent unnecessary resets
  const lastNodeIdRef = useRef(null);

  useEffect(() => {
    // Only update localData if the node ID actually changed
    if (selectedNode && selectedNode.id !== lastNodeIdRef.current) {
      const data = selectedNode.data || {};
      // Initialize localData with empty strings for all fields to avoid fallback issues
      setLocalData({
        action: data.action ?? data.text ?? '',
        text: data.text ?? '',
        condition: data.condition ?? '',
        name: data.name ?? '',
        next: data.next ?? '',
        ifTrue: data.ifTrue ?? { next: '' },
        ifFalse: data.ifFalse ?? { next: '' },
        trueLabel: data.trueLabel ?? 'True',
        falseLabel: data.falseLabel ?? 'False',
      });
      // Store previous values for each field
      previousValueRef.current = {
        action: data.action ?? data.text ?? '',
        text: data.text ?? '',
        condition: data.condition ?? '',
      };
      lastNodeIdRef.current = selectedNode.id;
    } else if (!selectedNode) {
      setLocalData({});
      previousValueRef.current = {};
      lastNodeIdRef.current = null;
    }
    // Only run when selectedNode.id changes, not when data changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode?.id]);

  if (!selectedNode) {
    return null;
  }

  const handleUpdate = (field, value) => {
    const newData = { ...localData, [field]: value };
    setLocalData(newData);
    previousValueRef.current[field] = value;
    if (onNodeUpdate) {
      onNodeUpdate(selectedNode.id, newData);
    }
  };

  // Normalize variables when field loses focus (onBlur)
  const handleBlur = (field, e) => {
    const value = e.target.value;
    if (value && typeof value === 'string') {
      // Create variable map from knowledge base
      const variableMap = {};
      knowledgeBase.forEach(kb => {
        if (kb.name && kb.name.trim()) {
          const original = kb.name.trim();
          const normalized = kb.normalizedName || toCamelCase(original);
          if (original !== normalized) {
            variableMap[original] = normalized;
          }
        }
      });
      const normalizedValue = normalizeVariablesInText(value, variableMap);
      if (normalizedValue !== value) {
        handleUpdate(field, normalizedValue);
      }
    }
  };

  // Get available variables from knowledge base (normalized to camelCase)
  const getAvailableVariables = () => {
    const variables = knowledgeBase
      .filter(kb => kb.name && kb.name.trim())
      .map(kb => {
        // Use normalizedName if available, otherwise convert to camelCase
        return kb.normalizedName || toCamelCase(kb.name);
      });
    return variables;
  };

  // Auto-complete for variables: when { is typed, add } and show variable list
  const handleTextareaChange = (field, e) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart;
    const previousValue = previousValueRef.current[field] || '';

    // Check if user just typed { (value changed and last char before cursor is {)
    if (
      value.length > previousValue.length &&
      value[cursorPosition - 1] === '{' &&
      value[cursorPosition] !== '}'
    ) {
      // Insert } after cursor
      const newValue =
        value.slice(0, cursorPosition) + '}' + value.slice(cursorPosition);

      // Update state
      handleUpdate(field, newValue);

      // Show variable list
      setShowVariables(true);
      setVariableField(field);

      // Set cursor position between { and } after state update
      setTimeout(() => {
        const textarea = e.target;
        if (textarea) {
          textarea.setSelectionRange(cursorPosition, cursorPosition);
        }
      }, 0);
    } else {
      handleUpdate(field, value);
      previousValueRef.current[field] = value;

      // Check if cursor is inside { } and show variables
      const textBeforeCursor = value.substring(0, cursorPosition);
      const lastOpenBrace = textBeforeCursor.lastIndexOf('{');
      const nextCloseBrace = value.indexOf('}', cursorPosition);

      if (
        lastOpenBrace !== -1 &&
        (nextCloseBrace === -1 || nextCloseBrace > cursorPosition)
      ) {
        setShowVariables(true);
        setVariableField(field);
      } else {
        setShowVariables(false);
        setVariableField(null);
      }
    }
  };

  // Handle input change for condition field (If Node)
  const handleInputChange = (field, e) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart;
    const previousValue = previousValueRef.current[field] || '';

    // Check if user just typed {
    if (
      value.length > previousValue.length &&
      value[cursorPosition - 1] === '{' &&
      value[cursorPosition] !== '}'
    ) {
      const newValue =
        value.slice(0, cursorPosition) + '}' + value.slice(cursorPosition);
      handleUpdate(field, newValue);
      previousValueRef.current[field] = newValue;
      setShowVariables(true);
      setVariableField(field);

      setTimeout(() => {
        const input = e.target;
        if (input) {
          input.setSelectionRange(cursorPosition, cursorPosition);
        }
      }, 0);
    } else {
      handleUpdate(field, value);
      previousValueRef.current[field] = value;

      // Check if cursor is inside { }
      const textBeforeCursor = value.substring(0, cursorPosition);
      const lastOpenBrace = textBeforeCursor.lastIndexOf('{');
      const nextCloseBrace = value.indexOf('}', cursorPosition);

      if (
        lastOpenBrace !== -1 &&
        (nextCloseBrace === -1 || nextCloseBrace > cursorPosition)
      ) {
        setShowVariables(true);
        setVariableField(field);
      } else {
        setShowVariables(false);
        setVariableField(null);
      }
    }
  };

  // Insert variable into field
  const insertVariable = (variableName, field) => {
    const currentValue = localData[field] || '';
    // Find the last { before cursor or the first { if cursor is not available
    const lastOpenBrace = currentValue.lastIndexOf('{');

    if (lastOpenBrace !== -1) {
      const beforeBrace = currentValue.substring(0, lastOpenBrace);
      const afterBrace = currentValue.substring(lastOpenBrace + 1);
      const closeBraceIndex = afterBrace.indexOf('}');

      if (closeBraceIndex !== -1) {
        const afterCloseBrace = afterBrace.substring(closeBraceIndex + 1);
        const newValue =
          beforeBrace + '{' + variableName + '}' + afterCloseBrace;
        handleUpdate(field, newValue);
        setShowVariables(false);
        setVariableField(null);
      } else {
        // If no closing brace, just replace from { to end
        const newValue = beforeBrace + '{' + variableName + '}';
        handleUpdate(field, newValue);
        setShowVariables(false);
        setVariableField(null);
      }
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        width: '400px',
        height: '100%',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.1)',
        borderLeft: '1px solid rgba(102, 126, 234, 0.1)',
        padding: '2rem',
        overflowY: 'auto',
        overflowX: 'hidden',
        zIndex: 50,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <h2
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#1f2937',
            margin: 0,
          }}
        >
          {selectedNode.type === 'start' && '🚀 Start Node'}
          {selectedNode.type === 'step' && '✨ Step Node'}
          {selectedNode.type === 'if' && '🔀 If Node'}
          {selectedNode.type === 'end' && '🏁 End Node'}
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '0.25rem 0.5rem',
              borderRadius: '8px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.color = '#1f2937';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Start Node */}
      {selectedNode.type === 'start' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 600,
                color: '#374151',
                fontSize: '0.875rem',
              }}
            >
              Action
            </label>
            <textarea
              value={localData.action ?? ''}
              onChange={e => handleTextareaChange('action', e)}
              onBlur={e => handleBlur('action', e)}
              placeholder="Start message... Use {variableName} for variables"
              className="bubble-input"
              style={{
                width: '100%',
                minHeight: '100px',
                resize: 'vertical',
              }}
            />
            {showVariables && variableField === 'action' && (
              <div
                style={{
                  marginTop: '0.5rem',
                  padding: '0.75rem',
                  background: 'rgba(102, 126, 234, 0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(102, 126, 234, 0.2)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '0.5rem',
                  }}
                >
                  Available Variables:
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                  }}
                >
                  {getAvailableVariables().length > 0 ? (
                    getAvailableVariables().map(variable => (
                      <button
                        key={variable}
                        onClick={() => insertVariable(variable, 'action')}
                        style={{
                          padding: '0.5rem',
                          background: 'white',
                          border: '1px solid rgba(102, 126, 234, 0.2)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background =
                            'rgba(102, 126, 234, 0.1)';
                          e.currentTarget.style.borderColor =
                            'rgba(102, 126, 234, 0.4)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'white';
                          e.currentTarget.style.borderColor =
                            'rgba(102, 126, 234, 0.2)';
                        }}
                      >
                        {'{'}
                        {variable}
                        {'}'}
                      </button>
                    ))
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      No variables available. Add entries in Knowledge Base.
                    </div>
                  )}
                </div>
              </div>
            )}
            {!showVariables && (
              <div
                style={{
                  marginTop: '0.5rem',
                  fontSize: '0.75rem',
                  color: '#6b7280',
                }}
              >
                💡 Tip: Type {'{'} to see available variables
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step Node */}
      {selectedNode.type === 'step' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 600,
                color: '#374151',
                fontSize: '0.875rem',
              }}
            >
              Name
            </label>
            <input
              type="text"
              value={localData.name || ''}
              onChange={e => handleUpdate('name', e.target.value)}
              onBlur={e => handleBlur('name', e)}
              placeholder="Node name..."
              className="bubble-input"
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 600,
                color: '#374151',
                fontSize: '0.875rem',
              }}
            >
              Action
            </label>
            <textarea
              value={localData.action ?? ''}
              onChange={e => handleTextareaChange('action', e)}
              onBlur={e => handleBlur('action', e)}
              placeholder="Step message... Use {variableName} for variables"
              className="bubble-input"
              style={{
                width: '100%',
                minHeight: '100px',
                resize: 'vertical',
              }}
            />
            {showVariables && variableField === 'action' && (
              <div
                style={{
                  marginTop: '0.5rem',
                  padding: '0.75rem',
                  background: 'rgba(102, 126, 234, 0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(102, 126, 234, 0.2)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '0.5rem',
                  }}
                >
                  Available Variables:
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                  }}
                >
                  {getAvailableVariables().length > 0 ? (
                    getAvailableVariables().map(variable => (
                      <button
                        key={variable}
                        onClick={() => insertVariable(variable, 'action')}
                        style={{
                          padding: '0.5rem',
                          background: 'white',
                          border: '1px solid rgba(102, 126, 234, 0.2)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background =
                            'rgba(102, 126, 234, 0.1)';
                          e.currentTarget.style.borderColor =
                            'rgba(102, 126, 234, 0.4)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'white';
                          e.currentTarget.style.borderColor =
                            'rgba(102, 126, 234, 0.2)';
                        }}
                      >
                        {'{'}
                        {variable}
                        {'}'}
                      </button>
                    ))
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      No variables available. Add entries in Knowledge Base.
                    </div>
                  )}
                </div>
              </div>
            )}
            {!showVariables && (
              <div
                style={{
                  marginTop: '0.5rem',
                  fontSize: '0.75rem',
                  color: '#6b7280',
                }}
              >
                💡 Tip: Type {'{'} to see available variables
              </div>
            )}
          </div>
        </div>
      )}

      {/* If Node */}
      {selectedNode.type === 'if' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 600,
                color: '#374151',
                fontSize: '0.875rem',
              }}
            >
              Condition
            </label>
            <input
              type="text"
              value={localData.condition || ''}
              onChange={e => handleInputChange('condition', e)}
              onBlur={e => handleBlur('condition', e)}
              placeholder="Condition... Use {variableName} for variables"
              className="bubble-input"
            />
            {showVariables && variableField === 'condition' && (
              <div
                style={{
                  marginTop: '0.5rem',
                  padding: '0.75rem',
                  background: 'rgba(102, 126, 234, 0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(102, 126, 234, 0.2)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '0.5rem',
                  }}
                >
                  Available Variables:
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                  }}
                >
                  {getAvailableVariables().length > 0 ? (
                    getAvailableVariables().map(variable => (
                      <button
                        key={variable}
                        onClick={() => insertVariable(variable, 'condition')}
                        style={{
                          padding: '0.5rem',
                          background: 'white',
                          border: '1px solid rgba(102, 126, 234, 0.2)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background =
                            'rgba(102, 126, 234, 0.1)';
                          e.currentTarget.style.borderColor =
                            'rgba(102, 126, 234, 0.4)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'white';
                          e.currentTarget.style.borderColor =
                            'rgba(102, 126, 234, 0.2)';
                        }}
                      >
                        {'{'}
                        {variable}
                        {'}'}
                      </button>
                    ))
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      No variables available. Add entries in Knowledge Base.
                    </div>
                  )}
                </div>
              </div>
            )}
            {!showVariables && (
              <div
                style={{
                  marginTop: '0.5rem',
                  fontSize: '0.75rem',
                  color: '#6b7280',
                }}
              >
                💡 Tip: Type {'{'} to see available variables
              </div>
            )}
          </div>
        </div>
      )}

      {/* End Node */}
      {selectedNode.type === 'end' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 600,
                color: '#374151',
                fontSize: '0.875rem',
              }}
            >
              Action
            </label>
            <textarea
              value={localData.action ?? ''}
              onChange={e => handleTextareaChange('action', e)}
              onBlur={e => handleBlur('action', e)}
              placeholder="End message... Use {variableName} for variables"
              className="bubble-input"
              style={{
                width: '100%',
                minHeight: '100px',
                resize: 'vertical',
              }}
            />
            {showVariables && variableField === 'action' && (
              <div
                style={{
                  marginTop: '0.5rem',
                  padding: '0.75rem',
                  background: 'rgba(102, 126, 234, 0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(102, 126, 234, 0.2)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '0.5rem',
                  }}
                >
                  Available Variables:
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                  }}
                >
                  {getAvailableVariables().length > 0 ? (
                    getAvailableVariables().map(variable => (
                      <button
                        key={variable}
                        onClick={() => insertVariable(variable, 'action')}
                        style={{
                          padding: '0.5rem',
                          background: 'white',
                          border: '1px solid rgba(102, 126, 234, 0.2)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background =
                            'rgba(102, 126, 234, 0.1)';
                          e.currentTarget.style.borderColor =
                            'rgba(102, 126, 234, 0.4)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'white';
                          e.currentTarget.style.borderColor =
                            'rgba(102, 126, 234, 0.2)';
                        }}
                      >
                        {'{'}
                        {variable}
                        {'}'}
                      </button>
                    ))
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      No variables available. Add entries in Knowledge Base.
                    </div>
                  )}
                </div>
              </div>
            )}
            {!showVariables && (
              <div
                style={{
                  marginTop: '0.5rem',
                  fontSize: '0.75rem',
                  color: '#6b7280',
                }}
              >
                💡 Tip: Type {'{'} to see available variables
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NodeSidebar;
