import BaseNode from './BaseNode';
import { Timer } from 'lucide-react';

export default function WaitNode({ data, selected }) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      type="wait"
      icon={<Timer className="w-5 h-5" />}
      color="#6366f1"
      label="Wait"
    />
  );
}
