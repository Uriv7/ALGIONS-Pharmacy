import React, { useState, useEffect } from 'react';
import { TopBar } from './components/TopBar.js';
import { NavigationRail, ActiveScreen } from './components/NavigationRail.js';
import { POSScreen } from './screens/POSScreen.js';
import { MedicineSearchScreen } from './screens/MedicineSearchScreen.js';
import { StockCheckScreen } from './screens/StockCheckScreen.js';
import { PurchaseEntryScreen } from './screens/PurchaseEntryScreen.js';
import { InvoiceListScreen } from './screens/InvoiceListScreen.js';
import { OwnerDashboardScreen } from './screens/OwnerDashboardScreen.js';
import { ExceptionsScreen } from './screens/ExceptionsScreen.js';
import { StaffManagementScreen } from './screens/StaffManagementScreen.js';
import { CustomerManagementScreen } from './screens/CustomerManagementScreen.js';
import { ExpiryManagementScreen } from './screens/ExpiryManagementScreen.js';
import { AccountingGstScreen } from './screens/AccountingGstScreen.js';
import { StoreControlScreen } from './screens/StoreControlScreen.js';
import { LockScreen } from './components/LockScreen.js';
import { ReceiptPrintDialog } from './components/dialogs/ReceiptPrintDialog.js';
import { FullWidthBanner } from '@algions/ui';
import { api } from './api/client.js';
import { offlineEngine } from './offline/engine.js';
import { AuthSessionUser } from '@algions/contracts';
import { LogIn, KeyRound } from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [storeStatus, setStoreStatus] = useState<any | null>(null);
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('POS');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [heldBillsCount, setHeldBillsCount] = useState<number>(0);

  // Login form state
  const [username, setUsername] = useState('staff1');
  const [password, setPassword] = useState('Staff@Algions2026!');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [requiresMfa, setRequiresMfa] = useState<boolean>(false);
  const [mfaToken, setMfaToken] = useState<string>('');
  const [mfaCode, setMfaCode] = useState<string>('');

  // Reprint Dialog
  const [reprintInvoice, setReprintInvoice] = useState<any | null>(null);

  // Initial load
  useEffect(() => {
    const initStore = async () => {
      try {
        const status = await api.getStoreStatus();
        setStoreStatus(status);
      } catch (err) {
        console.error('Store status error:', err);
      }
    };
    initStore();

    // Heartbeat every 15s per TAD Section 6
    const heartbeatTimer = setInterval(async () => {
      if (!isOffline) {
        try {
          await api.sendHeartbeat(Date.now());
        } catch {
          // offline detected
        }
      }
    }, 15000);

    return () => clearInterval(heartbeatTimer);
  }, [isOffline]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await api.login(username, password);
      if (res.requiresMfa) {
        setRequiresMfa(true);
        setMfaToken(res.tempToken || '');
      } else {
        setUser(res.user);
      }
    } catch (err: any) {
      setLoginError(err.message || 'Login failed. Check credentials.');
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.verifyMfa(mfaToken, mfaCode);
      setUser(res.user);
      setRequiresMfa(false);
    } catch (err: any) {
      setLoginError(err.message || 'Invalid MFA Code.');
    }
  };

  // Quick Unlock PIN
  const handleQuickUnlock = async (pin: string): Promise<boolean> => {
    try {
      const res = await api.quickUnlock(pin);
      setUser(res.user);
      setIsLocked(false);
      return true;
    } catch {
      return false;
    }
  };

  // Toggle Offline Simulation (demonstrates failover & local commit)
  const handleToggleOffline = () => {
    const nextState = !isOffline;
    setIsOffline(nextState);
    offlineEngine.setOfflineMode(nextState);
  };

  // Trigger sync
  const handleTriggerSync = async () => {
    const result = await offlineEngine.triggerSync();
    setPendingSyncCount(result.remainingCount);
  };

  if (!user) {
    return (
      <div className="h-screen w-screen bg-slate-900 flex items-center justify-center p-4 select-none">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm border border-slate-100">
          <div className="w-12 h-12 bg-teal-600 rounded-xl flex items-center justify-center text-white font-black text-xl mx-auto mb-4 shadow-md">
            A
          </div>
          <h1 className="text-xl font-bold text-center text-slate-800">ALGIONS Pharmacy</h1>
          <p className="text-xs text-center text-slate-500 mt-1 mb-6">
            Sign in to start counter billing session
          </p>

          {loginError && (
            <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700">
              {loginError}
            </div>
          )}

          {!requiresMfa ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
                  required
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold rounded-lg text-xs shadow-md transition flex items-center justify-center gap-1.5"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </button>
              </div>

              <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 text-center">
                Demo Accounts:<br />
                <span className="font-semibold text-slate-600">Staff:</span> staff1 / Staff@Algions2026! (PIN: 1234)<br />
                <span className="font-semibold text-slate-600">Owner:</span> owner / Owner@Algions2026! (MFA: 123456)
              </div>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit} className="space-y-3">
              <div className="text-xs text-slate-600 mb-2">
                Owner account requires 6-digit TOTP verification code.
              </div>
              <div>
                <input
                  type="text"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="Enter 6-digit code (e.g. 123456)"
                  className="w-full px-3 py-2 text-center tracking-widest font-mono text-lg bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 font-bold"
                  autoFocus
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-xs shadow transition flex items-center justify-center gap-1.5"
              >
                <KeyRound className="w-4 h-4" />
                <span>Verify & Enter</span>
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 overflow-hidden select-none">
      {/* Top Application Bar */}
      <TopBar
        user={user}
        storeName={storeStatus?.name || 'ALGIONS Health Pharmacy'}
        storeMode={storeStatus?.activeMode || 'ONLINE'}
        isOffline={isOffline}
        isPrimary={true}
        pendingSyncCount={pendingSyncCount}
        lastHeartbeatTime={storeStatus?.serverTime || null}
        onToggleOfflineSimulator={handleToggleOffline}
        onTriggerSync={handleTriggerSync}
        onLock={() => setIsLocked(true)}
      />

      {/* Offline Mode Banner per FES Section 4 */}
      {isOffline && (
        <FullWidthBanner
          type="CUSTOM"
          customTitle="OFFLINE BILLING ACTIVE (PRIMARY WORKSTATION)"
          customMessage="Transactions will be saved securely to local SQLite outbox and synchronized automatically once network is restored."
        />
      )}

      {/* Main Layout: Navigation Rail + Active Screen Content */}
      <div className="flex-1 flex overflow-hidden">
        <NavigationRail
          activeScreen={activeScreen}
          accountType={user.accountType}
          heldBillsCount={heldBillsCount}
          exceptionsCount={storeStatus?.pendingExceptionsCount || 0}
          onSelectScreen={setActiveScreen}
        />

        {activeScreen === 'POS' && (
          <POSScreen
            user={user}
            isOffline={isOffline}
            storeProfile={storeStatus}
            onRefreshSyncCount={() => setPendingSyncCount(offlineEngine.getPendingCount())}
          />
        )}

        {activeScreen === 'SEARCH' && (
          <MedicineSearchScreen
            onSelectItemForBilling={(prod, batch) => {
              setActiveScreen('POS');
            }}
          />
        )}

        {activeScreen === 'STOCK' && <StockCheckScreen />}

        {activeScreen === 'PURCHASES' && (
          <PurchaseEntryScreen onSuccess={() => setActiveScreen('STOCK')} />
        )}

        {activeScreen === 'INVOICES' && (
          <InvoiceListScreen
            user={user}
            onReprintInvoice={async (id) => {
              const inv = await api.getInvoice(id);
              setReprintInvoice(inv);
            }}
          />
        )}

        {activeScreen === 'CUSTOMERS' && <CustomerManagementScreen />}

        {activeScreen === 'EXPIRY' && <ExpiryManagementScreen user={user} />}

        {activeScreen === 'HELD' && (
          <POSScreen
            user={user}
            isOffline={isOffline}
            storeProfile={storeStatus}
            onRefreshSyncCount={() => setPendingSyncCount(offlineEngine.getPendingCount())}
          />
        )}

        {activeScreen === 'DASHBOARD' && <OwnerDashboardScreen />}

        {activeScreen === 'GST' && <AccountingGstScreen />}

        {activeScreen === 'EXCEPTIONS' && <ExceptionsScreen />}

        {activeScreen === 'STAFF' && <StaffManagementScreen />}

        {activeScreen === 'SYSTEM' && (
          <StoreControlScreen
            user={user}
            isOffline={isOffline}
            onToggleOffline={handleToggleOffline}
          />
        )}
      </div>

      {/* Quick Lock Screen Modal (A2) */}
      {isLocked && (
        <LockScreen
          user={user}
          onUnlock={handleQuickUnlock}
          onFullLogout={() => {
            setUser(null);
            setIsLocked(false);
            api.clearToken();
          }}
        />
      )}

      {/* Reprint Modal */}
      {reprintInvoice && (
        <ReceiptPrintDialog
          invoice={reprintInvoice}
          store={storeStatus}
          onClose={() => setReprintInvoice(null)}
        />
      )}
    </div>
  );
};
