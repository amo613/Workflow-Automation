import { useState } from 'react';
import { workflowExportImportService } from '../../services/workflowExportImport.service.js';

export default function WorkflowImportModal({
  isOpen,
  onClose,
  onImportSuccess,
}) {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [workflowName, setWorkflowName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  const handleFileSelect = e => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.json')) {
      setError('Please select a valid JSON file');
      return;
    }

    setFile(selectedFile);
    setFileName(selectedFile.name);
    setError(null);

    // Read and preview file
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const json = JSON.parse(event.target.result);
        setPreview(json);
        // Pre-fill workflow name if available
        if (json.workflow?.name) {
          setWorkflowName(json.workflow.name);
        }
      } catch (err) {
        setError('Invalid JSON file: ' + err.message);
        setPreview(null);
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (!file || !preview) {
      setError('Please select a valid workflow file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const importedWorkflow = await workflowExportImportService.importWorkflow(
        preview,
        workflowName || null
      );

      // Reset form
      setFile(null);
      setFileName('');
      setWorkflowName('');
      setPreview(null);

      // Call success callback
      if (onImportSuccess) {
        onImportSuccess(importedWorkflow);
      }

      // Close modal
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to import workflow');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFile(null);
      setFileName('');
      setWorkflowName('');
      setPreview(null);
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '2rem',
      }}
      onClick={e => {
        if (e.target === e.currentTarget && !loading) {
          handleClose();
        }
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.5rem 2rem',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
              }}
            >
              📥
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: 'white',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                }}
              >
                Import Workflow
              </h2>
              <p
                style={{
                  margin: '0.25rem 0 0 0',
                  fontSize: '0.875rem',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontWeight: 500,
                }}
              >
                Upload a JSON file to import a workflow
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              border: 'none',
              color: 'white',
              fontSize: '1.5rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              opacity: loading ? 0.5 : 1,
            }}
            onMouseEnter={e => {
              if (!loading) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                e.currentTarget.style.transform = 'rotate(90deg)';
              }
            }}
            onMouseLeave={e => {
              if (!loading) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.transform = 'rotate(0deg)';
              }
            }}
          >
            ×
          </button>
        </div>

        {/* Modal Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '2rem',
            background: '#f8fafc',
          }}
        >
          {/* File Upload */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#1a202c',
                marginBottom: '0.5rem',
              }}
            >
              Select Workflow File (JSON)
            </label>
            <div
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: '12px',
                padding: '2rem',
                textAlign: 'center',
                background: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: loading ? 0.6 : 1,
              }}
              onDragOver={e => {
                if (!loading) {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = '#10b981';
                  e.currentTarget.style.background = '#f0fdf4';
                }
              }}
              onDragLeave={e => {
                if (!loading) {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.background = 'white';
                }
              }}
              onDrop={e => {
                if (!loading) {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.background = 'white';
                  const droppedFile = e.dataTransfer.files[0];
                  if (droppedFile) {
                    const fakeEvent = { target: { files: [droppedFile] } };
                    handleFileSelect(fakeEvent);
                  }
                }
              }}
            >
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                disabled={loading}
                style={{ display: 'none' }}
                id="workflow-file-input"
              />
              <label
                htmlFor="workflow-file-input"
                style={{
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'block',
                }}
              >
                {fileName ? (
                  <div>
                    <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
                      📄
                    </div>
                    <div
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: '#10b981',
                        marginBottom: '0.25rem',
                      }}
                    >
                      {fileName}
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: '#64748b',
                      }}
                    >
                      Click to change file
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
                      📁
                    </div>
                    <div
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: '#64748b',
                        marginBottom: '0.25rem',
                      }}
                    >
                      Click to select or drag & drop
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: '#94a3b8',
                      }}
                    >
                      JSON files only
                    </div>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Workflow Name Override */}
          {preview && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#1a202c',
                  marginBottom: '0.5rem',
                }}
              >
                Workflow Name (optional)
              </label>
              <input
                type="text"
                value={workflowName}
                onChange={e => setWorkflowName(e.target.value)}
                placeholder={preview.workflow?.name || 'Enter workflow name'}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  background: 'white',
                  transition: 'all 0.2s ease',
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = '#10b981';
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = '#e0e0e0';
                }}
              />
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#1a202c',
                  marginBottom: '0.5rem',
                }}
              >
                Preview
              </div>
              <div
                style={{
                  background: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  padding: '1rem',
                  fontSize: '0.75rem',
                  color: '#64748b',
                  maxHeight: '200px',
                  overflowY: 'auto',
                }}
              >
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Name:</strong> {preview.workflow?.name || 'N/A'}
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Type:</strong> {preview.workflow?.type || 'N/A'}
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Nodes:</strong>{' '}
                  {preview.workflow?.workflow_json?.nodes?.length || 0}
                </div>
                <div>
                  <strong>Edges:</strong>{' '}
                  {preview.workflow?.workflow_json?.edges?.length || 0}
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div
              style={{
                padding: '0.75rem',
                background: '#fee2e2',
                border: '1px solid #ef4444',
                borderRadius: '8px',
                fontSize: '0.875rem',
                color: '#dc2626',
                marginBottom: '1.5rem',
              }}
            >
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end',
            }}
          >
            <button
              onClick={handleClose}
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#f1f5f9',
                color: '#64748b',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={loading || !file || !preview}
              style={{
                padding: '0.75rem 1.5rem',
                background:
                  loading || !file || !preview
                    ? '#cbd5e1'
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor:
                  loading || !file || !preview ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                boxShadow:
                  loading || !file || !preview
                    ? 'none'
                    : '0 4px 12px rgba(16, 185, 129, 0.3)',
              }}
              onMouseEnter={e => {
                if (!loading && file && preview) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow =
                    '0 6px 16px rgba(16, 185, 129, 0.4)';
                }
              }}
              onMouseLeave={e => {
                if (!loading && file && preview) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow =
                    '0 4px 12px rgba(16, 185, 129, 0.3)';
                }
              }}
            >
              {loading ? '⏳ Importing...' : '📥 Import Workflow'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
