import BaseNode from './BaseNode';

export default function GoogleSheetsNode({ data, selected }) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      type="google-sheets"
      icon="📊"
      color="#34d399"
      label="Google Sheets"
    />
  );
}
