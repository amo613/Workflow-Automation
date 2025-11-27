import { useState } from 'react';
import { workflowExportImportService } from '../../services/workflowExportImport.service.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

export default function WorkflowImportModal({
  isOpen,
  onClose,
  onImportSuccess,
}) {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [workflowName, setWorkflowName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  const handleFileSelect = e => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.json')) {
      setError('Please select a valid JSON file');
      return;
    }

    setFile(selectedFile);
    setFileName(selectedFile.name);
    setError(null);

    // Read and preview file
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const json = JSON.parse(event.target.result);
        setPreview(json);
        // Pre-fill workflow name if available
        if (json.workflow?.name) {
          setWorkflowName(json.workflow.name);
        }
      } catch (err) {
        setError('Invalid JSON file: ' + err.message);
        setPreview(null);
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (!file || !preview) {
      setError('Please select a valid workflow file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const importedWorkflow = await workflowExportImportService.importWorkflow(
        preview,
        workflowName || null
      );

      toast.success('Workflow imported successfully');

      // Reset form
      setFile(null);
      setFileName('');
      setWorkflowName('');
      setPreview(null);

      // Call success callback
      if (onImportSuccess) {
        onImportSuccess(importedWorkflow);
      }

      // Close modal
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to import workflow');
      toast.error('Failed to import workflow: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setFileName('');
    setWorkflowName('');
    setPreview(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Import Workflow</DialogTitle>
          <DialogDescription>
            Upload a JSON file to import a workflow
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="file">Workflow File (JSON)</Label>
            <Input
              id="file"
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              disabled={loading}
            />
            {fileName && (
              <div className="text-sm text-muted-foreground">
                Selected: {fileName}
              </div>
            )}
          </div>

          {preview && (
            <>
              <div className="space-y-2">
                <Label htmlFor="workflowName">Workflow Name (Optional)</Label>
                <Input
                  id="workflowName"
                  value={workflowName}
                  onChange={e => setWorkflowName(e.target.value)}
                  placeholder="Enter a name for the imported workflow"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label>Preview</Label>
                <ScrollArea className="h-[200px] rounded-md border p-4 bg-muted">
                  <pre className="text-xs whitespace-pre-wrap break-words">
                    {JSON.stringify(preview, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={handleClose} 
              animated
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleImport} 
              animated
              loading={loading}
              disabled={!file || loading}
            >
              Import Workflow
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
