import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PageContainer from '@/components/layout/PageContainer';

function ChooseWorkflowType() {
  const navigate = useNavigate();

  return (
    <PageContainer>
      <div className="min-h-[80vh] flex items-center justify-center py-12">
        <div className="w-full max-w-4xl space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold">Choose Workflow Type</h1>
            <p className="text-xl text-muted-foreground">
              Select the type of workflow you want to create
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Call Flow Card */}
            <Card
              className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 border-2 hover:border-primary"
              onClick={() => navigate('/workflows')}
            >
              <CardHeader>
                <div className="text-6xl mb-4">📞</div>
                <CardTitle className="text-2xl">Call Flow</CardTitle>
                <CardDescription className="text-base">
                  Create conversational workflows for phone calls
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-6">
                  Define what the AI agent says during the conversation, including steps,
                  conditions, and responses.
                </p>
                <Button className="w-full" variant="default">
                  Create Call Flow →
                </Button>
              </CardContent>
            </Card>

            {/* Full Workflow Card */}
            <Card
              className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 border-2 hover:border-primary"
              onClick={() => navigate('/fullWorkflows')}
            >
              <CardHeader>
                <div className="text-6xl mb-4">⚙️</div>
                <CardTitle className="text-2xl">Full Workflow</CardTitle>
                <CardDescription className="text-base">
                  Create complete automation workflows
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-6">
                  Connect multiple services with webhooks, HTTP requests, database queries,
                  and more. Automate complex processes.
                </p>
                <Button className="w-full" variant="default">
                  Create Full Workflow →
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

export default ChooseWorkflowType;
