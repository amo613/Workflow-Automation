import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { cn } from '@/lib/index';
import {
  Save,
  Play,
  Download,
  Upload,
  Settings,
  Database,
  BarChart3,
  History,
  BookOpen,
  Plus,
  Trash2,
  Edit,
} from 'lucide-react';

/**
 * Command Palette Component
 * Global command menu accessible via Cmd/Ctrl+K
 */
export function CommandPalette({ open, onOpenChange, onAction }) {
  const [search, setSearch] = React.useState('');

  const commands = React.useMemo(
    () => [
      {
        group: 'Actions',
        items: [
          {
            id: 'save',
            label: 'Save Workflow',
            icon: Save,
            shortcut: '⌘S',
            action: () => onAction?.('save'),
          },
          {
            id: 'execute',
            label: 'Execute Workflow',
            icon: Play,
            shortcut: '⌘E',
            action: () => onAction?.('execute'),
          },
          {
            id: 'export',
            label: 'Export Workflow',
            icon: Download,
            shortcut: '⌘⇧E',
            action: () => onAction?.('export'),
          },
          {
            id: 'import',
            label: 'Import Workflow',
            icon: Upload,
            shortcut: '⌘⇧I',
            action: () => onAction?.('import'),
          },
        ],
      },
      {
        group: 'Navigation',
        items: [
          {
            id: 'settings',
            label: 'Settings',
            icon: Settings,
            shortcut: '⌘,',
            action: () => onAction?.('settings'),
          },
          {
            id: 'knowledge-base',
            label: 'Knowledge Base',
            icon: Database,
            shortcut: '⌘K',
            action: () => onAction?.('knowledge-base'),
          },
          {
            id: 'statistics',
            label: 'Statistics',
            icon: BarChart3,
            shortcut: '⌘⇧S',
            action: () => onAction?.('statistics'),
          },
          {
            id: 'history',
            label: 'Version History',
            icon: History,
            shortcut: '⌘H',
            action: () => onAction?.('history'),
          },
          {
            id: 'docs',
            label: 'Documentation',
            icon: BookOpen,
            shortcut: '⌘⇧D',
            action: () => onAction?.('docs'),
          },
        ],
      },
      {
        group: 'Node Actions',
        items: [
          {
            id: 'add-node',
            label: 'Add Node',
            icon: Plus,
            shortcut: '⌘N',
            action: () => onAction?.('add-node'),
          },
          {
            id: 'edit-node',
            label: 'Edit Selected Node',
            icon: Edit,
            shortcut: '⌘E',
            action: () => onAction?.('edit-node'),
          },
          {
            id: 'delete-node',
            label: 'Delete Selected Node',
            icon: Trash2,
            shortcut: '⌫',
            action: () => onAction?.('delete-node'),
          },
        ],
      },
    ],
    [onAction]
  );

  const filteredCommands = React.useMemo(() => {
    if (!search) return commands;

    const lowerSearch = search.toLowerCase();
    return commands
      .map(group => ({
        ...group,
        items: group.items.filter(
          item =>
            item.label.toLowerCase().includes(lowerSearch) ||
            item.id.toLowerCase().includes(lowerSearch)
        ),
      }))
      .filter(group => group.items.length > 0);
  }, [search, commands]);

  const handleSelect = React.useCallback(
    action => {
      action?.();
      onOpenChange(false);
      setSearch('');
    },
    [onOpenChange]
  );

  React.useEffect(() => {
    const handleKeyDown = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
        setSearch('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 command-palette-animated">
        <DialogHeader className="sr-only">
          <DialogTitle>Command Palette</DialogTitle>
          <DialogDescription>
            Search and execute commands quickly
          </DialogDescription>
        </DialogHeader>
        <Command>
          <CommandInput
            placeholder="Type a command or search..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {filteredCommands.map((group, groupIndex) => (
              <React.Fragment key={group.group}>
                <CommandGroup heading={group.group}>
                  {group.items.map(item => {
                    const Icon = item.icon;
                    return (
                      <CommandItem
                        key={item.id}
                        onSelect={() => handleSelect(item.action)}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        <span>{item.label}</span>
                        {item.shortcut && (
                          <span className="ml-auto text-xs text-muted-foreground">
                            {item.shortcut}
                          </span>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                {groupIndex < filteredCommands.length - 1 && (
                  <CommandSeparator />
                )}
              </React.Fragment>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

