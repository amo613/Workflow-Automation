import BaseNode from './BaseNode';
import { GitMerge } from 'lucide-react';

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
      icon={<GitMerge className="w-5 h-5" />}
      color="#8b5cf6"
      label="Merge"
    />
  );
}
