import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/index';

/**
 * Accordion Component
 * Collapsible content sections with smooth animations
 * Performance optimized with CSS animations
 */
const AccordionContext = React.createContext({
  value: null,
  onValueChange: () => {},
  type: 'single',
});

export function Accordion({
  type = 'single',
  defaultValue,
  value: controlledValue,
  onValueChange,
  className,
  children,
  ...props
}) {
  const [internalValue, setInternalValue] = React.useState(
    defaultValue || null
  );
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const handleValueChange = React.useCallback(
    newValue => {
      if (type === 'single') {
        const nextValue = value === newValue ? null : newValue;
        if (controlledValue === undefined) {
          setInternalValue(nextValue);
        }
        onValueChange?.(nextValue);
      } else {
        // Multiple mode
        const currentValues = Array.isArray(value) ? value : [];
        const nextValues = currentValues.includes(newValue)
          ? currentValues.filter(v => v !== newValue)
          : [...currentValues, newValue];
        if (controlledValue === undefined) {
          setInternalValue(nextValues);
        }
        onValueChange?.(nextValues);
      }
    },
    [value, type, controlledValue, onValueChange]
  );

  return (
    <AccordionContext.Provider
      value={{
        value,
        onValueChange: handleValueChange,
        type,
      }}
    >
      <div className={cn('space-y-1', className)} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

const AccordionItemContext = React.createContext(null);

export function AccordionItem({ value, className, children, ...props }) {
  const { value: contextValue, type } = React.useContext(AccordionContext);
  const isOpen =
    type === 'single'
      ? contextValue === value
      : Array.isArray(contextValue) && contextValue.includes(value);

  return (
    <AccordionItemContext.Provider value={value}>
      <div
        className={cn('border-b border-border', className)}
        data-state={isOpen ? 'open' : 'closed'}
        {...props}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

export function AccordionTrigger({ className, children, ...props }) {
  const {
    value: contextValue,
    onValueChange,
    type,
  } = React.useContext(AccordionContext);
  const itemValue = React.useContext(AccordionItemContext);
  const isOpen =
    type === 'single'
      ? contextValue === itemValue
      : Array.isArray(contextValue) && contextValue.includes(itemValue);

  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180',
        className
      )}
      onClick={() => onValueChange(itemValue)}
      data-state={isOpen ? 'open' : 'closed'}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
    </button>
  );
}

export function AccordionContent({ className, children, ...props }) {
  const { value: contextValue, type } = React.useContext(AccordionContext);
  const itemValue = React.useContext(AccordionItemContext);
  const isOpen =
    type === 'single'
      ? contextValue === itemValue
      : Array.isArray(contextValue) && contextValue.includes(itemValue);

  return (
    <div
      className={cn(
        'overflow-hidden text-sm transition-all',
        'accordion-content',
        className
      )}
      data-state={isOpen ? 'open' : 'closed'}
      {...props}
    >
      <div className="pb-4 pt-0">{children}</div>
    </div>
  );
}

AccordionItem.displayName = 'AccordionItem';
AccordionTrigger.displayName = 'AccordionTrigger';
AccordionContent.displayName = 'AccordionContent';
