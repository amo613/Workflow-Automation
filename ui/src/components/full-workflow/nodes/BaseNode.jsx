import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import StatusBadge from '@/utils/StatusBadge';
import ElectricBorder from './ElectricBorder';

/**
 * Base Node Component for Full Workflows
 * Provides common structure and styling for all node types
 * Dark Theme optimized
 */
function BaseNode({ data, selected, type, icon, color, label }) {
  // Status: 'idle' | 'running' | 'success' | 'failed'
  const status = data.status || 'idle';

  const statusColor = {
    running: '#3b82f6',
    success: '#10b981',
    failed: '#ef4444',
    idle: null,
  };

  // Reduced chaos for better performance while maintaining visual effect
  const chaos = status === 'running' ? 0.5 : 0.2;

  return (
    <ElectricBorder
      color={color}
      chaos={chaos}
      speed={1}
      thickness={2}
      style={{ borderRadius: '0.75rem' }}
    >
      <div
        style={{
          background: selected ? 'hsl(var(--accent))' : 'hsl(var(--card))',
          borderRadius: '0.75rem',
          padding: '1rem',
          minWidth: '200px',
          boxShadow: selected
            ? `0 4px 12px ${color}40`
            : '0 2px 8px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.2s ease',
          position: 'relative',
        }}
      >
        <StatusBadge status={status} />
        {/* Input Handle */}
        <Handle
          type="target"
          position={Position.Top}
          style={{
            background: color,
            width: '12px',
            height: '12px',
            border: '2px solid hsl(var(--card))',
          }}
        />

        {/* Node Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.5rem',
          }}
        >
          <div
            style={{
              fontSize: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '0.5rem',
              background: `${color}20`,
              color: color,
            }}
          >
            {icon}
          </div>
          <div>
            <div
              style={{
                fontWeight: 600,
                fontSize: '0.875rem',
                color: 'hsl(var(--foreground))',
              }}
            >
              {label || type}
            </div>
            {data.name && (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'hsl(var(--muted-foreground))',
                  marginTop: '0.25rem',
                }}
              >
                {data.name}
              </div>
            )}
          </div>
        </div>

        {/* Node Content */}
        {data.description && (
          <div
            style={{
              fontSize: '0.75rem',
              color: 'hsl(var(--muted-foreground))',
              marginTop: '0.5rem',
              padding: '0.5rem',
              background: 'hsl(var(--muted))',
              borderRadius: '0.375rem',
            }}
          >
            {data.description}
          </div>
        )}

        {/* Output Handle */}
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            background: color,
            width: '12px',
            height: '12px',
            border: '2px solid hsl(var(--card))',
          }}
        />
      </div>
    </ElectricBorder>
  );
}

// Memoize to prevent unnecessary re-renders when parent updates
export default memo(BaseNode, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.selected === nextProps.selected &&
    prevProps.type === nextProps.type &&
    prevProps.color === nextProps.color &&
    prevProps.label === nextProps.label &&
    prevProps.icon === nextProps.icon &&
    prevProps.data?.status === nextProps.data?.status &&
    prevProps.data?.name === nextProps.data?.name &&
    prevProps.data?.description === nextProps.data?.description
  );
});
