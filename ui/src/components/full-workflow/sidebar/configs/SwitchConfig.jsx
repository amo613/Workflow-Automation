import React from 'react';
import FormField from '../FormField.jsx';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, GripVertical } from 'lucide-react';

/**
 * Switch/Case Node Configuration
 * Allows users to configure multiple cases with different matching rules
 */
export default function SwitchConfig({
  localData,
  handleUpdate,
  availableVariables,
}) {
  const cases = localData.cases || [];
  const hasDefault = localData.hasDefault !== false; // Default to true

  // Add a new case
  const handleAddCase = () => {
    const caseId = `case-${Date.now()}`;
    const newCase = {
      id: caseId,
      handleId: `case-${caseId}`, // Use stable ID based on case.id
      condition1: '',
      operator: '==',
      condition2: '',
      label: '',
    };
    handleUpdate('cases', [...cases, newCase]);
  };

  // Remove a case
  const handleRemoveCase = index => {
    const newCases = cases.filter((_, i) => i !== index);
    // Keep handleIds stable - they're based on case.id, not index
    handleUpdate('cases', newCases);
  };

  // Update a case field
  const handleCaseUpdate = (index, field, value) => {
    const newCases = [...cases];
    newCases[index] = {
      ...newCases[index],
      [field]: value,
    };
    handleUpdate('cases', newCases);
  };

  // Move case up/down
  const handleMoveCase = (index, direction) => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === cases.length - 1)
    ) {
      return;
    }

    const newCases = [...cases];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newCases[index], newCases[targetIndex]] = [
      newCases[targetIndex],
      newCases[index],
    ];

    // Keep handleIds stable - they're based on case.id, not index
    handleUpdate('cases', newCases);
  };

  return (
    <>
      {/* Cases List */}
      <div style={{ marginTop: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}
        >
          <label
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'hsl(var(--foreground))',
            }}
          >
            Cases ({cases.length})
          </label>
          <Button
            type="button"
            onClick={handleAddCase}
            size="sm"
            variant="outline"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.75rem',
            }}
          >
            <Plus className="w-3 h-3" />
            Add Case
          </Button>
        </div>

        {cases.length === 0 && (
          <div
            style={{
              padding: '1rem',
              textAlign: 'center',
              color: 'hsl(var(--muted-foreground))',
              fontSize: '0.875rem',
              border: '1px dashed hsl(var(--border))',
              borderRadius: '8px',
            }}
          >
            No cases configured. Add a case to create routing rules.
          </div>
        )}

        {cases.map((caseItem, index) => (
          <div
            key={caseItem.id || index}
            style={{
              marginBottom: '1rem',
              padding: '1rem',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              background: 'hsl(var(--muted))',
            }}
          >
            {/* Case Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <GripVertical
                  className="w-4 h-4"
                  style={{
                    color: 'hsl(var(--muted-foreground))',
                    cursor: 'grab',
                  }}
                />
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'hsl(var(--foreground))',
                  }}
                >
                  Case {index + 1}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {index > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleMoveCase(index, 'up')}
                    style={{ padding: '0.25rem', minWidth: 'auto' }}
                  >
                    ↑
                  </Button>
                )}
                {index < cases.length - 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleMoveCase(index, 'down')}
                    style={{ padding: '0.25rem', minWidth: 'auto' }}
                  >
                    ↓
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemoveCase(index)}
                  style={{
                    padding: '0.25rem',
                    minWidth: 'auto',
                    color: '#ef4444',
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Condition 1 */}
            <div style={{ marginBottom: '0.75rem' }}>
              <FormField
                label="Condition 1"
                name={`case-${index}-condition1`}
                value={caseItem.condition1 || ''}
                onChange={value => handleCaseUpdate(index, 'condition1', value)}
                placeholder="{{value}} or {{count}}"
                availableVariables={availableVariables}
              />
            </div>

            {/* Operator */}
            <div style={{ marginBottom: '0.75rem' }}>
              <FormField
                label="Operator"
                name={`case-${index}-operator`}
                type="select"
                value={caseItem.operator || '=='}
                onChange={value => handleCaseUpdate(index, 'operator', value)}
                options={[
                  { value: '==', label: 'Equals (==)' },
                  { value: '!=', label: 'Not Equals (!=)' },
                  { value: '>', label: 'Greater Than (>)' },
                  { value: '<', label: 'Less Than (<)' },
                  { value: '>=', label: 'Greater or Equal (>=)' },
                  { value: '<=', label: 'Less or Equal (<=)' },
                  { value: 'contains', label: 'Contains' },
                  { value: 'startsWith', label: 'Starts With' },
                  { value: 'endsWith', label: 'Ends With' },
                  { value: 'exists', label: 'Exists (not empty)' },
                  { value: 'regex', label: 'Regex Pattern' },
                ]}
              />
            </div>

            {/* Condition 2 (only if operator is not 'exists') */}
            {caseItem.operator !== 'exists' && (
              <div style={{ marginBottom: '0.75rem' }}>
                <FormField
                  label="Condition 2"
                  name={`case-${index}-condition2`}
                  value={caseItem.condition2 || ''}
                  onChange={value =>
                    handleCaseUpdate(index, 'condition2', value)
                  }
                  placeholder={
                    caseItem.operator === 'regex'
                      ? '/^pattern$/'
                      : '"test" or 10 or {{otherValue}}'
                  }
                  availableVariables={availableVariables}
                />
              </div>
            )}

            {/* Case Label (optional, for display) */}
            <div>
              <FormField
                label="Label (optional)"
                name={`case-${index}-label`}
                value={caseItem.label || ''}
                onChange={value => handleCaseUpdate(index, 'label', value)}
                placeholder={
                  caseItem.label ||
                  (caseItem.condition1
                    ? `${caseItem.condition1} ${caseItem.operator || '=='} ${caseItem.condition2 || '?'}`
                    : `Case ${index + 1}`)
                }
                availableVariables={[]}
              />
              <div
                style={{
                  fontSize: '0.7rem',
                  color: 'hsl(var(--muted-foreground))',
                  marginTop: '0.25rem',
                }}
              >
                This label will be displayed on the output handle
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Default Output Toggle */}
      <div
        style={{
          marginTop: '1.5rem',
          padding: '1rem',
          border: '1px solid hsl(var(--border))',
          borderRadius: '8px',
          background: 'hsl(var(--muted))',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <label
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
                display: 'block',
                marginBottom: '0.25rem',
              }}
            >
              Default Output
            </label>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'hsl(var(--muted-foreground))',
              }}
            >
              Route to this output when no case matches
            </div>
          </div>
          <input
            type="checkbox"
            checked={hasDefault}
            onChange={e => handleUpdate('hasDefault', e.target.checked)}
            style={{
              width: '18px',
              height: '18px',
              cursor: 'pointer',
            }}
          />
        </div>
      </div>

      {/* Info Box */}
      <div
        style={{
          marginTop: '1rem',
          padding: '0.75rem',
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '8px',
          fontSize: '0.75rem',
          color: 'hsl(var(--foreground))',
        }}
      >
        <strong>💡 Tip:</strong> Each case has its own condition (Value1,
        Operator, Value2). Cases are evaluated in order. The first matching case
        will route the data. Use labels to identify routes in the workflow
        canvas.
      </div>
    </>
  );
}
