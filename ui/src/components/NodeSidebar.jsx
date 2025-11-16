import { useState, useEffect, useRef } from 'react';
import { toCamelCase } from '../utils/variable-utils.js';
import { Rocket, Sparkles, GitBranch, Flag, Lightbulb } from 'lucide-react';

function NodeSidebar({ selectedNode, onNodeUpdate, nodes, edges, onClose }) {
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
        trueLabel: data.trueLabel || 'True',
        falseLabel: data.falseLabel || 'False',
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
      // Normalize variables in text (simple camelCase conversion)
      const normalizedValue = normalizeVariablesInText(value, {});
      if (normalizedValue !== value) {
        handleUpdate(field, normalizedValue);
      }
    }
  };

  // Get available variables (empty for call flows - no knowledge base)
  const getAvailableVariables = () => {
    return [];
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

  // Normalize variables in text
  const normalizeVariablesInText = (text, availableVariables) => {
    if (!text || typeof text !== 'string') return text;

    // Find all {variable} patterns
    const variablePattern = /\{([^}]+)\}/g;
    let normalizedText = text;
    let match;

    while ((match = variablePattern.exec(text)) !== null) {
      const originalVariable = match[1];
      const normalizedVariable = toCamelCase(originalVariable);

      if (originalVariable !== normalizedVariable) {
        normalizedText = normalizedText.replace(
          `{${originalVariable}}`,
          `{${normalizedVariable}}`
        );
      }
    }

    return normalizedText;
  };

  return (
    <>
      {/* Sidebar - Centered Overlay (no backdrop to avoid conflicts with modals) */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90vw',
          maxWidth: '600px',
          maxHeight: '85vh',
          zIndex: 100,
          background: 'hsl(var(--card))',
          borderRadius: '0.75rem',
          border: '1px solid hsl(var(--border))',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          padding: '2rem',
          overflowY: 'auto',
          overflowX: 'hidden',
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
              color: 'hsl(var(--foreground))',
              margin: 0,
            }}
          >
            {selectedNode.type === 'start' && (
              <>
                <Rocket className="w-5 h-5 mr-2" />
                Start Node
              </>
            )}
            {selectedNode.type === 'step' && (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Step Node
              </>
            )}
            {selectedNode.type === 'if' && (
              <>
                <GitBranch className="w-5 h-5 mr-2" />
                If Node
              </>
            )}
            {selectedNode.type === 'end' && (
              <>
                <Flag className="w-5 h-5 mr-2" />
                End Node
              </>
            )}
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: 'hsl(var(--muted-foreground))',
                padding: '0.25rem 0.5rem',
                borderRadius: '0.5rem',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'hsl(var(--accent))';
                e.currentTarget.style.color = 'hsl(var(--foreground))';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'hsl(var(--muted-foreground))';
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
                  color: 'hsl(var(--foreground))',
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
                  background: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                  border: '1px solid hsl(var(--input))',
                }}
              />
              {showVariables && variableField === 'action' && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    background: 'hsl(var(--muted))',
                    borderRadius: '0.5rem',
                    border: '1px solid hsl(var(--border))',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'hsl(var(--foreground))',
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
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            textAlign: 'left',
                            transition: 'all 0.2s',
                            color: 'hsl(var(--foreground))',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'hsl(var(--accent))';
                            e.currentTarget.style.borderColor = 'hsl(var(--primary))';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'hsl(var(--card))';
                            e.currentTarget.style.borderColor = 'hsl(var(--border))';
                          }}
                        >
                          {'{'}
                          {variable}
                          {'}'}
                        </button>
                      ))
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
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
                    color: 'hsl(var(--muted-foreground))',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Lightbulb className="w-3 h-3" />
                    <span>Tip: Type {'{'} to see available variables</span>
                  </div>
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
                  color: 'hsl(var(--foreground))',
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
                style={{
                  background: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                  border: '1px solid hsl(var(--input))',
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 600,
                  color: 'hsl(var(--foreground))',
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
                  background: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                  border: '1px solid hsl(var(--input))',
                }}
              />
              {showVariables && variableField === 'action' && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    background: 'hsl(var(--muted))',
                    borderRadius: '0.5rem',
                    border: '1px solid hsl(var(--border))',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'hsl(var(--foreground))',
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
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            textAlign: 'left',
                            transition: 'all 0.2s',
                            color: 'hsl(var(--foreground))',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'hsl(var(--accent))';
                            e.currentTarget.style.borderColor = 'hsl(var(--primary))';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'hsl(var(--card))';
                            e.currentTarget.style.borderColor = 'hsl(var(--border))';
                          }}
                        >
                          {'{'}
                          {variable}
                          {'}'}
                        </button>
                      ))
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
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
                    color: 'hsl(var(--muted-foreground))',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Lightbulb className="w-3 h-3" />
                    <span>Tip: Type {'{'} to see available variables</span>
                  </div>
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
                  color: 'hsl(var(--foreground))',
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
                placeholder="e.g., {userAge} > 18"
                className="bubble-input"
                style={{
                  background: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                  border: '1px solid hsl(var(--input))',
                }}
              />
              {showVariables && variableField === 'condition' && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    background: 'hsl(var(--muted))',
                    borderRadius: '0.5rem',
                    border: '1px solid hsl(var(--border))',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'hsl(var(--foreground))',
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
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            textAlign: 'left',
                            transition: 'all 0.2s',
                            color: 'hsl(var(--foreground))',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'hsl(var(--accent))';
                            e.currentTarget.style.borderColor = 'hsl(var(--primary))';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'hsl(var(--card))';
                            e.currentTarget.style.borderColor = 'hsl(var(--border))';
                          }}
                        >
                          {'{'}
                          {variable}
                          {'}'}
                        </button>
                      ))
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
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
                    color: 'hsl(var(--muted-foreground))',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Lightbulb className="w-3 h-3" />
                    <span>Tip: Type {'{'} to see available variables</span>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 600,
                  color: 'hsl(var(--foreground))',
                  fontSize: '0.875rem',
                }}
              >
                True Label
              </label>
              <input
                type="text"
                value={localData.trueLabel || 'True'}
                onChange={e => handleUpdate('trueLabel', e.target.value)}
                className="bubble-input"
                style={{
                  background: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                  border: '1px solid hsl(var(--input))',
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 600,
                  color: 'hsl(var(--foreground))',
                  fontSize: '0.875rem',
                }}
              >
                False Label
              </label>
              <input
                type="text"
                value={localData.falseLabel || 'False'}
                onChange={e => handleUpdate('falseLabel', e.target.value)}
                className="bubble-input"
                style={{
                  background: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                  border: '1px solid hsl(var(--input))',
                }}
              />
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
                  color: 'hsl(var(--foreground))',
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
                  background: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                  border: '1px solid hsl(var(--input))',
                }}
              />
              {showVariables && variableField === 'action' && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    background: 'hsl(var(--muted))',
                    borderRadius: '0.5rem',
                    border: '1px solid hsl(var(--border))',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'hsl(var(--foreground))',
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
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            textAlign: 'left',
                            transition: 'all 0.2s',
                            color: 'hsl(var(--foreground))',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'hsl(var(--accent))';
                            e.currentTarget.style.borderColor = 'hsl(var(--primary))';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'hsl(var(--card))';
                            e.currentTarget.style.borderColor = 'hsl(var(--border))';
                          }}
                        >
                          {'{'}
                          {variable}
                          {'}'}
                        </button>
                      ))
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
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
                    color: 'hsl(var(--muted-foreground))',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Lightbulb className="w-3 h-3" />
                    <span>Tip: Type {'{'} to see available variables</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default NodeSidebar;
