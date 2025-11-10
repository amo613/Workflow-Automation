import BaseNode from './BaseNode';
import { Handle, Position } from 'reactflow';

export default function CallAgentNode({ data, selected, id }) {
  const hasKnowledgeBase =
    data?.knowledge_base_ids && data.knowledge_base_ids.length > 0;

  return (
    <div style={{ position: 'relative' }}>
      <BaseNode
        data={data}
        selected={selected}
        type="call-agent"
        icon="📞"
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
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: '8px',
            fontSize: '0.75rem',
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
            whiteSpace: 'nowrap',
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>📚 {data.knowledge_base_ids.length} KB</span>
        </div>
      )}
    </div>
  );
}
