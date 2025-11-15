import { useState } from 'react';

/**
 * Error Details Modal
 * Displays detailed error information for a failed node
 */
export default function ErrorDetailsModal({
  isOpen,
  onClose,
  errorLogEntry,
  nodeName,
}) {
  const [showStack, setShowStack] = useState(false);

  if (!isOpen || !errorLogEntry) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: '#dc2626',
              margin: 0,
            }}
          >
            Error Details
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#6b7280',
            }}
          >
            ×
          </button>
        </div>

        {nodeName && (
          <div style={{ marginBottom: '1rem' }}>
            <div
              style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                marginBottom: '0.25rem',
              }}
            >
              Node
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 500 }}>{nodeName}</div>
          </div>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <div
            style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginBottom: '0.25rem',
            }}
          >
            Error Message
          </div>
          <div
            style={{
              fontSize: '0.875rem',
              color: '#dc2626',
              padding: '0.75rem',
              backgroundColor: '#fef2f2',
              borderRadius: '4px',
              wordBreak: 'break-word',
            }}
          >
            {errorLogEntry.error || 'Unknown error'}
          </div>
        </div>

        {errorLogEntry.errorType && (
          <div style={{ marginBottom: '1rem' }}>
            <div
              style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                marginBottom: '0.25rem',
              }}
            >
              Error Type
            </div>
            <div
              style={{
                fontSize: '0.875rem',
                padding: '0.5rem',
                backgroundColor:
                  errorLogEntry.errorType === 'transient'
                    ? '#fef3c7'
                    : errorLogEntry.errorType === 'user'
                      ? '#fee2e2'
                      : errorLogEntry.errorType === 'system'
                        ? '#dbeafe'
                        : '#f3f4f6',
                borderRadius: '4px',
                display: 'inline-block',
                textTransform: 'capitalize',
              }}
            >
              {errorLogEntry.errorType}
            </div>
          </div>
        )}

        {errorLogEntry.retryAttempts !== undefined &&
          errorLogEntry.retryAttempts > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div
                style={{
                  fontSize: '0.875rem',
                  color: '#6b7280',
                  marginBottom: '0.25rem',
                }}
              >
                Retry Attempts
              </div>
              <div style={{ fontSize: '0.875rem' }}>
                {errorLogEntry.retryAttempts} attempt(s) made
              </div>
            </div>
          )}

        {errorLogEntry.timestamp && (
          <div style={{ marginBottom: '1rem' }}>
            <div
              style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                marginBottom: '0.25rem',
              }}
            >
              Timestamp
            </div>
            <div style={{ fontSize: '0.875rem' }}>
              {new Date(errorLogEntry.timestamp).toLocaleString()}
            </div>
          </div>
        )}

        {errorLogEntry.errorStack && (
          <div style={{ marginBottom: '1rem' }}>
            <button
              onClick={() => setShowStack(!showStack)}
              style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
                marginBottom: '0.5rem',
              }}
            >
              {showStack ? 'Hide' : 'Show'} Stack Trace
            </button>
            {showStack && (
              <pre
                style={{
                  fontSize: '0.75rem',
                  padding: '0.75rem',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '4px',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '300px',
                  overflowY: 'auto',
                }}
              >
                {errorLogEntry.errorStack}
              </pre>
            )}
          </div>
        )}

        {errorLogEntry.errorContext && (
          <div style={{ marginBottom: '1rem' }}>
            <div
              style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                marginBottom: '0.25rem',
              }}
            >
              Error Context
            </div>
            <pre
              style={{
                fontSize: '0.75rem',
                padding: '0.75rem',
                backgroundColor: '#f3f4f6',
                borderRadius: '4px',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '200px',
                overflowY: 'auto',
              }}
            >
              {JSON.stringify(errorLogEntry.errorContext, null, 2)}
            </pre>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: '1.5rem',
            gap: '0.5rem',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#f3f4f6',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
