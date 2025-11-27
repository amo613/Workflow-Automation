import * as React from 'react';
import { cn } from '@/lib/index';

/**
 * Tooltip Component
 * Animated tooltip with smooth fade-in/out
 * Performance optimized with CSS animations
 */
const TooltipContext = React.createContext({
  open: false,
  setOpen: () => {},
});

export function Tooltip({ children, delay = 300 }) {
  const [open, setOpen] = React.useState(false);
  const timeoutRef = React.useRef(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setOpen(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setOpen(false);
  };

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <div
        className="relative inline-block"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>
    </TooltipContext.Provider>
  );
}

export function TooltipTrigger({ children, asChild, className, ...props }) {
  const { setOpen } = React.useContext(TooltipContext);

  if (asChild) {
    return React.cloneElement(children, {
      ...props,
      onMouseEnter: () => setOpen(true),
      onMouseLeave: () => setOpen(false),
    });
  }

  return (
    <div className={cn('inline-block', className)} {...props}>
      {children}
    </div>
  );
}

export function TooltipContent({
  children,
  side = 'top',
  className,
  ...props
}) {
  const { open } = React.useContext(TooltipContext);
  const [isExiting, setIsExiting] = React.useState(false);

  React.useEffect(() => {
    if (!open && isExiting) {
      const timer = setTimeout(() => setIsExiting(false), 150);
      return () => clearTimeout(timer);
    }
    if (open) {
      setIsExiting(false);
    }
  }, [open, isExiting]);

  if (!open && !isExiting) return null;

  const sideClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-popover border-l-transparent border-r-transparent border-b-transparent',
    bottom:
      'bottom-full left-1/2 -translate-x-1/2 border-b-popover border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-popover border-t-transparent border-b-transparent border-r-transparent',
    right:
      'right-full top-1/2 -translate-y-1/2 border-r-popover border-t-transparent border-b-transparent border-l-transparent',
  };

  return (
    <div
      className={cn(
        'absolute z-[2000] rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md tooltip-animated',
        sideClasses[side],
        !open && 'exiting',
        className
      )}
      onAnimationEnd={() => {
        if (!open) {
          setIsExiting(true);
        }
      }}
      {...props}
    >
      {children}
      <div
        className={cn(
          'absolute w-0 h-0 border-4',
          arrowClasses[side]
        )}
      />
    </div>
  );
}

TooltipTrigger.displayName = 'TooltipTrigger';
TooltipContent.displayName = 'TooltipContent';

