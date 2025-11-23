import BaseNode from './BaseNode';
import { Building2 } from 'lucide-react';

export default function HubspotNode({ data, selected }) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      type="hubspot"
      icon={<Building2 className="w-5 h-5" />}
      color="#ff7a59"
      label="HubSpot CRM"
    />
  );
}
