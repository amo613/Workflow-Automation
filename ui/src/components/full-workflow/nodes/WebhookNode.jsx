import BaseNode from './BaseNode';

export default function WebhookNode({ data, selected }) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      type="webhook"
      icon="🔗"
      color="#8b5cf6"
      label="Webhook"
    />
  );
}
