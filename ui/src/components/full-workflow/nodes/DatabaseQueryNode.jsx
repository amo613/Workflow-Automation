import BaseNode from './BaseNode';

export default function DatabaseQueryNode({ data, selected }) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      type="database-query"
      icon="🗄️"
      color="#06b6d4"
      label="Database Query"
    />
  );
}
