import { useState, useEffect } from 'react';
import {
  BookOpen,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchWithCSRF } from '../../utils/csrf.utils.js';

/**
 * Knowledge Base Manager Component
 * Manages knowledge base entries for Full Workflows
 * Design: n8n/make.com style
 */
export default function KnowledgeBaseManager({ onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', text: '' });

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const response = await fetchWithCSRF('/api/knowledge-base');
      if (!response.ok) throw new Error('Failed to fetch entries');
      const data = await response.json();
      setEntries(data.data || []);
    } catch (error) {
      console.error('Error fetching knowledge base entries:', error);
      alert('Failed to load knowledge base entries');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.text.trim()) {
      alert('Name and text are required');
      return;
    }

    try {
      const response = await fetchWithCSRF('/api/knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          text: formData.text.trim(),
        }),
      });

      if (!response.ok) throw new Error('Failed to create entry');
      await fetchEntries();
      setFormData({ name: '', text: '' });
    } catch (error) {
      console.error('Error creating entry:', error);
      alert('Failed to create knowledge base entry');
    }
  };

  const handleUpdate = async id => {
    if (!formData.name.trim() || !formData.text.trim()) {
      alert('Name and text are required');
      return;
    }

    try {
      const response = await fetchWithCSRF(`/api/knowledge-base/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          text: formData.text.trim(),
        }),
      });

      if (!response.ok) throw new Error('Failed to update entry');
      await fetchEntries();
      setEditingId(null);
      setFormData({ name: '', text: '' });
    } catch (error) {
      console.error('Error updating entry:', error);
      alert('Failed to update knowledge base entry');
    }
  };

  const handleDelete = async id => {
    if (!confirm('Are you sure you want to delete this entry?')) return;

    try {
      const response = await fetchWithCSRF(`/api/knowledge-base/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete entry');
      await fetchEntries();
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete knowledge base entry');
    }
  };

  const startEdit = entry => {
    setEditingId(entry.id);
    setFormData({ name: entry.name, text: entry.text });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ name: '', text: '' });
  };

  return (
    <div
      className="custom-scrollbar h-full w-full overflow-y-auto border-l border-border/60 bg-card/95 text-foreground shadow-2xl shadow-black/40 backdrop-blur-xl"
      style={{
        background:
          'radial-gradient(circle at top right, rgba(168, 85, 247, 0.14), transparent 34%), radial-gradient(circle at top left, rgba(59, 130, 246, 0.12), transparent 30%), hsl(var(--card))',
      }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/60 bg-card/80 px-5 py-4 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-purple-500/30 bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 shadow-lg shadow-purple-500/10">
            <BookOpen className="h-5 w-5 text-purple-300" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-lg font-bold text-transparent">
              Knowledge Base
            </h2>
            <p className="text-xs text-muted-foreground">
              Reusable context for your workflows
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="shrink-0 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Close knowledge base"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="space-y-6 p-5">
        {/* Create/Edit Form */}
        <div className="rounded-2xl border border-border/60 bg-background/55 p-5 shadow-xl shadow-black/10 backdrop-blur-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/25 bg-blue-500/10">
              {editingId ? (
                <Pencil className="h-4 w-4 text-blue-300" />
              ) : (
                <Plus className="h-4 w-4 text-blue-300" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {editingId ? 'Edit Entry' : 'Create New Entry'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {editingId
                  ? 'Update the selected knowledge entry.'
                  : 'Add information your workflow can reuse.'}
              </p>
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Product Name"
              className="w-full rounded-xl border border-input bg-card/70 px-3.5 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-purple-500/70 focus:ring-2 focus:ring-purple-500/15"
            />
          </div>

          <div className="mb-5">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Text
            </label>
            <textarea
              value={formData.text}
              onChange={e => setFormData({ ...formData, text: e.target.value })}
              placeholder="Enter knowledge base text..."
              rows={6}
              className="min-h-36 w-full resize-y rounded-xl border border-input bg-card/70 px-3.5 py-3 text-sm leading-6 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-purple-500/70 focus:ring-2 focus:ring-purple-500/15"
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={editingId ? () => handleUpdate(editingId) : handleCreate}
              className="flex-1 gap-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/20 transition hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 hover:shadow-purple-500/30"
            >
              {editingId ? (
                <Save className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {editingId ? 'Update Entry' : 'Create Entry'}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="outline"
                onClick={cancelEdit}
                className="border-border/70 bg-card/60 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Entries List */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-300" />
              <h3 className="text-sm font-semibold text-foreground">Entries</h3>
            </div>
            <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-200">
              {entries.length}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/50 bg-background/40 px-4 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-purple-300" />
              Loading entries...
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-background/35 px-5 py-10 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10">
                <BookOpen className="h-5 w-5 text-purple-300" />
              </div>
              <p className="text-sm font-medium text-foreground">
                No entries yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create your first reusable knowledge entry above.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map(entry => (
                <div
                  key={entry.id}
                  className={`rounded-2xl border p-4 transition ${
                    editingId === entry.id
                      ? 'border-purple-500/60 bg-purple-500/10 shadow-lg shadow-purple-500/10'
                      : 'border-border/60 bg-background/45 hover:border-purple-500/35 hover:bg-background/60'
                  }`}
                >
                  <div className="mb-3 flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                      <FileText className="h-4 w-4 text-blue-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {entry.name}
                      </div>
                      <div className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                        {entry.text}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(entry)}
                      className="flex-1 gap-1.5 border-border/70 bg-card/50 text-muted-foreground hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-200"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(entry.id)}
                      className="flex-1 gap-1.5 border-red-500/25 bg-red-500/5 text-red-300 hover:border-red-500/50 hover:bg-red-500/15 hover:text-red-200"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
