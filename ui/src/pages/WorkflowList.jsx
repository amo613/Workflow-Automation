import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchWithCSRF } from '../utils/csrf.utils.js';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import PageContainer from '@/components/layout/PageContainer';
import WorkflowCanvasTabs from '../components/workflow/WorkflowCanvasTabs.jsx';
import { toast } from 'sonner';
import { Phone, Plus, CheckCircle, XCircle, Trash2, Power } from 'lucide-react';

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
      const response = await fetchWithCSRF(
        `/api/workflows/${workflowToDelete}`,
        {
          method: 'DELETE',
        }
      );

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

      toast.success(
        `Workflow ${!workflow.is_active ? 'activated' : 'deactivated'}`
      );
      fetchWorkflows();
    } catch (err) {
      toast.error('Failed to update workflow: ' + err.message);
      console.error('Error updating workflow:', err);
    }
  };

  const listContent = loading ? (
    <div className="flex items-center justify-center h-96">
      <div className="text-lg text-muted-foreground">Loading workflows...</div>
    </div>
  ) : (
    <>
      <div className="space-y-6 py-4">
        {/* Header Section with Icons */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <div className="flex items-center gap-4 mb-5">
              <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-blue-500/30">
                <Phone className="w-8 h-8 text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                Call Flows
              </h1>
            </div>
            <p className="text-muted-foreground ml-16 text-lg">
              Manage your conversational call workflows
            </p>
          </div>
          <Button
            onClick={() => navigate('/workflows/new')}
            className="gap-2.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all hover:scale-105 text-base px-6 py-3"
          >
            <Plus className="w-5 h-5" />
            Create Call Flow
          </Button>
        </div>

        {/* Glassmorphism Card */}
        <Card className="glass border-border/50 hover:border-blue-500/30 transition-all hover:shadow-lg hover:shadow-blue-500/10">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-blue-400" />
              All Call Flows
            </CardTitle>
            <CardDescription>
              {workflows.length} workflow{workflows.length !== 1 ? 's' : ''}{' '}
              found
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {error ? (
              <div className="text-destructive text-center py-8">{error}</div>
            ) : workflows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-blue-500/30">
                    <Phone className="w-12 h-12 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-lg mb-2 font-semibold">
                      No call flows found
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Get started by creating your first call flow
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/workflows/new')}
                    className="gap-2 hover:scale-105 transition-transform"
                  >
                    <Plus className="w-4 h-4" />
                    Create your first call flow
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-4 px-8 py-5 text-base font-semibold text-muted-foreground border-b border-border/30">
                  <div className="col-span-4 flex items-center">Name</div>
                  <div className="col-span-2 flex items-center">Status</div>
                  <div className="col-span-3 flex items-center">Created</div>
                  <div className="col-span-3 text-right flex items-center justify-end">
                    Actions
                  </div>
                </div>
                <div className="space-y-4">
                  {workflows.map(workflow => (
                    <div
                      key={workflow.id}
                      className="cursor-pointer hover:bg-blue-500/5 hover:shadow-lg hover:shadow-blue-500/10 transition-all group rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm flex items-center"
                      style={{
                        minHeight: '100px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                      }}
                      onClick={() => navigate(`/workflows/edit/${workflow.id}`)}
                    >
                      <div className="grid grid-cols-12 gap-4 w-full py-7 px-8">
                        <div className="col-span-4 flex items-center">
                          <div className="flex items-center gap-4">
                            <div className="p-3.5 rounded-xl bg-gradient-to-br from-blue-500/15 to-purple-600/15 border border-blue-500/25 group-hover:border-blue-500/50 group-hover:from-blue-500/25 group-hover:to-purple-600/25 transition-all shadow-sm flex items-center justify-center">
                              <Phone className="w-7 h-7 text-blue-400" />
                            </div>
                            <span className="font-semibold text-lg flex items-center">
                              {workflow.name || 'Unnamed Workflow'}
                            </span>
                          </div>
                        </div>
                        <div className="col-span-2 flex items-center justify-start">
                          <Badge
                            variant={
                              workflow.is_active ? 'default' : 'secondary'
                            }
                            className={`gap-2.5 px-4 py-2 text-base flex items-center ${
                              workflow.is_active
                                ? 'bg-green-500/20 border-green-500/30 text-green-300'
                                : 'bg-gray-500/20 border-gray-500/30 text-gray-400'
                            }`}
                          >
                            {workflow.is_active ? (
                              <CheckCircle className="w-5 h-5 text-green-400" />
                            ) : (
                              <XCircle className="w-5 h-5 text-gray-400" />
                            )}
                            <span className="flex items-center">
                              {workflow.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </Badge>
                        </div>
                        <div className="col-span-3 text-muted-foreground text-lg flex items-center">
                          {workflow.created_at
                            ? new Date(workflow.created_at).toLocaleDateString()
                            : '-'}
                        </div>
                        <div className="col-span-3 text-right flex items-center justify-end">
                          <div
                            className="flex items-center justify-end gap-3"
                            onClick={e => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="default"
                              onClick={e => handleToggleActive(workflow, e)}
                              className="gap-2.5 hover:scale-105 hover:bg-blue-500/10 hover:text-blue-300 transition-all px-5 py-2.5 text-base flex items-center"
                            >
                              <Power className="w-6 h-6" />
                              <span className="flex items-center">
                                {workflow.is_active ? 'Deactivate' : 'Activate'}
                              </span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="default"
                              onClick={e => handleDeleteClick(workflow.id, e)}
                              className="gap-2.5 text-destructive hover:scale-105 hover:bg-red-500/10 transition-all px-5 py-2.5 text-base flex items-center"
                            >
                              <Trash2 className="w-6 h-6" />
                              <span className="flex items-center">Delete</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              workflow.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  return (
    <WorkflowCanvasTabs activeTab="call">
      <PageContainer>{listContent}</PageContainer>
    </WorkflowCanvasTabs>
  );
}

export default WorkflowList;
