import React, { useLayoutEffect, useRef } from 'react';
import { Handle, Position, useUpdateNodeInternals } from 'reactflow';
import { GitBranch } from 'lucide-react';
import StatusBadge from '@/utils/StatusBadge';

/**
 * Switch/Case Node Component
 * Supports dynamic handles based on configured cases
 *
 * Uses useUpdateNodeInternals to force React Flow to re-register handles
 * when cases are added or removed.
 */
export default function SwitchNode({ data, selected, id }) {
  const status = data.status || 'idle';
  const cases = data.cases || [];
  const hasDefault = data.hasDefault !== false; // Default to true
  const updateNodeInternals = useUpdateNodeInternals();
  const previousCasesRef = useRef(JSON.stringify(cases));

  // Force React Flow to update node internals (including handles) when cases change
  // useLayoutEffect runs after DOM updates but before paint, ensuring handles are updated immediately
  useLayoutEffect(() => {
    const currentCases = JSON.stringify(cases);
    if (previousCasesRef.current !== currentCases) {
      previousCasesRef.current = currentCases;
      // Update node internals to re-register handles
      // This must be called after the DOM is updated but before paint
      updateNodeInternals(id);
    }
  }, [cases, id, updateNodeInternals, hasDefault]);

  const statusColor = {
    running: '#3b82f6',
    success: '#10b981',
    failed: '#ef4444',
    idle: null,
  };

  // Calculate total outputs (cases + default)
  const totalOutputs = cases.length + (hasDefault ? 1 : 0);

  // Generate colors for handles (distributed across color spectrum)
  const getHandleColor = (index, total) => {
    const hue = (index * 360) / total;
    return `hsl(${hue}, 70%, 50%)`;
  };

  return (
    <div
      style={{
        background: selected ? 'hsl(var(--accent))' : 'hsl(var(--card))',
        border: `2px solid ${
          status !== 'idle' ? statusColor[status] : '#8b5cf6'
        }`,
        borderRadius: '0.75rem',
        padding: '1rem',
        minWidth: '220px',
        boxShadow: selected
          ? '0 4px 12px rgba(139, 92, 246, 0.3)'
          : '0 2px 8px rgba(0, 0, 0, 0.2)',
        transition: 'all 0.2s ease',
        position: 'relative',
      }}
    >
      <StatusBadge status={status} />

      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: '#8b5cf6',
          width: '12px',
          height: '12px',
          border: '2px solid hsl(var(--card))',
        }}
      />

      {/* Node Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.5rem',
        }}
      >
        <div
          style={{
            fontSize: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '0.5rem',
            background: 'rgba(139, 92, 246, 0.2)',
            color: '#8b5cf6',
          }}
        >
          <GitBranch className="w-5 h-5" />
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: '0.875rem',
              color: 'hsl(var(--foreground))',
            }}
          >
            Switch/Case
          </div>
          {data.name && (
            <div
              style={{
                fontSize: '0.75rem',
                color: 'hsl(var(--muted-foreground))',
                marginTop: '0.25rem',
              }}
            >
              {data.name}
            </div>
          )}
        </div>
      </div>

      {/* Cases Summary */}
      {cases.length > 0 && (
        <div
          style={{
            fontSize: '0.7rem',
            color: 'hsl(var(--muted-foreground))',
            marginTop: '0.25rem',
            padding: '0.25rem 0.5rem',
            background: 'hsl(var(--muted))',
            borderRadius: '0.375rem',
            marginBottom: '0.5rem',
          }}
        >
          {cases.length} case{cases.length !== 1 ? 's' : ''}
          {hasDefault && ' + default'}
        </div>
      )}

      {/* Dynamic Output Handles for Cases */}
      {/* Key prop forces React to re-render handles when cases change */}
      {cases.map((caseItem, index) => {
        // Use stable handleId based on case.id, not index
        const handleId =
          caseItem.handleId ||
          (caseItem.id ? `case-${caseItem.id}` : `case-${index}`);
        // Generate label from condition or use custom label
        let label = caseItem.label;
        if (!label && caseItem.condition1) {
          if (caseItem.operator === 'exists') {
            label = `${caseItem.condition1} exists`;
          } else {
            label = `${caseItem.condition1} ${caseItem.operator || '=='} ${caseItem.condition2 || '?'}`;
          }
        }
        if (!label) {
          label = `Case ${index + 1}`;
        }
        const handleColor = getHandleColor(index, totalOutputs);
        // Distribute handles evenly across bottom - ensure proper spacing
        const leftPercent =
          totalOutputs > 1 ? ((index + 1) * 100) / (totalOutputs + 1) : 50;

        return (
          <React.Fragment key={caseItem.id || index}>
            <Handle
              type="source"
              position={Position.Bottom}
              id={handleId}
              style={{
                background: handleColor,
                width: '16px',
                height: '16px',
                border: '3px solid hsl(var(--card))',
                left: `${leftPercent}%`,
                boxShadow: `0 0 0 2px ${handleColor}40, 0 2px 8px ${handleColor}60`,
              }}
            />
            {/* Label above handle */}
            <div
              style={{
                position: 'absolute',
                bottom: '24px',
                left: `${leftPercent}%`,
                transform: 'translateX(-50%)',
                fontSize: '0.65rem',
                color: 'hsl(var(--foreground))',
                background: 'hsl(var(--card))',
                padding: '2px 6px',
                borderRadius: '4px',
                border: `1px solid ${handleColor}`,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: 10,
                fontWeight: 500,
              }}
            >
              {label}
            </div>
          </React.Fragment>
        );
      })}

      {/* Default Handle */}
      {hasDefault && (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="default"
            style={{
              background: '#6b7280',
              width: '16px',
              height: '16px',
              border: '3px solid hsl(var(--card))',
              left: `${((cases.length + 1) * 100) / (totalOutputs + 1)}%`,
              boxShadow:
                '0 0 0 2px rgba(107, 114, 128, 0.2), 0 2px 8px rgba(107, 114, 128, 0.4)',
            }}
          />
          {/* Label above default handle */}
          <div
            style={{
              position: 'absolute',
              bottom: '24px',
              left: `${((cases.length + 1) * 100) / (totalOutputs + 1)}%`,
              transform: 'translateX(-50%)',
              fontSize: '0.65rem',
              color: 'hsl(var(--foreground))',
              background: 'hsl(var(--card))',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid #6b7280',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 10,
              fontWeight: 500,
            }}
          >
            Default
          </div>
        </>
      )}

      {/* No cases message */}
      {cases.length === 0 && (
        <div
          style={{
            fontSize: '0.7rem',
            color: 'hsl(var(--muted-foreground))',
            fontStyle: 'italic',
            textAlign: 'center',
            padding: '0.5rem',
            marginTop: '0.5rem',
          }}
        >
          No cases configured
        </div>
      )}
    </div>
  );
}
