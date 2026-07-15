import { useState, useEffect } from 'react';
import {
  Save,
  Download,
  Upload,
  Database,
  Play,
  Pencil,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

/**
 * Floating toolbar on the canvas: workflow name (editable), Full Workflow / Call Flow pills,
 * Save, Import, Export, Knowledge Base (full only), Execute (full only).
 * Glass style: bg-card/80 backdrop-blur-md border rounded-2xl.
 */
export default function FloatingCanvasToolbar({
  workflowName,
  onWorkflowNameChange,
  activeTab = 'full',
  onSwitchTab,
  onSave,
  onImport,
  onExport,
  onKnowledgeBase,
  onExecute,
  onOpenAgentsSettings,
  isFullWorkflow = true,
  saving = false,
  exporting = false,
  executing = false,
  lastSaved,
  showKnowledgeBase = false,
  agentsEnabled = false,
  isNew = false,
}) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState(workflowName ?? '');

  useEffect(() => {
    if (!isEditingName) setLocalName(workflowName ?? '');
  }, [workflowName, isEditingName]);

  const handleNameBlur = () => {
    setIsEditingName(false);
    if (onWorkflowNameChange && localName.trim() !== (workflowName ?? '')) {
      onWorkflowNameChange(localName.trim() || workflowName);
    }
  };

  const handleNameKeyDown = e => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  return (
    <div
      className="absolute top-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-5 px-5 py-3.5 rounded-2xl border bg-card/80 dark:bg-card/80 backdrop-blur-md shadow-lg"
      style={{
        borderColor: 'hsl(var(--border))',
      }}
    >
      {/* Workflow name (editable) */}
      <div className="flex items-center gap-2 min-w-0 max-w-[220px]">
        {isEditingName ? (
          <input
            type="text"
            value={localName}
            onChange={e => setLocalName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            autoFocus
            className="flex-1 min-w-0 px-2 py-1 text-sm font-medium bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Workflow Name"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setLocalName(workflowName ?? '');
              setIsEditingName(true);
            }}
            className="flex items-center gap-1.5 min-w-0 group text-left"
          >
            <span className="truncate text-base font-medium text-foreground">
              {workflowName?.trim() || 'Untitled Workflow'}
            </span>
            <Pencil className="w-3.5 h-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
        {lastSaved != null && (
          <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
            {lastSaved}
          </span>
        )}
      </div>

      {/* Divider */}
      <div
        className="h-6 w-px shrink-0"
        style={{ background: 'hsl(var(--border))' }}
      />

      {/* Pills: Full Workflow / Call Flow */}
      {onSwitchTab && (
        <>
          <div
            className="inline-flex rounded-full border overflow-hidden shrink-0"
            style={{ borderColor: 'hsl(var(--border))' }}
            role="tablist"
            aria-label="Workflow canvas selector"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'full'}
              onClick={() => activeTab !== 'full' && onSwitchTab('full')}
              className="px-5 py-2 text-sm font-medium transition-colors"
              style={{
                background:
                  activeTab === 'full' ? 'hsl(var(--primary))' : 'transparent',
                color:
                  activeTab === 'full'
                    ? 'hsl(var(--primary-foreground))'
                    : 'hsl(var(--muted-foreground))',
                cursor: activeTab === 'full' ? 'default' : 'pointer',
              }}
            >
              Full Workflow
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'call'}
              onClick={() => activeTab !== 'call' && onSwitchTab('call')}
              className="px-5 py-2 text-sm font-medium transition-colors"
              style={{
                background:
                  activeTab === 'call' ? 'hsl(var(--primary))' : 'transparent',
                color:
                  activeTab === 'call'
                    ? 'hsl(var(--primary-foreground))'
                    : 'hsl(var(--muted-foreground))',
                cursor: activeTab === 'call' ? 'default' : 'pointer',
              }}
            >
              Call Flow
            </button>
          </div>

          {/* Divider */}
          <div
            className="h-6 w-px shrink-0"
            style={{ background: 'hsl(var(--border))' }}
          />
        </>
      )}

      {/* Actions – Agents/Goal only in right sidebar, not in toolbar */}
      <div className="flex items-center gap-2 shrink-0">
        {isFullWorkflow && onKnowledgeBase && (
          <Button
            variant={showKnowledgeBase ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5"
            onClick={onKnowledgeBase}
            title="Knowledge Base"
          >
            <Database className="w-4 h-4" />
            KB
          </Button>
        )}
        {!isNew && onExport && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onExport}
            disabled={exporting || saving}
            title="Export"
          >
            {exporting ? (
              <Spinner variant="dots" size="sm" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Export
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={onImport}
          disabled={saving}
          title="Import"
        >
          <Upload className="w-4 h-4" />
          Import
        </Button>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={onSave}
          disabled={saving}
          title="Save"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save
        </Button>
        {isFullWorkflow && !isNew && onExecute && (
          <Button
            size="sm"
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={onExecute}
            disabled={executing || saving}
            title="Execute"
          >
            {executing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Execute
          </Button>
        )}
      </div>
    </div>
  );
}
