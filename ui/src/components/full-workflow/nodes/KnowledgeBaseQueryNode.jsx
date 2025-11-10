import BaseNode from './BaseNode';

export default function KnowledgeBaseQueryNode({ data, selected }) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      type="knowledge-base-query"
      icon="📚"
      color="#a78bfa"
      label="Knowledge Base"
    />
  );
}
