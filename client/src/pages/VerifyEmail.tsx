import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const hasVerified = useRef(false);

  useEffect(() => {
    // Prevent duplicate verification in React Strict Mode
    if (hasVerified.current) return;
    hasVerified.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setStatus('error');
      setErrorMessage('No verification token provided');
      return;
    }

    // Verify token
    fetch(`/api/auth/verify-email?token=${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Store session
          localStorage.setItem('refreshToken', data.session.refreshToken);
          localStorage.setItem('sessionId', data.session.sessionId);
          localStorage.setItem('user', JSON.stringify(data.user));
          
          setStatus('success');
          
          // Invalidate auth query to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
          
          // Redirect based on role
          setTimeout(() => {
            const role = data.user.primaryRole;
            
            // Contractors and tenants have dedicated dashboards
            if (role === 'contractor') {
              window.location.href = '/contractor-dashboard';
            } else if (role === 'tenant') {
              window.location.href = '/tenant-dashboard-new';
            } else {
              // Platform admins, landlords, and property owners use the main dashboard
              window.location.href = '/dashboard';
            }
          }, 1000);
        } else {
          setStatus('error');
          setErrorMessage(data.error || 'Verification failed');
        }
      })
      .catch(error => {
        console.error('Verification error:', error);
        setStatus('error');
        setErrorMessage('Failed to verify email');
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Email Verification</CardTitle>
          <CardDescription>
            {status === 'verifying' && 'Verifying your email...'}
            {status === 'success' && 'Email verified successfully!'}
            {status === 'error' && 'Verification failed'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8">
            {status === 'verifying' && (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Please wait...</p>
              </>
            )}
            
            {status === 'success' && (
              <>
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                <p className="text-sm text-muted-foreground">Redirecting to your dashboard...</p>
              </>
            )}
            
            {status === 'error' && (
              <>
                <XCircle className="h-12 w-12 text-destructive mb-4" />
                <p className="text-sm text-muted-foreground mb-4">{errorMessage}</p>
                <Button onClick={() => setLocation('/login')} data-testid="button-back-to-login">
                  Back to Login
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
