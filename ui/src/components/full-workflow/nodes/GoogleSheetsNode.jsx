import BaseNode from './BaseNode';
import { Sheet } from 'lucide-react';

export default function GoogleSheetsNode({ data, selected }) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      type="google-sheets"
      icon={<Sheet className="w-5 h-5" />}
      color="#34d399"
      label="Google Sheets"
    />
  );
}
