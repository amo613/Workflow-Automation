import { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';

function EndNode({ data, id }) {
  // React Flow passes onNodeUpdate in data, not as a separate prop
  const onNodeUpdate = data?.onNodeUpdate;
  const [text, setText] = useState(data?.text || '');

  // Sync state with data prop when it changes (e.g., when loading from DB)
  useEffect(() => {
    if (data?.text !== undefined) {
      setText(data.text);
    }
  }, [data?.text]);

  const handleChange = e => {
    const newText = e.target.value;
    setText(newText);
    if (onNodeUpdate) {
      // Only pass the changed property, not the entire data object
      onNodeUpdate(id, { text: newText });
    }
  };

  return (
    <div
      style={{
        padding: '1rem',
        background: '#dc3545',
        color: 'white',
        borderRadius: '8px',
        minWidth: '200px',
      }}
    >
      <div style={{ marginBottom: '0.5rem', fontWeight: 600 }}>END</div>
      <textarea
        value={text}
        onChange={handleChange}
        placeholder="End message..."
        style={{
          width: '100%',
          padding: '0.5rem',
          border: '1px solid #ddd',
          borderRadius: '4px',
          fontSize: '0.875rem',
          minHeight: '60px',
          resize: 'vertical',
          color: '#333',
          background: 'white',
        }}
      />
      <Handle type="target" position={Position.Top} />
    </div>
  );
}

export default EndNode;
