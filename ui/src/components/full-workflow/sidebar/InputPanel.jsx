import { useState } from 'react';
import DataTable from './DataTable.jsx';
import DraggableVariable from './DraggableVariable.jsx';

/**
 * InputPanel Component
 * Displays input data from previous nodes
 */
export default function InputPanel({
  inputData,
  selectedNode,
  edges,
  onDragStart,
}) {
  const [view, setView] = useState('table');

  if (!inputData || Object.keys(inputData).length === 0) {
    return (
      <div
        style={{ padding: '0.75rem', color: '#94a3b8', fontSize: '0.875rem' }}
      >
        No input data available
      </div>
    );
  }

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
                color: '#94a3b8',
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
            background: view === 'table' ? '#3b82f6' : 'transparent',
            border: 'none',
            color: 'white',
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
              borderTop: '1px solid #333',
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                marginBottom: '0.5rem',
              }}
            >
              Drag fields to use (or click to copy):
            </div>
            {renderNestedFields(inputData)}
          </div>
        </>
      ) : (
        <pre style={{ fontSize: '0.75rem', overflow: 'auto', color: 'white' }}>
          {JSON.stringify(inputData, null, 2)}
        </pre>
      )}
    </div>
  );
}
