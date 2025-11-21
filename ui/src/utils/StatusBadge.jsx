import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

/**
 * StatusBadge Component
 * Reusable status indicator badge for workflow nodes
 * @param {string} status - 'idle' | 'running' | 'success' | 'failed'
 */
export default function StatusBadge({ status }) {
  if (status === 'idle' || !status) {
    return null;
  }

  const statusColor = {
    running: '#3b82f6',
    success: '#10b981',
    failed: '#ef4444',
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '-8px',
        right: '-8px',
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        background: statusColor[status],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
        zIndex: 10,
      }}
    >
      {status === 'running' ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : status === 'success' ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : (
        <XCircle className="w-4 h-4" />
      )}
    </div>
  );
}
