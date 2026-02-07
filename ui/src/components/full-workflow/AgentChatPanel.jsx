import { useState, useEffect, useRef } from 'react';
import { fetchWithCSRF } from '../../utils/csrf.utils.js';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X, Send, Loader2 } from 'lucide-react';

/**
 * Agent Chat panel: conversation with the workflow agent.
 */
export default function AgentChatPanel({ workflowId, onClose }) {
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
        if (!cancelled) setError(err.message || 'Failed to load chat history');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [workflowId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !workflowId) return;

    setSending(true);
    setError(null);
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);

    try {
      const res = await fetchWithCSRF(`/api/full-workflows/${workflowId}/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to get reply');
      }

      if (data.success && data.data?.reply != null) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.data.reply }]);
      } else {
        throw new Error('No reply from agent');
      }
    } catch (err) {
      setError(err.message || 'Send failed');
      setMessages(prev => prev.slice(0, -1));
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: '420px',
        maxWidth: '100%',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        background: 'hsl(var(--card))',
        borderLeft: '1px solid hsl(var(--border))',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid hsl(var(--border))',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Agent Chat</h3>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'hsl(var(--muted-foreground))' }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading history…
          </div>
        )}
        {!loading && messages.length === 0 && (
          <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>
            Ask the agent about this workflow: explain nodes, request optimizations, or ask questions.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '90%',
              padding: '10px 14px',
              borderRadius: '12px',
              background: m.role === 'user' ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
              color: m.role === 'user' ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
              fontSize: '0.875rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {m.content}
          </div>
        ))}
        {sending && (
          <div style={{ alignSelf: 'flex-start', padding: '8px', color: 'hsl(var(--muted-foreground))' }}>
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div style={{ padding: '8px 16px', background: 'hsl(var(--destructive)/0.1)', color: 'hsl(var(--destructive))', fontSize: '0.8125rem' }}>
          {error}
        </div>
      )}

      <div style={{ padding: '12px 16px', borderTop: '1px solid hsl(var(--border))' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <Textarea
            placeholder="Message to agent…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={2}
            className="min-h-[60px] resize-none"
            disabled={sending}
          />
          <Button onClick={handleSend} disabled={sending || !input.trim()} size="icon" className="h-10 w-10 shrink-0">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
