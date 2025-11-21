import BaseNode from './BaseNode';
import { Search } from 'lucide-react';

export default function WebScraperNode({ data, selected }) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      type="web-scraper"
      icon={<Search className="w-5 h-5" />}
      color="#3b82f6"
      label="Web Scraper"
    />
  );
}
