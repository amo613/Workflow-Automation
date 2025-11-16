import BaseNode from './BaseNode';
import { Handle, Position } from 'reactflow';
import { Phone, Database } from 'lucide-react';

export default function CallAgentNode({ data, selected, id }) {
  const hasKnowledgeBase =
    data?.knowledge_base_ids && data.knowledge_base_ids.length > 0;

  return (
    <div style={{ position: 'relative' }}>
      <BaseNode
        data={data}
        selected={selected}
        type="call-agent"
        icon={<Phone className="w-5 h-5" />}
        color="#10b981"
        label="Call Agent"
      />

      {/* Knowledge Base Sub-Node */}
      {hasKnowledgeBase && (
        <div
          style={{
            position: 'absolute',
            bottom: '-40px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '0.5rem 0.75rem',
            background: 'hsl(var(--muted))',
            color: 'hsl(var(--foreground))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '0.5rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            whiteSpace: 'nowrap',
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Database className="w-3 h-3" />
          <span>{data.knowledge_base_ids.length} KB</span>
        </div>
      )}
    </div>
  );
}
