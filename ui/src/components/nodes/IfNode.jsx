import { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { GitBranch } from 'lucide-react';

function IfNode({ data, id }) {
  const onNodeUpdate = data?.onNodeUpdate;
  const [condition, setCondition] = useState(data?.condition || '');
  const [trueLabel, setTrueLabel] = useState(data?.trueLabel || 'True');
  const [falseLabel, setFalseLabel] = useState(data?.falseLabel || 'False');

  useEffect(() => {
    if (data?.condition !== undefined) {
      setCondition(data.condition);
    }
    if (data?.trueLabel !== undefined) {
      setTrueLabel(data.trueLabel);
    }
    if (data?.falseLabel !== undefined) {
      setFalseLabel(data.falseLabel);
    }
  }, [data?.condition, data?.trueLabel, data?.falseLabel]);

  const handleConditionChange = e => {
    const newCondition = e.target.value;
    setCondition(newCondition);
    if (onNodeUpdate) {
      onNodeUpdate(id, { condition: newCondition });
    }
  };

  const handleTrueLabelChange = e => {
    const newLabel = e.target.value;
    setTrueLabel(newLabel);
    if (onNodeUpdate) {
      onNodeUpdate(id, { trueLabel: newLabel });
    }
  };

  const handleFalseLabelChange = e => {
    const newLabel = e.target.value;
    setFalseLabel(newLabel);
    if (onNodeUpdate) {
      onNodeUpdate(id, { falseLabel: newLabel });
    }
  };

  return (
    <div
      style={{
        padding: '1.25rem',
        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        color: '#333',
        borderRadius: '20px',
        minWidth: '220px',
        boxShadow:
          '0 8px 24px rgba(245, 158, 11, 0.3), 0 4px 12px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
        border: '2px solid rgba(255, 255, 255, 0.3)',
        position: 'relative',
        transition: 'box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow =
          '0 12px 32px rgba(245, 158, 11, 0.4), 0 6px 16px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.4)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow =
          '0 8px 24px rgba(245, 158, 11, 0.3), 0 4px 12px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
      }}
    >
      <div
        style={{
          marginBottom: '0.75rem',
          fontWeight: 700,
          fontSize: '0.875rem',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          color: '#1f2937',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <GitBranch className="w-4 h-4" />
          <span>IF</span>
        </div>
      </div>
      <input
        type="text"
        value={condition}
        onChange={handleConditionChange}
        placeholder="Condition"
        style={{
          width: '100%',
          padding: '0.75rem',
          border: '2px solid rgba(0, 0, 0, 0.2)',
          borderRadius: '12px',
          fontSize: '0.875rem',
          marginBottom: '0.75rem',
          background: 'rgba(255, 255, 255, 0.9)',
          color: '#1f2937',
          backdropFilter: 'blur(10px)',
          transition: 'all 0.3s',
        }}
        onFocus={e => {
          e.currentTarget.style.background = '#ffffff';
          e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.3)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onBlur={e => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
          e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.2)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      />
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: 'white',
          border: '3px solid #f59e0b',
          width: '16px',
          height: '16px',
        }}
      />
      <div
        style={{
          marginTop: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={trueLabel}
            onChange={handleTrueLabelChange}
            placeholder="True label"
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              border: '2px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '10px',
              fontSize: '0.75rem',
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#1f2937',
              transition: 'all 0.3s',
            }}
            onFocus={e => {
              e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
            }}
            onBlur={e => {
              e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            style={{
              top: '50%',
              background: 'white',
              border: '3px solid #10b981',
              width: '16px',
              height: '16px',
            }}
          />
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={falseLabel}
            onChange={handleFalseLabelChange}
            placeholder="False label"
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              border: '2px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              fontSize: '0.75rem',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#1f2937',
              transition: 'all 0.3s',
            }}
            onFocus={e => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
            }}
            onBlur={e => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            }}
          />
          <Handle
            type="source"
            position={Position.Left}
            id="false"
            style={{
              top: '50%',
              background: 'white',
              border: '3px solid #ef4444',
              width: '16px',
              height: '16px',
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default IfNode;
