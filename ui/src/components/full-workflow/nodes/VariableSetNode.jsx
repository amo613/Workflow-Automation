import BaseNode from './BaseNode';
import { FileEdit } from 'lucide-react';

export default function VariableSetNode({ data, selected }) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      type="variable-set"
      icon={<FileEdit className="w-5 h-5" />}
      color="#f59e0b"
      label="Set Variable"
    />
  );
}
