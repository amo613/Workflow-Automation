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
import {
  MessageCircle,
  Bot,
  Shield,
  Zap,
  BarChart3,
  Play,
  Info,
} from 'lucide-react';

const AGENT_TYPES = [
  {
    id: 'monitoring',
    name: 'Monitoring',
    icon: BarChart3,
    description:
      'Analysiert Ausführungsstatistiken und Fehler, schlägt Verbesserungen vor.',
  },
  {
    id: 'optimization',
    name: 'Optimization',
    icon: Zap,
    description:
      'Prüft Workflow und Goal, schlägt oder wendet Optimierungen an (Nodes, Ablauf).',
  },
  {
    id: 'security',
    name: 'Security',
    icon: Shield,
    description:
      'Prüft Struktur, Trigger und externe Aufrufe auf Sicherheitsrisiken.',
  },
  {
    id: 'execution',
    name: 'Execution',
    icon: Play,
    description:
      'Prüft, ob der Workflow ausführbar ist (fehlende Konfiguration, ungültige Verbindungen).',
  },
];

/**
 * Workflow / Agent settings: enable agents, goal definition, link to chat.
 * Redesigned with clear info and better UX.
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
      setGoalSummary(
        typeof initialGoalDefinition === 'string' ? initialGoalDefinition : ''
      );
      setGoalConstraints('');
      setGoalSuccessCriteria('');
    }
    setError(null);
  }, [open, initialAgentsEnabled, initialGoalDefinition]);

  const buildGoalDefinition = () => {
    if (
      !goalSummary.trim() &&
      !goalConstraints.trim() &&
      !goalSuccessCriteria.trim()
    ) {
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Bot className="w-5 h-5 text-primary" />
            Workflow-Agents & Goal
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Agents analysieren und optimieren deinen Workflow automatisch.
            Definiere ein Goal, damit sie gezielt vorgehen können. Du kannst
            jederzeit mit dem Agenten chatten (Fragen, Erklärungen,
            Optimierungen).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Enable toggle */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="agents-enabled"
                className="text-base font-semibold"
              >
                Agents aktivieren
              </Label>
              <Switch
                id="agents-enabled"
                checked={agentsEnabled}
                onCheckedChange={setAgentsEnabled}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Wenn aktiv, laufen nach dem Speichern des Workflows Monitoring-,
              Optimierungs-, Security- und Execution-Checks. Alle Aktionen
              werden dokumentiert (Explainable AI).
            </p>
          </div>

          {/* Agent types info */}
          <div className="rounded-xl border bg-muted p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Info className="w-4 h-4" />
              Was die Agents tun
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {AGENT_TYPES.map(({ id, name, icon: Icon, description }) => (
                <li
                  key={id}
                  className="flex gap-2 rounded-lg border bg-background p-3 text-sm"
                >
                  <Icon className="w-4 h-4 shrink-0 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="font-medium text-foreground">{name}</span>
                    <p className="text-muted-foreground mt-0.5">
                      {description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Goal definition */}
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <Label className="text-base font-semibold">Goal Definition</Label>
            <p className="text-sm text-muted-foreground">
              Je klarer das Ziel beschrieben ist, desto gezielter können die
              Agents optimieren und antworten.
            </p>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">
                  Zusammenfassung / Ziel
                </Label>
                <Textarea
                  placeholder="z. B. E-Mail-Benachrichtigungen bei neuen HubSpot-Deals, max. 3 Schritte"
                  value={goalSummary}
                  onChange={e => setGoalSummary(e.target.value)}
                  className="mt-1 min-h-[72px] resize-none"
                  rows={3}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Einschränkungen (eine pro Zeile)
                </Label>
                <Textarea
                  placeholder="z. B. Nur interne APIs\nMax. 5 Nodes"
                  value={goalConstraints}
                  onChange={e => setGoalConstraints(e.target.value)}
                  className="mt-1 min-h-[56px] resize-none"
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Erfolgskriterien
                </Label>
                <Textarea
                  placeholder="z. B. E-Mail wird innerhalb von 1 Min. nach Deal-Erstellung versendet"
                  value={goalSuccessCriteria}
                  onChange={e => setGoalSuccessCriteria(e.target.value)}
                  className="mt-1 min-h-[56px] resize-none"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Chat CTA */}
          {onOpenAgentChat && (
            <div className="rounded-xl border-2 border-primary/30 bg-primary/10 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <MessageCircle className="w-10 h-10 shrink-0 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">
                  Mit dem Agenten chatten
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Stelle Fragen zum Workflow, lass Nodes erklären oder bitte um
                  Optimierungsvorschläge. Der Agent kennt dein Goal und die
                  Workflow-Struktur.
                </p>
              </div>
              <Button
                onClick={handleOpenChat}
                className="shrink-0 gap-2"
                size="lg"
              >
                <MessageCircle className="w-4 h-4" />
                Chat öffnen
              </Button>
            </div>
          )}

          {error && (
            <p className="text-destructive text-sm font-medium">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
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
