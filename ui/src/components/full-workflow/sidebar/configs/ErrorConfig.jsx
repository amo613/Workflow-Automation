import { useState } from 'react';
import FormField from '../FormField.jsx';

/**
 * Error Configuration Component
 * Handles error recovery settings for nodes
 */
export default function ErrorConfig({
  localData,
  handleUpdate,
  nodes = [], // All nodes in workflow (for fallback node selection)
  currentNodeId, // Current node ID (to exclude from fallback selection)
}) {
  const errorConfig = localData.errorConfig || {
    onError: 'stop',
    retryCount: 0,
    retryDelay: 1000,
    retryExponential: false,
    fallbackNodeId: null,
    retryOnErrors: [],
    continueOnErrors: [],
    defaultValue: null,
  };

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Get available nodes for fallback selection (exclude current node and trigger nodes)
  const availableNodes = nodes.filter(
    node =>
      node.id !== currentNodeId &&
      !node.type?.includes('trigger') &&
      node.type !== 'start' &&
      node.type !== 'end'
  );

  return (
    <div
      style={{
        marginTop: '1rem',
        paddingTop: '1rem',
        borderTop: '1px solid #e5e7eb',
      }}
    >
      <div
        style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: '#374151',
          marginBottom: '0.75rem',
        }}
      >
        Error Handling
      </div>

      {/* On Error Action */}
      <FormField
        label="On Error"
        name="onError"
        type="select"
        value={errorConfig.onError}
        onChange={value => {
          handleUpdate('errorConfig', {
            ...errorConfig,
            onError: value,
          });
        }}
        options={[
          { value: 'stop', label: 'Stop Workflow' },
          { value: 'continue', label: 'Continue Workflow' },
          { value: 'retry', label: 'Retry Execution' },
          { value: 'fallback', label: 'Go to Fallback Node' },
        ]}
      />

      {/* Retry Configuration */}
      {errorConfig.onError === 'retry' && (
        <div style={{ marginTop: '0.75rem' }}>
          <FormField
            label="Retry Count"
            name="retryCount"
            type="number"
            value={errorConfig.retryCount || 0}
            onChange={value => {
              handleUpdate('errorConfig', {
                ...errorConfig,
                retryCount: parseInt(value) || 0,
              });
            }}
            min={0}
            max={10}
            placeholder="0"
          />

          <div style={{ marginTop: '0.5rem' }}>
            <FormField
              label="Retry Delay (ms)"
              name="retryDelay"
              type="number"
              value={errorConfig.retryDelay || 1000}
              onChange={value => {
                handleUpdate('errorConfig', {
                  ...errorConfig,
                  retryDelay: parseInt(value) || 1000,
                });
              }}
              min={100}
              max={60000}
              placeholder="1000"
            />
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.875rem',
                color: '#374151',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={errorConfig.retryExponential || false}
                onChange={e => {
                  handleUpdate('errorConfig', {
                    ...errorConfig,
                    retryExponential: e.target.checked,
                  });
                }}
                style={{ marginRight: '0.5rem' }}
              />
              Exponential Backoff
            </label>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              marginTop: '0.5rem',
              fontSize: '0.75rem',
              color: '#6b7280',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Options
          </button>

          {showAdvanced && (
            <div style={{ marginTop: '0.5rem' }}>
              <FormField
                label="Retry Only On Errors (comma-separated patterns)"
                name="retryOnErrors"
                type="text"
                value={
                  errorConfig.retryOnErrors
                    ? errorConfig.retryOnErrors.join(', ')
                    : ''
                }
                onChange={value => {
                  const patterns = value
                    .split(',')
                    .map(p => p.trim())
                    .filter(p => p.length > 0);
                  handleUpdate('errorConfig', {
                    ...errorConfig,
                    retryOnErrors: patterns,
                  });
                }}
                placeholder="timeout, 503, ECONNRESET"
              />
            </div>
          )}
        </div>
      )}

      {/* Continue Configuration */}
      {errorConfig.onError === 'continue' && (
        <div style={{ marginTop: '0.75rem' }}>
          <FormField
            label="Default Value (JSON, optional)"
            name="defaultValue"
            type="text"
            value={
              errorConfig.defaultValue !== null &&
              errorConfig.defaultValue !== undefined
                ? JSON.stringify(errorConfig.defaultValue)
                : ''
            }
            onChange={value => {
              let parsedValue = null;
              try {
                if (value.trim()) {
                  parsedValue = JSON.parse(value);
                }
              } catch (e) {
                // Invalid JSON, keep as string or null
              }
              handleUpdate('errorConfig', {
                ...errorConfig,
                defaultValue: parsedValue,
              });
            }}
            placeholder='{"error": true} or [] or null'
          />

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              marginTop: '0.5rem',
              fontSize: '0.75rem',
              color: '#6b7280',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Options
          </button>

          {showAdvanced && (
            <div style={{ marginTop: '0.5rem' }}>
              <FormField
                label="Continue Only On Errors (comma-separated patterns)"
                name="continueOnErrors"
                type="text"
                value={
                  errorConfig.continueOnErrors
                    ? errorConfig.continueOnErrors.join(', ')
                    : ''
                }
                onChange={value => {
                  const patterns = value
                    .split(',')
                    .map(p => p.trim())
                    .filter(p => p.length > 0);
                  handleUpdate('errorConfig', {
                    ...errorConfig,
                    continueOnErrors: patterns,
                  });
                }}
                placeholder="table not found, 404"
              />
            </div>
          )}
        </div>
      )}

      {/* Fallback Configuration */}
      {errorConfig.onError === 'fallback' && (
        <div style={{ marginTop: '0.75rem' }}>
          <FormField
            label="Fallback Node"
            name="fallbackNodeId"
            type="select"
            value={errorConfig.fallbackNodeId || ''}
            onChange={value => {
              handleUpdate('errorConfig', {
                ...errorConfig,
                fallbackNodeId: value || null,
              });
            }}
            options={[
              { value: '', label: 'Select a node...' },
              ...availableNodes.map(node => ({
                value: node.id,
                label: `${node.data?.name || node.type} (${node.id})`,
              })),
            ]}
          />
          <div
            style={{
              marginTop: '0.5rem',
              fontSize: '0.75rem',
              color: '#6b7280',
            }}
          >
            When this node fails, the workflow will jump to the selected
            fallback node. The error information will be available as{' '}
            <code>_error</code> variable in the fallback node.
          </div>
        </div>
      )}
    </div>
  );
}
