import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle } from 'lucide-react';

/**
 * Workflow / Agent settings panel: enable agents, goal definition, link to agent chat.
 */
export default function WorkflowSettingsPanel({
  open,
  onClose,
  workflowId,
  agentsEnabled: initialAgentsEnabled,
  goalDefinition: initialGoalDefinition,
  onSaveSettings,
  onOpenAgentChat,
}) {
  const [agentsEnabled, setAgentsEnabled] = useState(!!initialAgentsEnabled);
  const [goalSummary, setGoalSummary] = useState('');
  const [goalConstraints, setGoalConstraints] = useState('');
  const [goalSuccessCriteria, setGoalSuccessCriteria] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setAgentsEnabled(!!initialAgentsEnabled);
    if (initialGoalDefinition && typeof initialGoalDefinition === 'object') {
      setGoalSummary(initialGoalDefinition.summary ?? '');
      setGoalConstraints(
        typeof initialGoalDefinition.constraints === 'string'
          ? initialGoalDefinition.constraints
          : Array.isArray(initialGoalDefinition.constraints)
            ? initialGoalDefinition.constraints.join('\n')
            : ''
      );
      setGoalSuccessCriteria(initialGoalDefinition.success_criteria ?? '');
    } else {
      setGoalSummary(typeof initialGoalDefinition === 'string' ? initialGoalDefinition : '');
      setGoalConstraints('');
      setGoalSuccessCriteria('');
    }
    setError(null);
  }, [open, initialAgentsEnabled, initialGoalDefinition]);

  const buildGoalDefinition = () => {
    if (!goalSummary.trim() && !goalConstraints.trim() && !goalSuccessCriteria.trim()) {
      return null;
    }
    const constraints = goalConstraints.trim()
      ? goalConstraints.trim().split(/\n/).filter(Boolean)
      : undefined;
    return {
      summary: goalSummary.trim() || undefined,
      constraints: constraints?.length ? constraints : undefined,
      success_criteria: goalSuccessCriteria.trim() || undefined,
    };
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      await onSaveSettings(agentsEnabled, buildGoalDefinition());
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChat = () => {
    onClose();
    onOpenAgentChat?.();
  };

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Workflow-Einstellungen</DialogTitle>
          <DialogDescription>
            Agents und Goal Definition für diesen Workflow. Aktivierte Agents analysieren und
            optimieren den Workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="agents-enabled" className="flex-1">
              Agents aktivieren
            </Label>
            <Switch
              id="agents-enabled"
              checked={agentsEnabled}
              onCheckedChange={setAgentsEnabled}
            />
          </div>
          <p className="text-muted-foreground text-sm">
            Wenn aktiviert, laufen Monitoring-, Optimierungs-, Security- und Execution-Agents
            (z. B. nach dem Speichern).
          </p>

          <div className="space-y-2">
            <Label>Goal Definition</Label>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Zusammenfassung / Ziel</Label>
                <Textarea
                  placeholder="Kurze Beschreibung des Workflow-Ziels"
                  value={goalSummary}
                  onChange={e => setGoalSummary(e.target.value)}
                  className="mt-1 min-h-[60px]"
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Einschränkungen (eine pro Zeile)</Label>
                <Textarea
                  placeholder="z. B. Nur interne APIs, max. 5 Nodes"
                  value={goalConstraints}
                  onChange={e => setGoalConstraints(e.target.value)}
                  className="mt-1 min-h-[50px]"
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Erfolgskriterien</Label>
                <Textarea
                  placeholder="Wann gilt der Workflow als erfolgreich?"
                  value={goalSuccessCriteria}
                  onChange={e => setGoalSuccessCriteria(e.target.value)}
                  className="mt-1 min-h-[50px]"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {onOpenAgentChat && (
            <div className="flex items-center gap-2 rounded-lg border p-3">
              <MessageCircle className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Mit Agent chatten</p>
                <p className="text-xs text-muted-foreground">
                  Fragen stellen, Optimierungen anfragen, Nodes erklären lassen
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleOpenChat}>
                Chat öffnen
              </Button>
            </div>
          )}

          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Speichern…' : 'Einstellungen speichern'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
