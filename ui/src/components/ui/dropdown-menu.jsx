import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const DropdownMenuContext = React.createContext({
  open: false,
  setOpen: () => {},
});

export function DropdownMenu({ children }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = event => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div ref={ref} className="relative">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

export function DropdownMenuTrigger({ children, asChild, className }) {
  const { open, setOpen } = React.useContext(DropdownMenuContext);

  if (asChild) {
    return React.cloneElement(children, {
      onClick: () => setOpen(!open),
    });
  }

  return (
    <button
      onClick={() => setOpen(!open)}
      className={cn('outline-none', className)}
    >
      {children}
    </button>
  );
}

export function DropdownMenuContent({ children, align = 'start', className }) {
  const { open } = React.useContext(DropdownMenuContext);

  if (!open) return null;

  const alignClasses = {
    start: 'left-0',
    end: 'right-0',
    center: 'left-1/2 -translate-x-1/2',
  };

  return (
    <div
      className={cn(
        'absolute top-full mt-2 z-[100] min-w-[12rem] rounded-md border border-border bg-popover p-1 shadow-lg',
        alignClasses[align],
        className
      )}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({ children, onClick, className, ...props }) {
  const { setOpen } = React.useContext(DropdownMenuContext);

  const handleClick = e => {
    onClick?.(e);
    setOpen(false);
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
