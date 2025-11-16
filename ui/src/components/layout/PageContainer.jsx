import { Card } from '@/components/ui/card';

export default function PageContainer({ children, className = '' }) {
  return (
    <div className={`max-w-7xl mx-auto ${className}`}>
      {children}
    </div>
  );
}

