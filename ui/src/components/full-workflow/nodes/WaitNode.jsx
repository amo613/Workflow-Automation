import BaseNode from './BaseNode';

export default function WaitNode({ data, selected }) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      type="wait"
      icon="⏱️"
      color="#6366f1"
      label="Wait"
    />
  );
}
