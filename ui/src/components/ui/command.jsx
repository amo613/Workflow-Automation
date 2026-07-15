import * as React from 'react';
import { Search, Command as CommandIcon } from 'lucide-react';
import { cn } from '@/lib/index';

/**
 * Command Palette Component
 * Keyboard-driven command menu with search
 * Performance optimized with CSS animations
 */
const CommandContext = React.createContext({
  value: '',
  onValueChange: () => {},
  selectedIndex: 0,
  setSelectedIndex: () => {},
});

export function Command({ className, children, ...props }) {
  const [value, setValue] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  return (
    <CommandContext.Provider
      value={{
        value,
        onValueChange: setValue,
        selectedIndex,
        setSelectedIndex,
      }}
    >
      <div
        className={cn(
          'flex h-full w-full flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground',
          className
        )}
        {...props}
      >
        {children}
      </div>
    </CommandContext.Provider>
  );
}

export function CommandInput({
  placeholder = 'Type a command or search...',
  className,
  ...props
}) {
  const { value, onValueChange } = React.useContext(CommandContext);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
      <input
        ref={inputRef}
        value={value}
        onChange={e => onValueChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    </div>
  );
}

export function CommandList({ className, children, ...props }) {
  const { selectedIndex, setSelectedIndex } = React.useContext(CommandContext);
  const listRef = React.useRef(null);
  const itemsRef = React.useRef([]);

  React.useEffect(() => {
    const handleKeyDown = e => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < itemsRef.current.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : itemsRef.current.length - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selectedItem = itemsRef.current[selectedIndex];
        if (selectedItem) {
          selectedItem.onSelect?.();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, setSelectedIndex]);

  React.useEffect(() => {
    const selectedItem = itemsRef.current[selectedIndex];
    if (selectedItem?.element) {
      selectedItem.element.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  return (
    <div
      ref={listRef}
      className={cn(
        'max-h-[300px] overflow-y-auto overflow-x-hidden p-1',
        className
      )}
      {...props}
    >
      {React.Children.map(children, (child, index) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            index,
            isSelected: index === selectedIndex,
            ref: (el, onSelect) => {
              itemsRef.current[index] = { element: el, onSelect };
            },
          });
        }
        return child;
      })}
    </div>
  );
}

export function CommandEmpty({ className, ...props }) {
  return (
    <div
      className={cn(
        'py-6 text-center text-sm text-muted-foreground',
        className
      )}
      {...props}
    >
      No results found.
    </div>
  );
}

export function CommandGroup({ heading, className, children, ...props }) {
  return (
    <div
      className={cn('overflow-hidden p-1 text-foreground', className)}
      {...props}
    >
      {heading && (
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          {heading}
        </div>
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export function CommandItem({
  onSelect,
  className,
  children,
  index,
  isSelected,
  ...props
}) {
  return (
    <div
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
        isSelected
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-accent hover:text-accent-foreground',
        className
      )}
      onClick={onSelect}
      {...props}
    >
      {children}
    </div>
  );
}

export function CommandSeparator({ className, ...props }) {
  return <div className={cn('-mx-1 h-px bg-border', className)} {...props} />;
}

CommandInput.displayName = 'CommandInput';
CommandList.displayName = 'CommandList';
CommandEmpty.displayName = 'CommandEmpty';
CommandGroup.displayName = 'CommandGroup';
CommandItem.displayName = 'CommandItem';
CommandSeparator.displayName = 'CommandSeparator';
