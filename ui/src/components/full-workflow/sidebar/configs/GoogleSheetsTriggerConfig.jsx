/**
 * Google Sheets Trigger Node Configuration
 */
import FormField from '../FormField.jsx';
import VariableAutocomplete from '../../VariableAutocomplete.jsx';

export default function GoogleSheetsTriggerConfig({
  localData,
  handleUpdate,
  spreadsheets,
  sheets,
  fetchSheets,
  fetchSpreadsheets,
  setShowSpreadsheetModal,
  setShowSheetModal,
}) {
  return (
    <>
      <FormField
        label="Poll Time"
        name="pollTime"
        type="select"
        value={localData.pollTime || '1 minute'}
        onChange={value => handleUpdate('pollTime', value)}
        options={[
          { value: '1 minute', label: 'Every minute' },
          { value: '15 minutes', label: 'Every 15 minutes' },
          { value: '30 minutes', label: 'Every 30 minutes' },
          { value: '1 hour', label: 'Every hour' },
          { value: '3 hours', label: 'Every 3 hours' },
          { value: '12 hours', label: 'Every 12 hours' },
          { value: '24 hours', label: 'Every 24 hours' },
        ]}
      />
      {/* Document Selection */}
      <div style={{ marginBottom: '1rem' }}>
        <label
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'white',
          }}
        >
          Document
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select
            value={localData.spreadsheetId || ''}
            onChange={async e => {
              const newSpreadsheetId = e.target.value;
              handleUpdate('spreadsheetId', newSpreadsheetId);
              if (newSpreadsheetId) {
                await fetchSheets(newSpreadsheetId);
              } else {
                // setSheets([]);
              }
            }}
            style={{
              flex: 1,
              padding: '0.75rem',
              border: '1px solid #333',
              borderRadius: '8px',
              fontSize: '0.875rem',
              background: '#2a2a2a',
              color: 'white',
            }}
          >
            <option value="">Select document...</option>
            {spreadsheets && spreadsheets.length > 0 ? (
              spreadsheets.map(spreadsheet => (
                <option key={spreadsheet.id} value={spreadsheet.id}>
                  {spreadsheet.name}
                </option>
              ))
            ) : (
              <option value="">No spreadsheets available</option>
            )}
          </select>
          <button
            onClick={async () => {
              await fetchSpreadsheets();
              setShowSpreadsheetModal(true);
            }}
            style={{
              background: '#3b82f6',
              border: 'none',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            Choose...
          </button>
        </div>
      </div>
      {/* Sheet Selection */}
      {localData.spreadsheetId && (
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'white',
            }}
          >
            Sheet
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select
              value={localData.sheetName || ''}
              onChange={e => handleUpdate('sheetName', e.target.value)}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid #333',
                borderRadius: '8px',
                fontSize: '0.875rem',
                background: '#2a2a2a',
                color: 'white',
              }}
            >
              <option value="">Select sheet...</option>
              {sheets && sheets.length > 0 ? (
                sheets.map(sheet => (
                  <option
                    key={sheet.sheetId || sheet.id}
                    value={sheet.title || sheet.name}
                  >
                    {sheet.title || sheet.name}
                  </option>
                ))
              ) : (
                <option value="">No sheets available</option>
              )}
            </select>
            <button
              onClick={async () => {
                if (localData.spreadsheetId) {
                  await fetchSheets(localData.spreadsheetId);
                  setShowSheetModal(true);
                }
              }}
              disabled={!localData.spreadsheetId}
              style={{
                background: localData.spreadsheetId ? '#3b82f6' : '#4a5568',
                border: 'none',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                cursor: localData.spreadsheetId ? 'pointer' : 'not-allowed',
                fontSize: '0.75rem',
              }}
            >
              Choose...
            </button>
          </div>
        </div>
      )}
      <FormField
        label="Trigger On"
        name="triggerOn"
        type="select"
        value={localData.triggerOn || 'Row added or updated'}
        onChange={value => handleUpdate('triggerOn', value)}
        options={[
          { value: 'Row added or updated', label: 'Row added or updated' },
        ]}
      />
    </>
  );
}
