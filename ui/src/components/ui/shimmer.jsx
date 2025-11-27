import * as React from 'react';
import { cn } from '@/lib/index';

/**
 * Shimmer Component
 * Wrapper component that adds shimmer effect to children
 * CSS-based animation for optimal performance
 */
const Shimmer = React.memo(
  React.forwardRef(
    (
      {
        children,
        className,
        active = true,
        duration = 2,
        ...props
      },
      ref
    ) => {
      if (!active) {
        return <>{children}</>;
      }

      return (
      <div
        ref={ref}
        className={cn('relative overflow-hidden', className)}
        {...props}
      >
        {children}
        <div
          className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent"
          style={{
            animationDuration: `${duration}s`,
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
          }}
        />
      </div>
      );
    }
  )
);

Shimmer.displayName = 'Shimmer';

export { Shimmer };

