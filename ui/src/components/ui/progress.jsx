import * as React from 'react';
import { cn } from '@/lib/index';

/**
 * Progress Component
 * Animated progress bar with optional shimmer effect
 * Performance optimized with CSS animations
 */
const Progress = React.memo(
  React.forwardRef(
    (
      {
        value = 0,
        max = 100,
        className,
        showShimmer = true,
        animated = true,
        indicatorClassName,
        ...props
      },
      ref
    ) => {
      const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

      return (
        <div
          ref={ref}
          className={cn(
            'relative h-2 w-full overflow-hidden rounded-full bg-muted',
            className
          )}
          {...props}
        >
          <div
            className={cn(
              'h-full rounded-full bg-primary transition-all ease-out',
              animated && 'will-change-transform',
              indicatorClassName
            )}
            style={{
              width: `${percentage}%`,
              transition: animated
                ? 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                : 'none',
            }}
          >
            {showShimmer && percentage > 0 && percentage < 100 && (
              <div
                className="absolute inset-0 animate-progress-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent"
                style={{
                  backgroundSize: '200% 100%',
                }}
              />
            )}
          </div>
        </div>
      );
    }
  )
);

Progress.displayName = 'Progress';

export { Progress };

