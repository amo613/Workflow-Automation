import { useState } from 'react';
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

export default function ErrorDetailsModal({
  isOpen,
  onClose,
  errorLogEntry,
  nodeName,
}) {
  const [showStack, setShowStack] = useState(false);

  if (!isOpen || !errorLogEntry) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-destructive">Error Details</DialogTitle>
          <DialogDescription>
            Detailed information about the error that occurred
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            {nodeName && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Node</div>
                <div className="font-medium">{nodeName}</div>
              </div>
            )}

            <div>
              <div className="text-sm text-muted-foreground mb-2">
                Error Message
              </div>
              <Alert variant="destructive">
                <AlertDescription className="break-words">
                  {errorLogEntry.error || 'Unknown error'}
                </AlertDescription>
              </Alert>
            </div>

            {errorLogEntry.errorType && (
              <div>
                <div className="text-sm text-muted-foreground mb-2">
                  Error Type
                </div>
                <Badge
                  variant={
                    errorLogEntry.errorType === 'transient'
                      ? 'default'
                      : errorLogEntry.errorType === 'user'
                        ? 'destructive'
                        : 'secondary'
                  }
                >
                  {errorLogEntry.errorType}
                </Badge>
              </div>
            )}

            {errorLogEntry.retryAttempts !== undefined &&
              errorLogEntry.retryAttempts > 0 && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Retry Attempts
                  </div>
                  <div className="text-sm">
                    {errorLogEntry.retryAttempts} attempt(s) made
                  </div>
                </div>
              )}

            {errorLogEntry.timestamp && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  Timestamp
                </div>
                <div className="text-sm">
                  {new Date(errorLogEntry.timestamp).toLocaleString()}
                </div>
              </div>
            )}

            {errorLogEntry.errorStack && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowStack(!showStack)}
                  className="mb-2"
                >
                  {showStack ? 'Hide' : 'Show'} Stack Trace
                </Button>
                {showStack && (
                  <ScrollArea className="h-[200px] rounded-md border p-4 bg-muted">
                    <pre className="text-xs whitespace-pre-wrap break-words">
                      {errorLogEntry.errorStack}
                    </pre>
                  </ScrollArea>
                )}
              </div>
            )}

            {errorLogEntry.errorContext && (
              <div>
                <div className="text-sm text-muted-foreground mb-2">
                  Error Context
                </div>
                <ScrollArea className="h-[200px] rounded-md border p-4 bg-muted">
                  <pre className="text-xs whitespace-pre-wrap break-words">
                    {JSON.stringify(errorLogEntry.errorContext, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
