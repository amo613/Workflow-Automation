import { useState, useEffect } from 'react';
import DataTable from './DataTable.jsx';

/**
 * OutputPanel Component
 * Displays output data from the current node
 */
export default function OutputPanel({
  outputData,
  outputView,
  setOutputView,
  nodeStatus,
}) {
  const [view, setView] = useState(outputView || 'table');

  // Sync with parent view state
  useEffect(() => {
    if (setOutputView && view !== outputView) {
      setOutputView(view);
    }
  }, [view, outputView, setOutputView]);

  if (!outputData || Object.keys(outputData).length === 0) {
    return (
      <div
        style={{
          padding: '0.75rem',
          color: 'hsl(var(--muted-foreground))',
          fontSize: '0.875rem',
        }}
      >
        No output data available. Execute the node to see output.
      </div>
    );
  }

  return (
    <div style={{ padding: '0.75rem', overflow: 'auto', flex: 1 }}>
      <div style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.25rem' }}>
        <button
          onClick={() => {
            setView('table');
            if (setOutputView) setOutputView('table');
          }}
          style={{
            padding: '0.25rem 0.5rem',
            background:
              view === 'table' ? 'hsl(var(--primary))' : 'transparent',
            border: '1px solid hsl(var(--border))',
            color:
              view === 'table'
                ? 'hsl(var(--primary-foreground))'
                : 'hsl(var(--foreground))',
            cursor: 'pointer',
            fontSize: '0.75rem',
            borderRadius: '4px',
            transition: 'all 0.2s ease',
          }}
        >
          Table
        </button>
        <button
          onClick={() => {
            setView('json');
            if (setOutputView) setOutputView('json');
          }}
          style={{
            padding: '0.25rem 0.5rem',
            background: view === 'json' ? 'hsl(var(--primary))' : 'transparent',
            border: '1px solid hsl(var(--border))',
            color:
              view === 'json'
                ? 'hsl(var(--primary-foreground))'
                : 'hsl(var(--foreground))',
            cursor: 'pointer',
            fontSize: '0.75rem',
            borderRadius: '4px',
            transition: 'all 0.2s ease',
          }}
        >
          JSON
        </button>
        <button
          onClick={() => {
            setView('schema');
            if (setOutputView) setOutputView('schema');
          }}
          style={{
            padding: '0.25rem 0.5rem',
            background:
              view === 'schema' ? 'hsl(var(--primary))' : 'transparent',
            border: '1px solid hsl(var(--border))',
            color:
              view === 'schema'
                ? 'hsl(var(--primary-foreground))'
                : 'hsl(var(--foreground))',
            cursor: 'pointer',
            fontSize: '0.75rem',
            borderRadius: '4px',
            transition: 'all 0.2s ease',
          }}
        >
          Schema
        </button>
      </div>
      {view === 'table' ? (
        <DataTable data={outputData} />
      ) : view === 'json' ? (
        <pre
          style={{
            fontSize: '0.75rem',
            overflow: 'auto',
            color: 'hsl(var(--foreground))',
            background: 'hsl(var(--muted))',
            padding: '0.5rem',
            borderRadius: '4px',
          }}
        >
          {JSON.stringify(outputData, null, 2)}
        </pre>
      ) : (
        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--foreground))' }}>
          <pre
            style={{
              background: 'hsl(var(--muted))',
              padding: '0.5rem',
              borderRadius: '4px',
            }}
          >
            {JSON.stringify(getSchema(outputData), null, 2)}
          </pre>
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
