import { useEffect } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';

/**
 * OAuth Callback Page
 * This page is opened in a popup window after OAuth flow completes.
 * It sends a message to the parent window and then closes itself.
 */
export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { integrationType } = useParams(); // e.g., 'google-sheets'
  
  const success = searchParams.get('success') === 'true';
  const error = searchParams.get('error');
  const returnUrl = searchParams.get('returnUrl') || '/fullWorkflows';

  useEffect(() => {
    // Send message to parent window immediately
    if (window.opener && !window.opener.closed) {
      console.log('OAuth callback: Sending message to parent', { success, integrationType });
      
      if (success) {
        // Send success message to parent
        window.opener.postMessage(
          {
            type: 'GOOGLE_SHEETS_OAUTH_SUCCESS',
            integrationType,
            returnUrl,
          },
          window.location.origin
        );
      } else {
        // Send error message to parent
        window.opener.postMessage(
          {
            type: 'GOOGLE_SHEETS_OAUTH_ERROR',
            integrationType,
            error: error || 'OAuth failed',
          },
          window.location.origin
        );
      }
      
      // Close popup immediately after sending message
      setTimeout(() => {
        console.log('OAuth callback: Closing popup');
        window.close();
        // Fallback: if close doesn't work, redirect to blank
        setTimeout(() => {
          if (!window.closed) {
            window.location.href = 'about:blank';
          }
        }, 200);
      }, 50);
    } else {
      // If no opener (not in popup), redirect normally
      console.log('OAuth callback: No opener, redirecting normally');
      if (success) {
        navigate(returnUrl);
      } else {
        navigate('/fullWorkflows?error=' + encodeURIComponent(error || 'OAuth failed'));
      }
    }
  }, [success, error, returnUrl, integrationType, navigate]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {success ? (
        <>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
          <h2 style={{ margin: 0, marginBottom: '0.5rem' }}>Connected Successfully!</h2>
          <p style={{ color: '#666', margin: 0 }}>Closing window...</p>
        </>
      ) : (
        <>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
          <h2 style={{ margin: 0, marginBottom: '0.5rem' }}>Connection Failed</h2>
          <p style={{ color: '#666', margin: 0 }}>{error || 'Unknown error'}</p>
          <p style={{ color: '#666', marginTop: '0.5rem', fontSize: '0.875rem' }}>Closing window...</p>
        </>
      )}
    </div>
  );
}

