import * as React from 'react';
import { Skeleton } from '../skeleton';
import { cn } from '@/lib/index';

/**
 * WorkflowCardSkeleton Component
 * Skeleton loader for workflow cards in FullWorkflowList
 * Optimized with React.memo for performance
 */
const WorkflowCardSkeleton = React.memo(() => {
  return (
    <div
      className={cn(
        'rounded-xl border border-border/30 bg-card',
        'flex items-center min-h-[100px]',
        'animate-pulse'
      )}
    >
      <div className="grid grid-cols-12 gap-4 w-full py-7 px-8">
        {/* Icon + Name */}
        <div className="col-span-3 flex items-center gap-4">
          <Skeleton variant="rectangular" className="w-14 h-14 rounded-xl" />
          <Skeleton variant="text" className="h-6 w-32" />
        </div>

        {/* Type Badge */}
        <div className="col-span-2 flex items-center">
          <Skeleton variant="rectangular" className="h-8 w-24 rounded-full" />
        </div>

        {/* Status Badge */}
        <div className="col-span-2 flex items-center">
          <Skeleton variant="rectangular" className="h-8 w-20 rounded-full" />
        </div>

        {/* Date */}
        <div className="col-span-2 flex items-center">
          <Skeleton variant="text" className="h-5 w-24" />
        </div>

        {/* Actions */}
        <div className="col-span-3 flex items-center justify-end gap-3">
          <Skeleton variant="rectangular" className="h-9 w-24 rounded-md" />
          <Skeleton variant="rectangular" className="h-9 w-20 rounded-md" />
        </div>
      </div>
    </div>
  );
});

WorkflowCardSkeleton.displayName = 'WorkflowCardSkeleton';

export default WorkflowCardSkeleton;
