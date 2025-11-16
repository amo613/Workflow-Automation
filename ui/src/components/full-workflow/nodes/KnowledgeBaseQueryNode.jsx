import BaseNode from './BaseNode';
import { Database } from 'lucide-react';

export default function KnowledgeBaseQueryNode({ data, selected }) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      type="knowledge-base-query"
      icon={<Database className="w-5 h-5" />}
      color="#a78bfa"
      label="Knowledge Base"
    />
  );
}
