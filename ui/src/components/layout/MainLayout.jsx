import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function MainLayout({ children }) {
  const location = useLocation();
  const isAuthPage =
    location.pathname === '/login' || location.pathname === '/register';

  if (isAuthPage) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    <div
      className="min-h-screen bg-background"
      style={{ overflowX: 'hidden', width: '100%', maxWidth: '100vw' }}
    >
      <nav
        className="border-b border-border bg-card"
        style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}
      >
        <div
          className="container mx-auto px-4 py-3 flex items-center justify-between"
          style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}
        >
          <Link
            to="/choose"
            className="text-xl font-semibold text-foreground hover:text-primary transition-colors"
          >
            Workflow Builder
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/fullWorkflows">
              <Button variant="ghost" size="sm">
                Workflows
              </Button>
            </Link>
            <Link to="/test-openai">
              <Button variant="outline" size="sm">
                Test Page
              </Button>
            </Link>
          </div>
        </div>
      </nav>
      <main
        className="container mx-auto px-4 py-6"
        style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}
      >
        {children}
      </main>
    </div>
  );
}
