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
import { MedicineMasterScreen } from './screens/MedicineMasterScreen.js';
import { SupplierManagementScreen } from './screens/SupplierManagementScreen.js';
import { ReportsScreen } from './screens/ReportsScreen.js';
import { StaffDashboardScreen } from './screens/StaffDashboardScreen.js';
import { LockScreen } from './components/LockScreen.js';
import { ReceiptPrintDialog } from './components/dialogs/ReceiptPrintDialog.js';
import { FullWidthBanner } from '@algions/ui';
import { api } from './api/client.js';
import { offlineEngine } from './offline/engine.js';
import { AuthSessionUser } from '@algions/contracts';
import { LogIn, KeyRound, ShieldCheck, User, Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [storeStatus, setStoreStatus] = useState<any | null>(null);
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('POS');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [heldBillsCount, setHeldBillsCount] = useState<number>(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

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
        setMfaCode('123456'); // pre-fill demo TOTP for ease of testing
      } else {
        setUser(res.user);
        setActiveScreen(res.user.accountType === 'OWNER' ? 'DASHBOARD' : 'POS');
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
      setActiveScreen('DASHBOARD');
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
            <form onSubmit={handleLogin} className="space-y-3.5">
              {/* Quick Auto-Fill Role Buttons */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
                  Quick Role Auto-Fill
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUsername('owner');
                      setPassword('Owner@Algions2026!');
                      setLoginError(null);
                    }}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      username === 'owner'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-600/20'
                        : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Auto-fill Owner</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUsername('staff1');
                      setPassword('Staff@Algions2026!');
                      setLoginError(null);
                    }}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      username === 'staff1'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-md ring-2 ring-teal-600/20'
                        : 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Auto-fill Staff</span>
                  </button>
                </div>
              </div>

              {/* Role Scope Badge */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                {username === 'owner' ? (
                  <div>
                    <div className="font-bold text-purple-800 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                      <span>Owner Permissions: 15 Feature Modules</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                      Dashboard, POS, Catalog, Inventory, Purchases, Suppliers, Customers, Accounting, GST, Reports, Staff, Settings, Devices, Backup/Sync, Mobile
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="font-bold text-teal-800 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-teal-600" />
                      <span>Staff Permissions: 10 Feature Modules</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                      Dashboard (Limited), POS Billing, Search, Customers, Purchases, Stock Check, Sales Returns, Profile, Own Billing, Activity History
                    </div>
                  </div>
                )}
              </div>

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
                  <span>Sign In as {username === 'owner' ? 'Owner' : 'Staff'}</span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 text-center">
                Demo Credentials: <span className="font-semibold text-slate-600">owner</span> (MFA 123456) • <span className="font-semibold text-slate-600">staff1</span> (PIN 1234)
              </div>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit} className="space-y-3.5">
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
                type="button"
                onClick={() => setMfaCode('123456')}
                className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition"
              >
                Auto-fill Code: 123456
              </button>
              <button
                type="submit"
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-xs shadow transition flex items-center justify-center gap-1.5"
              >
                <KeyRound className="w-4 h-4" />
                <span>Verify & Enter</span>
              </button>
              <button
                type="button"
                onClick={() => setRequiresMfa(false)}
                className="w-full py-1 text-slate-400 hover:text-slate-600 text-xs text-center"
              >
                Back to Login
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
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
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
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
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

        {activeScreen === 'STOCK' && <StockCheckScreen user={user} />}

        {activeScreen === 'MEDICINES' && (
          user.accountType === 'OWNER' ? (
            <MedicineMasterScreen user={user} />
          ) : (
            <MedicineSearchScreen onSelectItemForBilling={() => setActiveScreen('POS')} />
          )
        )}

        {activeScreen === 'PURCHASES' && (
          <PurchaseEntryScreen user={user} onSuccess={() => setActiveScreen('STOCK')} />
        )}

        {activeScreen === 'SUPPLIERS' && (
          user.accountType === 'OWNER' ? (
            <SupplierManagementScreen user={user} />
          ) : (
            <PurchaseEntryScreen user={user} onSuccess={() => setActiveScreen('STOCK')} />
          )
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

        {activeScreen === 'CUSTOMERS' && <CustomerManagementScreen user={user} />}

        {activeScreen === 'EXPIRY' && <ExpiryManagementScreen user={user} />}

        {activeScreen === 'HELD' && (
          <POSScreen
            user={user}
            isOffline={isOffline}
            storeProfile={storeStatus}
            onRefreshSyncCount={() => setPendingSyncCount(offlineEngine.getPendingCount())}
          />
        )}

        {activeScreen === 'STAFF_DASHBOARD' && (
          <StaffDashboardScreen
            user={user}
            onNavigate={setActiveScreen}
            onReprintInvoice={(inv) => setReprintInvoice(inv)}
          />
        )}

        {activeScreen === 'DASHBOARD' && (
          user.accountType === 'STAFF' ? (
            <StaffDashboardScreen
              user={user}
              onNavigate={setActiveScreen}
              onReprintInvoice={(inv) => setReprintInvoice(inv)}
            />
          ) : (
            <OwnerDashboardScreen />
          )
        )}

        {activeScreen === 'REPORTS' && (
          user.accountType === 'OWNER' ? (
            <ReportsScreen />
          ) : (
            <StaffDashboardScreen
              user={user}
              onNavigate={setActiveScreen}
              onReprintInvoice={(inv) => setReprintInvoice(inv)}
            />
          )
        )}

        {activeScreen === 'GST' && (
          user.accountType === 'OWNER' ? (
            <AccountingGstScreen />
          ) : (
            <StaffDashboardScreen
              user={user}
              onNavigate={setActiveScreen}
              onReprintInvoice={(inv) => setReprintInvoice(inv)}
            />
          )
        )}

        {activeScreen === 'EXCEPTIONS' && (
          user.accountType === 'OWNER' ? (
            <ExceptionsScreen />
          ) : (
            <StaffDashboardScreen
              user={user}
              onNavigate={setActiveScreen}
              onReprintInvoice={(inv) => setReprintInvoice(inv)}
            />
          )
        )}

        {activeScreen === 'STAFF' && (
          user.accountType === 'OWNER' ? (
            <StaffManagementScreen />
          ) : (
            <StaffDashboardScreen
              user={user}
              onNavigate={setActiveScreen}
              onReprintInvoice={(inv) => setReprintInvoice(inv)}
            />
          )
        )}

        {activeScreen === 'SYSTEM' && (
          user.accountType === 'OWNER' ? (
            <StoreControlScreen
              user={user}
              isOffline={isOffline}
              onToggleOffline={handleToggleOffline}
            />
          ) : (
            <StaffDashboardScreen
              user={user}
              onNavigate={setActiveScreen}
              onReprintInvoice={(inv) => setReprintInvoice(inv)}
            />
          )
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
