import { useState } from 'react';
import DataTable from './DataTable.jsx';
import DraggableVariable from './DraggableVariable.jsx';

/**
 * InputPanel Component
 * Displays input data from previous nodes
 * Now also shows array extractions from availableVariables
 */
export default function InputPanel({
  inputData,
  availableVariables = [],
  selectedNode,
  edges,
  onDragStart,
}) {
  const [view, setView] = useState('table');

  // Helper to render variables from availableVariables (includes array extractions)
  const renderAvailableVariables = () => {
    if (!availableVariables || availableVariables.length === 0) return null;

    // Group variables by their base path (e.g., "data", "data.username", "data[0].username")
    const grouped = {};
    availableVariables.forEach(variable => {
      // Extract base path (e.g., "data" from "data.username" or "data[0].username")
      const basePath = variable.path.split('.')[0].split('[')[0];
      if (!grouped[basePath]) {
        grouped[basePath] = [];
      }
      grouped[basePath].push(variable);
    });

    return Object.entries(grouped).map(([basePath, vars]) => {
      // Sort: base variable first, then array extractions, then array examples
      const sorted = vars.sort((a, b) => {
        if (a.path === basePath) return -1;
        if (b.path === basePath) return 1;
        if (a.isArrayExtraction && !b.isArrayExtraction) return -1;
        if (!a.isArrayExtraction && b.isArrayExtraction) return 1;
        if (a.isArrayExample && !b.isArrayExample) return 1;
        if (!a.isArrayExample && b.isArrayExample) return -1;
        return a.path.localeCompare(b.path);
      });

      return (
        <div key={basePath} style={{ marginBottom: '1rem' }}>
          {sorted.map(variable => (
            <DraggableVariable
              key={variable.path}
              fieldKey={variable.name}
              value={variable.value}
              path={variable.path}
              onDragStart={onDragStart}
              isArrayExtraction={variable.isArrayExtraction}
              isArrayExample={variable.isArrayExample}
            />
          ))}
        </div>
      );
    });
  };

  const renderNestedFields = (obj, path = '') => {
    if (!obj || typeof obj !== 'object') return null;
    return Object.entries(obj).map(([key, value]) => {
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        return (
          <div key={key} style={{ marginLeft: path ? '1rem' : 0 }}>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'hsl(var(--muted-foreground))',
                marginTop: '0.5rem',
                marginBottom: '0.25rem',
              }}
            >
              {path ? `${path}.${key}` : key}
            </div>
            {renderNestedFields(value, path ? `${path}.${key}` : key)}
          </div>
        );
      }
      return (
        <DraggableVariable
          key={path ? `${path}.${key}` : key}
          fieldKey={key}
          value={value}
          path={path}
          onDragStart={onDragStart}
        />
      );
    });
  };

  // Get all source nodes
  const sourceNodes = edges
    .filter(e => e.target === selectedNode.id)
    .map(e => e.source);

  return (
    <div style={{ padding: '0.75rem', overflow: 'auto', flex: 1 }}>
      <div
        style={{
          marginBottom: '0.5rem',
          fontSize: '0.75rem',
          color: '#94a3b8',
        }}
      >
        From:{' '}
        {sourceNodes.length > 0
          ? sourceNodes.length === 1
            ? sourceNodes[0]
            : `${sourceNodes.length} nodes (${sourceNodes.join(', ')})`
          : 'Previous Node'}
      </div>
      <div style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.25rem' }}>
        <button
          onClick={() => setView('table')}
          style={{
            padding: '0.25rem 0.5rem',
            background: view === 'table' ? 'hsl(var(--primary))' : 'transparent',
            border: '1px solid hsl(var(--border))',
            color: view === 'table' ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
            cursor: 'pointer',
            fontSize: '0.75rem',
            borderRadius: '4px',
          }}
        >
          Table
        </button>
        <button
          onClick={() => setView('json')}
          style={{
            padding: '0.25rem 0.5rem',
            background: view === 'json' ? '#3b82f6' : 'transparent',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '0.75rem',
            borderRadius: '4px',
          }}
        >
          JSON
        </button>
      </div>
      {view === 'table' ? (
        <>
          <DataTable data={inputData} />
          <div
            style={{
              marginTop: '1rem',
              paddingTop: '1rem',
              borderTop: '1px solid hsl(var(--border))',
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                color: 'hsl(var(--muted-foreground))',
                marginBottom: '0.5rem',
              }}
            >
              Drag fields to use (or click to copy):
            </div>
            {/* Show available variables (includes array extractions) */}
            {availableVariables && availableVariables.length > 0
              ? renderAvailableVariables()
              : renderNestedFields(inputData)}
          </div>
        </>
      ) : (
        <pre style={{ fontSize: '0.75rem', overflow: 'auto', color: 'hsl(var(--foreground))', background: 'hsl(var(--muted))', padding: '0.5rem', borderRadius: '4px' }}>
          {JSON.stringify(inputData, null, 2)}
        </pre>
      )}
    </div>
  );
}
