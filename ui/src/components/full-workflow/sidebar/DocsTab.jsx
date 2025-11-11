/**
 * Documentation Tab Component
 * Displays documentation for different node types
 */
export default function DocsTab({ nodeType }) {
  if (nodeType === 'google-sheets') {
    return (
      <div>
        <h3 style={{ color: 'white', marginBottom: '1rem' }}>
          Google Sheets Node Documentation
        </h3>
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ color: 'white', marginBottom: '0.5rem' }}>Resources</h4>
          <ul style={{ paddingLeft: '1.5rem', color: '#94a3b8' }}>
            <li>
              <strong>Document:</strong> Create or delete entire spreadsheets
            </li>
            <li>
              <strong>Sheet Within Document:</strong> Work with individual
              sheets within a spreadsheet
            </li>
          </ul>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ color: 'white', marginBottom: '0.5rem' }}>Operations</h4>
          <ul style={{ paddingLeft: '1.5rem', color: '#94a3b8' }}>
            <li>
              <strong>Create:</strong> Create a new spreadsheet with optional
              initial sheets
            </li>
            <li>
              <strong>Append or Update Row:</strong> Smart operation that
              searches for a unique identifier and updates if found, appends if
              not found
            </li>
            <li>
              <strong>Append Row:</strong> Add a new row to the end of a sheet
            </li>
            <li>
              <strong>Update Row:</strong> Update an existing row by row index
            </li>
            <li>
              <strong>Get Row(s):</strong> Retrieve rows with optional filters
              (AND/OR)
            </li>
            <li>
              <strong>Delete Rows:</strong> Delete rows by their indices
            </li>
          </ul>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ color: 'white', marginBottom: '0.5rem' }}>Variables</h4>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            You can use variables from previous nodes in any field using{' '}
            {'{{variableName}}'} syntax. For example:{' '}
            {'{{httpResponse.data.email}}'} or {'{{userId}}'}.
          </p>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ color: 'white', marginBottom: '0.5rem' }}>
            Authentication
          </h4>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            Connect your Google account in the Settings tab to access Google
            Sheets. Once connected, you can select spreadsheets and sheets from
            your account.
          </p>
        </div>
      </div>
    );
  }

  return <div>Documentation</div>;
}
