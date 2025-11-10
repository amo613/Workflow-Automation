import BaseNode from './BaseNode';

export default function HttpRequestNode({ data, selected }) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      type="http-request"
      icon="🌐"
      color="#3b82f6"
      label="HTTP Request"
    />
  );
}
