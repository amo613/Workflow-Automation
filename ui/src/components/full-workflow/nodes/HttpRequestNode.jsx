import BaseNode from './BaseNode';
import { Globe } from 'lucide-react';
export default function HttpRequestNode({ data, selected }) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      type="http-request"
      icon={<Globe className="w-5 h-5" />}
      color="#3b82f6"
      label="HTTP Request"
    />
  );
}
