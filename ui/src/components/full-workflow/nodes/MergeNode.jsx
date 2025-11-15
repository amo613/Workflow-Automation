import BaseNode from './BaseNode';

export default function MergeNode({ data, selected }) {
  const mergeStrategy = data?.mergeStrategy || 'array';
  const strategyLabels = {
    array: 'Array',
    first: 'First',
    last: 'Last',
    merge: 'Merge',
  };

  // Add subtitle to data.name so it shows in BaseNode
  const nodeData = {
    ...data,
    name: data.name || strategyLabels[mergeStrategy] || 'Array',
  };

  return (
    <BaseNode
      data={nodeData}
      selected={selected}
      type="merge"
      icon="🔀"
      color="#8b5cf6"
      label="Merge"
    />
  );
}
