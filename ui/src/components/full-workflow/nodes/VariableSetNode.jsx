import BaseNode from './BaseNode';

export default function VariableSetNode({ data, selected }) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      type="variable-set"
      icon="📝"
      color="#f59e0b"
      label="Set Variable"
    />
  );
}
