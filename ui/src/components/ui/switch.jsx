import * as React from 'react';
import { cn } from '@/lib/index';

/**
 * Switch/Toggle Component
 * Animated toggle switch with smooth transitions
 * Performance optimized with CSS animations
 */
const SwitchContext = React.createContext({
  checked: false,
  onCheckedChange: () => {},
  disabled: false,
});

export function Switch({
  checked: controlledChecked,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  animated = true,
  className,
  ...props
}) {
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked);
  const checked =
    controlledChecked !== undefined ? controlledChecked : internalChecked;

  const handleToggle = React.useCallback(() => {
    if (disabled) return;
    const newChecked = !checked;
    if (controlledChecked === undefined) {
      setInternalChecked(newChecked);
    }
    onCheckedChange?.(newChecked);
  }, [checked, disabled, controlledChecked, onCheckedChange]);

  return (
    <SwitchContext.Provider
      value={{
        checked,
        onCheckedChange: handleToggle,
        disabled,
      }}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled}
        data-state={checked ? 'checked' : 'unchecked'}
        className={cn(
          'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-primary' : 'bg-input',
          animated && 'switch-toggle',
          className
        )}
        onClick={handleToggle}
        disabled={disabled}
        {...props}
      >
        <span
          className={cn(
            'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0',
            animated && 'switch-toggle-thumb switch-toggle-thumb-animated'
          )}
          data-state={checked ? 'checked' : 'unchecked'}
        />
      </button>
    </SwitchContext.Provider>
  );
}

export function SwitchLabel({ className, children, ...props }) {
  const { checked, disabled } = React.useContext(SwitchContext);

  return (
    <label
      className={cn(
        'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className
      )}
      data-state={checked ? 'checked' : 'unchecked'}
      {...props}
    >
      {children}
    </label>
  );
}

Switch.displayName = 'Switch';
SwitchLabel.displayName = 'SwitchLabel';
