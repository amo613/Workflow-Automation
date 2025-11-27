import * as React from 'react';
import { cn } from '@/lib/index';
import { Loader2 } from 'lucide-react';

/**
 * Spinner Component
 * Various loading spinner animations
 * Performance optimized with CSS animations
 */

// Default Spinner (Rotating)
export function Spinner({
  className,
  size = 'default',
  variant = 'default',
  ...props
}) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    default: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  if (variant === 'default' || variant === 'rotate') {
    return (
      <Loader2
        className={cn(
          'animate-spin text-primary',
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }

  return (
    <div
      className={cn(
        'inline-block',
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {variant === 'dots' && <SpinnerDots size={size} />}
      {variant === 'pulse' && <SpinnerPulse size={size} />}
      {variant === 'ring' && <SpinnerRing size={size} />}
      {variant === 'chase' && <SpinnerChase size={size} />}
    </div>
  );
}

// Dots Spinner
function SpinnerDots({ size = 'default' }) {
  const dotSize = {
    sm: 'w-1 h-1',
    default: 'w-2 h-2',
    lg: 'w-3 h-3',
    xl: 'w-4 h-4',
  };

  return (
    <div className="flex items-center justify-center gap-1">
      <div
        className={cn(
          'rounded-full bg-primary spinner-dots',
          dotSize[size]
        )}
        style={{ animationDelay: '0s' }}
      />
      <div
        className={cn(
          'rounded-full bg-primary spinner-dots',
          dotSize[size]
        )}
        style={{ animationDelay: '0.2s' }}
      />
      <div
        className={cn(
          'rounded-full bg-primary spinner-dots',
          dotSize[size]
        )}
        style={{ animationDelay: '0.4s' }}
      />
    </div>
  );
}

// Pulse Spinner
function SpinnerPulse({ size = 'default' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    default: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  return (
    <div
      className={cn(
        'rounded-full bg-primary spinner-pulse',
        sizeClasses[size]
      )}
    />
  );
}

// Ring Spinner
function SpinnerRing({ size = 'default' }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    default: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-2',
    xl: 'w-12 h-12 border-4',
  };

  return (
    <div
      className={cn(
        'rounded-full border-primary border-t-transparent spinner-ring',
        sizeClasses[size]
      )}
    />
  );
}

// Chase Spinner
function SpinnerChase({ size = 'default' }) {
  const dotSize = {
    sm: 'w-1 h-1',
    default: 'w-1.5 h-1.5',
    lg: 'w-2 h-2',
    xl: 'w-3 h-3',
  };

  const containerSize = {
    sm: 'w-4 h-4',
    default: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  return (
    <div
      className={cn(
        'relative spinner-chase',
        containerSize[size]
      )}
    >
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className={cn(
            'absolute rounded-full bg-primary',
            dotSize[size]
          )}
          style={{
            top: '50%',
            left: '50%',
            transformOrigin: `0 ${size === 'sm' ? '8px' : size === 'default' ? '12px' : size === 'lg' ? '16px' : '24px'}`,
            transform: `translate(-50%, -50%) rotate(${i * 60}deg) translateY(${size === 'sm' ? '-8px' : size === 'default' ? '-12px' : size === 'lg' ? '-16px' : '-24px'})`,
            animationDelay: `${i * 0.1}s`,
            opacity: 0.3 + (i % 2) * 0.7,
          }}
        />
      ))}
    </div>
  );
}

export default Spinner;

