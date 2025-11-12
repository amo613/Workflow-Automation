import VariableAutocomplete from '../../VariableAutocomplete.jsx';

/**
 * Google Sheets Node Configuration
 * Extracted from NodeSidebarN8N for better maintainability
 */
export default function GoogleSheetsConfig({
  localData,
  handleUpdate,
  availableVariables,
  spreadsheets,
  sheets,
  columns,
  fetchSheets,
  fetchSpreadsheets,
  fetchColumns,
  setShowSpreadsheetModal,
  setShowSheetModal,
}) {
  return (
    <>
      {/* Resource Dropdown */}
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
          Resource
        </label>
        <select
          value={localData.resource || 'Sheet Within Document'}
          onChange={e => {
            handleUpdate('resource', e.target.value);
          }}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #333',
            borderRadius: '8px',
            fontSize: '0.875rem',
            background: '#2a2a2a',
            color: 'white',
          }}
        >
          <option value="Document">Document</option>
          <option value="Sheet Within Document">Sheet Within Document</option>
        </select>
      </div>

      {/* Operation Dropdown */}
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
          Operation
        </label>
        <select
          value={localData.operation || ''}
          onChange={e => handleUpdate('operation', e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #333',
            borderRadius: '8px',
            fontSize: '0.875rem',
            background: '#2a2a2a',
            color: 'white',
          }}
        >
          {localData.resource === 'Document' ? (
            <>
              <option value="">Select operation...</option>
              <option value="Create">Create</option>
              <option value="Delete">Delete</option>
            </>
          ) : (
            <>
              <option value="">Select operation...</option>
              <option value="Append or Update Row">Append or Update Row</option>
              <option value="Append Row">Append Row</option>
              <option value="Update Row">Update Row</option>
              <option value="Get Row(s)">Get Row(s)</option>
              <option value="Delete Rows">Delete Rows</option>
            </>
          )}
        </select>
      </div>

      {/* Document: Delete */}
      {localData.resource === 'Document' &&
        localData.operation === 'Delete' && (
          <>
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
                  onChange={e => handleUpdate('spreadsheetId', e.target.value)}
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
                  <option value="">Select document to delete...</option>
                  {spreadsheets.map(spreadsheet => (
                    <option key={spreadsheet.id} value={spreadsheet.id}>
                      {spreadsheet.name}
                    </option>
                  ))}
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
          </>
        )}

      {/* Document: Create */}
      {localData.resource === 'Document' &&
        localData.operation === 'Create' && (
          <>
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
                Title
              </label>
              <VariableAutocomplete
                value={localData.title || ''}
                onChange={e => handleUpdate('title', e.target.value)}
                availableVariables={availableVariables}
                placeholder="My Report"
              />
            </div>
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
                Initial Sheets
              </label>
              <div
                style={{
                  background: '#2a2a2a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  padding: '0.75rem',
                }}
              >
                {(localData.sheets || []).map((sheet, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      marginBottom: '0.5rem',
                      alignItems: 'center',
                    }}
                  >
                    <input
                      type="text"
                      value={sheet.title || ''}
                      onChange={e => {
                        const newSheets = [...(localData.sheets || [])];
                        newSheets[index] = {
                          ...newSheets[index],
                          title: e.target.value,
                        };
                        handleUpdate('sheets', newSheets);
                      }}
                      placeholder="Sheet Title"
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        border: '1px solid #333',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        background: '#1a1a1a',
                        color: 'white',
                      }}
                    />
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.75rem',
                        color: '#94a3b8',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={sheet.hidden || false}
                        onChange={e => {
                          const newSheets = [...(localData.sheets || [])];
                          newSheets[index] = {
                            ...newSheets[index],
                            hidden: e.target.checked,
                          };
                          handleUpdate('sheets', newSheets);
                        }}
                      />
                      Hidden
                    </label>
                    <button
                      onClick={() => {
                        const newSheets = (localData.sheets || []).filter(
                          (_, i) => i !== index
                        );
                        handleUpdate('sheets', newSheets);
                      }}
                      style={{
                        background: '#ef4444',
                        border: 'none',
                        color: 'white',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const newSheets = [
                      ...(localData.sheets || []),
                      { title: '', hidden: false },
                    ];
                    handleUpdate('sheets', newSheets);
                  }}
                  style={{
                    background: '#3b82f6',
                    border: 'none',
                    color: 'white',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    width: '100%',
                  }}
                >
                  + Add Sheet
                </button>
              </div>
            </div>
          </>
        )}

      {/* Sheet Within Document: All Operations */}
      {localData.resource === 'Sheet Within Document' && (
        <>
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
                onChange={e => {
                  handleUpdate('spreadsheetId', e.target.value);
                  if (e.target.value) {
                    fetchSheets(e.target.value);
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

          {/* Append or Update Row */}
          {localData.operation === 'Append or Update Row' && (
            <>
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
                  Unique Column
                </label>
                <select
                  value={localData.uniqueColumn || ''}
                  onChange={e => handleUpdate('uniqueColumn', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    background: '#2a2a2a',
                    color: 'white',
                  }}
                >
                  <option value="">Select column...</option>
                  {columns && columns.length > 0 ? (
                    columns.map((column, index) => (
                      <option key={index} value={column}>
                        {column}
                      </option>
                    ))
                  ) : (
                    <option value="">No columns available</option>
                  )}
                </select>
              </div>
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
                  Unique Value
                </label>
                <VariableAutocomplete
                  value={localData.uniqueValue || ''}
                  onChange={e => handleUpdate('uniqueValue', e.target.value)}
                  availableVariables={availableVariables}
                  placeholder="john@example.com or {{email}}"
                />
              </div>
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
                  Values to Set by Column
                </label>
                <div
                  style={{
                    background: '#2a2a2a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    padding: '0.75rem',
                  }}
                >
                  {columns && columns.length > 0 ? (
                    columns.map((column, index) => {
                      // Get current value from valuesToSet object
                      let currentValue = '';
                      if (
                        typeof localData.valuesToSet === 'object' &&
                        localData.valuesToSet !== null &&
                        !Array.isArray(localData.valuesToSet)
                      ) {
                        currentValue = localData.valuesToSet[column] || '';
                      }

                      return (
                        <div key={index} style={{ marginBottom: '0.5rem' }}>
                          <label
                            style={{
                              display: 'block',
                              marginBottom: '0.25rem',
                              fontSize: '0.75rem',
                              color: '#94a3b8',
                            }}
                          >
                            {column}
                          </label>
                          <VariableAutocomplete
                            value={
                              typeof currentValue === 'string'
                                ? currentValue
                                : String(currentValue || '')
                            }
                            onChange={e => {
                              // Handle both regular events and synthetic events
                              const newValue =
                                e?.target?.value ?? e?.value ?? '';
                              // Update as object with column names as keys
                              const newValues = {
                                ...(typeof localData.valuesToSet === 'object' &&
                                localData.valuesToSet !== null &&
                                !Array.isArray(localData.valuesToSet)
                                  ? localData.valuesToSet
                                  : {}),
                              };
                              if (newValue) {
                                newValues[column] = newValue;
                              } else {
                                delete newValues[column];
                              }
                              handleUpdate('valuesToSet', newValues);
                            }}
                            availableVariables={availableVariables}
                            placeholder={`Value for ${column}`}
                          />
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                      Select a sheet to see available columns
                    </div>
                  )}
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    color: 'white',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={localData.appendIfNotFound !== false}
                    onChange={e =>
                      handleUpdate('appendIfNotFound', e.target.checked)
                    }
                  />
                  Append if not found
                </label>
              </div>
            </>
          )}

          {/* Append Row */}
          {localData.operation === 'Append Row' && (
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
                Values by Column
              </label>
              <div
                style={{
                  background: '#2a2a2a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  padding: '0.75rem',
                }}
              >
                {columns && columns.length > 0 ? (
                  columns.map((column, index) => {
                    // Get current value from valuesToSet array or object
                    let currentValue = '';
                    if (Array.isArray(localData.valuesToSet)) {
                      currentValue = localData.valuesToSet[index] || '';
                    } else if (
                      typeof localData.valuesToSet === 'object' &&
                      localData.valuesToSet !== null
                    ) {
                      currentValue = localData.valuesToSet[column] || '';
                    }

                    return (
                      <div key={index} style={{ marginBottom: '0.5rem' }}>
                        <label
                          style={{
                            display: 'block',
                            marginBottom: '0.25rem',
                            fontSize: '0.75rem',
                            color: '#94a3b8',
                          }}
                        >
                          {column}
                        </label>
                        <VariableAutocomplete
                          value={
                            typeof currentValue === 'string'
                              ? currentValue
                              : String(currentValue || '')
                          }
                          onChange={e => {
                            // Handle both regular events and synthetic events
                            const newValue = e?.target?.value ?? e?.value ?? '';
                            // Update as array to maintain column order
                            const newValues = Array.isArray(
                              localData.valuesToSet
                            )
                              ? [...localData.valuesToSet]
                              : [];
                            // Ensure array is long enough
                            while (newValues.length <= index) {
                              newValues.push('');
                            }
                            newValues[index] = newValue;
                            handleUpdate('valuesToSet', newValues);
                          }}
                          availableVariables={availableVariables}
                          placeholder={`Value for ${column}`}
                        />
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                    Select a sheet to see available columns
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Update Row */}
          {localData.operation === 'Update Row' && (
            <>
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
                  Row Index (1-based)
                </label>
                <VariableAutocomplete
                  value={localData.rowIndex || ''}
                  onChange={e => handleUpdate('rowIndex', e.target.value)}
                  availableVariables={availableVariables}
                  placeholder="2 or {{rowIndex}}"
                />
              </div>
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
                  Values by Column
                </label>
                <div
                  style={{
                    background: '#2a2a2a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    padding: '0.75rem',
                  }}
                >
                  {columns && columns.length > 0 ? (
                    columns.map((column, index) => {
                      // Get current value from valuesToSet array or object
                      let currentValue = '';
                      if (Array.isArray(localData.valuesToSet)) {
                        currentValue = localData.valuesToSet[index] || '';
                      } else if (
                        typeof localData.valuesToSet === 'object' &&
                        localData.valuesToSet !== null
                      ) {
                        currentValue = localData.valuesToSet[column] || '';
                      }

                      return (
                        <div key={index} style={{ marginBottom: '0.5rem' }}>
                          <label
                            style={{
                              display: 'block',
                              marginBottom: '0.25rem',
                              fontSize: '0.75rem',
                              color: '#94a3b8',
                            }}
                          >
                            {column}
                          </label>
                          <VariableAutocomplete
                            value={
                              typeof currentValue === 'string'
                                ? currentValue
                                : String(currentValue || '')
                            }
                            onChange={e => {
                              // Handle both regular events and synthetic events
                              const newValue =
                                e?.target?.value ?? e?.value ?? '';
                              // Update as array to maintain column order
                              const newValues = Array.isArray(
                                localData.valuesToSet
                              )
                                ? [...localData.valuesToSet]
                                : [];
                              // Ensure array is long enough
                              while (newValues.length <= index) {
                                newValues.push('');
                              }
                              newValues[index] = newValue;
                              handleUpdate('valuesToSet', newValues);
                            }}
                            availableVariables={availableVariables}
                            placeholder={`Value for ${column}`}
                          />
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                      Select a sheet to see available columns
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Get Row(s) */}
          {localData.operation === 'Get Row(s)' && (
            <>
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
                  Filters
                </label>
                <div
                  style={{
                    background: '#2a2a2a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    padding: '0.75rem',
                  }}
                >
                  {(localData.filters || []).map((filter, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        gap: '0.5rem',
                        marginBottom: '0.5rem',
                        alignItems: 'center',
                      }}
                    >
                      <select
                        value={filter.column || ''}
                        onChange={e => {
                          const newFilters = [...(localData.filters || [])];
                          newFilters[index] = {
                            ...newFilters[index],
                            column: e.target.value,
                          };
                          handleUpdate('filters', newFilters);
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
                        <option value="">Select column...</option>
                        {columns && columns.length > 0 ? (
                          columns.map((column, colIndex) => (
                            <option key={colIndex} value={column}>
                              {column}
                            </option>
                          ))
                        ) : (
                          <option value="">No columns available</option>
                        )}
                      </select>
                      <VariableAutocomplete
                        value={filter.value || ''}
                        onChange={e => {
                          const newFilters = [...(localData.filters || [])];
                          newFilters[index] = {
                            ...newFilters[index],
                            value: e.target.value,
                          };
                          handleUpdate('filters', newFilters);
                        }}
                        availableVariables={availableVariables}
                        placeholder="Value"
                        style={{ flex: 1 }}
                      />
                      <button
                        onClick={() => {
                          const newFilters = (localData.filters || []).filter(
                            (_, i) => i !== index
                          );
                          handleUpdate('filters', newFilters);
                        }}
                        style={{
                          background: '#ef4444',
                          border: 'none',
                          color: 'white',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const newFilters = [
                        ...(localData.filters || []),
                        { column: '', value: '' },
                      ];
                      handleUpdate('filters', newFilters);
                    }}
                    style={{
                      background: '#3b82f6',
                      border: 'none',
                      color: 'white',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      width: '100%',
                    }}
                  >
                    + Add Filter
                  </button>
                </div>
              </div>
              {localData.filters && localData.filters.length > 0 && (
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
                    Combine Filters
                  </label>
                  <select
                    value={localData.combineFilters || 'AND'}
                    onChange={e =>
                      handleUpdate('combineFilters', e.target.value)
                    }
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #333',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      background: '#2a2a2a',
                      color: 'white',
                    }}
                  >
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                  </select>
                </div>
              )}
            </>
          )}

          {/* Delete Rows */}
          {localData.operation === 'Delete Rows' && (
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
                Row Indices (JSON Array, 1-based)
              </label>
              <VariableAutocomplete
                value={
                  typeof localData.rowIndices === 'string'
                    ? localData.rowIndices
                    : JSON.stringify(localData.rowIndices || [], null, 2)
                }
                onChange={e => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    handleUpdate('rowIndices', parsed);
                  } catch {
                    handleUpdate('rowIndices', e.target.value);
                  }
                }}
                availableVariables={availableVariables}
                placeholder="[2, 3, 5]"
                multiline
              />
            </div>
          )}
        </>
      )}
    </>
  );
}
