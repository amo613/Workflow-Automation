import BaseNode from './BaseNode';
import { Database } from 'lucide-react';

export default function DatabaseQueryNode({ data, selected }) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      type="database-query"
      icon={<Database className="w-5 h-5" />}
      color="#06b6d4"
      label="Database Query"
    />
  );
}
