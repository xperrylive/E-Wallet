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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
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
        const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: displayName, first_name: firstName.trim(), last_name: lastName.trim() },
            emailRedirectTo: undefined,
          }
        });
        if (error) throw error;

        if (data.session) {
          // Email confirmation disabled — immediately signed in
          return;
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setMessage('Account created! Please check your inbox to confirm your email, then sign in.');
        }
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
            {isSignUp && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First Name</Label>
                  <Input
                    id="first-name"
                    type="text"
                    placeholder="Ahmad"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required={isSignUp}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last Name</Label>
                  <Input
                    id="last-name"
                    type="text"
                    placeholder="Razak"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>
            )}
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
              <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</p>
            )}
            {message && (
              <p className="text-sm text-primary bg-primary/10 p-3 rounded-md">{message}</p>
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

  useEffect(() => {
    if (!session) return;

    const ensureWallet = async () => {
      try {
        // Pull display_name from Supabase user metadata
        const meta = session.user?.user_metadata || {};
        const displayName = meta.full_name || meta.name || meta.email?.split('@')[0] || '';
        await createWallet('MYR', displayName);
      } catch (err) {
        // Wallet already exists — fine, dashboard will load it
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

  const meta = session.user?.user_metadata || {};
  const fullName = meta.full_name || meta.name || meta.email?.split('@')[0] || 'there';
  const firstName = fullName.split(' ')[0];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {greeting}, {firstName}! 👋
            </h1>
            <p className="mt-1 text-muted-foreground">Here&apos;s your wallet overview</p>
          </div>
          <Button
            variant="outline"
            size="sm"
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
