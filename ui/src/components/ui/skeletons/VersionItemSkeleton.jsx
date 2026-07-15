import * as React from 'react';
import { Skeleton } from '../skeleton';
import { cn } from '@/lib/index';

/**
 * VersionItemSkeleton Component
 * Skeleton loader for version history items
 * Optimized with React.memo for performance
 */
const VersionItemSkeleton = React.memo(() => {
  return (
    <div
      className={cn(
        'rounded-lg border border-border/30 bg-card/50 p-4',
        'animate-pulse'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          {/* Version Number */}
          <Skeleton variant="rectangular" className="h-8 w-16 rounded-md" />

          {/* Date */}
          <Skeleton variant="text" className="h-5 w-32" />

          {/* Message */}
          <Skeleton variant="text" className="h-5 w-48" />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Skeleton variant="rectangular" className="h-8 w-20 rounded-md" />
        </div>
      </div>
    </div>
  );
});

VersionItemSkeleton.displayName = 'VersionItemSkeleton';

export default VersionItemSkeleton;
