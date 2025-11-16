import VariableAutocomplete from '../VariableAutocomplete.jsx';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * FormField Component
 * Reusable form field component with variable support
 */
export default function FormField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  options = [],
  multiline = false,
  availableVariables = [],
  onDrop,
  onDragOver,
  className = '',
}) {
  if (type === 'select') {
    return (
      <div className={`space-y-2 ${className}`} data-field-name={name}>
        <Label>{label}</Label>
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options
              .filter(opt => opt.value !== '' && opt.value != null)
              .map(opt => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (availableVariables.length > 0 || multiline) {
    return (
      <div className={`space-y-2 ${className}`} data-field-name={name}>
        <Label>{label}</Label>
        <VariableAutocomplete
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          availableVariables={availableVariables}
          placeholder={placeholder}
          multiline={multiline}
          onDrop={onDrop}
          onDragOver={onDragOver}
        />
      </div>
    );
  }

  if (multiline) {
    return (
      <div className={`space-y-2 ${className}`} data-field-name={name}>
        <Label>{label}</Label>
        <Textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          onDrop={onDrop}
          onDragOver={onDragOver}
        />
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`} data-field-name={name}>
      <Label>{label}</Label>
      <Input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onDrop={onDrop}
        onDragOver={onDragOver}
      />
    </div>
  );
}
