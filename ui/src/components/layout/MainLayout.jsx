import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Workflow,
  Sparkles,
  User,
  ChevronDown,
  Settings,
  LogOut,
} from 'lucide-react';
import logoChain from '@/lib/assets/Logo-Chain_pixian_ai.png';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function MainLayout({ children }) {
  const location = useLocation();
  const isAuthPage =
    location.pathname === '/login' || location.pathname === '/register';

  const isEditorRoute =
    /^\/fullWorkflows\/(edit\/[^/]+|new)$/.test(location.pathname) ||
    /^\/workflows\/(edit\/[^/]+|new)$/.test(location.pathname);

  // Update canonical URL on route change
  React.useEffect(() => {
    const canonicalLink = document.getElementById('canonical-link');
    if (canonicalLink) {
      canonicalLink.href = window.location.href.split('?')[0]; // Remove query params
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Optional: CSRF-Token Cookie löschen (falls vorhanden)
        document.cookie =
          'csrf-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

        // Redirect zu Login
        window.location.href = '/login';
      } else {
        console.error('Logout failed');
        // Fallback: Trotzdem redirecten
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Fallback: Redirect
      window.location.href = '/login';
    }
  };

  if (isAuthPage) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    <div
      className="min-h-screen bg-background"
      style={{ overflowX: 'hidden', width: '100%', maxWidth: '100vw' }}
    >
      {/* Glassmorphism Header */}
      <nav
        className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60"
        style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}
      >
        <div className="w-full flex justify-center">
          <div
            className="w-full max-w-[1400px] px-8 py-6 flex items-center justify-between"
            style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}
          >
            {/* Logo + Brand */}
            <Link
              to="/choose"
              className="flex items-center gap-4 group transition-transform hover:scale-105"
            >
              <div className="relative">
                <img
                  src={logoChain}
                  alt="NodeChain Logo"
                  className="w-16 h-16 object-contain"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-lg blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                NodeChain
              </span>
            </Link>

            {/* Navigation */}
            <div className="flex items-center gap-4">
              <Link to="/fullWorkflows">
                <Button
                  variant="ghost"
                  size="default"
                  className="gap-2 hover:bg-accent/50 transition-all hover:scale-105 text-base"
                >
                  <Workflow className="w-5 h-5" />
                  Workflows
                </Button>
              </Link>
              <Link to="/test-openai">
                <Button
                  variant="outline"
                  size="default"
                  className="gap-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all hover:scale-105 text-base"
                >
                  <Sparkles className="w-5 h-5" />
                  Test Page
                </Button>
              </Link>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="default"
                    className="gap-2 hover:bg-accent/50 text-base"
                  >
                    <User className="w-5 h-5" />
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    className="gap-2 text-destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>
      <main
        className="w-full flex justify-center pt-20 pb-8"
        style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}
      >
        {isEditorRoute ? (
          <div className="w-full flex-1">{children}</div>
        ) : (
          <div className="w-full max-w-[1400px] px-8">{children}</div>
        )}
      </main>
    </div>
  );
}
