import { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';

function IfNode({ data, id }) {
  // React Flow passes onNodeUpdate in data, not as a separate prop
  const onNodeUpdate = data?.onNodeUpdate;
  const [condition, setCondition] = useState(data?.condition || '');
  const [trueLabel, setTrueLabel] = useState(data?.trueLabel || 'True');
  const [falseLabel, setFalseLabel] = useState(data?.falseLabel || 'False');

  // Sync state with data prop when it changes (e.g., when loading from DB)
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
      // Only pass the changed property, not the entire data object
      onNodeUpdate(id, { condition: newCondition });
    }
  };

  const handleTrueLabelChange = e => {
    const newLabel = e.target.value;
    setTrueLabel(newLabel);
    if (onNodeUpdate) {
      // Only pass the changed property, not the entire data object
      onNodeUpdate(id, { trueLabel: newLabel });
    }
  };

  const handleFalseLabelChange = e => {
    const newLabel = e.target.value;
    setFalseLabel(newLabel);
    if (onNodeUpdate) {
      // Only pass the changed property, not the entire data object
      onNodeUpdate(id, { falseLabel: newLabel });
    }
  };

  return (
    <div
      style={{
        padding: '1rem',
        background: '#ffc107',
        color: '#333',
        borderRadius: '8px',
        minWidth: '200px',
      }}
    >
      <div style={{ marginBottom: '0.5rem', fontWeight: 600 }}>IF</div>
      <input
        type="text"
        value={condition}
        onChange={handleConditionChange}
        placeholder="Condition"
        style={{
          width: '100%',
          padding: '0.5rem',
          border: '1px solid #ddd',
          borderRadius: '4px',
          fontSize: '0.875rem',
          marginBottom: '0.5rem',
        }}
      />
      <Handle type="target" position={Position.Top} />
      <div style={{ marginTop: '0.5rem' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <input
            type="text"
            value={trueLabel}
            onChange={handleTrueLabelChange}
            placeholder="True label"
            style={{
              width: '100%',
              padding: '0.25rem 0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '0.75rem',
            }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            style={{ top: '60%' }}
          />
        </div>
        <div>
          <input
            type="text"
            value={falseLabel}
            onChange={handleFalseLabelChange}
            placeholder="False label"
            style={{
              width: '100%',
              padding: '0.25rem 0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '0.75rem',
            }}
          />
          <Handle
            type="source"
            position={Position.Left}
            id="false"
            style={{ top: '80%' }}
          />
        </div>
      </div>
    </div>
  );
}

export default IfNode;
