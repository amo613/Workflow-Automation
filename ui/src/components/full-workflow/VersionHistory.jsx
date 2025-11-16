import { useState, useEffect } from 'react';
import { workflowVersionService } from '../../services/workflowVersion.service.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { BookOpen, Clock, RefreshCw, Loader2, MessageSquare } from 'lucide-react';

export default function VersionHistory({ workflowId, onRestore }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (workflowId && isModalOpen) {
      fetchVersions();
    }
  }, [workflowId, isModalOpen]);

  const fetchVersions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await workflowVersionService.getVersions(workflowId);
      setVersions(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching versions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async version => {
    if (
      !window.confirm(
        `Restore workflow to version ${version.version_number}? This will replace the current workflow with this version.`
      )
    ) {
      return;
    }

    setRestoring(true);
    try {
      const restoredWorkflow = await workflowVersionService.restoreVersion(
        workflowId,
        version.id
      );
      if (onRestore && restoredWorkflow.workflow_json) {
        onRestore(restoredWorkflow.workflow_json);
      }
      await fetchVersions();
      toast.success(
        `Workflow restored to version ${version.version_number} successfully!`
      );
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      toast.error(`Failed to restore version: ${err.message}`);
      console.error('Error restoring version:', err);
    } finally {
      setRestoring(false);
    }
  };

  const formatDate = dateString => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      {/* Button in Sidebar */}
      <div style={{ marginBottom: '1rem' }}>
        <Button
          onClick={() => setIsModalOpen(true)}
          variant="outline"
          className="w-full justify-start gap-2"
          style={{
            background: 'hsl(var(--secondary))',
            borderColor: 'hsl(var(--border))',
            color: 'hsl(var(--foreground))',
          }}
        >
          <BookOpen className="w-4 h-4" />
          <span>Version History</span>
          {versions.length > 0 && (
            <Badge
              variant="secondary"
              className="ml-auto"
              style={{
                background: 'hsl(var(--muted))',
                color: 'hsl(var(--muted-foreground))',
              }}
            >
              {versions.length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{
                    background: 'hsl(var(--muted))',
                    border: '1px solid hsl(var(--border))',
                  }}
                >
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-2xl">Version History</DialogTitle>
                  <DialogDescription className="mt-1">
                    {versions.length} version{versions.length !== 1 ? 's' : ''}{' '}
                    saved
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6 py-4" style={{ maxHeight: 'calc(85vh - 120px)' }}>
            {loading && (
              <div className="text-center py-8 text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading versions...</span>
              </div>
            )}

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>Error: {error}</AlertDescription>
              </Alert>
            )}

            {!loading && !error && versions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No versions yet. Versions are automatically created when you save
                changes.
              </div>
            )}

            {!loading && !error && versions.length > 0 && (
              <div className="space-y-3">
                {versions.map((version, index) => {
                  const isLatest = index === 0;
                  const isSelected = selectedVersion?.id === version.id;

                  return (
                    <div
                      key={version.id}
                      className="rounded-lg border transition-all cursor-pointer"
                      style={{
                        background: isSelected
                          ? 'hsl(var(--accent))'
                          : isLatest
                            ? 'hsl(var(--muted))'
                            : 'hsl(var(--card))',
                        borderColor: isSelected
                          ? 'hsl(var(--primary))'
                          : isLatest
                            ? 'hsl(var(--primary) / 0.3)'
                            : 'hsl(var(--border))',
                        padding: '1rem',
                      }}
                      onClick={() => setSelectedVersion(version)}
                      onMouseEnter={e => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'hsl(var(--accent))';
                          e.currentTarget.style.borderColor = 'hsl(var(--border))';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) {
                          e.currentTarget.style.background = isLatest
                            ? 'hsl(var(--muted))'
                            : 'hsl(var(--card))';
                          e.currentTarget.style.borderColor = isLatest
                            ? 'hsl(var(--primary) / 0.3)'
                            : 'hsl(var(--border))';
                        }
                      }}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div
                            className="w-12 h-12 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0"
                            style={{
                              background: isLatest
                                ? 'hsl(var(--primary))'
                                : 'hsl(var(--secondary))',
                              color: isLatest
                                ? 'hsl(var(--primary-foreground))'
                                : 'hsl(var(--secondary-foreground))',
                            }}
                          >
                            v{version.version_number}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3
                                className="font-semibold text-sm"
                                style={{ color: 'hsl(var(--foreground))' }}
                              >
                                {version.name || `Version ${version.version_number}`}
                              </h3>
                              {isLatest && (
                                <Badge
                                  variant="default"
                                  className="text-xs"
                                  style={{
                                    background: 'hsl(var(--primary))',
                                    color: 'hsl(var(--primary-foreground))',
                                  }}
                                >
                                  Latest
                                </Badge>
                              )}
                            </div>
                            <div
                              className="text-xs flex items-center gap-2"
                              style={{ color: 'hsl(var(--muted-foreground))' }}
                            >
                              <Clock className="w-3 h-3" />
                              <span>{formatDate(version.created_at)}</span>
                            </div>
                            {version.description && (
                              <div
                                className="text-xs mt-2 pt-2 border-t"
                                style={{
                                  color: 'hsl(var(--muted-foreground))',
                                  borderColor: 'hsl(var(--border))',
                                }}
                              >
                                <MessageSquare className="w-3 h-3 mr-1" />
                                {version.description}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={e => {
                            e.stopPropagation();
                            handleRestore(version);
                          }}
                          disabled={restoring}
                          size="sm"
                          variant={isLatest ? 'default' : 'outline'}
                          className="shrink-0"
                        >
                          {restoring ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Restoring...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-3 h-3 mr-1" />
                              Restore
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
