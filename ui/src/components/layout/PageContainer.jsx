import { Card } from '@/components/ui/card';

export default function PageContainer({ children, className = '' }) {
  return <div className={`w-full ${className}`}>{children}</div>;
}
