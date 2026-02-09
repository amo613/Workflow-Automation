import { useState, useEffect, useRef } from 'react';
import { fetchWithCSRF } from '../../utils/csrf.utils.js';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X, Send, Loader2, Bot, Sparkles } from 'lucide-react';

const QUICK_PROMPTS = [
  { label: 'Workflow erklären', message: 'Erkläre mir bitte diesen Workflow: Ablauf, Zweck der Nodes und wo ich aufpassen muss.' },
  { label: 'Optimierung vorschlagen', message: 'Schlag konkrete Optimierungen für diesen Workflow vor (Performance, Fehlerbehandlung, Vereinfachung).' },
  { label: 'Sicherheit prüfen', message: 'Prüfe diesen Workflow auf Sicherheitsrisiken (Secrets, Trigger, externe Aufrufe).' },
  { label: 'Node erklären', message: 'Erkläre mir den ausgewählten Node (oder den Start-Node, falls keiner ausgewählt): was macht er und welche Konfiguration ist wichtig?' },
];

/**
 * Agent Chat panel: conversation with the workflow agent.
 * Improved layout, quick prompts, and empty state.
 */
export default function AgentChatPanel({ workflowId, workflowName, agentsEnabled = true, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    if (!workflowId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchWithCSRF(`/api/full-workflows/${workflowId}/agent/chat?limit=50`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (data.success && data.data?.messages) {
          setMessages(data.data.messages);
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.message || 'Verlauf konnte nicht geladen werden.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [workflowId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (text) => {
    const trimmed = String(text).trim();
    if (!trimmed || sending || !workflowId) return;

    setSending(true);
    setError(null);
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);

    try {
      const res = await fetchWithCSRF(`/api/full-workflows/${workflowId}/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Antwort konnte nicht geladen werden.');
      }

      if (data.success && data.data?.reply != null) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.data.reply }]);
      } else {
        throw new Error('Keine Antwort vom Agenten.');
      }
    } catch (err) {
      setError(err.message || 'Senden fehlgeschlagen');
      setMessages(prev => prev.slice(0, -1));
      setInput(trimmed);
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => sendMessage(input);

  const handleQuickPrompt = (message) => sendMessage(message);

  return (
    <div
      className="flex flex-col h-full bg-card border-l border-border shadow-lg"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'min(440px, 100%)',
        zIndex: 10,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-border bg-muted">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
            <Bot className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate">Agent Chat</h3>
            {workflowName && (
              <p className="text-xs text-muted-foreground truncate">{workflowName}</p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Schließen" className="shrink-0">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Verlauf wird geladen…
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col gap-4 py-2">
            <div className="rounded-xl bg-muted border border-border p-4 flex flex-col items-center text-center gap-2">
              <Sparkles className="w-8 h-8 text-primary/70" />
              <p className="text-sm font-medium text-foreground">Mit dem Workflow-Agenten chatten</p>
              <p className="text-xs text-muted-foreground max-w-[280px]">
                Stelle Fragen zum Workflow, lass dir Nodes erklären oder bitte um Optimierungs- und Sicherheitsvorschläge.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Schnellvorschläge</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map(({ label, message }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleQuickPrompt(message)}
                    disabled={sending || !agentsEnabled}
                    className="text-left text-xs px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors disabled:opacity-50 max-w-full"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-muted text-foreground rounded-bl-md border border-border'
              }`}
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md px-4 py-2.5 bg-muted border border-border">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {!agentsEnabled && (
        <div className="shrink-0 px-4 py-3 bg-amber-500/10 border-t border-border text-amber-800 dark:text-amber-200 text-sm">
          Agents sind deaktiviert. Aktiviere sie unter „Einstellungen & Goal“, um Nachrichten zu senden.
        </div>
      )}

      {error && (
        <div className="shrink-0 px-4 py-2 bg-destructive/10 text-destructive text-sm border-t border-border">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 p-4 pt-3 border-t border-border bg-background">
        <div className="flex gap-2 items-end">
          <Textarea
            placeholder={agentsEnabled ? 'Nachricht an den Agenten…' : 'Aktiviere Agents, um zu chatten'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={2}
            className="min-h-[52px] resize-none flex-1"
            disabled={sending || !agentsEnabled}
          />
          <Button
            onClick={handleSend}
            disabled={sending || !input.trim() || !agentsEnabled}
            size="icon"
            className="h-[52px] w-12 shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
