import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchWithCSRF } from '../utils/csrf.utils.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import PageContainer from '@/components/layout/PageContainer';
import { toast } from 'sonner';

function WorkflowList() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const response = await fetchWithCSRF('/api/workflows');

      if (!response.ok) {
        throw new Error('Failed to fetch workflows');
      }

      const data = await response.json();
      setWorkflows(data.data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching workflows:', err);
      toast.error('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id, e) => {
    e.stopPropagation();
    setWorkflowToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!workflowToDelete) return;

    try {
      const response = await fetchWithCSRF(`/api/workflows/${workflowToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete workflow');
      }

      toast.success('Workflow deleted successfully');
      fetchWorkflows();
    } catch (err) {
      toast.error('Failed to delete workflow: ' + err.message);
      console.error('Error deleting workflow:', err);
    } finally {
      setDeleteDialogOpen(false);
      setWorkflowToDelete(null);
    }
  };

  const handleToggleActive = async (workflow, e) => {
    e.stopPropagation();
    try {
      const response = await fetchWithCSRF(`/api/workflows/${workflow.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_active: !workflow.is_active,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update workflow');
      }

      toast.success(`Workflow ${!workflow.is_active ? 'activated' : 'deactivated'}`);
      fetchWorkflows();
    } catch (err) {
      toast.error('Failed to update workflow: ' + err.message);
      console.error('Error updating workflow:', err);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-96">
          <div className="text-lg text-muted-foreground">Loading workflows...</div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Call Flows</h1>
            <p className="text-muted-foreground mt-1">
              Manage your conversational call workflows
            </p>
          </div>
          <Button onClick={() => navigate('/workflows/new')}>
            Create Call Flow
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Call Flows</CardTitle>
            <CardDescription>
              {workflows.length} workflow{workflows.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="text-destructive text-center py-8">{error}</div>
            ) : workflows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg mb-2">No workflows found</p>
                <Button
                  variant="outline"
                  onClick={() => navigate('/workflows/new')}
                  className="mt-4"
                >
                  Create your first call flow
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workflows.map(workflow => (
                    <TableRow
                      key={workflow.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/workflows/edit/${workflow.id}`)}
                    >
                      <TableCell className="font-medium">
                        {workflow.name || 'Unnamed Workflow'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={workflow.is_active ? 'default' : 'secondary'}>
                          {workflow.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {workflow.created_at
                          ? new Date(workflow.created_at).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={e => handleToggleActive(workflow, e)}
                          >
                            {workflow.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={e => handleDeleteClick(workflow.id, e)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the workflow.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

export default WorkflowList;
