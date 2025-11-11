/**
 * DataTable Component
 * Renders data as a table
 */
export default function DataTable({ data }) {
  if (!data || typeof data !== 'object') {
    return (
      <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No data</div>
    );
  }

  const entries = Object.entries(data);
  if (entries.length === 0) {
    return (
      <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No data</div>
    );
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid #333' }}>
          <th
            style={{
              textAlign: 'left',
              padding: '0.5rem',
              fontSize: '0.75rem',
              color: '#94a3b8',
            }}
          >
            Field
          </th>
          <th
            style={{
              textAlign: 'left',
              padding: '0.5rem',
              fontSize: '0.75rem',
              color: '#94a3b8',
            }}
          >
            Value
          </th>
          <th
            style={{
              textAlign: 'left',
              padding: '0.5rem',
              fontSize: '0.75rem',
              color: '#94a3b8',
            }}
          >
            Type
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([key, value]) => (
          <tr key={key} style={{ borderBottom: '1px solid #2a2a2a' }}>
            <td
              style={{
                padding: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'white',
              }}
            >
              {key}
            </td>
            <td
              style={{
                padding: '0.5rem',
                fontSize: '0.875rem',
                color: 'white',
              }}
            >
              {typeof value === 'object'
                ? JSON.stringify(value)
                : String(value)}
            </td>
            <td
              style={{
                padding: '0.5rem',
                fontSize: '0.75rem',
                color: '#94a3b8',
              }}
            >
              {typeof value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
