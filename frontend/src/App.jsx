// Main App component with routing
// TODO: Implement full routing and layout

import { DashboardHeader } from '@/components/dashboard-header';
import { WalletDashboard } from '@/components/wallet-dashboard';

function App() {
  const mockToken = "mock-auth-token";

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">My Wallet</h1>
          <p className="mt-1 text-muted-foreground">Manage your funds and transactions</p>
        </div>
        <WalletDashboard token={mockToken} />
      </main>
    </div>
  );
}

export default App;
