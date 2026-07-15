import * as React from 'react';
import { cn } from '@/lib/index';

/**
 * Skeleton Component
 * CSS-based loading placeholder with shimmer effect
 * Performance optimized with CSS animations (no JS)
 */
const Skeleton = React.memo(
  React.forwardRef(({ className, variant = 'rectangular', ...props }, ref) => {
    const baseClasses = 'animate-pulse bg-muted';

    const variantClasses = {
      rectangular: 'rounded-md',
      circular: 'rounded-full',
      text: 'rounded h-4',
    };

    return (
      <div
        ref={ref}
        className={cn(baseClasses, variantClasses[variant], className)}
        {...props}
      />
    );
  })
);

Skeleton.displayName = 'Skeleton';

export { Skeleton };
