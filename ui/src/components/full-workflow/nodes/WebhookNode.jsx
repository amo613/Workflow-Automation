import BaseNode from './BaseNode';
import { Link } from 'lucide-react';

export default function WebhookNode({ data, selected }) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      type="webhook"
      icon={<Link className="w-5 h-5" />}
      color="#8b5cf6"
      label="Webhook"
    />
  );
}
