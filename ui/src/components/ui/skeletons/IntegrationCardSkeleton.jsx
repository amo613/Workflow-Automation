import * as React from 'react';
import { Skeleton } from '../skeleton';
import { cn } from '@/lib/index';

/**
 * IntegrationCardSkeleton Component
 * Skeleton loader for integration cards in OpenAITestPage
 * Optimized with React.memo for performance
 */
const IntegrationCardSkeleton = React.memo(() => {
  return (
    <div
      className={cn('glass border-border/50 rounded-lg p-4', 'animate-pulse')}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <Skeleton variant="circular" className="w-8 h-8" />
          <Skeleton variant="text" className="h-5 w-32" />
        </div>
        <Skeleton variant="rectangular" className="h-6 w-20 rounded-full" />
      </div>

      {/* Description */}
      <Skeleton variant="text" className="h-4 w-full mb-2" />
      <Skeleton variant="text" className="h-4 w-3/4" />

      {/* Button */}
      <div className="mt-4">
        <Skeleton variant="rectangular" className="h-9 w-32 rounded-md" />
      </div>
    </div>
  );
});

IntegrationCardSkeleton.displayName = 'IntegrationCardSkeleton';

export default IntegrationCardSkeleton;
