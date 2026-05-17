import { useState, useEffect } from 'react';
import { DashboardHeader } from '@/components/dashboard-header';
import { WalletDashboard } from '@/components/wallet-dashboard';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { supabase } from '@/services/supabase';
import { createWallet } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // Skip email confirmation for demo/local use
            emailRedirectTo: undefined,
          }
        });
        if (error) throw error;

        // If session is returned immediately, email confirmation is disabled — good!
        if (data.session) {
          // Already logged in, App will re-render
          return;
        }

        // If no session, email confirmation is required
        // Auto-sign in if possible
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          // Email confirmation is required
          setMessage('Account created! Since email confirmation is enabled, please check your inbox or contact the admin to disable it in Supabase Dashboard → Auth → Email.');
        }
        // If sign in worked, session update handled by auth listener
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">E-Wallet</CardTitle>
          <CardDescription>
            {isSignUp ? 'Create a new account' : 'Sign in to your account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-3 rounded-md">{error}</p>
            )}
            {message && (
              <p className="text-sm text-blue-600 bg-blue-50 dark:bg-blue-950 p-3 rounded-md">{message}</p>
            )}
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
            </Button>
            <Button
              className="w-full"
              variant="ghost"
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage(''); }}
            >
              {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function AppContent({ session }) {
  const [walletReady, setWalletReady] = useState(false);

  // Auto-create wallet on first login so users never see "wallet not found"
  useEffect(() => {
    if (!session) return;

    const ensureWallet = async () => {
      try {
        await createWallet('MYR');
      } catch (err) {
        // Wallet already exists (WALLET_EXISTS error) or other error — that's fine
        // The dashboard will load the existing wallet
      } finally {
        setWalletReady(true);
      }
    };

    ensureWallet();
  }, [session?.user?.id]);

  if (!walletReady) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <main className="mx-auto max-w-2xl px-4 py-8">
          <div className="flex items-center justify-center py-20">
            <div className="text-muted-foreground">Setting up your wallet...</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">My Wallet</h1>
          <p className="mt-1 text-muted-foreground">Manage your funds and transactions</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => supabase.auth.signOut()}
          >
            Sign Out
          </Button>
        </div>
        <WalletDashboard token={session.access_token} />
      </main>
    </div>
  );
}

function App() {
  const { session, loading } = useSupabaseAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  if (!session) {
    return <Auth />;
  }

  return <AppContent session={session} />;
}

export default App;
