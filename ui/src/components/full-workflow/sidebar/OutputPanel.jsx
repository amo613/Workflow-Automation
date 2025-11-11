import { useState } from 'react';
import DataTable from './DataTable.jsx';

/**
 * OutputPanel Component
 * Displays output data from the current node
 */
export default function OutputPanel({ outputData }) {
  const [view, setView] = useState('table');

  if (!outputData || Object.keys(outputData).length === 0) {
    return (
      <div
        style={{ padding: '0.75rem', color: '#94a3b8', fontSize: '0.875rem' }}
      >
        No output data available. Execute the node to see output.
      </div>
    );
  }

  return (
    <div style={{ padding: '0.75rem', overflow: 'auto', flex: 1 }}>
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
        <button
          onClick={() => setView('schema')}
          style={{
            padding: '0.25rem 0.5rem',
            background: view === 'schema' ? '#3b82f6' : 'transparent',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '0.75rem',
            borderRadius: '4px',
          }}
        >
          Schema
        </button>
      </div>
      {view === 'table' ? (
        <DataTable data={outputData} />
      ) : view === 'json' ? (
        <pre style={{ fontSize: '0.75rem', overflow: 'auto', color: 'white' }}>
          {JSON.stringify(outputData, null, 2)}
        </pre>
      ) : (
        <div style={{ fontSize: '0.75rem', color: 'white' }}>
          <pre>{JSON.stringify(getSchema(outputData), null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function getSchema(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return { type: typeof obj };
  }
  if (Array.isArray(obj)) {
    return {
      type: 'array',
      items: obj.length > 0 ? getSchema(obj[0]) : {},
    };
  }
  const schema = { type: 'object', properties: {} };
  Object.keys(obj).forEach(key => {
    schema.properties[key] = getSchema(obj[key]);
  });
  return schema;
}
